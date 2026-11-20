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
    // ignore write failure
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

function readAdminSavedBybitFallback(): { apiKey: string; secret: string } | null {
  try {
    const candidates = [
      path.join(os.tmpdir(), '.saloma-apis.json'),
      path.resolve(process.cwd(), '.saloma-apis.json')
    ];
    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as {
        providers?: { bybit?: { apiKey?: string; secret?: string } };
      };
      const k = stripWrappingQuotes(parsed?.providers?.bybit?.apiKey).trim();
      const s = stripWrappingQuotes(parsed?.providers?.bybit?.secret).trim();
      if (k && s) return { apiKey: k, secret: s };
    }
  } catch {
    // ignore fallback file read errors
  }
  return null;
}

type BybitWalletResp = {
  retCode?: number;
  retMsg?: string;
  result?: {
    list?: Array<{
      totalWalletBalance?: string;
      coin?: Array<{ coin?: string; walletBalance?: string; equity?: string }>;
    }>;
  };
};

async function fetchBybitServerTimestamp(
  baseUrl: string,
  signal: AbortSignal
): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/v5/market/time`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SalomaTradingPlatform/1.0'
      },
      signal
    });
    const text = await res.text();
    const parsed = text ? (JSON.parse(text) as { retCode?: number; time?: number; result?: { timeSecond?: string } }) : null;
    if (parsed?.retCode === 0) {
      if (typeof parsed.time === 'number' && parsed.time > 0) {
        return String(parsed.time);
      }
      if (parsed.result?.timeSecond) {
        return String(Number(parsed.result.timeSecond) * 1000);
      }
    }
  } catch {
    // fallback to local clock
  }
  return Date.now().toString();
}

export async function testBybitMainnetConnection(
  apiKey: string,
  apiSecret: string
): Promise<{
  connected: boolean;
  usdtBalance: number;
  retCode?: number;
  retMsg?: string;
  httpStatus?: number;
  endpoint?: string;
  error?: string;
  message?: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const domains = ['https://api.bybit.com', 'https://api.bytick.com'];
    const recvWindow = '10000';
    let lastHttpStatus = 0;
    let lastRetCode: number | undefined;
    let lastRetMsg = '';
    let lastEndpoint = '';
    let lastError = 'Erreur connexion Bybit.';

    for (const baseUrl of domains) {
      const serverTs = await fetchBybitServerTimestamp(baseUrl, controller.signal);

      const callBybitGet = async (
        endpointPath: string,
        queryString: string
      ): Promise<{
        ok: boolean;
        httpStatus: number;
        data: BybitWalletResp | null;
        rawSnippet: string;
        endpoint: string;
      }> => {
        const timestamp = serverTs || Date.now().toString();
        const prehash = `${timestamp}${apiKey}${recvWindow}${queryString}`;
        const sign = crypto.createHmac('sha256', apiSecret).update(prehash).digest('hex');
        const fullUrl = queryString
          ? `${baseUrl}${endpointPath}?${queryString}`
          : `${baseUrl}${endpointPath}`;

        const r = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'X-BAPI-API-KEY': apiKey,
            'X-BAPI-SIGN': sign,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': recvWindow,
            Accept: 'application/json',
            'User-Agent': 'SalomaTradingPlatform/1.0'
          },
          signal: controller.signal
        });

        const rawText = await r.text();
        let data: BybitWalletResp | null = null;
        try {
          data = rawText ? (JSON.parse(rawText) as BybitWalletResp) : null;
        } catch {
          data = null;
        }

        console.log('[SALOMA Bybit V5 Check]', {
          endpoint: fullUrl,
          httpStatus: r.status,
          retCode: data?.retCode,
          retMsg: data?.retMsg,
          bodySnippet: data ? undefined : rawText.slice(0, 220)
        });

        return {
          ok: r.ok,
          httpStatus: r.status,
          data,
          rawSnippet: rawText.slice(0, 220),
          endpoint: fullUrl
        };
      };

      const attempts = [
        await callBybitGet('/v5/account/wallet-balance', 'accountType=UNIFIED')
      ];
      if (!attempts[0].ok || attempts[0].data?.retCode !== 0) {
        if (attempts[0].httpStatus !== 403 || attempts[0].data) {
          attempts.push(await callBybitGet('/v5/account/wallet-balance', 'accountType=SPOT'));
        }
      }

      for (const att of attempts) {
        lastHttpStatus = att.httpStatus;
        lastEndpoint = att.endpoint;
        if (att.data) {
          lastRetCode = att.data.retCode;
          lastRetMsg = String(att.data.retMsg || '');
        }
        if (att.ok && att.data && att.data.retCode === 0) {
          const list = att.data.result?.list || [];
          let usdt = 0;
          for (const acc of list) {
            const usdtCoin = (acc.coin || []).find(
              c => String(c.coin || '').toUpperCase() === 'USDT'
            );
            if (usdtCoin) {
              usdt += Number(usdtCoin.walletBalance || usdtCoin.equity || 0) || 0;
            } else if (acc.totalWalletBalance) {
              usdt += Number(acc.totalWalletBalance) || 0;
            }
          }
          return {
            connected: true,
            usdtBalance: Number(usdt.toFixed(4)),
            retCode: 0,
            retMsg: 'OK',
            httpStatus: att.httpStatus,
            endpoint: att.endpoint
          };
        }
      }

      // Fallback check on /v5/account/info when JSON responded with accountType error
      const firstAtt = attempts[0];
      if (firstAtt.data && firstAtt.data.retCode !== 10003 && firstAtt.data.retCode !== 10004) {
        const infoAtt = await callBybitGet('/v5/account/info', '');
        lastHttpStatus = infoAtt.httpStatus;
        lastEndpoint = infoAtt.endpoint;
        if (infoAtt.data) {
          lastRetCode = infoAtt.data.retCode;
          lastRetMsg = String(infoAtt.data.retMsg || '');
        }
        if (infoAtt.ok && infoAtt.data && infoAtt.data.retCode === 0) {
          return {
            connected: true,
            usdtBalance: 0,
            retCode: 0,
            retMsg: 'OK',
            httpStatus: infoAtt.httpStatus,
            endpoint: infoAtt.endpoint
          };
        }
      }

      if (lastRetMsg) {
        lastError = `Bybit (${lastRetCode ?? lastHttpStatus}): ${lastRetMsg}`;
        break; // Got genuine Bybit API JSON error — no need to switch CDN domain
      }
      if (lastHttpStatus === 403) {
        lastError =
          'HTTP 403 CloudFront/WAF — Vérifiez que la fonction Vercel est en région Europe (fra1) et que la clé Mainnet est active.';
      } else {
        lastError = `Réponse Bybit invalide (HTTP ${lastHttpStatus || 'réseau'}).`;
      }
    }

    console.error('[SALOMA /api/bybit/status] Échec connexion Bybit:', {
      httpStatus: lastHttpStatus,
      retCode: lastRetCode,
      retMsg: lastRetMsg,
      endpoint: lastEndpoint,
      lastError
    });

    return {
      connected: false,
      usdtBalance: 0,
      retCode: lastRetCode,
      retMsg: lastRetMsg || undefined,
      httpStatus: lastHttpStatus,
      endpoint: lastEndpoint,
      error: lastError,
      message: lastError
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur réseau Bybit.';
    console.error('[SALOMA /api/bybit/status] Exception:', err);
    return {
      connected: false,
      usdtBalance: 0,
      error: msg,
      message: msg
    };
  } finally {
    clearTimeout(timer);
  }
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
    const hasFormCreds =
      Boolean(bodyKey) &&
      Boolean(bodySecret) &&
      !bodyKey.includes('****') &&
      !/^\*+$/.test(bodySecret);

    const envKey = stripWrappingQuotes(process.env.BYBIT_API_KEY).trim();
    const envSecret = stripWrappingQuotes(process.env.BYBIT_API_SECRET).trim();

    let apiKey = '';
    let apiSecret = '';
    let source: 'admin_form' | 'vercel_env' | 'admin_saved' | 'none' = 'none';

    if (hasFormCreds) {
      apiKey = bodyKey;
      apiSecret = bodySecret;
      source = 'admin_form';
    } else if (envKey && envSecret) {
      apiKey = envKey;
      apiSecret = envSecret;
      source = 'vercel_env';
    } else {
      const saved = readAdminSavedBybitFallback();
      if (saved) {
        apiKey = saved.apiKey;
        apiSecret = saved.secret;
        source = 'admin_saved';
      }
    }

    if (!apiKey || !apiSecret) {
      console.error(
        '[SALOMA /api/bybit/status] Clé manquante dans Vercel et champs formulaire vides.'
      );
      sendJson(res, 200, {
        sponsor: 'BYBIT',
        connected: false,
        usdtBalance: 0,
        source: 'none',
        error: 'Clé manquante dans Vercel',
        message: 'Clé manquante dans Vercel'
      });
      return;
    }

    const result = await testBybitMainnetConnection(apiKey, apiSecret);
    sendJson(res, 200, {
      sponsor: 'BYBIT',
      source,
      ...result
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur vérification statut Bybit.';
    console.error('[SALOMA /api/bybit/status] Erreur inattendue:', err);
    sendJson(res, 200, {
      sponsor: 'BYBIT',
      connected: false,
      usdtBalance: 0,
      source: 'none',
      error: msg,
      message: msg
    });
  }
}
