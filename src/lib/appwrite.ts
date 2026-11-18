const readEnv = (getter: () => unknown, fallback = ''): string => {
  try {
    const val = getter();
    return typeof val === 'string' && val.trim() ? val.trim() : fallback;
  } catch {
    return fallback;
  }
};

export const ENV_CONFIG = {
  supabaseUrl: readEnv(() => import.meta.env?.VITE_SUPABASE_URL, ''),
  supabaseAnonKey: readEnv(() => import.meta.env?.VITE_SUPABASE_ANON_KEY, ''),
  cloudflareSiteKey:
    readEnv(() => import.meta.env?.VITE_CLOUDFLARE_SITE_KEY, '') ||
    readEnv(() => import.meta.env?.NEXT_PUBLIC_CLOUDFLARE_SITE_KEY, ''),
  appwriteEndpoint: readEnv(
    () => import.meta.env?.VITE_APPWRITE_ENDPOINT,
    'https://fra.cloud.appwrite.io/v1'
  ),
  appwriteProjectId: readEnv(
    () => import.meta.env?.VITE_APPWRITE_PROJECT_ID,
    '6af771140031749ce67c'
  ),
  appwriteDatabaseId: readEnv(
    () => import.meta.env?.VITE_APPWRITE_DATABASE_ID,
    '6af7739d00073c4937e6'
  )
};

export const APPWRITE_ENDPOINT = ENV_CONFIG.appwriteEndpoint;
export const APPWRITE_PROJECT_ID = ENV_CONFIG.appwriteProjectId;
export const APPWRITE_DATABASE_ID = ENV_CONFIG.appwriteDatabaseId;
export const hasSupabaseConfig = Boolean(ENV_CONFIG.supabaseUrl && ENV_CONFIG.supabaseAnonKey);

export function subscribeToNotificationsStream<T>(
  token: string,
  onNotification: (payload: T) => void
): () => void {
  if (typeof window === 'undefined' || !token) {
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
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.adminPin) {
    headers['x-admin-pin'] = options.adminPin;
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
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller?.signal
    });
  } catch {
    if (timer) clearTimeout(timer);
    throw new Error(
      'Impossible de contacter le serveur SALOMA. Vérifiez votre connexion internet ou la configuration Vercel.'
    );
  }
  if (timer) clearTimeout(timer);

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : {};

  if (!res.ok) {
    if (res.status === 404 && !data?.error) {
      throw new Error(
        'Service API introuvable (404). Vérifiez que les routes /api sont bien déployées sur Vercel et que les variables d’environnement sont configurées.'
      );
    }
    throw new Error(data?.error || `Erreur serveur (${res.status})`);
  }
  return data as T;
}
