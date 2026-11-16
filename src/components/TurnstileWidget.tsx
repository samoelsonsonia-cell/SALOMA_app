import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle, Check } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
          language?: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptLoaderPromise: Promise<void> | null = null;

function ensureTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoaderPromise) return scriptLoaderPromise;

  scriptLoaderPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-saloma-turnstile="1"]');
    if (existing) {
      if (window.turnstile) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => {
        scriptLoaderPromise = null;
        reject(new Error('Impossible de charger Cloudflare Turnstile.'));
      }, { once: true });
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
      reject(new Error('Impossible de charger Cloudflare Turnstile.'));
    };
    document.head.appendChild(script);
  });

  return scriptLoaderPromise;
}

interface TurnstileWidgetProps {
  siteKey: string;
  token: string;
  resetKey?: number;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  siteKey,
  token,
  resetKey = 0,
  onVerify,
  onExpire,
  onError
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });
  callbacksRef.current = { onVerify, onExpire, onError };

  const [loadError, setLoadError] = useState<string>('');
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const isVerified = Boolean(token);

  useEffect(() => {
    let cancelled = false;
    setLoadError('');

    const mountWidget = async () => {
      try {
        await ensureTurnstileScript();
        if (cancelled || !containerRef.current || !window.turnstile) return;

        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore remove error
          }
          widgetIdRef.current = null;
        }
        containerRef.current.innerHTML = '';

        const effectiveKey = (siteKey || '1x00000000000000000000AA').trim();
        const wid = window.turnstile.render(containerRef.current, {
          sitekey: effectiveKey,
          theme: 'dark',
          size: 'normal',
          language: 'fr',
          callback: (tok: string) => {
            setLoadError('');
            callbacksRef.current.onVerify(tok);
          },
          'expired-callback': () => {
            callbacksRef.current.onExpire?.();
          },
          'error-callback': () => {
            callbacksRef.current.onExpire?.();
            callbacksRef.current.onError?.();
            setLoadError('Erreur de vérification Cloudflare. Cliquez sur Actualiser.');
          }
        });
        widgetIdRef.current = wid;
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Vérification Cloudflare indisponible.');
        }
      }
    };

    void mountWidget();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore cleanup error
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, resetKey, reloadNonce]);

  const handleManualReload = () => {
    callbacksRef.current.onExpire?.();
    setLoadError('');
    setReloadNonce(n => n + 1);
  };

  return (
    <div
      className={`p-2.5 rounded-2xl border transition ${
        isVerified
          ? 'bg-[#121F28] border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.18)]'
          : 'bg-[#150D2E] border-[#8B5CF6]/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${isVerified ? 'text-emerald-400' : 'text-[#A78BFA]'}`} />
          <span className="text-[10px] font-bold text-purple-200 truncate">
            Cloudflare • Je ne suis pas un robot
          </span>
        </div>

        {isVerified ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-black shrink-0">
            <Check className="w-3 h-3" />
            Vérifié
          </span>
        ) : (
          <button
            type="button"
            onClick={handleManualReload}
            title="Actualiser le widget Cloudflare"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[#23154D] text-purple-300 hover:text-white text-[9px] font-bold shrink-0"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            Actualiser
          </button>
        )}
      </div>

      {loadError ? (
        <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[10px] font-bold flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {loadError}
          </span>
          <button
            type="button"
            onClick={handleManualReload}
            className="px-2 py-1 rounded bg-rose-500/30 text-white text-[10px] font-black shrink-0"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <div className="flex justify-center overflow-hidden rounded-xl">
          <div ref={containerRef} className="min-h-[65px] flex items-center justify-center" />
        </div>
      )}
    </div>
  );
};
