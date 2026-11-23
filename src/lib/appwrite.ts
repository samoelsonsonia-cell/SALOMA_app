const readEnv = (getter: () => unknown, fallback = ''): string => {
  try {
    const val = getter();
    return typeof val === 'string' && val.trim() ? val.trim() : fallback;
  } catch {
    return fallback;
  }
};

export const APPWRITE_CONFIG_MISSING_MSG =
  'Project ID introuvable - vérifie les Environment Variables';
export const APPWRITE_CONNECTION_FAILED_MSG = 'Connexion Appwrite échouée';

export const ENV_CONFIG = {
  supabaseUrl: readEnv(() => import.meta.env?.VITE_SUPABASE_URL, ''),
  supabaseAnonKey: readEnv(() => import.meta.env?.VITE_SUPABASE_ANON_KEY, ''),
  // Clé publique Cloudflare uniquement (NEXT_PUBLIC_CLOUDFLARE_SITE_KEY prioritaire)
  cloudflareSiteKey:
    readEnv(() => import.meta.env?.NEXT_PUBLIC_CLOUDFLARE_SITE_KEY, '') ||
    readEnv(() => import.meta.env?.VITE_CLOUDFLARE_SITE_KEY, ''),
  appwriteEndpoint: readEnv(() => import.meta.env?.VITE_APPWRITE_ENDPOINT, ''),
  appwriteProjectId: readEnv(() => import.meta.env?.VITE_APPWRITE_PROJECT_ID, ''),
  appwriteDatabaseId: readEnv(() => import.meta.env?.VITE_APPWRITE_DATABASE_ID, ''),
  appwriteTableBotSetting: readEnv(() => import.meta.env?.VITE_APPWRITE_TABLE_BOT_SETTING, ''),
  appwriteTableLiveBalance: readEnv(() => import.meta.env?.VITE_APPWRITE_TABLE_LIVE_BALANCE, ''),
  appwriteTableSignales: readEnv(() => import.meta.env?.VITE_APPWRITE_TABLE_SIGNALES, ''),
  appwriteTableTrades: readEnv(() => import.meta.env?.VITE_APPWRITE_TABLE_TRADES, '')
};

export const APPWRITE_ENDPOINT = ENV_CONFIG.appwriteEndpoint;
export const APPWRITE_PROJECT_ID = ENV_CONFIG.appwriteProjectId;
export const APPWRITE_DATABASE_ID = ENV_CONFIG.appwriteDatabaseId;
export const APPWRITE_TABLE_BOT_SETTING = ENV_CONFIG.appwriteTableBotSetting;
export const APPWRITE_TABLE_LIVE_BALANCE = ENV_CONFIG.appwriteTableLiveBalance;
export const APPWRITE_TABLE_SIGNALES = ENV_CONFIG.appwriteTableSignales;
export const APPWRITE_TABLE_TRADES = ENV_CONFIG.appwriteTableTrades;
export const hasAppwriteClientConfig = Boolean(APPWRITE_ENDPOINT && APPWRITE_PROJECT_ID);
export const hasSupabaseConfig = Boolean(ENV_CONFIG.supabaseUrl && ENV_CONFIG.supabaseAnonKey);

export const COOKIE_SESSION_MARKER = '__saloma_cookie_session__';
const APPWRITE_FALLBACK_COOKIE_KEY = 'saloma_appwrite_fallback_cookies';

export interface ApiError extends Error {
  status?: number;
  turnstileRetry?: boolean;
  liquidityUnavailable?: boolean;
  requiresKycLevel2?: boolean;
  isNetworkError?: boolean;
  appwriteConfigMissing?: boolean;
  appwriteError?: boolean;
}

export function isApiNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as ApiError;
  if (e.liquidityUnavailable || e.appwriteConfigMissing || e.appwriteError) return false;
  if (e.status === 404 || (typeof e.status === 'number' && e.status >= 500)) return true;
  const msg = String(e.message || '');
  return (
    msg.includes('(404)') ||
    msg.includes('(500)') ||
    msg.includes('Service API introuvable')
  );
}

export function isTurnstileRetryError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  return Boolean((err as ApiError).turnstileRetry);
}

