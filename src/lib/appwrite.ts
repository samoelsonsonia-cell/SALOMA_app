export const APPWRITE_ENDPOINT =
  import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID =
  import.meta.env.VITE_APPWRITE_PROJECT_ID || '6af771140031749ce67c';
export const APPWRITE_DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID || '6af7739d00073c4937e6';

export function subscribeToNotificationsStream<T>(
  token: string,
  onNotification: (payload: T) => void
): () => void {
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

      if (!response.ok || !response.body) {
        if (response.status === 401 || response.status === 403) {
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

  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Erreur réseau (${res.status})`);
  }
  return data as T;
}
