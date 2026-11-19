import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

const OTP_TTL_MS = 5 * 60 * 1000;

interface StoredAdminOtp {
  email: string;
  code: string;
  expiresAt: number;
}

const globalOtpStoreKey = '__saloma_admin_otp_store__';
const g = globalThis as unknown as Record<string, Map<string, StoredAdminOtp> | undefined>;
const adminOtpMemoryStore: Map<string, StoredAdminOtp> =
  g[globalOtpStoreKey] || (g[globalOtpStoreKey] = new Map<string, StoredAdminOtp>());

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

function signPayload(payloadObj: Record<string, unknown>, secret: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
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

async function trySendEmailViaResend(toEmail: string, code: string): Promise<boolean> {
  const resendKey = stripWrappingQuotes(process.env.RESEND_API_KEY);
  if (!resendKey) return false;
  const fromEmail =
    stripWrappingQuotes(process.env.RESEND_FROM_EMAIL) || 'SALOMA Admin <onboarding@resend.dev>';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: 'SALOMA Admin - Code de vérification à 6 chiffres',
        html: `<p>Votre code de vérification administrateur SALOMA est : <strong>${code}</strong></p><p>Ce code expire dans 5 minutes.</p>`
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    return resp.ok;
  } catch {
    return false;
  }
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  try {
    if ((req.method || 'GET').toUpperCase() !== 'POST') {
      sendJson(res, 405, {
        success: false,
        ok: false,
        message: 'Méthode non autorisée.',
        error: 'Méthode non autorisée.'
      });
      return;
    }

    const configuredEmail = getServerAdminEmail();
    const configuredPin = getServerAdminPin();
    if (!configuredEmail || !configuredPin) {
      console.error('[SALOMA Admin] Configuration serveur manquante.');
      sendJson(res, 400, {
        success: false,
        ok: false,
        message: 'Configuration serveur manquante',
        error: 'Configuration serveur manquante'
      });
      return;
    }

    const body = await readJsonBody(req);
    const cleanEmail = String(body?.email || '').trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      sendJson(res, 400, {
        success: false,
        ok: false,
        message: 'Adresse e-mail administrateur invalide.',
        error: 'Adresse e-mail administrateur invalide.'
      });
      return;
    }

    if (cleanEmail !== configuredEmail) {
      sendJson(res, 403, {
        success: false,
        ok: false,
        message: 'Accès refusé : Email administrateur incorrect.',
        error: 'Accès refusé : Email administrateur incorrect.'
      });
      return;
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const nonce = crypto.randomBytes(12).toString('hex');
    const expiresAt = Date.now() + OTP_TTL_MS;

    // Purge expired entries and save in server memory (TTL 5 minutes)
    const now = Date.now();
    for (const [k, v] of adminOtpMemoryStore.entries()) {
      if (v.expiresAt < now) adminOtpMemoryStore.delete(k);
    }
    adminOtpMemoryStore.set(nonce, { email: cleanEmail, code, expiresAt });

    const codeHash = crypto.createHash('sha256').update(`${cleanEmail}:${code}`).digest('hex');
    const challengeToken = signPayload(
      {
        kind: 'admin-otp-v2',
        email: cleanEmail,
        nonce,
        codeHash,
        exp: expiresAt
      },
      getAdminHmacSecret(configuredEmail, configuredPin)
    );

    const emailDelivered = await trySendEmailViaResend(cleanEmail, code);
    if (emailDelivered) {
      sendJson(res, 200, {
        success: true,
        ok: true,
        email: cleanEmail,
        challengeToken,
        demoMode: false,
        message: 'Code de vérification à 6 chiffres envoyé par email.'
      });
      return;
    }

    sendJson(res, 200, {
      success: true,
      ok: true,
      email: cleanEmail,
      challengeToken,
      demoMode: true,
      demoCode: code,
      message: `Code démo : ${code}`
    });
  } catch (err) {
    console.error('[SALOMA Admin] Erreur send-code:', err instanceof Error ? err.message : 'Erreur inconnue');
    sendJson(res, 400, {
      success: false,
      ok: false,
      message: "Impossible de générer le code administrateur pour le moment.",
      error: "Impossible de générer le code administrateur pour le moment."
    });
  }
}
