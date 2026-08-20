'use client';

import { useCompatibility } from '@/lib/compatibility';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

export function CompatibilityBanner() {
  const { data: compat, isLoading } = useCompatibility();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || !compat || compat.canControl || dismissed) {
    return null;
  }

  const isError = !compat.canControl;

  const onRefreshPwa = async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    window.location.reload();
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 flex items-start gap-3 shadow-lg ${
        isError ? 'bg-red-600 text-white' : 'bg-amber-500 text-black'
      }`}
    >
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">
          {isError ? 'Firmware Incompatible — Control Disabled' : 'Compatibility Warning'}
        </p>
        <p className="text-xs mt-1 opacity-90">{compat.message}</p>
        <p className="text-xs mt-1 opacity-75">
          PWA v{compat.pwaVersion}
          {compat.firmwareVersion ? ` · Firmware v${compat.firmwareVersion}` : ''}
        </p>
        <div className="flex gap-2 mt-2">
          {compat.status === 'pwa_too_old' && (
            <button
              onClick={onRefreshPwa}
              className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh PWA
            </button>
          )}
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
