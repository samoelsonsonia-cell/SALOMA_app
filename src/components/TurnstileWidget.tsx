import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle, Check, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
          appearance?: 'always' | 'execute' | 'interaction-only';
          execution?: 'render' | 'execute';
          language?: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: (errorCode?: string | number) => void;
        }
      ) => string;
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
          reject(new Error('Erreur de vérification Cloudflare. Cliquez sur Actualiser.'));
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
      reject(new Error('Erreur de vérification Cloudflare. Cliquez sur Actualiser.'));
    };
    document.head.appendChild(script);
  });

  return scriptLoaderPromise;
}

interface TurnstileWidgetProps {
  siteKey: string;
  token: string;
  resetKey?: number;
  onVerify: (token: string, verifiedProof?: string) => void;
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

  const [isHumanChecked, setIsHumanChecked] = useState<boolean>(false);
  const [verifyingServer, setVerifyingServer] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>('');
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const isVerified = Boolean(token) && isHumanChecked && !verifyingServer;

  const removeActiveWidget = () => {
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

  // Reset checkbox & widget whenever parent bumps resetKey
  useEffect(() => {
    if (resetKey > 0) {
      removeActiveWidget();
      setIsHumanChecked(false);
      setVerifyingServer(false);
      setLoadError('');
    }
  }, [resetKey]);

  // Mount interactive Turnstile widget ONLY after user manually checks "Je ne suis pas un robot"
  useEffect(() => {
    if (!isHumanChecked) {
      removeActiveWidget();
      return;
    }

    let cancelled = false;
    setLoadError('');

    const verifyTokenWithBackend = async (tok: string) => {
      if (cancelled) return;
      setVerifyingServer(true);
      setLoadError('');
      try {
        const res = await fetch('/api/security/turnstile/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tok })
        });
        const contentType = res.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
          ? ((await res.json().catch(() => ({}))) as {
              success?: boolean;
              verifiedProof?: string;
              error?: string;
            })
          : {};

        if (cancelled) return;

        if (!res.ok || !data?.success) {
          callbacksRef.current.onExpire?.();
          callbacksRef.current.onError?.();
          setLoadError(
            data?.error || 'Erreur de vérification Cloudflare. Cliquez sur Actualiser.'
          );
          return;
        }

        callbacksRef.current.onVerify(tok, data.verifiedProof || '');
      } catch {
        if (!cancelled) {
          callbacksRef.current.onExpire?.();
          callbacksRef.current.onError?.();
          setLoadError('Erreur de vérification Cloudflare. Cliquez sur Actualiser.');
        }
      } finally {
        if (!cancelled) {
          setVerifyingServer(false);
        }
      }
    };

    const mountWidget = async () => {
      try {
        await ensureTurnstileScript();
        if (cancelled || !containerRef.current || !window.turnstile) return;

        removeActiveWidget();

        const effectiveKey = (siteKey || '1x00000000000000000000AA').trim();
        const wid = window.turnstile.render(containerRef.current, {
          sitekey: effectiveKey,
          theme: 'dark',
          size: 'normal',
          appearance: 'always',
          execution: 'render',
          language: 'fr',
          callback: (tok: string) => {
            void verifyTokenWithBackend(tok);
          },
          'expired-callback': () => {
            if (cancelled) return;
            removeActiveWidget();
            setIsHumanChecked(false);
            setVerifyingServer(false);
            callbacksRef.current.onExpire?.();
            setLoadError('Vérification expirée. Veuillez recocher « Je ne suis pas un robot ».');
          },
          'error-callback': () => {
            if (cancelled) return;
            setVerifyingServer(false);
            callbacksRef.current.onExpire?.();
            callbacksRef.current.onError?.();
            setLoadError('Erreur de vérification Cloudflare. Cliquez sur Actualiser.');
          }
        });
        widgetIdRef.current = wid;
      } catch {
        if (!cancelled) {
          setVerifyingServer(false);
          setLoadError('Erreur de vérification Cloudflare. Cliquez sur Actualiser.');
        }
      }
    };

    void mountWidget();

    return () => {
      cancelled = true;
      removeActiveWidget();
    };
  }, [isHumanChecked, siteKey, reloadNonce]);

