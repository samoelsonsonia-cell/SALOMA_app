import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

const OTP_VALIDITY_MS = 2 * 60 * 1000; // 2 minutes strictement

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

function getAppwriteEndpoint(): string {
  return (
    stripWrappingQuotes(
      process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT
    ) || 'https://fra.cloud.appwrite.io/v1'
  );
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

function generateAppwriteUniqueId(): string {
  const now = new Date();
  const sec = Math.floor(now.getTime() / 1000).toString(16);
  const msec = now.getMilliseconds().toString(16).padStart(5, '0');
  return `${sec}${msec}${crypto.randomBytes(4).toString('hex').slice(0, 7)}`;
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

    const endpoint = getAppwriteEndpoint();
    const projectId = getAppwriteProjectId();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    let appwriteResp: Response;
    try {
      appwriteResp = await fetch(`${endpoint}/account/tokens/email`, {
        method: 'POST',
        headers: {
          'X-Appwrite-Project': projectId,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          userId: generateAppwriteUniqueId(),
          email: configuredEmail
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    const tokenJson = (await appwriteResp.json().catch(() => ({}))) as {
      userId?: string;
      message?: string;
      type?: string;
      code?: number;
    };

    if (!appwriteResp.ok || !tokenJson?.userId) {
      const errType = String(tokenJson?.type || '');
      const isRateLimited =
        appwriteResp.status === 429 || errType === 'general_rate_limit_exceeded';
      sendJson(res, isRateLimited ? 429 : 400, {
        success: false,
        ok: false,
        message: isRateLimited
          ? 'Trop de tentatives Appwrite. Veuillez patienter quelques instants avant de réessayer.'
          : tokenJson?.message || "Impossible d'envoyer le code Appwrite par email.",
        error: isRateLimited
          ? 'Trop de tentatives Appwrite. Veuillez patienter quelques instants avant de réessayer.'
          : tokenJson?.message || "Impossible d'envoyer le code Appwrite par email."
      });
      return;
    }

    const issuedAt = Date.now();
    const expiresAt = issuedAt + OTP_VALIDITY_MS;
    const challengeToken = signPayload(
      {
        kind: 'admin-appwrite-otp-v3',
        email: configuredEmail,
        userId: tokenJson.userId,
        issuedAt,
        exp: expiresAt
      },
      getAdminHmacSecret(configuredEmail, configuredPin)
    );

    sendJson(res, 200, {
      success: true,
      ok: true,
      email: configuredEmail,
      challengeToken,
      expiresAt,
      expiresInSeconds: 120,
      message: 'Code de vérification à 6 chiffres envoyé par email (valide 2 minutes).'
    });
  } catch (err) {
    console.error(
      '[SALOMA Admin] Erreur send-code Appwrite:',
      err instanceof Error ? err.message : 'Erreur inconnue'
    );
    sendJson(res, 400, {
      success: false,
      ok: false,
      message: "Impossible d'envoyer le code de vérification par email.",
      error: "Impossible d'envoyer le code de vérification par email."
    });
  }
}
