import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

type ProviderId = 'bybit' | 'okx' | 'binance';

interface StoredProviderEntry {
  enabled: boolean;
  apiKey: string;
  secret: string;
  passphrase?: string;
  marginPct: number;
}

interface StoredApisConfig {
  primaryApi: ProviderId;
  providers: Record<ProviderId, StoredProviderEntry>;
  salomaFees: {
    bybitRecoveryMarginPct: number;
    tradeFeePct: number;
    exchangeFeePct: number;
    withdrawFeePct: number;
    networkFeeUsdt: number;
  };
}

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

function getConfigPath(): string {
  return path.join(os.tmpdir(), '.saloma-apis.json');
}

function loadStore(): StoredApisConfig {
  const base: StoredApisConfig = {
    primaryApi: 'bybit',
    providers: {
      bybit: {
        enabled: true,
        apiKey: stripWrappingQuotes(process.env.BYBIT_API_KEY).trim(),
        secret: stripWrappingQuotes(process.env.BYBIT_API_SECRET).trim(),
        marginPct: 0.1
      },
      okx: {
        enabled: false,
        apiKey: stripWrappingQuotes(process.env.OKX_API_KEY).trim(),
        secret: stripWrappingQuotes(process.env.OKX_API_SECRET).trim(),
        passphrase: stripWrappingQuotes(
          process.env.OKX_PASSPHRASE || process.env.OKX_API_PASSPHRASE
        ).trim(),
        marginPct: 0.1
      },
      binance: {
        enabled: false,
        apiKey: stripWrappingQuotes(process.env.BINANCE_API_KEY).trim(),
        secret: stripWrappingQuotes(process.env.BINANCE_API_SECRET).trim(),
        marginPct: 0.1
      }
    },
    salomaFees: {
      bybitRecoveryMarginPct: 0.1,
      tradeFeePct: 0.1,
      exchangeFeePct: 0.1,
      withdrawFeePct: 0.15,
      networkFeeUsdt: 0.5
    }
  };
  try {
    const filePath = getConfigPath();
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<StoredApisConfig>;
      if (parsed?.providers) {
        for (const id of ['bybit', 'okx', 'binance'] as const) {
          const p = parsed.providers[id];
          if (p) {
            base.providers[id] = {
              enabled: Boolean(p.enabled ?? base.providers[id].enabled),
              apiKey: String(base.providers[id].apiKey || p.apiKey || ''),
              secret: String(base.providers[id].secret || p.secret || ''),
              ...(id === 'okx'
                ? { passphrase: String(base.providers[id].passphrase || p.passphrase || '') }
                : {}),
              marginPct: Number.isFinite(Number(p.marginPct)) ? Number(p.marginPct) : 0.1
            };
          }
        }
      }
      if (parsed?.primaryApi === 'bybit' || parsed?.primaryApi === 'okx' || parsed?.primaryApi === 'binance') {
        base.primaryApi = parsed.primaryApi;
      }
      if (parsed?.salomaFees) {
        base.salomaFees = { ...base.salomaFees, ...parsed.salomaFees };
      }
    }
  } catch (err) {
    console.error('[SALOMA toggle] Erreur lecture store:', err);
  }
  return base;
}

function buildMaskedApis(store: StoredApisConfig) {
  const labels: Record<ProviderId, string> = { bybit: 'BYBIT', okx: 'OKX', binance: 'BINANCE' };
  const maskPreview = (val: string) => {
    const clean = val.trim();
    if (!clean) return '';
    if (clean.length <= 8) return '****';
    return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
  };
  return {
    primaryApi: store.primaryApi,
    providers: (['bybit', 'okx', 'binance'] as const).map(id => {
      const e = store.providers[id];
      return {
        id,
        label: labels[id],
        enabled: e.enabled,
        isPrimary: store.primaryApi === id,
        marginPct: e.marginPct,
        hasApiKey: Boolean(e.apiKey.trim()),
        apiKeyMasked: maskPreview(e.apiKey),
        hasSecret: Boolean(e.secret.trim()),
        secretMasked: e.secret.trim() ? '*'.repeat(16) : '',
        ...(id === 'okx'
          ? {
              hasPassphrase: Boolean((e.passphrase || '').trim()),
              passphraseMasked: (e.passphrase || '').trim() ? '*'.repeat(12) : ''
            }
          : {})
      };
    })
  };
}