  const handleCheckboxToggle = (checked: boolean) => {
    setLoadError('');
    setVerifyingServer(false);
    if (!checked) {
      removeActiveWidget();
      setIsHumanChecked(false);
      callbacksRef.current.onExpire?.();
      return;
    }
    callbacksRef.current.onExpire?.();
    setIsHumanChecked(true);
    setReloadNonce(n => n + 1);
  };

  const handleManualReload = () => {
    callbacksRef.current.onExpire?.();
    setLoadError('');
    setVerifyingServer(false);
    removeActiveWidget();
    if (!isHumanChecked) {
      setIsHumanChecked(true);
    }
    setReloadNonce(n => n + 1);
  };

  const effectiveSiteKey = (siteKey || '1x00000000000000000000AA').trim();
  const isTestMode = effectiveSiteKey === '1x00000000000000000000AA';

  return (
    <div
      className={`p-3 rounded-2xl border-2 transition ${
        isVerified
          ? 'bg-[#121F28] border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.18)]'
          : 'bg-[#150D2E] border-[#8B5CF6]/45'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5 px-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <ShieldCheck
            className={`w-3.5 h-3.5 shrink-0 ${
              isVerified ? 'text-emerald-400' : 'text-[#A78BFA]'
            }`}
          />
          <span className="text-[10px] font-bold text-purple-200 truncate">
            Sécurité Cloudflare Turnstile
          </span>
          {isTestMode && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[9px] font-black shrink-0">
              Mode Test
            </span>
          )}
        </div>

        {isVerified ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-black shrink-0">
            <Check className="w-3 h-3" />
            Vérifié
          </span>
        ) : verifyingServer ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#7C3AED]/25 border border-[#8B5CF6]/50 text-purple-200 text-[10px] font-bold shrink-0">
            <Loader2 className="w-3 h-3 animate-spin" />
            Validation...
          </span>
        ) : (
          <button
            type="button"
            onClick={handleManualReload}
            title="Actualiser le widget Cloudflare"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#23154D] text-purple-200 hover:text-white text-[10px] font-bold shrink-0 border border-[#8B5CF6]/30"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            Actualiser
          </button>
        )}
      </div>

      {/* CHECKBOX MANUELLE VISIBLE OBLIGATOIRE */}
      <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#1D1240] border border-[#8B5CF6]/45 cursor-pointer select-none hover:border-[#8B5CF6] transition">
        <div className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={isHumanChecked}
            onChange={e => handleCheckboxToggle(e.target.checked)}
            className="w-4 h-4 rounded border-2 border-[#8B5CF6] bg-[#150D2E] text-[#7C3AED] accent-[#7C3AED] cursor-pointer shrink-0"
          />
          <span className="text-xs font-extrabold text-white">Je ne suis pas un robot</span>
        </div>
        <span className="text-[9px] font-mono text-purple-300/80 uppercase">Cloudflare</span>
      </label>

      {isTestMode && (
        <div className="mt-2 px-2 py-1.5 rounded-xl bg-amber-500/10 border border-amber-400/35 text-amber-200 text-[10px] leading-snug">
          Clé Cloudflare en <strong>mode test</strong> (« À des fins de test uniquement »). Ajoutez{' '}
          <span className="font-mono font-bold text-amber-300">VITE_CLOUDFLARE_SITE_KEY</span> en
          production ou via Admin → Sécu.
        </div>
      )}

      {!isHumanChecked && !loadError && (
        <p className="mt-2 text-[10px] text-purple-300/80 text-center">
          Cochez la case « Je ne suis pas un robot » pour lancer la vérification Cloudflare.
        </p>
      )}

      {loadError && (
        <div className="mt-2 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[10px] font-bold flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {loadError}
          </span>
          <button
            type="button"
            onClick={handleManualReload}
            className="px-2.5 py-1 rounded-lg bg-rose-500/30 hover:bg-rose-500/45 text-white text-[10px] font-black shrink-0"
          >
            Actualiser
          </button>
        </div>
      )}

      {isHumanChecked && !loadError && (
        <div className="mt-2.5 flex flex-col items-center justify-center overflow-hidden rounded-xl">
          <div ref={containerRef} className="min-h-[65px] flex items-center justify-center" />
          {verifyingServer && (
            <span className="mt-1 text-[10px] text-purple-300 font-semibold">
              Vérification serveur Cloudflare en cours...
            </span>
          )}
        </div>
      )}
    </div>
  );
};
