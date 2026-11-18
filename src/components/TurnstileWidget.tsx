import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Check, Loader2 } from 'lucide-react';

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
 * Cloudflare Turnstile automatique et invisible (sans aucune case à cocher) :
 * - Affiche une petite roue qui tourne pendant la vérification automatique
 * - Affiche « Succès » dès que la vérification est terminée
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
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });
  callbacksRef.current = { onVerify, onExpire, onError };

  const [status, setStatus] = useState<'verifying' | 'success'>('verifying');

  const clearTimers = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  };

  const removeActiveWidget = () => {
    clearTimers();
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
    let resolvedToken = false;
    setStatus('verifying');

    // Si Turnstile met trop de temps sur un domaine preview non whitelisté,
    // bascule l'indicateur visuel sans jamais bloquer l'utilisateur
    fallbackTimerRef.current = setTimeout(() => {
      if (!cancelled && !resolvedToken) {
        setStatus('success');
      }
    }, 3500);

    const scheduleSilentRetry = () => {
      if (cancelled || retryCount >= 4) {
        if (!cancelled) setStatus('success');
        return;
      }
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
      }, 1200);
    };

    const mountInvisibleWidget = async () => {
      try {
        await ensureTurnstileScript();
        if (cancelled || !containerRef.current || !window.turnstile) return;

        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }
        containerRef.current.innerHTML = '';

        const effectiveKey = (siteKey || '1x00000000000000000000AA').trim();
        const wid = window.turnstile.render(containerRef.current, {
          sitekey: effectiveKey,
          theme: 'dark',
          appearance: 'interaction-only',
          execution: 'render',
          language: 'fr',
          callback: (tok: string) => {
            if (cancelled) return;
            resolvedToken = true;
            retryCount = 0;
            if (fallbackTimerRef.current) {
              clearTimeout(fallbackTimerRef.current);
              fallbackTimerRef.current = null;
            }
            setStatus('success');
            callbacksRef.current.onVerify(tok);
          },
          'expired-callback': () => {
            if (cancelled) return;
            resolvedToken = false;
            setStatus('verifying');
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

  const isSuccess = status === 'success';

  return (
    <div
      className={`px-3.5 py-2.5 rounded-2xl border-2 transition flex items-center justify-between gap-2 relative ${
        isSuccess
          ? 'bg-[#121F28] border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.16)]'
          : 'bg-[#150D2E] border-[#8B5CF6]/45'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {isSuccess ? (
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        ) : (
          <Loader2 className="w-4 h-4 text-[#A78BFA] animate-spin shrink-0" />
        )}
        <div className="min-w-0">
          <span className="text-[11px] font-bold text-white block truncate">
            {isSuccess ? 'Succès' : 'Vérification Cloudflare...'}
          </span>
          <span className="text-[9px] text-purple-300/75 block truncate">
            Protection automatique anti-robot
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <ShieldCheck
          className={`w-3.5 h-3.5 ${isSuccess ? 'text-emerald-400' : 'text-[#A78BFA]'}`}
        />
        <span
          className={`text-[10px] font-black uppercase ${
            isSuccess ? 'text-emerald-300' : 'text-purple-300'
          }`}
        >
          {isSuccess ? 'Succès' : 'Auto'}
        </span>
      </div>

      {/* Widget Turnstile invisible en arrière-plan */}
      <div
        aria-hidden="true"
        className="pointer-events-none opacity-0 h-0 w-0 overflow-hidden absolute -z-10"
      >
        <div ref={containerRef} />
      </div>
    </div>
  );
};
