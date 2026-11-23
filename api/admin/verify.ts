import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

const MAX_PIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_COOKIE_NAME = 'saloma_admin_attempts';

interface AttemptRecord {
  fails: number;
  blockedUntil: number;
}

const globalAttemptsKey = '__saloma_admin_pin_attempts__';
const g = globalThis as unknown as Record<string, Map<string, AttemptRecord> | undefined>;
const adminPinAttemptsMap: Map<string, AttemptRecord> =
  g[globalAttemptsKey] || (g[globalAttemptsKey] = new Map<string, AttemptRecord>());

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
  return stripWrappingQuotes(
    process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT
  );
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

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function getClientKey(req: IncomingMessage, email: string): string {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || req.socket?.remoteAddress || 'unknown';
  return `${ip}:${email}`;
}

function readAttemptState(
  req: IncomingMessage,
  clientKey: string,
  secret: string
): AttemptRecord {
  const now = Date.now();
  const mem = adminPinAttemptsMap.get(clientKey);
  let best: AttemptRecord = { fails: 0, blockedUntil: 0 };

  if (mem) {
    if (mem.blockedUntil > now) {
      best = { fails: mem.fails, blockedUntil: mem.blockedUntil };
    } else if (mem.blockedUntil === 0) {
      best = { fails: mem.fails, blockedUntil: 0 };
    } else {
      adminPinAttemptsMap.delete(clientKey);
    }
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  const rawCookie = cookies[LOCKOUT_COOKIE_NAME];
  if (rawCookie) {
    const parsed = verifySignedPayload<{
      fails?: number;
      blockedUntil?: number;
      exp?: number;
    }>(rawCookie, secret);
    if (parsed) {
      const cBlockedUntil = Number(parsed.blockedUntil) || 0;
      const cFails = Number(parsed.fails) || 0;
      if (cBlockedUntil > now && cBlockedUntil > best.blockedUntil) {
        best = { fails: Math.max(cFails, best.fails), blockedUntil: cBlockedUntil };
      } else if (cBlockedUntil === 0 && best.blockedUntil === 0) {
        best = { fails: Math.max(cFails, best.fails), blockedUntil: 0 };
      }
    }
  }

  return best;
}

function writeAttemptCookie(
  res: ServerResponse,
  state: AttemptRecord,
  secret: string
) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const secureFlag = isProd ? '; Secure' : '';
  if (state.fails === 0 && state.blockedUntil === 0) {
    res.setHeader(
      'Set-Cookie',
      `${LOCKOUT_COOKIE_NAME}=; Path=/api/admin; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`
    );
    return;
  }
  const token = signPayload(
    {
      fails: state.fails,
      blockedUntil: state.blockedUntil,
      exp: Date.now() + LOCKOUT_DURATION_MS
    },
    secret
  );
  res.setHeader(
    'Set-Cookie',
    `${LOCKOUT_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/api/admin; HttpOnly; SameSite=Lax; Max-Age=900${secureFlag}`
  );
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

    // Étape préliminaire : vérifier l'email contre ADMIN_EMAIL avant tout déverrouillage
    if (cleanEmail !== configuredEmail) {
      sendJson(res, 403, {
        success: false,
        ok: false,
        message: 'Accès refusé : Email administrateur incorrect.',
        error: 'Accès refusé : Email administrateur incorrect.'
      });
      return;
    }

    const secret = getAdminHmacSecret(configuredEmail, configuredPin);
    const clientKey = getClientKey(req, configuredEmail);
    const attemptState = readAttemptState(req, clientKey, secret);

    if (attemptState.blockedUntil > Date.now()) {
      const minsLeft = Math.max(1, Math.ceil((attemptState.blockedUntil - Date.now()) / 60000));
      const msg = `Trop de tentatives incorrectes. Accès bloqué pendant ${minsLeft} minute(s).`;
      sendJson(res, 429, {
        success: false,
        ok: false,
        message: msg,
        error: msg
      });
      return;
    }

    if (!/^\d{6}$/.test(cleanEmailCode)) {
      sendJson(res, 403, {
        success: false,
        ok: false,
        message: 'Accès refusé : Le code reçu par email doit contenir exactement 6 chiffres.',
        error: 'Accès refusé : Le code reçu par email doit contenir exactement 6 chiffres.'
      });
      return;
    }

    if (!/^\d{9}$/.test(cleanPin)) {
      sendJson(res, 403, {
        success: false,
        ok: false,
        message: 'Le code de sécurité administrateur doit contenir exactement 9 chiffres.',
        error: 'Le code de sécurité administrateur doit contenir exactement 9 chiffres.'
      });
      return;
    }

    // ========================================================
    // ÉTAPE 1 : VÉRIFIER VALIDITÉ 2 MINUTES + APPWRITE AUTH OTP
    // ========================================================
    const challenge = verifySignedPayload<{
      kind?: string;
      email?: string;
      userId?: string;
      issuedAt?: number;
      exp?: number;
    }>(challengeToken, secret);

    if (
      !challenge ||
      challenge.kind !== 'admin-appwrite-otp-v3' ||
      String(challenge.email || '').trim().toLowerCase() !== configuredEmail ||
      !challenge.userId ||
      (typeof challenge.issuedAt === 'number' &&
        Date.now() - challenge.issuedAt > 2 * 60 * 1000)
    ) {
      sendJson(res, 403, {
        success: false,
        ok: false,
        message: 'Code expiré, demandez un nouveau code',
        error: 'Code expiré, demandez un nouveau code'
      });
      return;
    }

    const endpoint = getAppwriteEndpoint();
    const projectId = getAppwriteProjectId();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    let sessResp: Response;
    try {
      sessResp = await fetch(`${endpoint}/account/sessions/token`, {
        method: 'POST',
        headers: {
          'X-Appwrite-Project': projectId,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          userId: challenge.userId,
          secret: cleanEmailCode
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    const sessJson = (await sessResp.json().catch(() => ({}))) as {
      $id?: string;
      userId?: string;
      secret?: string;
      message?: string;
    };

    if (!sessResp.ok) {
      sendJson(res, 403, {
        success: false,
        ok: false,
        message: 'Accès refusé : Code à 6 chiffres incorrect ou expiré.',
        error: 'Accès refusé : Code à 6 chiffres incorrect ou expiré.'
      });
      return;
    }

    // Vérifier l'email du compte Appwrite connecté et nettoyer la session temporaire
    const sessionHeaders: Record<string, string> = {
      'X-Appwrite-Project': projectId,
      Accept: 'application/json'
    };
    const fallbackCookie =
      sessResp.headers.get('x-fallback-cookies') || sessResp.headers.get('X-Fallback-Cookies');
    const setCookie = sessResp.headers.get('set-cookie');
    if (sessJson.secret) {
      sessionHeaders['X-Appwrite-Session'] = sessJson.secret;
    } else if (fallbackCookie) {
      sessionHeaders['X-Fallback-Cookies'] = fallbackCookie;
    } else if (setCookie) {
      sessionHeaders.Cookie = setCookie.split(';')[0];
    }

    let appwriteEmailMatches = false;
    try {
      if (
        sessionHeaders['X-Appwrite-Session'] ||
        sessionHeaders['X-Fallback-Cookies'] ||
        sessionHeaders.Cookie
      ) {
        const accResp = await fetch(`${endpoint}/account`, {
          method: 'GET',
          headers: sessionHeaders
        });
        if (accResp.ok) {
          const accData = (await accResp.json().catch(() => ({}))) as { email?: string };
          appwriteEmailMatches =
            String(accData?.email || '').trim().toLowerCase() === configuredEmail;
        }
        await fetch(`${endpoint}/account/sessions/current`, {
          method: 'DELETE',
          headers: sessionHeaders
        }).catch(() => {});
      } else {
        appwriteEmailMatches =
          String(challenge.email || '').trim().toLowerCase() === configuredEmail;
      }
    } catch {
      appwriteEmailMatches =
        String(challenge.email || '').trim().toLowerCase() === configuredEmail;
    }

    if (!appwriteEmailMatches) {
      sendJson(res, 403, {
        success: false,
        ok: false,
        message: 'Accès refusé : Email administrateur incorrect.',
        error: 'Accès refusé : Email administrateur incorrect.'
      });
      return;
    }

    // ========================================================
    // ÉTAPE 2 : VÉRIFIER ADMIN_PIN (MAX 3 TENTATIVES / 15 MIN)
    // ========================================================
    if (cleanPin !== configuredPin) {
      const nextFails = attemptState.fails + 1;
      const isNowBlocked = nextFails >= MAX_PIN_ATTEMPTS;
      const nextState: AttemptRecord = {
        fails: nextFails,
        blockedUntil: isNowBlocked ? Date.now() + LOCKOUT_DURATION_MS : 0
      };
      adminPinAttemptsMap.set(clientKey, nextState);
      writeAttemptCookie(res, nextState, secret);

      const errMsg = isNowBlocked
        ? 'Code à 9 chiffres incorrect. 3 tentatives échouées : accès bloqué pendant 15 minutes.'
        : `Code à 9 chiffres incorrect. Tentative ${nextFails}/${MAX_PIN_ATTEMPTS}.`;

      sendJson(res, isNowBlocked ? 429 : 403, {
        success: false,
        ok: false,
        message: errMsg,
        error: errMsg
      });
      return;
    }

    // Succès : réinitialiser le compteur de tentatives
    adminPinAttemptsMap.delete(clientKey);
    writeAttemptCookie(res, { fails: 0, blockedUntil: 0 }, secret);

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
    console.error(
      '[SALOMA Admin] Erreur verify Appwrite:',
      err instanceof Error ? err.message : 'Erreur inconnue'
    );
    sendJson(res, 400, {
      success: false,
      ok: false,
      message: 'Accès refusé : Vérification administrateur échouée.',
      error: 'Accès refusé : Vérification administrateur échouée.'
    });
  }
}
