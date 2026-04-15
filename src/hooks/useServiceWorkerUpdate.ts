import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Escuta mensagens do Service Worker e força reload quando há uma nova versão.
 * Adicione este hook no App.tsx para que funcione em todas as páginas.
 */
export function useServiceWorkerUpdate() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Escuta mensagem do SW novo informando que foi ativado
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[SW] Nova versão detectada, recarregando...');
        // Pequeno delay para o SW terminar de se instalar
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Verifica se já há um SW aguardando instalação (usuário que abriu a aba
    // antes do deploy e só agora o SW novo foi detectado)
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      // SW já está esperando — aciona imediatamente
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // SW novo chegou enquanto a aba estava aberta
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);
}
