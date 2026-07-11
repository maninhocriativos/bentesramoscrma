// Origem pública do app (domínio real de produção, servido pela Netlify).
// Configure o secret SITE_URL nas Edge Functions. Fallback: domínio Netlify.
const SITE_ORIGIN = (Deno.env.get("SITE_URL") || "https://bentesramoscrm.netlify.app").replace(/\/$/, "");

/** Monta a URL absoluta de um asset em /public ou de uma rota do app. */
export const siteUrl = (path = ""): string =>
  path ? `${SITE_ORIGIN}/${path.replace(/^\//, "")}` : SITE_ORIGIN;
