import { createClient } from 'npm:@supabase/supabase-js@2';

// Passo 1 do login da Área do Cliente (portal externo, Cloudflare Worker
// separado): dado um CPF, confirma se existe processo com esse CPF e resolve
// o telefone pra onde o Worker deve mandar o código de verificação (via
// zapi-send, que o próprio Worker chama depois).
//
// Igual a zapi-webhook: sem verify_jwt (não é um usuário Supabase Auth quem
// chama), protegido por um secret compartilhado só com o Worker do portal.
// A service_role key nunca sai daqui — o Worker só recebe existe/não-existe
// e o telefone, nunca uma chave que dê acesso ao banco.

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

// cpf_cliente não tem formato garantido/normalizado no banco hoje — tenta
// dígitos puros e a versão formatada antes de desistir.
async function findProcessoByCpf(cpfDigits: string) {
  const candidates = [cpfDigits, formatCpf(cpfDigits)];
  for (const candidate of candidates) {
    const { data } = await supabaseAdmin
      .from('processos')
      .select('id, cliente_id, nome_cliente')
      .eq('cpf_cliente', candidate)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

// Fallback: CPF aparece como parte do processo mas cpf_cliente não foi
// preenchido nessa linha.
async function findProcessoPartePorCpf(cpfDigits: string) {
  const candidates = [cpfDigits, formatCpf(cpfDigits)];
  for (const candidate of candidates) {
    const { data } = await supabaseAdmin
      .from('processo_partes')
      .select('processo_id, celular, telefone_adicional, nome')
      .eq('documento', candidate)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

function normalizePhone(raw: string | null | undefined): string | null {
  const digits = onlyDigits(raw);
  if (!digits) return null;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
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
    const { cpf } = await req.json();
    const cpfDigits = onlyDigits(cpf);
    if (cpfDigits.length !== 11) {
      return new Response(JSON.stringify({ error: 'CPF inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const processo = await findProcessoByCpf(cpfDigits);

    let telefone: string | null = null;
    let nome: string | null = null;

    if (processo) {
      nome = processo.nome_cliente;
      if (processo.cliente_id) {
        const { data: lead } = await supabaseAdmin
          .from('leads_juridicos')
          .select('telefone, nome')
          .eq('id', processo.cliente_id)
          .maybeSingle();
        if (lead?.telefone) telefone = lead.telefone;
        if (!nome && lead?.nome) nome = lead.nome;
      }
    }

    // Sem processo direto ou sem telefone resolvido ainda: tenta como parte
    if (!telefone) {
      const parte = await findProcessoPartePorCpf(cpfDigits);
      if (parte) {
        telefone = parte.celular || parte.telefone_adicional || null;
        if (!nome) nome = parte.nome;
      }
    }

    const exists = !!(processo || telefone);

    return new Response(JSON.stringify({
      exists,
      telefone: exists ? normalizePhone(telefone) : null,
      nome_hint: exists ? (nome || null) : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[cliente-portal-lookup]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
