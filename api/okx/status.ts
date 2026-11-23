import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

function stripWrappingQuotes(raw: unknown): string {
  const s = String(raw || '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function getServerAdminEmail(): string {
  return stripWrappingQuotes(process.env.ADMIN_EMAIL).trim().toLowerCase();
}

function getServerAdminPin(): string {
  return stripWrappingQuotes(process.env.ADMIN_PIN).trim();
}

function getAppwriteProjectId(): string {
  return stripWrappingQuotes(
    process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
  );
}

function getAdminHmacSecret(email: string, pin: string): string {
  return crypto
    .createHash('sha256')
    .update(`${pin}:${getAppwriteProjectId()}:${email}:saloma-admin-sec-v2`)
    .digest('hex');
}

function verifySignedPayload<T extends Record<string, unknown>>(
  token: string,
  secret: string
): T | null {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, sig] = parts;
    if (!payloadB64 || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as T;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.exp === 'number' && parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  try {
    if (res.headersSent) return;
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(payload));
  } catch {
    // ignore response write failure
  }
}

async function readJsonBody(
  req: IncomingMessage & { body?: unknown }
): Promise<Record<string, unknown>> {
  try {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return req.body as Record<string, unknown>;
    }
    if (typeof req.body === 'string') {
      return req.body.trim() ? (JSON.parse(req.body) as Record<string, unknown>) : {};
    }
    if (Buffer.isBuffer(req.body)) {
      const txt = req.body.toString('utf8').trim();
      return txt ? (JSON.parse(txt) as Record<string, unknown>) : {};
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function verifyAdminHeaders(req: IncomingMessage): { ok: true } | { ok: false; error: string } {
  const configuredEmail = getServerAdminEmail();
  const configuredPin = getServerAdminPin();
  const pin = String(req.headers['x-admin-pin'] || '').trim();
  const email = String(req.headers['x-admin-email'] || '').trim().toLowerCase();
  const adminToken = String(req.headers['x-admin-token'] || '').trim();

  if (
    !configuredEmail ||
    !configuredPin ||
    !email ||
    email !== configuredEmail ||
    !/^\d{9}$/.test(pin) ||
    pin !== configuredPin
  ) {
    return {
      ok: false,
      error: 'Accès refusé. Email administrateur ou code à 9 chiffres incorrect.'
    };
  }

  const verifiedSess = verifySignedPayload<{
    kind?: string;
    email?: string;
    pinHash?: string;
    exp?: number;
  }>(adminToken, getAdminHmacSecret(configuredEmail, pin));
  const expectedPinHash = crypto.createHash('sha256').update(pin).digest('hex');

  if (
    !verifiedSess ||
    verifiedSess.kind !== 'admin-session' ||
    String(verifiedSess.email || '').trim().toLowerCase() !== configuredEmail ||
    verifiedSess.pinHash !== expectedPinHash
  ) {
    return {
      ok: false,
      error: 'Session administrateur expirée ou vérification email 6 chiffres requise.'
    };
  }

  return { ok: true };
}

function readAdminSavedOkxFallback(): { apiKey: string; secret: string; passphrase: string } | null {
  try {
    const candidates = [
      path.join(os.tmpdir(), '.saloma-apis.json'),
      path.resolve(process.cwd(), '.saloma-apis.json')
    ];
    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as {
        providers?: { okx?: { apiKey?: string; secret?: string; passphrase?: string } };
      };
      const k = stripWrappingQuotes(parsed?.providers?.okx?.apiKey).trim();
      const s = stripWrappingQuotes(parsed?.providers?.okx?.secret).trim();
      const p = stripWrappingQuotes(parsed?.providers?.okx?.passphrase).trim();
      if (k && s && p) return { apiKey: k, secret: s, passphrase: p };
    }
  } catch {
    // ignore fallback read errors
  }
  return null;
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  try {
    const auth = verifyAdminHeaders(req);
    if (!auth.ok) {
      sendJson(res, 403, { error: auth.error });
      return;
    }

    const body = req.method === 'POST' ? await readJsonBody(req) : {};
    const bodyKey = stripWrappingQuotes(body.apiKey).trim();
    const bodySecret = stripWrappingQuotes(body.secret).trim();
    const bodyPass = stripWrappingQuotes(body.passphrase).trim();
    const hasFormCreds =
      Boolean(bodyKey) &&
      Boolean(bodySecret) &&
      Boolean(bodyPass) &&
      !bodyKey.includes('****') &&
      !/^\*+$/.test(bodySecret) &&
      !/^\*+$/.test(bodyPass);

    const envKey = stripWrappingQuotes(process.env.OKX_API_KEY).trim();
    const envSecret = stripWrappingQuotes(process.env.OKX_API_SECRET).trim();
    const envPass = stripWrappingQuotes(
      process.env.OKX_PASSPHRASE || process.env.OKX_API_PASSPHRASE
    ).trim();

    let apiKey = '';
    let apiSecret = '';
    let passphrase = '';
    let source: 'admin_form' | 'vercel_env' | 'admin_saved' | 'none' = 'none';

    if (hasFormCreds) {
      apiKey = bodyKey;
      apiSecret = bodySecret;
      passphrase = bodyPass;
      source = 'admin_form';
    } else if (envKey && envSecret && envPass) {
      apiKey = envKey;
      apiSecret = envSecret;
      passphrase = envPass;
      source = 'vercel_env';
    } else {
      const saved = readAdminSavedOkxFallback();
      if (saved) {
        apiKey = saved.apiKey;
        apiSecret = saved.secret;
        passphrase = saved.passphrase;
        source = 'admin_saved';
      }
    }

    if (!apiKey || !apiSecret || !passphrase) {
      console.error('[SALOMA /api/okx/status] Clé manquante dans Vercel.');
      sendJson(res, 200, {
        sponsor: 'OKX',
        connected: false,
        usdtBalance: 0,
        source: 'none',
        error: 'Clé manquante dans Vercel',
        message: 'Clé manquante dans Vercel'
      });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const ts = new Date().toISOString();
      const requestPath = '/api/v5/account/balance';
      const prehash = `${ts}GET${requestPath}`;
      const sign = crypto.createHmac('sha256', apiSecret).update(prehash).digest('base64');

      const r = await fetch(`https://www.okx.com${requestPath}`, {
        method: 'GET',
        headers: {
          'OK-ACCESS-KEY': apiKey,
          'OK-ACCESS-SIGN': sign,
          'OK-ACCESS-TIMESTAMP': ts,
          'OK-ACCESS-PASSPHRASE': passphrase,
          Accept: 'application/json',
          'User-Agent': 'SalomaTradingPlatform/1.0'
        },
        signal: controller.signal
      });

      type OkxBalanceResp = {
        code?: string;
        msg?: string;
        data?: Array<{
          totalEq?: string;
          details?: Array<{ ccy?: string; cashBal?: string; eq?: string }>;
        }>;
      };

      const rawText = await r.text();
      let data: OkxBalanceResp | null = null;

      try {
        data = rawText ? (JSON.parse(rawText) as OkxBalanceResp) : null;
      } catch (parseErr) {
        console.error('[SALOMA /api/okx/status] Réponse OKX non-JSON:', {
          status: r.status,
          bodySnippet: rawText.slice(0, 300),
          parseError: parseErr instanceof Error ? parseErr.message : String(parseErr)
        });
      }

      if (!r.ok || !data || data.code !== '0') {
        const msg = data?.msg
          ? `OKX (${data.code ?? r.status}): ${data.msg}`
          : `Erreur authentification OKX (HTTP ${r.status}).`;
        console.error('[SALOMA /api/okx/status] Échec vérification OKX:', {
          httpStatus: r.status,
          code: data?.code,
          msg: data?.msg
        });
        sendJson(res, 200, {
          sponsor: 'OKX',
          connected: false,
          usdtBalance: 0,
          source,
          httpStatus: r.status,
          retMsg: data?.msg,
          error: msg,
          message: msg
        });
        return;
      }

      const first = data.data?.[0];
      const usdtRow = (first?.details || []).find(d => String(d.ccy || '').toUpperCase() === 'USDT');
      const usdt = usdtRow
        ? Number(usdtRow.cashBal || usdtRow.eq || 0) || 0
        : Number(first?.totalEq || 0) || 0;

      sendJson(res, 200, {
        sponsor: 'OKX',
        connected: true,
        usdtBalance: Number(usdt.toFixed(4)),
        source
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Erreur réseau OKX.';
      console.error('[SALOMA /api/okx/status] Exception requête OKX:', fetchErr);
      sendJson(res, 200, {
        sponsor: 'OKX',
        connected: false,
        usdtBalance: 0,
        source,
        error: msg,
        message: msg
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur vérification statut OKX.';
    console.error('[SALOMA /api/okx/status] Erreur inattendue:', err);
    sendJson(res, 200, {
      sponsor: 'OKX',
      connected: false,
      usdtBalance: 0,
      source: 'none',
      error: msg,
      message: msg
    });
  }
}