export function subscribeToNotificationsStream<T>(
  token: string,
  onNotification: (payload: T) => void
): () => void {
  if (typeof window === 'undefined' || !token || token === COOKIE_SESSION_MARKER) {
    return () => {};
  }

  let stopped = false;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelayMs = 2000;

  const connect = async () => {
    if (stopped) return;
    controller = new AbortController();
    try {
      const response = await fetch('/api/notifications/stream', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream'
        },
        signal: controller.signal
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !response.body || !contentType.includes('text/event-stream')) {
        if (
          response.status === 401 ||
          response.status === 403 ||
          response.status === 404 ||
          contentType.includes('text/html')
        ) {
          return;
        }
        throw new Error(`SSE HTTP ${response.status}`);
      }

      retryDelayMs = 2000;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let splitIndex = buffer.indexOf('\n\n');
        while (splitIndex !== -1) {
          const frame = buffer.slice(0, splitIndex);
          buffer = buffer.slice(splitIndex + 2);

          const dataLines = frame
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).trim());

          if (dataLines.length > 0) {
            try {
              const parsed = JSON.parse(dataLines.join('\n')) as T;
              onNotification(parsed);
            } catch {
              // ignore malformed SSE frame
            }
          }

          splitIndex = buffer.indexOf('\n\n');
        }
      }
    } catch {
      // reconnect silently on transient network interruption
    }

    if (!stopped) {
      retryTimer = setTimeout(connect, retryDelayMs);
      retryDelayMs = Math.min(retryDelayMs * 2, 30000);
    }
  };

  void connect();

  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    controller?.abort();
  };
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
    adminPin?: string | null;
    adminEmail?: string | null;
    adminToken?: string | null;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (options.token && options.token !== COOKIE_SESSION_MARKER) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.adminPin) {
    headers['x-admin-pin'] = options.adminPin;
  }
  if (options.adminEmail) {
    headers['x-admin-email'] = options.adminEmail;
  }
  if (options.adminToken) {
    headers['x-admin-token'] = options.adminToken;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutMs = options.timeoutMs ?? 12000;
  const timer =
    controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method || 'GET',
      headers,
      credentials: 'same-origin',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller?.signal
    });
  } catch {
    if (timer) clearTimeout(timer);
    const netErr: ApiError = new Error(
      'Connexion Internet requise - Vérifiez vos données mobiles.'
    );
    netErr.isNetworkError = true;
    throw netErr;
  }
  if (timer) clearTimeout(timer);

  const contentType = res.headers.get('content-type') || '';
  const isHtmlFallback = contentType.includes('text/html');
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : {};

  if (!res.ok || isHtmlFallback) {
    const status = isHtmlFallback && res.ok ? 404 : res.status;
    const errMsg = data?.error || data?.message;
    if (status === 404 && !errMsg) {
      const err: ApiError = new Error('Service API introuvable (404).');
      err.status = 404;
      throw err;
    }
    const err: ApiError = new Error(errMsg || `Erreur serveur (${status})`);
    err.status = status;
    if (data?.turnstileRetry) {
      err.turnstileRetry = true;
    }
    if (data?.liquidityUnavailable) {
      err.liquidityUnavailable = true;
    }
    if (data?.requiresKycLevel2) {
      err.requiresKycLevel2 = true;
    }
    if (data?.appwriteConfigMissing) {
      err.appwriteConfigMissing = true;
    }
    if (data?.appwriteError) {
      err.appwriteError = true;
    }
    throw err;
  }
  return data as T;
}

// ========================================================
// CONNEXION DIRECTE APPWRITE CLIENT REST (FALLBACK SI PAS DE /api)
// ========================================================

function getFallbackCookieHeader(): string {
  try {
    return localStorage.getItem(APPWRITE_FALLBACK_COOKIE_KEY) || '';
  } catch {
    return '';
  }
}

function saveFallbackCookieHeader(val: string | null) {
  if (!val) return;
  try {
    localStorage.setItem(APPWRITE_FALLBACK_COOKIE_KEY, val);
  } catch {
    // ignore storage quota
  }
}

function clearFallbackCookieHeader() {
  try {
    localStorage.removeItem(APPWRITE_FALLBACK_COOKIE_KEY);
  } catch {
    // ignore storage errors
  }
}

