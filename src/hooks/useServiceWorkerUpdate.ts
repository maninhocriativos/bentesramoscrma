import { useEffect } from 'react';

const SW_VERSION = __BUILD_DATE__;
const SW_URL = `/sw.js?v=${SW_VERSION}`;
const UPDATE_CHECK_INTERVAL_MS = 60_000;

/**
 * Registra o Service Worker com cache-bust por build e força adoção imediata
 * da versão nova quando um deploy é publicado.
 */
export function useServiceWorkerUpdate() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let intervalId: number | null = null;
    let reloadTriggered = false;
    let registration: ServiceWorkerRegistration | null = null;

    const reloadOnce = () => {
      if (reloadTriggered) return;
      reloadTriggered = true;
      window.location.reload();
    };

    const skipWaiting = (worker?: ServiceWorker | null) => {
      worker?.postMessage({ type: 'SKIP_WAITING' });
    };

    const attachRegistrationListeners = (reg: ServiceWorkerRegistration) => {
      registration = reg;

      if (reg.waiting) {
        skipWaiting(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            skipWaiting(newWorker);
          }
        });
      });
    };

    const registerOrUpdateServiceWorker = async () => {
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, {
          scope: '/',
          updateViaCache: 'none',
        });

        attachRegistrationListeners(reg);
        await reg.update();
      } catch (error) {
        console.error('[SW] Falha ao registrar/atualizar o service worker', error);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[SW] Nova versão detectada, recarregando...');
        setTimeout(reloadOnce, 300);
      }
    };

    const handleControllerChange = () => {
      console.log('[SW] Controller trocado, recarregando...');
      reloadOnce();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void registration?.update();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (document.readyState === 'complete') {
      void registerOrUpdateServiceWorker();
    } else {
      window.addEventListener('load', () => {
        void registerOrUpdateServiceWorker();
      }, { once: true });
    }

    intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void registration?.update();
      }
    }, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, []);
}
