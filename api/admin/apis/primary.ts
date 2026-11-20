import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

type ProviderId = 'bybit' | 'okx' | 'binance';

function stripWrappingQuotes(raw: unknown): string {
  const s = String(raw || '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function verifyAdminHeaders(req: IncomingMessage): { ok: true } | { ok: false; error: string } {
  const configuredEmail = stripWrappingQuotes(process.env.ADMIN_EMAIL).trim().toLowerCase();
  const configuredPin = stripWrappingQuotes(process.env.ADMIN_PIN).trim();
  const projectId =
    stripWrappingQuotes(process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID) ||
    '6af771140031749ce67c';
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

  try {
    const secret = crypto
      .createHash('sha256')
      .update(`${pin}:${projectId}:${configuredEmail}:saloma-admin-sec-v2`)
      .digest('hex');
    const parts = adminToken.split('.');
    if (parts.length !== 2) throw new Error('bad token');
    const [payloadB64, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      throw new Error('bad sig');
    }
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      kind?: string;
      email?: string;
      pinHash?: string;
      exp?: number;
    };
    const expectedPinHash = crypto.createHash('sha256').update(pin).digest('hex');
    if (
      parsed.kind !== 'admin-session' ||
      String(parsed.email || '').trim().toLowerCase() !== configuredEmail ||
      parsed.pinHash !== expectedPinHash ||
      (typeof parsed.exp === 'number' && parsed.exp < Date.now())
    ) {
      throw new Error('expired');
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Session administrateur expirée ou vérification email 6 chiffres requise.'
    };
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
    // ignore
  }
}

async function readJsonBody(req: IncomingMessage & { body?: unknown }): Promise<Record<string, unknown>> {
  try {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return req.body as Record<string, unknown>;
    }
    if (typeof req.body === 'string') {
      return req.body.trim() ? (JSON.parse(req.body) as Record<string, unknown>) : {};
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  try {
    const auth = verifyAdminHeaders(req);
    if (!auth.ok) {
      sendJson(res, 403, { success: false, ok: false, error: auth.error });
      return;
    }

    const body = await readJsonBody(req);
    const provider = String(body?.primaryApi || '').toLowerCase().trim() as ProviderId;
    if (provider !== 'bybit' && provider !== 'okx' && provider !== 'binance') {
      sendJson(res, 200, {
        success: false,
        ok: false,
        error: 'API principale invalide (BYBIT, OKX ou BINANCE).'
      });
      return;
    }

    const filePath = path.join(os.tmpdir(), '.saloma-apis.json');
    const store = (() => {
      try {
        if (fs.existsSync(filePath)) {
          return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
      } catch {
        // ignore
      }
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
            passphrase: stripWrappingQuotes(process.env.OKX_PASSPHRASE || process.env.OKX_API_PASSPHRASE).trim(),
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
    })();

    store.primaryApi = provider;
    if (!store.providers[provider]) store.providers[provider] = { enabled: true, apiKey: '', secret: '', marginPct: 0.1 };
    store.providers[provider].enabled = true;
    store.salomaFees.bybitRecoveryMarginPct = Number(store.providers[provider].marginPct ?? 0.1) || 0.1;

    try {
      fs.writeFileSync(filePath, JSON.stringify(store, null, 2), { mode: 0o600 });
    } catch (writeErr) {
      console.error('[SALOMA /api/admin/apis/primary] Write error:', writeErr);
    }

    const labels: Record<ProviderId, string> = { bybit: 'BYBIT', okx: 'OKX', binance: 'BINANCE' };
    const maskPreview = (val: string) => {
      const clean = String(val || '').trim();
      if (!clean) return '';
      return clean.length <= 8 ? '****' : `${clean.slice(0, 4)}****${clean.slice(-4)}`;
    };

    sendJson(res, 200, {
      success: true,
      ok: true,
      apis: {
        primaryApi: store.primaryApi,
        providers: (['bybit', 'okx', 'binance'] as const).map(id => {
          const e = store.providers[id];
          return {
            id,
            label: labels[id],
            enabled: Boolean(e?.enabled),
            isPrimary: store.primaryApi === id,
            marginPct: Number(e?.marginPct ?? 0.1),
            hasApiKey: Boolean(String(e?.apiKey || '').trim()),
            apiKeyMasked: maskPreview(e?.apiKey || ''),
            hasSecret: Boolean(String(e?.secret || '').trim()),
            secretMasked: String(e?.secret || '').trim() ? '*'.repeat(16) : '',
            ...(id === 'okx'
              ? {
                  hasPassphrase: Boolean(String(e?.passphrase || '').trim()),
                  passphraseMasked: String(e?.passphrase || '').trim() ? '*'.repeat(12) : ''
                }
              : {})
          };
        })
      },
      salomaFees: store.salomaFees,
      bybitStatus: {
        online: true,
        latencyMs: 0,
        updatedAt: Date.now(),
        primaryExchange: provider.toUpperCase()
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur sélection API principale.';
    console.error('[SALOMA /api/admin/apis/primary] Erreur:', err);
    sendJson(res, 200, { success: false, ok: false, error: msg, message: msg });
  }
}
