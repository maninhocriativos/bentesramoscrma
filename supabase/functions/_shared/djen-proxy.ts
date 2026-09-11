// O DJEN (comunicaapi.pje.jus.br) bloqueia o IP de saída do Supabase — tanto
// por país (CloudFront geoblock) quanto por classe de IP (datacenter/hosting,
// confirmado em teste real 2026-09-11: um proxy datacenter brasileiro real
// ainda tomou 403). Só IP RESIDENCIAL brasileiro passa. `DJEN_PROXY_URL`
// (secret) aponta pra um proxy residencial (Webshare, gateway
// p.webshare.io:80, usuário com sufixo "-br-" força saída no Brasil).
//
// Deno não usa HTTP_PROXY/HTTPS_PROXY automaticamente no fetch() global —
// precisa de um Deno.createHttpClient() explícito passado via `client` em
// cada chamada.
const DJEN_PROXY_URL = Deno.env.get("DJEN_PROXY_URL");

let cachedClient: Deno.HttpClient | undefined;
let cachedFor: string | undefined;

export function getDjenHttpClient(): Deno.HttpClient | undefined {
  if (!DJEN_PROXY_URL) return undefined;
  if (cachedClient && cachedFor === DJEN_PROXY_URL) return cachedClient;
  cachedClient = Deno.createHttpClient({ proxy: { url: DJEN_PROXY_URL } });
  cachedFor = DJEN_PROXY_URL;
  return cachedClient;
}
