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

function maskSecretValue(val: string | undefined, length = 12): string {
  if (!val || !val.trim()) return '';
  return '*'.repeat(length);
}

function maskApiKeyPreview(val: string | undefined): string {
  const clean = (val || '').trim();
  if (!clean) return '';
  if (clean.length <= 8) return '****';
  return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
}

function getDefaultStore(): StoredApisConfig {
  return {
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
}

function getConfigPath(): string {
  return path.join(os.tmpdir(), '.saloma-apis.json');
}

function loadFallbackStore(): StoredApisConfig {
  const base = getDefaultStore();
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
              apiKey: String(p.apiKey || base.providers[id].apiKey || ''),
              secret: String(p.secret || base.providers[id].secret || ''),
              ...(id === 'okx'
                ? { passphrase: String(p.passphrase || base.providers[id].passphrase || '') }
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
    console.error('[SALOMA /api/admin/apis/save] Erreur lecture fallback store:', err);
  }
  return base;
}

function buildMaskedApis(store: StoredApisConfig) {
  const labels: Record<ProviderId, string> = {
    bybit: 'BYBIT',
    okx: 'OKX',
    binance: 'BINANCE'
  };
  return {
    primaryApi: store.primaryApi,
    providers: (['bybit', 'okx', 'binance'] as const).map(id => {
      const entry = store.providers[id];
      return {
        id,
        label: labels[id],
        enabled: entry.enabled,
        isPrimary: store.primaryApi === id,
        marginPct: entry.marginPct,
        hasApiKey: Boolean(entry.apiKey.trim()),
        apiKeyMasked: maskApiKeyPreview(entry.apiKey),
        hasSecret: Boolean(entry.secret.trim()),
        secretMasked: maskSecretValue(entry.secret, 16),
        ...(id === 'okx'
          ? {
              hasPassphrase: Boolean((entry.passphrase || '').trim()),
              passphraseMasked: maskSecretValue(entry.passphrase, 12)
            }
          : {})
      };
    })
  };
}

function resolveProviderFromReq(
  req: IncomingMessage & { query?: Record<string, string | string[] | undefined>; url?: string }
): ProviderId | '' {
  const qProv = req.query?.provider;
  const rawQuery = Array.isArray(qProv) ? qProv[0] : qProv;
  if (rawQuery) {
    const clean = String(rawQuery).toLowerCase().trim();
    if (clean === 'bybit' || clean === 'okx' || clean === 'binance') return clean;
  }
  try {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    const match = pathname.match(/\/api\/admin\/apis\/(bybit|okx|binance)\/?$/i);
    if (match?.[1]) {
      return match[1].toLowerCase() as ProviderId;
    }
  } catch {
    // ignore url parse error
  }
  return '';
}

export default async function handler(
  req: IncomingMessage & { body?: unknown; query?: Record<string, string | string[] | undefined>; url?: string },
  res: ServerResponse
) {
  try {
    const auth = verifyAdminHeaders(req);
    if (!auth.ok) {
      sendJson(res, 403, { success: false, error: auth.error });
      return;
    }

    const provider = resolveProviderFromReq(req);
    if (provider !== 'bybit' && provider !== 'okx' && provider !== 'binance') {
      sendJson(res, 200, {
        success: false,
        mode: 'fallback_local',
        message: 'Fournisseur API inconnu.'
      });
      return;
    }

    const body = await readJsonBody(req);
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    const secret = typeof body.secret === 'string' ? body.secret.trim() : '';
    const passphrase = typeof body.passphrase === 'string' ? body.passphrase.trim() : '';

    const store = loadFallbackStore();

    if (apiKey && !apiKey.includes('****')) {
      store.providers[provider].apiKey = apiKey;
      if (provider === 'bybit') process.env.BYBIT_API_KEY = apiKey;
      if (provider === 'okx') process.env.OKX_API_KEY = apiKey;
      if (provider === 'binance') process.env.BINANCE_API_KEY = apiKey;
    }
    if (secret && !/^\*+$/.test(secret)) {
      store.providers[provider].secret = secret;
      if (provider === 'bybit') process.env.BYBIT_API_SECRET = secret;
      if (provider === 'okx') process.env.OKX_API_SECRET = secret;
      if (provider === 'binance') process.env.BINANCE_API_SECRET = secret;
    }
    if (provider === 'okx' && passphrase && !/^\*+$/.test(passphrase)) {
      store.providers.okx.passphrase = passphrase;
      process.env.OKX_PASSPHRASE = passphrase;
    }

    try {
      fs.writeFileSync(getConfigPath(), JSON.stringify(store, null, 2), { mode: 0o600 });
    } catch (writeErr) {
      console.error(`[SALOMA /api/admin/apis/${provider}] Fallback /tmp write error:`, writeErr);
    }

    sendJson(res, 200, {
      success: true,
      mode: 'fallback_local',
      message: 'Clés prises en compte pour cette session - à mettre aussi dans Vercel',
      apis: buildMaskedApis(store)
    });
  } catch (err) {
    console.error('[SALOMA /api/admin/apis/[provider]] Erreur sauvegarde API:', err);
    sendJson(res, 200, {
      success: true,
      mode: 'fallback_local',
      message: 'Clés prises en compte pour cette session - à mettre aussi dans Vercel'
    });
  }
}
