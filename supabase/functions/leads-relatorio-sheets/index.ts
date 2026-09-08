const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const STATUS_HEADERS = ['Nome', 'Telefone', 'Email', 'Status', 'Origem', 'Tipo de Ação', 'Valor da Causa', 'Cidade/UF', 'Data de Entrada', 'Histórico de Interação'];

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { leadIds } = await req.json();
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum lead selecionado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Token do Google Drive/Sheets — reaproveita o mesmo mecanismo já em produção
    // (get_office_token já lê google_drive_tokens pelo DRIVE_OFFICE_USER_ID e renova
    // sozinho se expirado; não duplicar essa lógica aqui).
    const { data: tokenResult, error: tokenErr } = await supabase.functions.invoke('google-drive', {
      body: { action: 'get_office_token' },
    });

    if (tokenErr || !tokenResult?.connected || !tokenResult?.access_token) {
      return new Response(JSON.stringify({
        error: 'Google Drive não conectado. Conecte em Documentos → "Conectar Google Drive" antes de gerar o relatório.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const accessToken: string = tokenResult.access_token;

    // Leads — paginado por segurança (teto de 1000 linhas do PostgREST), embora
    // leadIds venha de uma seleção manual na tela e dificilmente passe disso.
    const PAGE = 1000;
    const leads: any[] = [];
    for (let i = 0; i < leadIds.length; i += PAGE) {
      const batchIds = leadIds.slice(i, i + PAGE);
      const { data, error } = await supabase
        .from('leads_juridicos')
        .select('id, nome, telefone, email, status, tipo_acao, origem, tipo_origem, valor_causa, created_at, cidade, uf, resumo_ia')
        .in('id', batchIds);
      if (error) throw error;
      leads.push(...(data || []));
    }
    if (leads.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum lead encontrado para os IDs informados' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Histórico de interação — mesmo padrão do ExportTrafegoModal: até ~5 mensagens
    // recentes por lead, paginado em lotes de 1000 (teto do PostgREST).
    const targetMsgCount = leads.length * 5;
    const messages: any[] = [];
    for (let offset = 0; offset < targetMsgCount; offset += PAGE) {
      const { data } = await supabase
        .from('manychat_mensagens')
        .select('lead_id, conteudo, direcao, created_at')
        .in('lead_id', leads.map(l => l.id))
        .eq('tipo', 'text')
        .order('created_at', { ascending: false })
        .range(offset, Math.min(offset + PAGE, targetMsgCount) - 1);
      messages.push(...(data || []));
      if (!data || data.length < Math.min(PAGE, targetMsgCount - offset)) break;
    }

    const msgMap = new Map<string, string[]>();
    for (const msg of messages) {
      if (!msg.lead_id) continue;
      const arr = msgMap.get(msg.lead_id) || [];
      if (arr.length < 5) {
        const prefix = msg.direcao === 'entrada' ? '👤' : '🤖';
        arr.push(`${prefix} ${(msg.conteudo || '').substring(0, 120)}`);
        msgMap.set(msg.lead_id, arr);
      }
    }

    const rows = leads.map(l => [
      l.nome || '',
      l.telefone || '',
      l.email || '',
      l.status || '',
      l.origem || l.tipo_origem || '',
      l.tipo_acao || '',
      formatCurrency(l.valor_causa),
      [l.cidade, l.uf].filter(Boolean).join('/'),
      formatDate(l.created_at),
      msgMap.get(l.id)?.join(' | ') || l.resumo_ia || 'Sem conversas',
    ]);

    // 1) Cria a planilha
    const titulo = `Relatório de Leads - ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus' }).replace(',', '')}`;
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title: titulo },
        sheets: [{ properties: { title: 'Leads', gridProperties: { frozenRowCount: 1 } } }],
      }),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      const insufficientScope = createRes.status === 403 && JSON.stringify(created).includes('insufficient');
      return new Response(JSON.stringify({
        error: insufficientScope
          ? 'Permissão do Google insuficiente para criar planilhas. Reconecte em Documentos → "Conectar Google Drive" para conceder o novo acesso.'
          : `Erro ao criar planilha: ${created.error?.message || 'desconhecido'}`,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const spreadsheetId = created.spreadsheetId;
    const sheetId = created.sheets?.[0]?.properties?.sheetId ?? 0;

    // 2) Escreve cabeçalho + linhas
    const values = [STATUS_HEADERS, ...rows];
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      },
    );

    // 3) Formatação: cabeçalho em negrito/fundo, congelar linha 1, quebra de texto na
    // coluna de histórico, autoajuste de largura de coluna.
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.90, green: 0.93, blue: 0.98 } } },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startColumnIndex: 9, endColumnIndex: 10 },
              cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
              fields: 'userEnteredFormat.wrapStrategy',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: STATUS_HEADERS.length },
            },
          },
        ],
      }),
    });

    return new Response(JSON.stringify({
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      spreadsheetId,
      total: leads.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[leads-relatorio-sheets] Erro:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
