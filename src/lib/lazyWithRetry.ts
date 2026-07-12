import { lazy, ComponentType } from 'react';

// Guarda anti-loop: só 1 reload automático a cada janela.
const RETRY_TS_KEY = 'chunk-reload-ts';
const RETRY_WINDOW_MS = 20_000;

/**
 * Igual a React.lazy, mas se o import dinâmico do chunk falhar (deploy novo deixou
 * o chunk antigo com 404, cache do Service Worker desatualizado, rede instável),
 * limpa os caches e recarrega a página UMA vez para buscar o index.html + chunks
 * frescos. Se já recarregou há pouco, propaga o erro para o ErrorBoundary.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const last = Number(sessionStorage.getItem(RETRY_TS_KEY) || '0');
      if (Date.now() - last > RETRY_WINDOW_MS) {
        sessionStorage.setItem(RETRY_TS_KEY, String(Date.now()));
        try {
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
        } catch {
          /* segue para o reload de qualquer forma */
        }
        window.location.reload();
        // Mantém a promessa pendente enquanto a página recarrega.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