function resolveProvider(
  req: IncomingMessage & { query?: Record<string, string | string[] | undefined>; url?: string }
): ProviderId | '' {
  const q = req.query?.provider;
  const rawQ = Array.isArray(q) ? q[0] : q;
  if (rawQ) {
    const c = String(rawQ).toLowerCase().trim();
    if (c === 'bybit' || c === 'okx' || c === 'binance') return c;
  }
  try {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    const m = pathname.match(/\/api\/admin\/apis\/(bybit|okx|binance)\/toggle\/?$/i);
    if (m?.[1]) return m[1].toLowerCase() as ProviderId;
  } catch {
    // ignore
  }
  return '';
}

async function checkBybitQuick(apiKey: string, apiSecret: string): Promise<{
  connected: boolean;
  usdtBalance: number;
  retCode?: number;
  retMsg?: string;
  error?: string;
}> {
  if (!apiKey || !apiSecret) {
    return { connected: false, usdtBalance: 0, error: 'Clé manquante dans Vercel' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7500);
  try {
    const domains = ['https://api.bybit.com', 'https://api.bytick.com'];
    const recvWindow = '10000';
    let lastError = 'Connexion BYBIT refusée.';
    let lastRetCode: number | undefined;
    let lastRetMsg = '';

    for (const baseUrl of domains) {
      let ts = Date.now().toString();
      try {
        const tRes = await fetch(`${baseUrl}/v5/market/time`, {
          headers: { Accept: 'application/json', 'User-Agent': 'SalomaTradingPlatform/1.0' },
          signal: controller.signal
        });
        const tJson = (await tRes.json().catch(() => null)) as { retCode?: number; time?: number } | null;
        if (tJson?.retCode === 0 && tJson.time) ts = String(tJson.time);
      } catch {
        // fallback local time
      }

      for (const accountType of ['UNIFIED', 'SPOT'] as const) {
        const qs = `accountType=${accountType}`;
        const sign = crypto
          .createHmac('sha256', apiSecret)
          .update(`${ts}${apiKey}${recvWindow}${qs}`)
          .digest('hex');
        const r = await fetch(`${baseUrl}/v5/account/wallet-balance?${qs}`, {
          method: 'GET',
          headers: {
            'X-BAPI-API-KEY': apiKey,
            'X-BAPI-SIGN': sign,
            'X-BAPI-TIMESTAMP': ts,
            'X-BAPI-RECV-WINDOW': recvWindow,
            Accept: 'application/json',
            'User-Agent': 'SalomaTradingPlatform/1.0'
          },
          signal: controller.signal
        });
        const raw = await r.text();
        type BybitQuickWalletResp = {
          retCode?: number;
          retMsg?: string;
          result?: {
            list?: Array<{
              totalWalletBalance?: string;
              coin?: Array<{ coin?: string; walletBalance?: string; equity?: string }>;
            }>;
          };
        };
        let data: BybitQuickWalletResp | null = null;
        try {
          data = raw ? (JSON.parse(raw) as BybitQuickWalletResp) : null;
        } catch {
          data = null;
        }
        if (r.ok && data?.retCode === 0) {
          let usdt = 0;
          for (const acc of data.result?.list || []) {
            const c = (acc.coin || []).find(
              (x: { coin?: string; walletBalance?: string; equity?: string }) =>
                String(x.coin || '').toUpperCase() === 'USDT'
            );
            if (c) usdt += Number(c.walletBalance || c.equity || 0) || 0;
            else if (acc.totalWalletBalance) usdt += Number(acc.totalWalletBalance) || 0;
          }
          return { connected: true, usdtBalance: Number(usdt.toFixed(4)), retCode: 0, retMsg: 'OK' };
        }
        if (data) {
          lastRetCode = data.retCode;
          lastRetMsg = String(data.retMsg || '');
          lastError = `Bybit (${data.retCode ?? r.status}): ${lastRetMsg || 'Erreur'}`;
        } else {
          lastError = `HTTP ${r.status} depuis ${baseUrl}`;
        }
      }
      if (lastRetMsg) break;
    }
    return {
      connected: false,
      usdtBalance: 0,
      retCode: lastRetCode,
      retMsg: lastRetMsg || undefined,
      error: lastError
    };
  } catch (err) {
    return {
      connected: false,
      usdtBalance: 0,
      error: err instanceof Error ? err.message : 'Erreur réseau Bybit.'
    };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(
  req: IncomingMessage & { body?: unknown; query?: Record<string, string | string[] | undefined>; url?: string },
  res: ServerResponse
) {
  try {
    const auth = verifyAdminHeaders(req);
    if (!auth.ok) {
      sendJson(res, 403, { success: false, ok: false, error: auth.error });
      return;
    }

    const provider = resolveProvider(req);
    if (provider !== 'bybit' && provider !== 'okx' && provider !== 'binance') {
      sendJson(res, 200, {
        success: false,
        ok: false,
        error: 'Fournisseur API inconnu.',
        message: 'Fournisseur API inconnu.'
      });
      return;
    }

    const body = await readJsonBody(req);
    const store = loadStore();

    const nextEnabled =
      typeof body?.enabled === 'boolean'
        ? body.enabled
        : body?.enabled === 'true'
          ? true
          : body?.enabled === 'false'
            ? false
            : !store.providers[provider].enabled;

    if (nextEnabled) {
      const bodyKey = stripWrappingQuotes(body?.apiKey).trim();
      const bodySecret = stripWrappingQuotes(body?.secret).trim();
      const checkKey =
        bodyKey && !bodyKey.includes('****') ? bodyKey : store.providers[provider].apiKey;
      const checkSecret =
        bodySecret && !/^\*+$/.test(bodySecret) ? bodySecret : store.providers[provider].secret;

      if (provider === 'bybit') {
        const connCheck = await checkBybitQuick(checkKey, checkSecret);
        if (!connCheck.connected) {
          const reason = connCheck.error || 'Connexion BYBIT non établie.';
          console.error('[SALOMA /api/admin/apis/bybit/toggle] Refus activation (Bybit hors ligne):', reason);
          sendJson(res, 200, {
            success: false,
            ok: false,
            connected: false,
            retCode: connCheck.retCode,
            retMsg: connCheck.retMsg,
            error: `Impossible d'activer BYBIT : ${reason}`,
            message: `Impossible d'activer BYBIT : ${reason}`,
            apis: buildMaskedApis(store)
          });
          return;
        }
      } else if (!checkKey || !checkSecret) {
        sendJson(res, 200, {
          success: false,
          ok: false,
          connected: false,
          error: `Clés ${provider.toUpperCase()} manquantes pour activer.`,
          message: `Clés ${provider.toUpperCase()} manquantes pour activer.`,
          apis: buildMaskedApis(store)
        });
        return;
      }
    }

    store.providers[provider].enabled = nextEnabled;
    if (!nextEnabled && store.primaryApi === provider) {
      const alt = (['bybit', 'okx', 'binance'] as const).find(
        id => id !== provider && store.providers[id].enabled
      );
      if (alt) {
        store.primaryApi = alt;
      } else {
        store.providers[provider].enabled = true;
        sendJson(res, 200, {
          success: false,
          ok: false,
          error: 'Au moins une API doit rester activée comme pont principal.',
          message: 'Au moins une API doit rester activée comme pont principal.',
          apis: buildMaskedApis(store)
        });
        return;
      }
    }

    try {
      fs.writeFileSync(getConfigPath(), JSON.stringify(store, null, 2), { mode: 0o600 });
    } catch (writeErr) {
      console.error(`[SALOMA /api/admin/apis/${provider}/toggle] Fallback write error:`, writeErr);
    }

    sendJson(res, 200, {
      success: true,
      ok: true,
      message: `${provider.toUpperCase()} ${nextEnabled ? 'activée ✅' : 'désactivée.'}`,
      apis: buildMaskedApis(store)
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Action impossible.';
    console.error('[SALOMA /api/admin/apis/[provider]/toggle] Erreur inattendue:', err);
    sendJson(res, 200, {
      success: false,
      ok: false,
      error: msg,
      message: msg
    });
  }
}
