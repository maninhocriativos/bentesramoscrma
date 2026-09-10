const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Cores da marca (mesmas do CRM: marrom escuro do header + dourado de destaque).
const BRAND_DARK = { red: 0.239, green: 0.169, blue: 0.122 };  // #3d2b1f
const BRAND_GOLD = { red: 0.788, green: 0.663, blue: 0.431 };  // #c9a96e
const ZEBRA_LIGHT = { red: 1, green: 1, blue: 1 };
const ZEBRA_DARK = { red: 0.973, green: 0.957, blue: 0.925 };  // bege claro (tom do dourado)

const HEADERS = ['Nome', 'Telefone', 'Email', 'Status', 'Origem', 'Tipo de Ação', 'Valor da Causa', 'Cidade/UF', 'Data de Entrada', 'Ações Realizadas (Equipe)', 'Histórico de Conversa (WhatsApp)'];
// largura em pixels de cada coluna acima, na mesma ordem
const COLUMN_WIDTHS = [170, 120, 190, 110, 130, 150, 110, 90, 100, 340, 340];

const INTERACAO_ICONS: Record<string, string> = {
  'Ligação': '📞', 'Email': '📧', 'WhatsApp': '💬', 'Reunião': '🤝',
  'Atendimento Presencial': '🏢', 'Anotação': '📝',
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function orDash(v: string | null | undefined): string {
  return v && v.trim() ? v : '—';
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
    const leadIdsFound = leads.map(l => l.id);

    // Histórico de conversa (WhatsApp) — até ~5 mensagens recentes por lead,
    // mesmo padrão do ExportTrafegoModal, paginado em lotes de 1000 (teto do PostgREST).
    const targetMsgCount = leads.length * 5;
    const messages: any[] = [];
    for (let offset = 0; offset < targetMsgCount; offset += PAGE) {
      const { data } = await supabase
        .from('manychat_mensagens')
        .select('lead_id, conteudo, direcao, created_at')
        .in('lead_id', leadIdsFound)
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
        arr.push(`${prefix} ${formatDate(msg.created_at)}: ${(msg.conteudo || '').substring(0, 100)}`);
        msgMap.set(msg.lead_id, arr);
      }
    }

    // Ações realizadas pela equipe (interacoes: ligação, e-mail, reunião,
    // atendimento presencial, anotação manual) — é o que a "aba Registros" do
    // lead já mostra na tela, aqui trazido pra planilha. Distinto do histórico
    // de WhatsApp acima, que é o espelho automático da conversa.
    const targetAcaoCount = leads.length * 5;
    const acoes: any[] = [];
    for (let offset = 0; offset < targetAcaoCount; offset += PAGE) {
      const { data } = await supabase
        .from('interacoes')
        .select('cliente_id, tipo, resumo, responsavel_id, data_interacao')
        .in('cliente_id', leadIdsFound)
        .order('data_interacao', { ascending: false })
        .range(offset, Math.min(offset + PAGE, targetAcaoCount) - 1);
      acoes.push(...(data || []));
      if (!data || data.length < Math.min(PAGE, targetAcaoCount - offset)) break;
    }

    const responsavelIds = Array.from(new Set(acoes.map(a => a.responsavel_id).filter(Boolean)));
    const nomePorResponsavel = new Map<string, string>();
    if (responsavelIds.length > 0) {
      const { data: perfis } = await supabase.from('perfis').select('id, nome, sobrenome').in('id', responsavelIds);
      (perfis || []).forEach((p: any) => nomePorResponsavel.set(p.id, [p.nome, p.sobrenome].filter(Boolean).join(' ') || 'Equipe'));
    }

    const acaoMap = new Map<string, string[]>();
    for (const a of acoes) {
      if (!a.cliente_id) continue;
      const arr = acaoMap.get(a.cliente_id) || [];
      if (arr.length < 5) {
        const icone = INTERACAO_ICONS[a.tipo] || '•';
        const quem = a.responsavel_id ? nomePorResponsavel.get(a.responsavel_id) || 'Equipe' : 'Equipe';
        const resumo = (a.resumo || '').substring(0, 140);
        arr.push(`${icone} ${formatDate(a.data_interacao)} (${quem}): ${resumo}`);
        acaoMap.set(a.cliente_id, arr);
      }
    }

    const rows = leads.map(l => [
      orDash(l.nome),
      orDash(l.telefone),
      orDash(l.email),
      orDash(l.status),
      orDash(l.origem || l.tipo_origem),
      orDash(l.tipo_acao),
      formatCurrency(l.valor_causa),
      orDash([l.cidade, l.uf].filter(Boolean).join('/')),
      formatDate(l.created_at),
      acaoMap.get(l.id)?.join('\n') || 'Nenhuma ação registrada',
      msgMap.get(l.id)?.join('\n') || l.resumo_ia || 'Sem conversas',
    ]);

    // 1) Cria a planilha
    const titulo = `Relatório de Leads - ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus' }).replace(',', '')}`;
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title: titulo },
        sheets: [{ properties: { title: 'Leads', gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 } } }],
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
    const values = [HEADERS, ...rows];
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      },
    );

    const lastDataRow = 1 + rows.length; // linha 0 = cabeçalho
    const lastCol = HEADERS.length;
    const longTextStartCol = 9; // "Ações Realizadas" e "Histórico de Conversa"

    // 3) Formatação no padrão visual do escritório: cabeçalho marrom/dourado,
    // colunas com largura fixa legível, zebra nas linhas, texto alinhado no
    // topo (essencial pras duas colunas longas, que variam muito de altura).
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          // Cabeçalho: fundo marrom escuro, texto dourado em negrito, altura maior
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: lastCol },
              cell: {
                userEnteredFormat: {
                  backgroundColor: BRAND_DARK,
                  textFormat: { bold: true, foregroundColor: BRAND_GOLD, fontSize: 10 },
                  verticalAlignment: 'MIDDLE',
                  wrapStrategy: 'WRAP',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 34 },
              fields: 'pixelSize',
            },
          },
          // Largura fixa por coluna (autoResize deixava tudo espremido e as
          // linhas gigantes de altura por causa do texto quebrando em poucos
          // caracteres por linha)
          ...COLUMN_WIDTHS.map((w, i) => ({
            updateDimensionProperties: {
              range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
              properties: { pixelSize: w },
              fields: 'pixelSize',
            },
          })),
          // Zebra nas linhas de dado (sem contar o cabeçalho, que já tem cor própria)
          ...(rows.length > 0 ? [{
            addBanding: {
              bandedRange: {
                range: { sheetId, startRowIndex: 1, endRowIndex: lastDataRow, startColumnIndex: 0, endColumnIndex: lastCol },
                rowProperties: { firstBandColor: ZEBRA_LIGHT, secondBandColor: ZEBRA_DARK },
              },
            },
          }] : []),
          // Texto alinhado no topo em todas as linhas de dado (as 2 colunas
          // longas variam muito de altura; sem isso o resto fica "flutuando"
          // no meio da célula)
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: lastDataRow, startColumnIndex: 0, endColumnIndex: lastCol },
              cell: { userEnteredFormat: { verticalAlignment: 'TOP', textFormat: { fontSize: 10 } } },
              fields: 'userEnteredFormat(verticalAlignment,textFormat.fontSize)',
            },
          },
          // Quebra de linha só nas colunas de texto longo
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: lastDataRow, startColumnIndex: longTextStartCol, endColumnIndex: lastCol },
              cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
              fields: 'userEnteredFormat.wrapStrategy',
            },
          },
          // Valor da Causa alinhado à direita, como número/moeda
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: lastDataRow, startColumnIndex: 6, endColumnIndex: 7 },
              cell: { userEnteredFormat: { horizontalAlignment: 'RIGHT' } },
              fields: 'userEnteredFormat.horizontalAlignment',
            },
          },
          // Borda fina entre linhas pra separar visualmente os leads
          {
            updateBorders: {
              range: { sheetId, startRowIndex: 0, endRowIndex: lastDataRow, startColumnIndex: 0, endColumnIndex: lastCol },
              innerHorizontal: { style: 'SOLID', width: 1, color: { red: 0.88, green: 0.88, blue: 0.86 } },
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
