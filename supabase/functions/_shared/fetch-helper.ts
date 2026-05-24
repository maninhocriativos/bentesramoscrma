/**
 * Wrapper para fetch com timeout padrão por categoria de serviço.
 * Usar sempre que chamar APIs externas em Edge Functions.
 */

export const TIMEOUT = {
  ZAPI:       10_000, // Z-API WhatsApp
  CLICKSIGN:   8_000, // Clicksign assinatura
  META:       10_000, // Facebook/Meta Graph API
  GOOGLE:     12_000, // Google APIs (Drive, Calendar, Sheets)
  OPENAI:     45_000, // OpenAI (Whisper, GPT) — pode ser lento
  ANTHROPIC:  45_000, // Anthropic Claude
  ESCAVADOR:  15_000, // Escavador processos
  DEFAULT:    10_000, // qualquer outra API externa
} as const;

/**
 * fetch com AbortSignal.timeout automático.
 * Lança DOMException("signal timed out") se exceder o prazo.
 */
export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = TIMEOUT.DEFAULT,
): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * Lê e parseia o body de um Request com tratamento de erro.
 * Retorna null se o body for inválido ou vazio.
 */
export async function parseRequestBody<T = unknown>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
