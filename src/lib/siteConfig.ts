// Origem pública do app (domínio real de produção, servido pela Netlify).
// Os assets em /public (imagens, templates ZapSign) são servidos por esta origem.
//
// Prioridade: VITE_SITE_URL (override explícito, ex.: staging) → origem atual do
// navegador. Em produção, window.location.origin já resolve para o domínio real,
// então nenhuma configuração é necessária.
export const SITE_ORIGIN =
  ((import.meta.env.VITE_SITE_URL as string | undefined) ||
    (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

/** Monta a URL absoluta de um asset em /public. */
export const assetUrl = (path: string): string =>
  `${SITE_ORIGIN}/${path.replace(/^\//, '')}`;
