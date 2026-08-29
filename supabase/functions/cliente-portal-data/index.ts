import { createClient } from 'npm:@supabase/supabase-js@2';

// Dados da Área do Cliente (portal externo, Cloudflare Worker separado).
// O Worker já validou a sessão (CPF confirmado via OTP) antes de chamar aqui —
// esta function confia no CPF que vem no corpo da requisição PORQUE só o
// Worker conhece o CLIENTE_PORTAL_BRIDGE_SECRET. Nunca é chamada direto pelo
// navegador do cliente.
//
// service_role só é usada aqui dentro (nunca sai pro Worker) — mesmo motivo
// de cliente-portal-lookup.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-bridge-secret',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BRIDGE_SECRET = Deno.env.get('CLIENTE_PORTAL_BRIDGE_SECRET');

function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '');
}

function formatCpf(digits: string): string {
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

const PROCESSO_FIELDS = 'id, numero_processo, titulo_acao, status, status_detalhado, fase, tribunal, vara_comarca, advogado_responsavel, valor_causa, nome_cliente, cpf_cliente, cliente_id, movimentos_json, created_at, updated_at';

// Todos os processos que pertencem a esse CPF: direto por cpf_cliente OU via
// processo_partes.documento (quando cpf_cliente não foi preenchido na linha).
async function findProcessosDoCliente(cpfDigits: string) {
  const candidates = [cpfDigits, formatCpf(cpfDigits)];

  const byCliente = new Map<string, any>();
  for (const candidate of candidates) {
    const { data } = await supabaseAdmin.from('processos').select(PROCESSO_FIELDS).eq('cpf_cliente', candidate);
    for (const p of data || []) byCliente.set(p.id, p);
  }

  // Fallback via parte, só se ainda não achou nada por cpf_cliente direto
  if (byCliente.size === 0) {
    for (const candidate of candidates) {
      const { data: partes } = await supabaseAdmin.from('processo_partes').select('processo_id').eq('documento', candidate);
      const ids = [...new Set((partes || []).map((p: any) => p.processo_id))];
      if (ids.length === 0) continue;
      const { data } = await supabaseAdmin.from('processos').select(PROCESSO_FIELDS).in('id', ids);
      for (const p of data || []) byCliente.set(p.id, p);
    }
  }

  return [...byCliente.values()];
}

function getLocalStoragePath(url: string): string {
  return url.includes('/documentos/') ? url.split('/documentos/')[1].split('?')[0] : url.split('?')[0];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const secret = req.headers.get('x-bridge-secret');
  if (!BRIDGE_SECRET || secret !== BRIDGE_SECRET) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { cpf, resource, resource_id } = await req.json();
    const cpfDigits = onlyDigits(cpf);
    if (cpfDigits.length !== 11) {
      return new Response(JSON.stringify({ error: 'CPF inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const processos = await findProcessosDoCliente(cpfDigits);
    const processoIds = processos.map(p => p.id);

    switch (resource) {
      case 'me': {
        const nome = processos.find(p => p.nome_cliente)?.nome_cliente || null;
        return json({ nome, total_processos: processos.length });
      }

      case 'processos': {
        return json({ processos: processos.map(stripMovimentos) });
      }

      case 'processo': {
        const p = processos.find(x => x.id === resource_id);
        if (!p) return json({ error: 'Processo não encontrado' }, 404);
        return json({ processo: p });
      }

      case 'documentos': {
        if (processoIds.length === 0) return json({ documentos: [] });
        const clienteIds = [...new Set(processos.map(p => p.cliente_id).filter(Boolean))];
        const orFilter = [
          `processo_id.in.(${processoIds.join(',')})`,
          clienteIds.length ? `cliente_id.in.(${clienteIds.join(',')})` : null,
        ].filter(Boolean).join(',');
        const { data: docs, error } = await supabaseAdmin
          .from('documentos')
          .select('id, nome, tipo, arquivo_url, arquivo_nome, arquivo_tamanho, created_at')
          .or(orFilter)
          .order('created_at', { ascending: false });
        if (error) throw error;

        const withUrls = await Promise.all((docs || []).map(async (d) => {
          const { data: signed } = await supabaseAdmin.storage
            .from('documentos')
            .createSignedUrl(getLocalStoragePath(d.arquivo_url), 300);
          return { ...d, arquivo_url: undefined, download_url: signed?.signedUrl || null };
        }));

        return json({ documentos: withUrls });
      }

      case 'comunicados': {
        const { data, error } = await supabaseAdmin
          .from('comunicados')
          .select('id, tipo, titulo, corpo, publicado_em')
          .eq('ativo', true)
          .order('publicado_em', { ascending: false })
          .limit(50);
        if (error) throw error;
        return json({ comunicados: data || [] });
      }

      default:
        return json({ error: `resource desconhecido: ${resource}` }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[cliente-portal-data]', message);
    return json({ error: message }, 500);
  }
});

function stripMovimentos(p: any) {
  const { movimentos_json, ...rest } = p;
  return rest;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
