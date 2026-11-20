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
  return (
    stripWrappingQuotes(
      process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
    ) || '6af771140031749ce67c'
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

function readAdminSavedBinanceFallback(): { apiKey: string; secret: string } | null {
  try {
    const candidates = [
      path.join(os.tmpdir(), '.saloma-apis.json'),
      path.resolve(process.cwd(), '.saloma-apis.json')
    ];
    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as {
        providers?: { binance?: { apiKey?: string; secret?: string } };
      };
      const k = stripWrappingQuotes(parsed?.providers?.binance?.apiKey).trim();
      const s = stripWrappingQuotes(parsed?.providers?.binance?.secret).trim();
      if (k && s) return { apiKey: k, secret: s };
    }
  } catch {
    // ignore fallback read errors
  }
  return null;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const auth = verifyAdminHeaders(req);
    if (!auth.ok) {
      sendJson(res, 403, { error: auth.error });
      return;
    }

    const envKey = stripWrappingQuotes(process.env.BINANCE_API_KEY).trim();
    const envSecret = stripWrappingQuotes(process.env.BINANCE_API_SECRET).trim();

    let apiKey = envKey;
    let apiSecret = envSecret;
    let source: 'vercel_env' | 'admin_saved' | 'none' = 'none';

    if (apiKey && apiSecret) {
      source = 'vercel_env';
    } else {
      const saved = readAdminSavedBinanceFallback();
      if (saved) {
        apiKey = saved.apiKey;
        apiSecret = saved.secret;
        source = 'admin_saved';
      }
    }

    if (!apiKey || !apiSecret) {
      console.error('[SALOMA /api/binance/status] Clé manquante dans Vercel.');
      sendJson(res, 200, {
        sponsor: 'BINANCE',
        connected: false,
        usdtBalance: 0,
        source: 'none',
        error: 'Clé manquante dans Vercel',
        message: 'Clé manquante dans Vercel'
      });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);

    try {
      const ts = Date.now();
      const qs = `timestamp=${ts}&recvWindow=5000`;
      const sig = crypto.createHmac('sha256', apiSecret).update(qs).digest('hex');

      const r = await fetch(`https://api.binance.com/api/v3/account?${qs}&signature=${sig}`, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': apiKey
        },
        signal: controller.signal
      });

      type BinanceAccountResp = {
        code?: number;
        msg?: string;
        balances?: Array<{ asset?: string; free?: string; locked?: string }>;
      };

      const rawText = await r.text();
      let data: BinanceAccountResp | null = null;

      try {
        data = rawText ? (JSON.parse(rawText) as BinanceAccountResp) : null;
      } catch (parseErr) {
        console.error('[SALOMA /api/binance/status] Réponse Binance non-JSON:', {
          status: r.status,
          bodySnippet: rawText.slice(0, 300),
          parseError: parseErr instanceof Error ? parseErr.message : String(parseErr)
        });
      }

      if (!r.ok || !data || !Array.isArray(data.balances)) {
        const msg = data?.msg || `Erreur authentification Binance (HTTP ${r.status}).`;
        console.error('[SALOMA /api/binance/status] Échec vérification Binance:', msg);
        sendJson(res, 200, {
          sponsor: 'BINANCE',
          connected: false,
          usdtBalance: 0,
          source,
          error: msg,
          message: msg
        });
        return;
      }

      const usdtEntry = data.balances.find(b => String(b.asset || '').toUpperCase() === 'USDT');
      const usdt = usdtEntry
        ? (Number(usdtEntry.free || 0) || 0) + (Number(usdtEntry.locked || 0) || 0)
        : 0;

      sendJson(res, 200, {
        sponsor: 'BINANCE',
        connected: true,
        usdtBalance: Number(usdt.toFixed(4)),
        source
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Erreur réseau Binance.';
      console.error('[SALOMA /api/binance/status] Exception requête Binance:', fetchErr);
      sendJson(res, 200, {
        sponsor: 'BINANCE',
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
    const msg = err instanceof Error ? err.message : 'Erreur vérification statut Binance.';
    console.error('[SALOMA /api/binance/status] Erreur inattendue:', err);
    sendJson(res, 200, {
      sponsor: 'BINANCE',
      connected: false,
      usdtBalance: 0,
      source: 'none',
      error: msg,
      message: msg
    });
  }
}
