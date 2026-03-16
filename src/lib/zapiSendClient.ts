import { supabase } from '@/integrations/supabase/client';

type ZapiSendPayload = {
  to_phone?: string;
  message?: string;
  type?: string;
  provider?: string;
  lead_id?: string;
  file_name?: string;
  instance_id?: string;
  message_id?: string;
};

type ZapiSendResponse = {
  success?: boolean;
  data?: any;
  error?: string;
  messageId?: string;
};

const ZAPI_SEND_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-send`;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const NETWORK_ERROR_PATTERNS = [
  'failed to send a request to the edge function',
  'failed to fetch',
  'networkerror',
  'load failed',
  'fetch failed',
];

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : 'Erro desconhecido');
}

function isEdgeNetworkError(error: unknown): boolean {
  const message = toError(error).message.toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

async function callZapiSendDirect(
  payload: ZapiSendPayload,
): Promise<{ data: ZapiSendResponse | null; error: Error | null }> {
  const { data: sessionData } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_PUBLISHABLE_KEY,
  };

  const accessToken = sessionData.session?.access_token;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(ZAPI_SEND_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let data: ZapiSendResponse | null = null;

  if (raw) {
    try {
      data = JSON.parse(raw) as ZapiSendResponse;
    } catch {
      data = { error: raw };
    }
  }

  if (!response.ok) {
    return {
      data,
      error: new Error(data?.error || `Erro HTTP ${response.status} ao chamar zapi-send`),
    };
  }

  return { data, error: null };
}

export async function invokeZapiSend(
  payload: ZapiSendPayload,
): Promise<{ data: ZapiSendResponse | null; error: Error | null; usedFallback: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke('zapi-send', {
      body: payload,
    });

    if (!error) {
      return {
        data: (data as ZapiSendResponse) ?? null,
        error: null,
        usedFallback: false,
      };
    }

    if (!isEdgeNetworkError(error)) {
      return {
        data: (data as ZapiSendResponse) ?? null,
        error: new Error(error.message),
        usedFallback: false,
      };
    }
  } catch (error) {
    if (!isEdgeNetworkError(error)) {
      return {
        data: null,
        error: toError(error),
        usedFallback: false,
      };
    }
  }

  console.warn('[zapiSendClient] supabase.functions.invoke falhou, usando fetch direto');
  const fallback = await callZapiSendDirect(payload);

  return {
    data: fallback.data,
    error: fallback.error,
    usedFallback: true,
  };
}
