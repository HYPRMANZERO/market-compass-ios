import { useEffect, useState } from 'react';

/**
 * Announce a new offline PWA shell only after an already-controlled page
 * receives a different service worker. The owner chooses when to reload.
 * Never clear caches, IndexedDB or an unlocked financial workspace here.
 */
export default function PwaUpdateNotice() {
  const [updateAvailable,setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD || typeof navigator === 'undefined' ||
        !('serviceWorker' in navigator)) return;
    let hadController = Boolean(navigator.serviceWorker.controller);
    const controllerChanged = () => {
      if (hadController) setUpdateAvailable(true);
      hadController = true;
    };
    navigator.serviceWorker.addEventListener('controllerchange',controllerChanged);
    return () => navigator.serviceWorker.removeEventListener('controllerchange',controllerChanged);
  },[]);

  if (!updateAvailable) return null;
  return (
    <aside role="status" aria-live="polite"
      className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-3 right-3 z-[100] mx-auto max-w-lg rounded-2xl border border-border bg-card p-4 text-foreground shadow-xl sm:bottom-5"
      data-testid="compass-update-available">
      <p className="text-[13px] font-bold">Compass update available</p>
      <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
        Save your current work before refreshing. Your encrypted vault and
        imported documents will not be cleared.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setUpdateAvailable(false)}
          className="min-h-11 rounded-xl border border-border px-4 text-[12px] font-semibold">
          Later
        </button>
        <button type="button" onClick={() => window.location.reload()}
          className="min-h-11 rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground">
          Refresh app
        </button>
      </div>
    </aside>
  );
}
