'use client';

import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone, Check } from 'lucide-react';

export const PWAInstaller: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('FirstTrade PWA ServiceWorker registered:', reg.scope))
        .catch((err) => console.warn('FirstTrade PWA SW registration failed:', err));
    }

    // 2. Check if already installed in standalone mode
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      if (isStandalone) {
        setIsInstalled(true);
        return;
      }

      // Check iOS Safari
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIosDevice);
    }

    // 3. Listen for Android / Chrome install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSTip(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled || isDismissed || (!isInstallable && !isIOS)) {
    return null;
  }

  return (
    <>
      {/* Sleek Floating Install Banner for Mobile & Web */}
      <div className="fixed top-14 sm:top-16 right-3 sm:right-5 z-50 animate-in slide-in-from-top-2 duration-200">
        <div className="flex items-center gap-2.5 bg-slate-900/95 dark:bg-[#121722]/95 text-white backdrop-blur-md px-3.5 py-2 rounded-2xl border border-emerald-500/30 shadow-2xl shadow-emerald-950/40">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-xs">
            <Smartphone className="w-4 h-4 text-black" />
          </div>

          <div className="text-left pr-1">
            <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
              <span>FirstTrade App</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-[#00D09C] font-mono">PWA</span>
            </div>
            <div className="text-[10px] text-slate-400">Install for 1-click mobile access</div>
          </div>

          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-xl bg-[#00D09C] hover:bg-[#00B887] text-black font-extrabold text-xs flex items-center gap-1 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors -mr-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* iOS Safari Add to Home Screen Instructions Modal */}
      {showIOSTip && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141926] text-slate-900 dark:text-white rounded-2xl p-5 max-w-xs w-full border border-slate-200 dark:border-[#22293A] shadow-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 mx-auto flex items-center justify-center">
              <Download className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm">Install FirstTrade on iOS</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              1. Tap the <strong className="text-slate-900 dark:text-white">Share</strong> button in Safari (box with up arrow).<br />
              2. Scroll down and tap <strong className="text-emerald-500">"Add to Home Screen"</strong>.
            </p>
            <button
              onClick={() => setShowIOSTip(false)}
              className="w-full py-2 rounded-xl bg-[#00D09C] text-black font-bold text-xs"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