function formatDirectAppwriteError(data: { type?: string; message?: string; code?: number }, fallback: string): string {
  const type = String(data?.type || '');
  const msg = String(data?.message || '').toLowerCase();
  if (type === 'project_not_found' || msg.includes('project with the requested id')) {
    return data?.message || APPWRITE_CONFIG_MISSING_MSG;
  }
  if (type === 'user_already_exists' || msg.includes('already exists')) {
    return 'Un compte existe déjà avec cette adresse e-mail.';
  }
  if (type === 'user_invalid_credentials' || msg.includes('invalid credentials')) {
    return 'Email ou mot de passe incorrect.';
  }
  if (type === 'user_invalid_token' || msg.includes('invalid token') || msg.includes('expired')) {
    return 'Code incorrect ou expiré.';
  }
  if (type === 'user_blocked') {
    return 'Ce compte est bloqué.';
  }
  if (data?.code === 429 || type === 'general_rate_limit_exceeded') {
    return 'Trop de tentatives. Veuillez patienter quelques instants.';
  }
  if (msg.includes('password') && msg.includes('8')) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  return data?.message || fallback;
}

async function directAppwriteFetch<T>(
  appwritePath: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  if (!APPWRITE_PROJECT_ID || !APPWRITE_ENDPOINT) {
    const cfgErr: ApiError = new Error(APPWRITE_CONFIG_MISSING_MSG);
    cfgErr.status = 503;
    cfgErr.appwriteConfigMissing = true;
    throw cfgErr;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': APPWRITE_PROJECT_ID
  };
  const fallbackCookie = getFallbackCookieHeader();
  if (fallbackCookie) {
    headers['X-Fallback-Cookies'] = fallbackCookie;
  }

  let res: Response;
  try {
    res = await fetch(`${APPWRITE_ENDPOINT}${appwritePath}`, {
      method: options.method || 'GET',
      headers,
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
  } catch {
    const connErr: ApiError = new Error(APPWRITE_CONNECTION_FAILED_MSG);
    connErr.status = 503;
    connErr.appwriteError = true;
    throw connErr;
  }

  const nextCookie = res.headers.get('X-Fallback-Cookies') || res.headers.get('x-fallback-cookies');
  if (nextCookie) {
    saveFallbackCookieHeader(nextCookie);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: ApiError = new Error(
      formatDirectAppwriteError(data, `Erreur Appwrite (${res.status})`)
    );
    err.status = res.status;
    err.appwriteError = true;
    throw err;
  }
  return data as T;
}

interface AppwriteAccountResponse {
  $id: string;
  name: string;
  email: string;
  phone?: string;
  emailVerification?: boolean;
}

export interface DirectAuthUserPayload {
  $id: string;
  user_id: string;
  name: string;
  nom: string;
  prenom: string;
  email: string;
  phone?: string;
  telephone: string;
  solde: number;
  code_parrainage: string;
  parrain?: string;
  date_inscription?: string;
  statut?: string;
  email_verifie: boolean;
  kyc_level?: number;
  kyc_statut?: string;
  pays?: string;
  role?: string;
}

export interface DirectAuthWalletPayload {
  $id: string;
  user_id: string;
  solde_total: number;
  solde_disponible: number;
  solde_bloque: number;
  compte_trade?: number;
  solde_wallet?: number;
  devise: string;
  date_maj?: string;
  coins_json?: string;
}

function buildFallbackUserAndWallet(
  acc: AppwriteAccountResponse,
  extra?: { nom?: string; prenom?: string; telephone?: string; pays?: string; parrain?: string }
): { user: DirectAuthUserPayload; wallet: DirectAuthWalletPayload } {
  const fullName = extra
    ? `${extra.prenom ? extra.prenom + ' ' : ''}${extra.nom || ''}`.trim() || acc.name || acc.email
    : acc.name || acc.email;
  const nowIso = new Date().toISOString();
  const isEmailVerified = Boolean(acc.emailVerification);
  return {
    user: {
      $id: acc.$id,
      user_id: acc.$id,
      name: fullName,
      nom: extra?.nom || acc.name || 'Client',
      prenom: extra?.prenom || '',
      email: acc.email,
      phone: extra?.telephone || acc.phone || '',
      telephone: extra?.telephone || acc.phone || '',
      solde: 0,
      code_parrainage: `SALOMA-${acc.$id.slice(-6).toUpperCase()}`,
      parrain: extra?.parrain || '',
      date_inscription: nowIso,
      statut: 'actif',
      email_verifie: isEmailVerified,
      kyc_level: isEmailVerified ? 1 : 0,
      pays: extra?.pays || 'Madagascar 🇲🇬',
      role: 'client'
    },
    wallet: {
      $id: `wallet-${acc.$id}`,
      user_id: acc.$id,
      solde_total: 0,
      solde_disponible: 0,
      solde_bloque: 0,
      compte_trade: 0,
      solde_wallet: 0,
      devise: 'Ar',
      date_maj: nowIso,
      coins_json: '{}'
    }
  };
}

export async function directAppwriteGetSession(): Promise<{
  userId: string;
  requiresEmailVerification: boolean;
  user: DirectAuthUserPayload;
  wallet: DirectAuthWalletPayload;
}> {
  const acc = await directAppwriteFetch<AppwriteAccountResponse>('/account');
  const { user, wallet } = buildFallbackUserAndWallet(acc);
  return {
    userId: acc.$id,
    requiresEmailVerification: !acc.emailVerification,
    user,
    wallet
  };
}

export async function directAppwriteLogin(
  email: string,
  password: string
): Promise<{
  sessionSecret: string;
  userId: string;
  requiresEmailVerification: boolean;
  user: DirectAuthUserPayload;
  wallet: DirectAuthWalletPayload;
}> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    await directAppwriteFetch('/account/sessions/email', {
      method: 'POST',
      body: { email: cleanEmail, password }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('session is active')) {
      try {
        await directAppwriteFetch('/account/sessions/current', { method: 'DELETE' });
      } catch {
        // ignore delete failure
      }
      await directAppwriteFetch('/account/sessions/email', {
        method: 'POST',
        body: { email: cleanEmail, password }
      });
    } else {
      throw err;
    }
  }

  const acc = await directAppwriteFetch<AppwriteAccountResponse>('/account');
  if (!acc.emailVerification) {
    try {
      await directAppwriteFetch('/account/verifications/email/otp', {
        method: 'POST',
        body: {}
      });
    } catch {
      // ignore rate limit on email OTP resend
    }
  }

  const { user, wallet } = buildFallbackUserAndWallet(acc);
  return {
    sessionSecret: COOKIE_SESSION_MARKER,
    userId: acc.$id,
    requiresEmailVerification: !acc.emailVerification,
    user,
    wallet
  };
}

export async function directAppwriteRegister(params: {
  nom: string;
  prenom?: string;
  email: string;
  telephone?: string;
  password: string;
  parrain?: string;
  pays?: string;
}): Promise<{
  sessionSecret: string;
  userId: string;
  requiresEmailVerification: boolean;
  user: DirectAuthUserPayload;
  wallet: DirectAuthWalletPayload;
}> {
  const cleanEmail = params.email.trim().toLowerCase();
  const fullName = `${params.prenom ? params.prenom + ' ' : ''}${params.nom}`.trim();

  await directAppwriteFetch('/account', {
    method: 'POST',
    body: {
      userId: 'unique()',
      email: cleanEmail,
      password: params.password,
      name: fullName
    }
  });

  await directAppwriteFetch('/account/sessions/email', {
    method: 'POST',
    body: { email: cleanEmail, password: params.password }
  });

  try {
    await directAppwriteFetch('/account/verifications/email/otp', {
      method: 'POST',
      body: {}
    });
  } catch {
    // ignore transient OTP issue
  }

  const acc = await directAppwriteFetch<AppwriteAccountResponse>('/account');
  const { user, wallet } = buildFallbackUserAndWallet(acc, {
    nom: params.nom,
    prenom: params.prenom,
    telephone: params.telephone,
    pays: params.pays,
    parrain: params.parrain
  });

  return {
    sessionSecret: COOKIE_SESSION_MARKER,
    userId: acc.$id,
    requiresEmailVerification: true,
    user,
    wallet
  };
}

export async function directAppwriteVerifyEmailOtp(userId: string, code: string): Promise<void> {
  await directAppwriteFetch('/account/verifications/email/otp', {
    method: 'PUT',
    body: { userId, secret: code }
  });
}

export async function directAppwriteResendEmailOtp(): Promise<void> {
  await directAppwriteFetch('/account/verifications/email/otp', {
    method: 'POST',
    body: {}
  });
}

export async function directAppwriteLogout(): Promise<void> {
  try {
    await directAppwriteFetch('/account/sessions/current', { method: 'DELETE' });
  } catch {
    // ignore logout error
  }
  clearFallbackCookieHeader();
}
