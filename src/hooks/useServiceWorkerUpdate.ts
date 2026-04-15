import { useEffect } from 'react';

const SW_CHECK_INTERVAL_MS = 60_000;
const RELOAD_COOLDOWN_KEY = 'sw_reload_ts';
const RELOAD_COOLDOWN_MS = 10_000;

/**
 * Detecta quando um novo Service Worker é instalado após um deploy
 * e recarrega a página uma única vez para adotar a versão nova.
 */
export function useServiceWorkerUpdate() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let intervalId: number | null = null;
    let registration: ServiceWorkerRegistration | null = null;

    const safeReload = () => {
      const lastReload = Number(sessionStorage.getItem(RELOAD_COOLDOWN_KEY) || '0');
      if (Date.now() - lastReload < RELOAD_COOLDOWN_MS) {
        console.log('[SW] Reload ignorado — cooldown ativo');
        return;
      }
      sessionStorage.setItem(RELOAD_COOLDOWN_KEY, String(Date.now()));
      window.location.reload();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[SW] Nova versão ativada, recarregando...');
        setTimeout(safeReload, 500);
      }
    };

    const listenForWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        return;
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // Só age quando existe um controller anterior (= é um UPDATE, não primeiro registro)
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] Novo worker instalado, solicitando ativação...');
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    };

    const init = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          updateViaCache: 'none',
        });
        registration = reg;
        listenForWaiting(reg);
      } catch (err) {
        console.error('[SW] Falha ao registrar service worker', err);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Registra após o load para não competir com o carregamento inicial
    if (document.readyState === 'complete') {
      void init();
    } else {
      window.addEventListener('load', () => void init(), { once: true });
    }

    // Checa atualizações periodicamente e ao voltar o foco
    const checkUpdate = () => {
      if (document.visibilityState === 'visible') {
        void registration?.update();
      }
    };

    intervalId = window.setInterval(checkUpdate, SW_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', checkUpdate);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      document.removeEventListener('visibilitychange', checkUpdate);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, []);
}
