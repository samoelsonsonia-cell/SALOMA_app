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

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
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

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-amber-500/95 border border-amber-300 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-xl backdrop-blur-md">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Mode Hors Ligne — Données en cache actives</span>
    </div>
  );
};
