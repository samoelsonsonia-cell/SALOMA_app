import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

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
    const cleanEmailCode = String(body?.emailCode || body?.otp || '').trim();
    const cleanPin = String(body?.code || body?.pin || '').trim();
    const challengeToken = String(body?.challengeToken || '').trim();

    if (!cleanEmail || !cleanEmailCode || !cleanPin) {
      sendJson(res, 400, {
        success: false,
        ok: false,
        message: 'Veuillez saisir Email, Code 6 chiffres et Code à 9 chiffres.',
        error: 'Veuillez saisir Email, Code 6 chiffres et Code à 9 chiffres.'
      });
      return;
    }

    if (cleanEmail !== configuredEmail || !/^\d{9}$/.test(cleanPin) || cleanPin !== configuredPin) {
      sendJson(res, 403, {
        success: false,
        ok: false,
        message: 'Accès refusé : Email ou Code à 9 chiffres incorrect.',
        error: 'Accès refusé : Email ou Code à 9 chiffres incorrect.'
      });
      return;
    }

    if (!/^\d{6}$/.test(cleanEmailCode)) {
      sendJson(res, 403, {
        success: false,
        ok: false,
        message: 'Accès refusé : Le code à 6 chiffres est invalide.',
        error: 'Accès refusé : Le code à 6 chiffres est invalide.'
      });
      return;
    }

    const secret = getAdminHmacSecret(configuredEmail, configuredPin);
    const challenge = verifySignedPayload<{
      kind?: string;
      email?: string;
      nonce?: string;
      codeHash?: string;
      exp?: number;
    }>(challengeToken, secret);

    if (
      !challenge ||
      challenge.kind !== 'admin-otp-v2' ||
      String(challenge.email || '').trim().toLowerCase() !== configuredEmail ||
      !challenge.codeHash
    ) {
      sendJson(res, 403, {
        success: false,
        ok: false,
        message: 'Code expiré ou invalide. Veuillez cliquer sur Envoyer pour générer un nouveau code.',
        error: 'Code expiré ou invalide. Veuillez cliquer sur Envoyer pour générer un nouveau code.'
      });
      return;
    }

    const expectedCodeHash = crypto
      .createHash('sha256')
      .update(`${cleanEmail}:${cleanEmailCode}`)
      .digest('hex');

    const stored = challenge.nonce ? adminOtpMemoryStore.get(challenge.nonce) : undefined;
    if (stored) {
      if (stored.expiresAt < Date.now() || stored.email !== cleanEmail || stored.code !== cleanEmailCode) {
        sendJson(res, 403, {
          success: false,
          ok: false,
          message: 'Accès refusé : Code à 6 chiffres incorrect ou expiré.',
          error: 'Accès refusé : Code à 6 chiffres incorrect ou expiré.'
        });
        return;
      }
      adminOtpMemoryStore.delete(challenge.nonce!);
    } else if (challenge.codeHash !== expectedCodeHash) {
      sendJson(res, 403, {
        success: false,
        ok: false,
        message: 'Accès refusé : Code à 6 chiffres incorrect ou expiré.',
        error: 'Accès refusé : Code à 6 chiffres incorrect ou expiré.'
      });
      return;
    }

    const adminSessionToken = signPayload(
      {
        kind: 'admin-session',
        email: configuredEmail,
        pinHash: crypto.createHash('sha256').update(configuredPin).digest('hex'),
        exp: Date.now() + 4 * 60 * 60 * 1000
      },
      secret
    );

    sendJson(res, 200, {
      success: true,
      ok: true,
      email: configuredEmail,
      adminSessionToken
    });
  } catch (err) {
    console.error('[SALOMA Admin] Erreur verify:', err instanceof Error ? err.message : 'Erreur inconnue');
    sendJson(res, 400, {
      success: false,
      ok: false,
      message: 'Accès refusé : Vérification administrateur échouée.',
      error: 'Accès refusé : Vérification administrateur échouée.'
    });
  }
}
