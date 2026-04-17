import { useEffect } from 'react';

const SW_VERSION = __BUILD_DATE__;
const SW_URL = import.meta.env.PROD ? `/sw.js?v=${SW_VERSION}` : '/sw.js';
const SW_CHECK_INTERVAL_MS = 60_000;
const RELOAD_TS_KEY = 'sw-reload-ts';
const RELOAD_VERSION_KEY = 'sw-reload-version';
const RELOAD_COUNT_KEY = 'sw-reload-count';
const RELOAD_COOLDOWN_MS = 30_000;
const MAX_RELOADS_PER_SESSION = 2;

/**
 * Em produção, registra o SW com versão de build para furar cache/CDN
 * e recarrega a página uma única vez quando um novo deploy é ativado.
 */
export function useServiceWorkerUpdate() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (!import.meta.env.PROD) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;
    let intervalId: number | null = null;
    let disposed = false;

    const safeReload = (version: string) => {
      const lastVersion = sessionStorage.getItem(RELOAD_VERSION_KEY);
      const lastTs = Number(sessionStorage.getItem(RELOAD_TS_KEY) || '0');

      if (lastVersion === version && Date.now() - lastTs < RELOAD_COOLDOWN_MS) {
        console.log('[SW] Reload ignorado — mesma versão em cooldown');
        return;
      }

      sessionStorage.setItem(RELOAD_VERSION_KEY, version);
      sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
      window.location.reload();
    };

    const skipWaiting = (worker?: ServiceWorker | null) => {
      worker?.postMessage({ type: 'SKIP_WAITING' });
    };

    const watchRegistration = (reg: ServiceWorkerRegistration) => {
      registration = reg;

      if (reg.waiting) {
        skipWaiting(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] Novo worker instalado, ativando...');
            skipWaiting(newWorker);
          }
        });
      });
    };

    const registerServiceWorker = async () => {
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, {
          scope: '/',
          updateViaCache: 'none',
        });

        if (disposed) return;

        watchRegistration(reg);
        await reg.update();
      } catch (error) {
        console.error('[SW] Falha ao registrar service worker', error);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'SW_UPDATED') return;

      const version = String(event.data?.version || SW_VERSION);
      console.log('[SW] Nova versão ativada:', version);
      setTimeout(() => safeReload(version), 300);
    };

    const checkForUpdates = () => {
      if (document.visibilityState === 'visible') {
        void registration?.update();
      }
    };

    const handleLoad = () => {
      void registerServiceWorker();
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    document.addEventListener('visibilitychange', checkForUpdates);

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad, { once: true });
    }

    intervalId = window.setInterval(checkForUpdates, SW_CHECK_INTERVAL_MS);

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      document.removeEventListener('visibilitychange', checkForUpdates);
      window.removeEventListener('load', handleLoad);

      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, []);
}
