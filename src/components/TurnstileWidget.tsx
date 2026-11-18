import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible' | 'invisible';
          appearance?: 'always' | 'execute' | 'interaction-only';
          execution?: 'render' | 'execute';
          language?: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: (errorCode?: string | number) => void;
        }
      ) => string;
      execute?: (containerOrId?: HTMLElement | string) => void;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptLoaderPromise: Promise<void> | null = null;

function ensureTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoaderPromise) return scriptLoaderPromise;

  scriptLoaderPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-saloma-turnstile="1"]'
    );
    if (existing) {
      if (window.turnstile) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => {
          scriptLoaderPromise = null;
          reject(new Error('turnstile-script-error'));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.salomaTurnstile = '1';
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoaderPromise = null;
      reject(new Error('turnstile-script-error'));
    };
    document.head.appendChild(script);
  });

  return scriptLoaderPromise;
}

interface TurnstileWidgetProps {
  siteKey: string;
  resetKey?: number;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

/**
 * Cloudflare Turnstile en mode automatique et invisible :
 * - Aucune case à cocher pour l'utilisateur
 * - Se lance automatiquement dès l'ouverture de l'écran
 * - Réessaie silencieusement en arrière-plan en cas d'expiration ou de délai réseau
 */
export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  siteKey,
  resetKey = 0,
  onVerify,
  onExpire,
  onError
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });
  callbacksRef.current = { onVerify, onExpire, onError };

  const removeActiveWidget = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (widgetIdRef.current && typeof window !== 'undefined' && window.turnstile) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        // ignore remove error
      }
      widgetIdRef.current = null;
    }
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  };

  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;

    const scheduleSilentRetry = () => {
      if (cancelled || retryCount >= 6) return;
      retryCount += 1;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
            return;
          } catch {
            // fall through to re-mount
          }
        }
        void mountInvisibleWidget();
      }, 1500);
    };

    const mountInvisibleWidget = async () => {
      try {
        await ensureTurnstileScript();
        if (cancelled || !containerRef.current || !window.turnstile) return;

        removeActiveWidget();

        const effectiveKey = (siteKey || '1x00000000000000000000AA').trim();
        const wid = window.turnstile.render(containerRef.current, {
          sitekey: effectiveKey,
          theme: 'dark',
          appearance: 'interaction-only',
          execution: 'render',
          language: 'fr',
          callback: (tok: string) => {
            if (cancelled) return;
            retryCount = 0;
            callbacksRef.current.onVerify(tok);
          },
          'expired-callback': () => {
            if (cancelled) return;
            callbacksRef.current.onExpire?.();
            scheduleSilentRetry();
          },
          'error-callback': () => {
            if (cancelled) return;
            callbacksRef.current.onExpire?.();
            callbacksRef.current.onError?.();
            scheduleSilentRetry();
          }
        });
        widgetIdRef.current = wid;
      } catch {
        if (!cancelled) {
          callbacksRef.current.onError?.();
          scheduleSilentRetry();
        }
      }
    };

    void mountInvisibleWidget();

    return () => {
      cancelled = true;
      removeActiveWidget();
    };
  }, [siteKey, resetKey]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none opacity-0 h-0 w-0 overflow-hidden absolute -z-10"
    >
      <div ref={containerRef} />
    </div>
  );
};
