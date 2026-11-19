import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export async function checkInternetConnectivity(timeoutMs = 4500): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  if (typeof fetch === 'undefined') {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    await fetch(`/api/security/turnstile?ping=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
      signal: controller?.signal
    });
    if (timer) clearTimeout(timer);
    return typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  } catch {
    if (timer) clearTimeout(timer);
    return false;
  }
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    let active = true;

    const verifyOnline = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (active) setIsOnline(false);
        return;
      }
      const ok = await checkInternetConnectivity(4000);
      if (active) setIsOnline(ok);
    };

    const handleOnline = () => {
      void verifyOnline();
    };
    const handleOffline = () => {
      if (active) setIsOnline(false);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void verifyOnline();
      }
    };

    void verifyOnline();
    const pollTimer = setInterval(() => {
      void verifyOnline();
    }, 15000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      clearInterval(pollTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return { isOnline, setIsOnline };
}

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={
          compact
            ? 'flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] px-2.5 py-1.5 text-[10px] font-extrabold text-white border border-purple-300/40 shadow-[0_0_12px_rgba(124,58,237,0.5)] hover:opacity-90 active:scale-95 transition'
            : 'w-full py-3 rounded-2xl bg-[#1F1042] hover:bg-[#2B1B5D] text-amber-300 text-xs font-extrabold border-2 border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.25)] flex items-center justify-center gap-2 active:scale-98 transition'
        }
        title="Installer SALOMA sur votre appareil"
      >
        <Download className={compact ? 'w-3.5 h-3.5 text-amber-300' : 'w-4 h-4 text-amber-300'} />
        <span>{compact ? 'Installer' : 'Installer l\'App SALOMA (PWA)'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={
            compact
              ? 'flex items-center gap-1 rounded-xl bg-[#23154D] px-2.5 py-1.5 text-[10px] font-bold text-amber-300 border border-amber-400/40 hover:bg-[#2F1D63] transition'
              : 'w-full py-3 rounded-2xl bg-[#1F1042] hover:bg-[#2B1B5D] text-amber-300 text-xs font-extrabold border-2 border-amber-400/50 flex items-center justify-center gap-2 transition'
          }
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>{compact ? 'App iOS' : 'Installer SALOMA sur iOS'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6] p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white">Installer SALOMA sur iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg bg-[#23154D] text-purple-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-purple-200 leading-relaxed">
                1. Appuyez sur le bouton <strong>Partager</strong> dans la barre Safari.<br />
                2. Faites défiler et sélectionnez <strong>Sur l'écran d'accueil</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-xs font-bold text-white"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC<{
  blocked?: boolean;
  onRetry?: () => Promise<boolean> | void;
}> = ({ blocked = false, onRetry }) => {
  const [retrying, setRetrying] = useState(false);
  const [stillOfflineMsg, setStillOfflineMsg] = useState(false);

  if (!blocked) return null;

  const handleRetryClick = async () => {
    if (retrying) return;
    setRetrying(true);
    setStillOfflineMsg(false);
    try {
      const ok = onRetry ? await onRetry() : await checkInternetConnectivity(4000);
      if (ok === false) {
        setStillOfflineMsg(true);
      }
    } catch {
      setStillOfflineMsg(true);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="saloma-offline-title"
      className="fixed inset-0 z-[120] bg-[#150D2E] flex flex-col items-center justify-center p-6 text-center select-none"
    >
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[520px] h-[300px] bg-gradient-to-b from-[#7C3AED]/30 via-[#8B5CF6]/10 to-transparent blur-3xl pointer-events-none" />
      <div className="w-full max-w-sm rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6] shadow-[0_0_45px_rgba(124,58,237,0.5)] p-6 space-y-5 relative z-10">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/15 border-2 border-rose-500/60 flex items-center justify-center shadow-[0_0_25px_rgba(244,63,94,0.25)]">
          <WifiOff className="w-8 h-8 text-rose-400" />
        </div>

        <div className="space-y-2">
          <span className="inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-[#23154D] text-purple-200 border border-[#8B5CF6]/40">
            SALOMA • Hors Ligne
          </span>
          <h2 id="saloma-offline-title" className="text-lg font-black text-white">
            Connexion Internet requise
          </h2>
          <p className="text-xs font-bold text-amber-300">
            Vérifiez vos données mobiles
          </p>
          <p className="text-[11px] text-purple-200/80 leading-relaxed">
            Activez vos données mobiles ou le Wi-Fi pour accéder au Dashboard, au Trading, à l&apos;Échange et à votre Portefeuille.
          </p>
        </div>

        {stillOfflineMsg && (
          <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-[11px] font-bold">
            Toujours aucune connexion détectée. Vérifiez vos données mobiles.
          </div>
        )}

        <button
          type="button"
          disabled={retrying}
          onClick={handleRetryClick}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#7C3AED] text-white font-black text-sm shadow-[0_0_25px_rgba(124,58,237,0.7)] border border-purple-300/40 active:scale-[0.98] transition disabled:opacity-60"
        >
          {retrying ? 'Vérification de la connexion...' : 'Réessayer'}
        </button>
      </div>
    </div>
  );
};
