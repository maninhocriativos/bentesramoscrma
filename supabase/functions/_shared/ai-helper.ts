// ─────────────────────────────────────────────────────────────────────────────
// Helper de IA compartilhado — OpenAI (primário) com fallback para Anthropic Claude.
// Substitui o antigo gateway do Lovable (ai.gateway.lovable.dev).
//
// Modelos configuráveis por env (sem precisar alterar código):
//   OPENAI_MODEL     (default: gpt-4o)
//   ANTHROPIC_MODEL  (default: claude-sonnet-4-20250514)
// ─────────────────────────────────────────────────────────────────────────────

const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o";
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-20250514";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

// Erro tipado para a função chamadora mapear status HTTP (429 rate limit, 402 créditos).
export class AIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AIError";
  }
}

async function callOpenAI(opts: ChatOptions, apiKey: string): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2000,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new AIError(`OpenAI ${resp.status}: ${t.substring(0, 300)}`, resp.status);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(opts: ChatOptions, apiKey: string): Promise<string> {
  // Anthropic separa o system do array de mensagens.
  const system = opts.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const messages = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: opts.maxTokens ?? 2000,
      temperature: opts.temperature ?? 0.7,
      ...(system ? { system } : {}),
      messages,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new AIError(`Anthropic ${resp.status}: ${t.substring(0, 300)}`, resp.status);
  }
  const data = await resp.json();
  return data.content?.[0]?.text || "";
}

/**
 * Executa um chat completion. Tenta OpenAI primeiro; em caso de falha (erro de
 * servidor, indisponibilidade, rate limit), cai automaticamente para o Claude.
 * Se ambos falharem, propaga o último AIError.
 */
export async function chatCompletion(opts: ChatOptions): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!openaiKey && !anthropicKey) {
    throw new AIError("Nenhuma chave de IA configurada (OPENAI_API_KEY ou ANTHROPIC_API_KEY)", 500);
  }

  if (openaiKey) {
    try {
      return await callOpenAI(opts, openaiKey);
    } catch (e) {
      console.error("OpenAI falhou; tentando fallback Claude:", (e as Error).message);
      if (!anthropicKey) throw e;
    }
  }
  return await callAnthropic(opts, anthropicKey!);
}
