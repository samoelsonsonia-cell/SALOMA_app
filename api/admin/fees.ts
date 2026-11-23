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

function verifyAdminHeaders(req: IncomingMessage): { ok: true } | { ok: false; error: string } {
  const configuredEmail = stripWrappingQuotes(process.env.ADMIN_EMAIL).trim().toLowerCase();
  const configuredPin = stripWrappingQuotes(process.env.ADMIN_PIN).trim();
  const projectId = stripWrappingQuotes(
    process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
  );
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
    const parseNum = (v: unknown, def: number) => {
      if (v === null || v === undefined || v === '') return def;
      const n = Number(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : NaN;
    };

    const nextBybitMargin = parseNum(body?.bybitRecoveryMarginPct, 0.1);
    const nextTradeFee = parseNum(body?.tradeFeePct, 0.1);
    const nextExchangeFee = parseNum(body?.exchangeFeePct, 0.1);
    const nextWithdrawFee = parseNum(body?.withdrawFeePct, 0.15);
    const nextNetworkFee = parseNum(body?.networkFeeUsdt, 0.5);

    if (
      !Number.isFinite(nextBybitMargin) || nextBybitMargin < 0 || nextBybitMargin > 5 ||
      !Number.isFinite(nextTradeFee) || nextTradeFee < 0 || nextTradeFee > 5 ||
      !Number.isFinite(nextExchangeFee) || nextExchangeFee < 0 || nextExchangeFee > 5 ||
      !Number.isFinite(nextWithdrawFee) || nextWithdrawFee < 0 || nextWithdrawFee > 5 ||
      !Number.isFinite(nextNetworkFee) || nextNetworkFee < 0 || nextNetworkFee > 100
    ) {
      sendJson(res, 200, {
        success: false,
        ok: false,
        error: 'Valeurs de frais invalides (0% à 5%, frais réseau 0 à 100 USDT).'
      });
      return;
    }

    const clampPct = (v: number) => Number(Math.min(5, Math.max(0, v)).toFixed(2));
    const clampUsdt = (v: number) => Number(Math.min(100, Math.max(0, v)).toFixed(4));

    const salomaFees = {
      bybitRecoveryMarginPct: clampPct(nextBybitMargin),
      tradeFeePct: clampPct(nextTradeFee),
      exchangeFeePct: clampPct(nextExchangeFee),
      withdrawFeePct: clampPct(nextWithdrawFee),
      networkFeeUsdt: clampUsdt(nextNetworkFee)
    };

    const filePath = path.join(os.tmpdir(), '.saloma-apis.json');
    let store: Record<string, unknown> = {};
    try {
      if (fs.existsSync(filePath)) {
        store = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      }
    } catch {
      store = {};
    }
    store.salomaFees = salomaFees;
    try {
      fs.writeFileSync(filePath, JSON.stringify(store, null, 2), { mode: 0o600 });
    } catch (writeErr) {
      console.error('[SALOMA /api/admin/fees] Write error:', writeErr);
    }

    sendJson(res, 200, {
      success: true,
      ok: true,
      salomaFees
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur sauvegarde configuration frais.';
    console.error('[SALOMA /api/admin/fees] Erreur:', err);
    sendJson(res, 200, { success: false, ok: false, error: msg, message: msg });
  }
}
