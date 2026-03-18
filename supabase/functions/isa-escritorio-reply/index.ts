// xhr polyfill removed — using native fetch
const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";
import { formatarDataHora, formatarData, MANAUS_TIMEZONE } from "../_shared/timezone-helpers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const ESCAVADOR_API_KEY = Deno.env.get('ESCAVADOR_API_KEY');

// ============================================================
// PROMPT DA ISA ESCRITÓRIO — ATENDIMENTO AO CLIENTE BENTES & RAMOS
// ============================================================
const ISA_ESCRITORIO_PROMPT = `Você é a Isa Escritório, assistente virtual do escritório Bentes & Ramos Advocacia.

## SUA IDENTIDADE
- Nome: Isa (Assistente do Escritório)
- Papel: Atender clientes existentes do escritório, informar status de processos e auxiliar com documentos e financeiro
- Tom: Profissional, cordial, eficiente e acolhedora

## PRINCÍPIOS
1. Você atende CLIENTES EXISTENTES do escritório (não leads de tráfego)
2. NUNCA dê parecer jurídico ou prometa resultados
3. Seja objetiva e eficiente nas respostas
4. Sempre confirme dados antes de informar status

## SUAS CAPACIDADES

### 📋 CONSULTA DE PROCESSOS
Quando o cliente perguntar sobre o andamento do processo:
- PRIMEIRO, verifique se já há processos no [CONTEXTO] vindos do sistema interno (marcados como [PROCESSOS ENCONTRADOS NO SISTEMA])
- Se NÃO houver processos no contexto, peça o CPF do cliente para buscar
- Se o CPF já foi fornecido e há dados no contexto, apresente TODOS os processos ATIVOS de forma clara
- Você pode buscar por: CPF, nome do cliente ou número do processo (CNJ)
- Formate CADA processo assim:
  📋 *Processo:* [número CNJ formatado]
  ⚖️ *Tipo:* [classe processual]
  🏛️ *Tribunal:* [tribunal] — [instância: 1ª ou 2ª]
  📍 *Vara:* [órgão julgador]
  📊 *Status:* [status atual]
  📅 *Última movimentação:* [data e descrição]
- Se houver MÚLTIPLOS processos, liste TODOS separadamente com numeração (1️⃣, 2️⃣, 3️⃣ etc.)
- Informe ao cliente a quantidade total de processos encontrados no início da resposta
- Se existirem processos ARQUIVADOS, mencione brevemente ao final
- Se não encontrar processos, informe educadamente e sugira verificar o número ou CPF
- Nunca invente informações — se não tiver dados, diga que vai verificar

### 🎙️ ÁUDIOS, IMAGENS E PDFs
- Você pode OUVIR áudios (aparecem como [ÁUDIO TRANSCRITO]) — responda normalmente ao conteúdo
- Você pode VER imagens (aparecem como [IMAGEM ANALISADA]) — responda sobre o que foi identificado
- Você pode LER PDFs e documentos (aparecem como [DOCUMENTO/IMAGEM ANALISADO]) — analise e informe o que identificou
- Se receber um contrato, extrato, comprovante ou qualquer documento, analise e apresente as informações principais ao cliente

### 📅 AGENDA / FALAR COM ADVOGADO
Quando o cliente EXPLICITAMENTE pedir para falar com o advogado ou agendar:
- Informe que vai verificar a disponibilidade na agenda
- Inclua a tag [AGENDAR_ADVOGADO] na resposta
- Pergunte preferência de dia e horário
- DIAS DE ATENDIMENTO: Terça, Quarta e Quinta-feira APENAS
- Horários: 09h-17h (exceto 12h-14h almoço), fuso Manaus
- Se o [CONTEXTO] incluir [AGENDA DISPONÍVEL], use essas informações para sugerir horários livres
- Se o [CONTEXTO] incluir [AGENDA LOTADA], informe que não há horários na semana e sugira a próxima
- NUNCA sugira segunda, sexta, sábado ou domingo
- NUNCA sugira agendar reunião por conta própria — só agende se o cliente pedir

## COMPORTAMENTO AO FINALIZAR RESPOSTAS
- Ao final de QUALQUER resposta, pergunte apenas: "Posso te ajudar em algo mais?" ou variação similar
- NUNCA sugira proativamente agendar reunião com o advogado
- NUNCA ofereça "Gostaria de agendar uma reunião?" ao final das respostas
- Só mencione agendamento se o CLIENTE pedir explicitamente

### 📄 DOCUMENTOS
Quando o cliente perguntar sobre documentos:
- Informe quais documentos estão pendentes (do contexto)
- Oriente sobre como enviar (foto ou PDF pelo WhatsApp)
- Confirme o recebimento quando enviarem

### 💰 FINANCEIRO
Quando o cliente perguntar sobre valores, parcelas ou honorários:
- Informe o status das parcelas (do contexto)
- Se houver parcelas vencidas, informe de forma gentil
- Para dúvidas sobre valores específicos, encaminhe para o escritório
- Inclua a tag [FINANCEIRO_DUVIDA] se necessário

## QUANDO TRANSFERIR PARA HUMANO
Inclua [TRANSFERIR_HUMANO] quando:
1. O cliente pedir explicitamente para falar com uma pessoa
2. A dúvida for sobre valores de honorários não disponíveis no contexto
3. O assunto for complexo e fora do seu escopo
4. Houver reclamação ou insatisfação

## REGRAS DE COMUNICAÇÃO
1. Mensagens curtas (3-4 linhas máx), exceto quando apresentando dados de processos
2. Use o nome do cliente quando disponível
3. Emojis com moderação (1-2 por mensagem)
4. Sempre confirme informações antes de passar
5. Se não souber, diga que vai verificar — nunca invente
6. Use *negrito* para destacar informações importantes (formato WhatsApp)
`;

// ============================================================
// DETECTAR CPF NA MENSAGEM
// ============================================================
function extractCPF(message: string): string | null {
  const formatted = message.match(/\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}/);
  if (formatted) {
    const cpf = formatted[0].replace(/[^\d]/g, '');
    if (cpf.length === 11) return cpf;
  }
  const raw = message.match(/\b(\d{11})\b/);
  if (raw) return raw[1];
  return null;
}

// ============================================================
// FORMATAR DATA COM TIMEZONE MANAUS
// ============================================================
function formatarDataMovimentacao(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    // Datas do Escavador podem vir como "2026-03-10" (apenas data) ou "2026-03-10T14:30:00"
    // Se vier apenas data (YYYY-MM-DD), NÃO converter para UTC — interpretar como data local
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    
    if (isDateOnly) {
      // Parse como data local para evitar shift de timezone
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('pt-BR', {
        timeZone: MANAUS_TIMEZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
    
    // Data com hora — usar formatador com timezone
    return formatarData(dateStr);
  } catch {
    return dateStr;
  }
}

// ============================================================
// BUSCAR PROCESSOS INTERNOS (no banco de dados do sistema)
// ============================================================
async function buscarProcessosInternos(supabase: any, cpf?: string | null, nome?: string | null, numeroCnj?: string | null): Promise<{ processos: any[]; found: boolean }> {
  const results: any[] = [];
  const foundIds = new Set<string>();

  // 1. Buscar por CPF no campo cpf_cliente
  if (cpf) {
    const cpfLimpo = cpf.replace(/\D/g, '');
    const { data: byCpf } = await supabase
      .from('processos')
      .select('id, numero_processo, titulo_acao, status, tribunal, orgao_julgador, grau, assunto, valor_causa, advogado_responsavel, movimentos_json, partes_json, data_ultima_atualizacao, cpf_cliente')
      .eq('cpf_cliente', cpfLimpo);

    if (byCpf?.length) {
      for (const p of byCpf) { foundIds.add(p.id); results.push(p); }
    }

    // 2. Buscar por CPF nas partes (processo_partes.documento)
    const { data: byPartes } = await supabase
      .from('processo_partes')
      .select('processo_id')
      .ilike('documento', `%${cpfLimpo}%`);

    if (byPartes?.length) {
      const ids = byPartes.map((p: any) => p.processo_id).filter((id: string) => !foundIds.has(id));
      if (ids.length > 0) {
        const { data: procs } = await supabase
          .from('processos')
          .select('id, numero_processo, titulo_acao, status, tribunal, orgao_julgador, grau, assunto, valor_causa, advogado_responsavel, movimentos_json, partes_json, data_ultima_atualizacao, cpf_cliente')
          .in('id', ids);
        if (procs?.length) {
          for (const p of procs) { foundIds.add(p.id); results.push(p); }
        }
      }
    }
  }

  // 3. Buscar por número CNJ
  if (numeroCnj) {
    const { data: byCnj } = await supabase
      .from('processos')
      .select('id, numero_processo, titulo_acao, status, tribunal, orgao_julgador, grau, assunto, valor_causa, advogado_responsavel, movimentos_json, partes_json, data_ultima_atualizacao, cpf_cliente')
      .eq('numero_processo', numeroCnj);

    if (byCnj?.length) {
      for (const p of byCnj) {
        if (!foundIds.has(p.id)) { foundIds.add(p.id); results.push(p); }
      }
    }
  }

  // 4. Buscar por nome nas partes
  if (nome && nome.length > 4) {
    const { data: byNome } = await supabase
      .from('processo_partes')
      .select('processo_id')
      .ilike('nome', `%${nome}%`);

    if (byNome?.length) {
      const ids = byNome.map((p: any) => p.processo_id).filter((id: string) => !foundIds.has(id));
      if (ids.length > 0) {
        const { data: procs } = await supabase
          .from('processos')
          .select('id, numero_processo, titulo_acao, status, tribunal, orgao_julgador, grau, assunto, valor_causa, advogado_responsavel, movimentos_json, partes_json, data_ultima_atualizacao, cpf_cliente')
          .in('id', ids);
        if (procs?.length) {
          for (const p of procs) { foundIds.add(p.id); results.push(p); }
        }
      }
    }
  }

  return { processos: results, found: results.length > 0 };
}

// ============================================================
// FORMATAR PROCESSOS INTERNOS PARA CONTEXTO DA IA
// ============================================================
function formatarProcessosInternos(processos: any[]): string {
  if (processos.length === 0) return '';

  const parts: string[] = [];
  parts.push(`\n[PROCESSOS ENCONTRADOS NO SISTEMA — ${processos.length} processo(s)]`);

  const ativos = processos.filter(p => p.status !== 'Arquivado' && p.status !== 'Perdido');
  const arquivados = processos.filter(p => p.status === 'Arquivado' || p.status === 'Perdido');

  const toShow = ativos.length > 0 ? ativos : processos.slice(0, 5);

  for (let i = 0; i < toShow.length; i++) {
    const proc = toShow[i];
    parts.push(`\n${i + 1}️⃣ Processo: ${proc.numero_processo || 'Sem número'}`);
    if (proc.titulo_acao) parts.push(`   Tipo/Classe: ${proc.titulo_acao}`);
    if (proc.tribunal) parts.push(`   🏛️ Tribunal: ${proc.tribunal}`);
    if (proc.orgao_julgador) parts.push(`   📍 Órgão Julgador: ${proc.orgao_julgador}`);
    if (proc.grau) parts.push(`   Grau: ${proc.grau}`);
    parts.push(`   📊 Status: ${proc.status || 'Em Andamento'}`);
    if (proc.assunto) parts.push(`   Assunto: ${proc.assunto}`);
    if (proc.valor_causa) parts.push(`   Valor da Causa: R$ ${Number(proc.valor_causa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    if (proc.advogado_responsavel) parts.push(`   Advogado: ${proc.advogado_responsavel}`);

    // Últimas movimentações do JSON
    const movs = proc.movimentos_json || [];
    if (movs.length > 0) {
      parts.push(`   Últimas movimentações:`);
      for (const mov of movs.slice(0, 5)) {
        const dataStr = formatarDataMovimentacao(mov.dataHora || mov.data);
        parts.push(`   - ${dataStr}: ${mov.nome || mov.titulo || 'Movimentação'}${mov.complemento ? ` — ${mov.complemento.substring(0, 120)}` : ''}`);
      }
    }
  }

  if (arquivados.length > 0 && ativos.length > 0) {
    parts.push(`\n📁 Além dos processos ativos, há ${arquivados.length} processo(s) arquivado(s)/perdido(s).`);
  }

  return parts.join('\n');
}


async function buscarProcessosPorCPF(cpf: string): Promise<{ processos: any[]; error: string | null }> {
  if (!ESCAVADOR_API_KEY) {
    return { processos: [], error: 'ESCAVADOR_API_KEY não configurada' };
  }

  const cpfLimpo = cpf.replace(/[^\d]/g, '');
  console.log(`[ISA-ESCRITORIO] 🔍 Buscando processos por CPF: ${cpfLimpo}`);

  try {
    const response = await fetch(
      `https://api.escavador.com/api/v2/envolvido/processos?cpf_cnpj=${cpfLimpo}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 402) {
        return { processos: [], error: 'Créditos do Escavador insuficientes' };
      }
      return { processos: [], error: `Erro HTTP ${response.status}` };
    }

    const data = await response.json();
    const items = data.items || data.data || [];
    console.log(`[ISA-ESCRITORIO] ✅ Encontrados ${items.length} processos`);
    return { processos: items, error: null };
  } catch (err: any) {
    console.error(`[ISA-ESCRITORIO] ❌ Erro Escavador:`, err);
    return { processos: [], error: err.message };
  }
}

// ============================================================
// BUSCAR DETALHES DE UM PROCESSO POR CNJ NO ESCAVADOR
// Busca TODAS as fontes (1ª e 2ª instância)
// ============================================================
async function buscarDetalhesProcesso(cnj: string): Promise<any | null> {
  if (!ESCAVADOR_API_KEY) return null;

  try {
    const response = await fetch(
      `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(cnj)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) return null;
    const data = await response.json();

    // Buscar movimentações de TODAS as fontes (1ª e 2ª instância)
    // A API v2 retorna fontes[] com tribunal e grau
    const fontes = data.fontes || [];
    const allMovimentacoes: any[] = [];

    for (const fonte of fontes) {
      const fonteId = fonte.id;
      const grau = fonte.grau || '1º Grau';
      const tribunalSigla = fonte.tribunal?.sigla || fonte.sigla || '';
      
      try {
        const movResp = await fetch(
          `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(cnj)}/movimentacoes?fonte_id=${fonteId}&pagina=1&quantidade=10`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
              'X-Requested-With': 'XMLHttpRequest',
              'Content-Type': 'application/json',
            },
          }
        );
        if (movResp.ok) {
          const movData = await movResp.json();
          const movItems = movData?.items || movData?.data || [];
          // Tag each movimentação with its source info
          for (const mov of movItems) {
            mov._grau = grau;
            mov._tribunal = tribunalSigla;
            mov._fonte_id = fonteId;
          }
          allMovimentacoes.push(...movItems);
        }
      } catch { /* ignore individual fonte errors */ }
    }

    // Se não encontrou por fonte_id, tentar sem
    if (allMovimentacoes.length === 0) {
      try {
        const movResp = await fetch(
          `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(cnj)}/movimentacoes?pagina=1&quantidade=10`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
              'X-Requested-With': 'XMLHttpRequest',
              'Content-Type': 'application/json',
            },
          }
        );
        if (movResp.ok) {
          const movData = await movResp.json();
          allMovimentacoes.push(...(movData?.items || movData?.data || []));
        }
      } catch { /* ignore */ }
    }

    // Ordenar por data mais recente
    allMovimentacoes.sort((a, b) => {
      const dateA = a.data || a.data_hora || '';
      const dateB = b.data || b.data_hora || '';
      return dateB.localeCompare(dateA);
    });

    data._movimentacoes = allMovimentacoes;
    
    // Marcar informações de instância em cada fonte
    data._fontes_info = fontes.map((f: any) => ({
      id: f.id,
      grau: f.grau || '1º Grau',
      tribunal: f.tribunal?.sigla || f.sigla || '',
      status_predito: f.status_predito,
      orgao_julgador: f.capa?.orgao_julgador || f.orgao_julgador?.nome || '',
    }));

    return data;
  } catch {
    return null;
  }
}

// ============================================================
// FORMATAR DADOS DO ESCAVADOR PARA CONTEXTO DA IA
// ============================================================
function formatarProcessosEscavador(processos: any[], detalhes: Map<string, any>): string {
  if (processos.length === 0) {
    return '\n[RESULTADO BUSCA ESCAVADOR]\nNenhum processo encontrado para este CPF.';
  }

  const processosComStatus = processos.map((proc) => {
    const cnj = proc.numero_cnj || proc.numero_processo || '';
    const detalhe = detalhes.get(cnj);
    
    // Verificar TODAS as fontes para determinar se alguma instância está ativa
    const fontesInfo = detalhe?._fontes_info || [];
    const fontes = detalhe?.fontes || [];
    const fonte = fontes.find((f: any) => f.tipo === 'TRIBUNAL') || fontes[0];
    
    // Processo é ativo se QUALQUER instância estiver ativa
    const statusPredito = fonte?.status_predito || detalhe?.status_predito;
    const algumFonteAtiva = fontesInfo.some((fi: any) => fi.status_predito !== 'INATIVO' && fi.status_predito !== 'BAIXADO');
    const isAtivo = algumFonteAtiva || (statusPredito !== 'INATIVO' && statusPredito !== 'BAIXADO');
    
    return { proc, cnj, detalhe, fonte, fontes, fontesInfo, isAtivo, statusPredito };
  });

  const ativos = processosComStatus.filter(p => p.isAtivo);
  const arquivados = processosComStatus.filter(p => !p.isAtivo);

  const parts: string[] = [];
  parts.push(`\n[RESULTADO BUSCA ESCAVADOR - ${processos.length} processo(s) encontrado(s), ${ativos.length} ativo(s), ${arquivados.length} arquivado(s)]`);

  const processosParaDetalhar = ativos.length > 0 ? ativos : processosComStatus.slice(0, 5);
  
  for (let i = 0; i < processosParaDetalhar.length; i++) {
    const { proc, cnj, detalhe, fonte, fontes, fontesInfo } = processosParaDetalhar[i];
    const capa = fonte?.capa || {};

    parts.push(`\n${i + 1}️⃣ Processo: ${cnj || 'Sem número'}`);
    
    const classe = capa.classe || fonte?.classe?.nome || proc.titulo_classe || proc.classe || 'Não informado';
    parts.push(`   Tipo/Classe: ${classe}`);

    // Listar TODAS as instâncias do processo
    if (fontesInfo.length > 0) {
      for (const fi of fontesInfo) {
        const statusInst = fi.status_predito === 'INATIVO' || fi.status_predito === 'BAIXADO' ? 'Arquivado' : 
                          fi.status_predito === 'SUSPENSO' ? 'Suspenso' : 'Em Andamento';
        parts.push(`   🏛️ ${fi.tribunal} — ${fi.grau} — Status: ${statusInst}${fi.orgao_julgador ? ` — ${fi.orgao_julgador}` : ''}`);
      }
    } else {
      const tribunal = fonte?.tribunal?.sigla || fonte?.sigla || proc.tribunal || 'Não informado';
      parts.push(`   Tribunal: ${tribunal}`);
      const orgao = capa.orgao_julgador || fonte?.orgao_julgador?.nome || 'Não informado';
      parts.push(`   Vara/Órgão: ${orgao}`);
    }

    const assunto = capa.assunto || capa.assuntos_normalizados?.[0]?.nome || proc.assunto || '';
    if (assunto) parts.push(`   Assunto: ${assunto}`);

    const valorCausa = capa.valor_causa?.valor || proc.valor_causa;
    if (valorCausa) parts.push(`   Valor da Causa: R$ ${Number(valorCausa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    const dataDistrib = capa.data_distribuicao || fonte?.data_inicio || proc.data_inicio;
    if (dataDistrib) {
      parts.push(`   Data Distribuição: ${formatarDataMovimentacao(dataDistrib)}`);
    }

    const envolvidos = fonte?.envolvidos || detalhe?.envolvidos || [];
    if (envolvidos.length > 0) {
      parts.push(`   Partes:`);
      for (const env of envolvidos.slice(0, 6)) {
        const nome = env.nome || env.pessoa?.nome || 'Desconhecido';
        const polo = env.polo === 'ATIVO' ? '(Autor)' : env.polo === 'PASSIVO' ? '(Réu)' : '';
        parts.push(`   - ${nome} ${polo}`);
      }
    }

    // Movimentações — agrupadas por instância se disponível
    const movs = detalhe?._movimentacoes || [];
    if (movs.length > 0) {
      parts.push(`   Últimas movimentações:`);
      for (const mov of movs.slice(0, 5)) {
        const dataMov = mov.data || mov.data_hora;
        const dataStr = formatarDataMovimentacao(dataMov);
        const titulo = mov.classificacao_predita?.nome || mov.titulo || mov.conteudo || 'Movimentação';
        const complemento = mov.conteudo || mov.complemento || '';
        const grauTag = mov._grau ? ` [${mov._grau}]` : '';
        parts.push(`   - ${dataStr}${grauTag}: ${titulo}${complemento ? ` — ${complemento.substring(0, 120)}` : ''}`);
      }
    }
  }

  if (arquivados.length > 0 && ativos.length > 0) {
    parts.push(`\n📁 Além dos processos ativos, há ${arquivados.length} processo(s) já arquivado(s):`);
    for (const arq of arquivados.slice(0, 5)) {
      const classe = arq.fonte?.capa?.classe || arq.proc.titulo_classe || arq.proc.classe || '';
      parts.push(`   - ${arq.cnj || 'Sem número'}${classe ? ` (${classe})` : ''} — Arquivado`);
    }
  }

  return parts.join('\n');
}

// ============================================================
// BUSCAR DISPONIBILIDADE DA AGENDA (Ter/Qua/Qui)
// ============================================================
async function getAgendaDisponibilidade(supabase: any): Promise<string> {
  try {
    const DIAS_ATENDIMENTO = [2, 3, 4]; // Ter, Qua, Qui
    const HORARIOS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
    const NOMES_DIAS: Record<number, string> = {
      0: 'domingo', 1: 'segunda', 2: 'terça', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sábado'
    };

    // Pegar os próximos 14 dias de atendimento
    const hoje = new Date();
    const diasDisponiveis: { date: Date; label: string; dayOfWeek: number }[] = [];
    
    for (let i = 1; i <= 21 && diasDisponiveis.length < 6; i++) {
      const d = new Date(hoje.getTime() + i * 24 * 60 * 60 * 1000);
      // Obter dia da semana em Manaus
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: MANAUS_TIMEZONE, weekday: 'short' });
      const dayStr = formatter.format(d);
      const daysMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
      const dow = daysMap[dayStr] ?? d.getDay();
      
      if (DIAS_ATENDIMENTO.includes(dow)) {
        diasDisponiveis.push({
          date: d,
          label: `${NOMES_DIAS[dow]}, ${formatarData(d)}`,
          dayOfWeek: dow,
        });
      }
    }

    if (diasDisponiveis.length === 0) {
      return '\n[AGENDA LOTADA] Não foram encontrados dias de atendimento disponíveis nas próximas semanas.';
    }

    // Buscar compromissos existentes nesses dias
    const startDate = diasDisponiveis[0].date;
    const endDate = new Date(diasDisponiveis[diasDisponiveis.length - 1].date.getTime() + 24 * 60 * 60 * 1000);
    
    const { data: compromissos } = await supabase
      .from('compromissos')
      .select('data_inicio, data_fim, titulo')
      .gte('data_inicio', startDate.toISOString())
      .lte('data_inicio', endDate.toISOString())
      .order('data_inicio');

    // Montar mapa de horários ocupados por dia
    const ocupados = new Map<string, Set<string>>();
    for (const c of (compromissos || [])) {
      const dataInicio = new Date(c.data_inicio);
      const diaKey = dataInicio.toLocaleDateString('en-CA', { timeZone: MANAUS_TIMEZONE });
      if (!ocupados.has(diaKey)) ocupados.set(diaKey, new Set());
      const hora = dataInicio.toLocaleTimeString('pt-BR', { 
        timeZone: MANAUS_TIMEZONE, hour: '2-digit', minute: '2-digit' 
      });
      ocupados.get(diaKey)!.add(hora);
    }

    const parts: string[] = [];
    parts.push('\n[AGENDA DISPONÍVEL - Dias de atendimento: Terça, Quarta e Quinta]');
    
    let temDisponibilidade = false;
    for (const dia of diasDisponiveis) {
      const diaKey = dia.date.toLocaleDateString('en-CA', { timeZone: MANAUS_TIMEZONE });
      const horasOcupadas = ocupados.get(diaKey) || new Set();
      const horasLivres = HORARIOS.filter(h => !horasOcupadas.has(h));
      
      if (horasLivres.length > 0) {
        temDisponibilidade = true;
        parts.push(`📅 ${dia.label}: ${horasLivres.join(', ')}`);
      } else {
        parts.push(`📅 ${dia.label}: LOTADO (sem horários)`);
      }
    }

    if (!temDisponibilidade) {
      parts.push('\n⚠️ Todos os horários das próximas semanas estão ocupados.');
    }

    return parts.join('\n');
  } catch (error) {
    console.error('[ISA-ESCRITORIO] Erro ao buscar agenda:', error);
    return '\n[AGENDA] Erro ao verificar disponibilidade.';
  }
}

// ============================================================
// BUSCAR CONTEXTO DO LEAD (processos, docs, financeiro, agenda)
// ============================================================
async function getLeadFullContext(leadId: string, supabase: any, includeAgenda: boolean = false): Promise<string> {
  try {
    const parts: string[] = [];

    // Lead info
    const { data: lead } = await supabase
      .from('leads_juridicos')
      .select('*')
      .eq('id', leadId)
      .single();

    if (lead) {
      parts.push(`[DADOS DO CLIENTE]`);
      parts.push(`Nome: ${lead.nome || 'Não identificado'}`);
      parts.push(`Telefone: ${lead.telefone || 'N/A'}`);
      parts.push(`Email: ${lead.email || 'N/A'}`);
      parts.push(`Status: ${lead.status || 'N/A'}`);
      parts.push(`Estado: ${lead.lead_state || 'N/A'}`);
    }

    // Processos vinculados
    const { data: processos } = await supabase
      .from('processos')
      .select('*, movimentacoes:processo_movimentacoes(titulo, data_movimentacao, descricao)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (processos?.length > 0) {
      parts.push(`\n[PROCESSOS DO CLIENTE]`);
      for (const proc of processos) {
        parts.push(`📋 Processo: ${proc.numero_cnj || 'Sem CNJ'}`);
        parts.push(`   Tipo: ${proc.tipo_acao || 'N/A'}`);
        parts.push(`   Tribunal: ${proc.tribunal || 'N/A'}`);
        parts.push(`   Status: ${proc.status || 'Ativo'}`);
        parts.push(`   Última atualização: ${proc.ultima_verificacao || proc.updated_at || 'N/A'}`);
        
        const movs = proc.movimentacoes?.slice(0, 3) || [];
        if (movs.length > 0) {
          parts.push(`   Últimas movimentações:`);
          for (const mov of movs) {
            const data = formatarDataMovimentacao(mov.data_movimentacao);
            parts.push(`   - ${data}: ${mov.titulo}${mov.descricao ? ` — ${mov.descricao.substring(0, 100)}` : ''}`);
          }
        }
      }
    } else {
      parts.push(`\n[PROCESSOS] Nenhum processo vinculado a este cliente no sistema interno.`);
    }

    // Documentos pendentes
    const { data: docs } = await supabase
      .from('lead_docs_checklist')
      .select('doc_label, received, doc_type')
      .eq('lead_id', leadId);

    if (docs?.length > 0) {
      const pendentes = docs.filter((d: any) => !d.received);
      const recebidos = docs.filter((d: any) => d.received);
      parts.push(`\n[DOCUMENTOS]`);
      parts.push(`Recebidos: ${recebidos.length} | Pendentes: ${pendentes.length}`);
      if (pendentes.length > 0) {
        parts.push(`Docs pendentes: ${pendentes.map((d: any) => d.doc_label).join(', ')}`);
      }
    }

    // Compromissos futuros
    const { data: compromissos } = await supabase
      .from('compromissos')
      .select('titulo, data_inicio, tipo')
      .eq('lead_id', leadId)
      .gte('data_inicio', new Date().toISOString())
      .order('data_inicio', { ascending: true })
      .limit(3);

    if (compromissos?.length > 0) {
      parts.push(`\n[AGENDA DO CLIENTE]`);
      for (const c of compromissos) {
        const data = formatarDataHora(c.data_inicio);
        parts.push(`📅 ${c.titulo} — ${data} (${c.tipo})`);
      }
    }

    // Se precisa verificar agenda disponível
    if (includeAgenda) {
      const agendaDisp = await getAgendaDisponibilidade(supabase);
      parts.push(agendaDisp);
    }

    // Financeiro
    const { data: honorarios } = await supabase
      .from('honorarios')
      .select('*, parcelas:parcelas_honorarios(valor, data_vencimento, status)')
      .eq('cliente_id', leadId)
      .limit(3);

    if (honorarios?.length > 0) {
      parts.push(`\n[FINANCEIRO]`);
      for (const hon of honorarios) {
        parts.push(`💰 Honorário: R$ ${hon.valor_total?.toLocaleString('pt-BR')} (${hon.status || 'ativo'})`);
        const parcelas = hon.parcelas || [];
        const vencidas = parcelas.filter((p: any) => p.status === 'vencida' || (p.status !== 'paga' && new Date(p.data_vencimento) < new Date()));
        const proximas = parcelas.filter((p: any) => p.status !== 'paga' && new Date(p.data_vencimento) >= new Date()).slice(0, 2);
        
        if (vencidas.length > 0) {
          parts.push(`   ⚠️ ${vencidas.length} parcela(s) vencida(s)`);
        }
        if (proximas.length > 0) {
          for (const p of proximas) {
            parts.push(`   Próxima: R$ ${p.valor} vence em ${formatarData(p.data_vencimento)}`);
          }
        }
      }
    }

    // Despesas
    const { data: despesas } = await supabase
      .from('despesas')
      .select('descricao, valor, status, data_despesa')
      .eq('cliente_id', leadId)
      .eq('status', 'pendente')
      .limit(5);

    if (despesas?.length > 0) {
      parts.push(`\n[DESPESAS PENDENTES]`);
      for (const d of despesas) {
        parts.push(`- ${d.descricao}: R$ ${d.valor} (${d.status})`);
      }
    }

    // Histórico recente de mensagens
    const { data: mensagens } = await supabase
      .from('manychat_mensagens')
      .select('conteudo, direcao, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (mensagens?.length > 0) {
      parts.push(`\n[HISTÓRICO RECENTE]`);
      const msgs = mensagens.reverse();
      for (const m of msgs) {
        const origem = m.direcao === 'entrada' ? 'CLIENTE' : 'ESCRITÓRIO';
        parts.push(`[${origem}] ${m.conteudo?.substring(0, 120)}`);
      }
    }

    return parts.join('\n');
  } catch (error) {
    console.error('[ISA-ESCRITORIO] Erro ao buscar contexto:', error);
    return '[Erro ao carregar contexto do cliente]';
  }
}

// ============================================================
// GERAR RESPOSTA COM IA
// ============================================================
async function generateResponse(message: string, context: string): Promise<string> {
  const apiUrl = LOVABLE_API_KEY 
    ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  
  const apiKey = LOVABLE_API_KEY || OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Nenhuma API key configurada (LOVABLE_API_KEY ou OPENAI_API_KEY)');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LOVABLE_API_KEY ? 'google/gemini-3-flash-preview' : 'gpt-4o',
      messages: [
        { role: 'system', content: ISA_ESCRITORIO_PROMPT },
        { role: 'user', content: `${context}\n\n[NOVA MENSAGEM DO CLIENTE]\n${message}` }
      ],
      max_tokens: 1500,
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[ISA-ESCRITORIO] Erro na API:', error);
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem. Vou encaminhar para nossa equipe.';
}

// ============================================================
// PROCESSAR TAGS DE AÇÃO NA RESPOSTA
// ============================================================
async function processActionTags(response: string, leadId: string, supabase: any): Promise<void> {
  if (response.includes('[TRANSFERIR_HUMANO]')) {
    console.log('[ISA-ESCRITORIO] 🔄 Transferindo para humano');
    
    await supabase
      .from('leads_juridicos')
      .update({ isa_ativa: false })
      .eq('id', leadId);

    await supabase
      .from('manychat_subscribers')
      .update({ atendimento_humano: true })
      .eq('lead_id', leadId);

    await supabase.from('system_events').insert({
      tipo: 'handoff_humano',
      fonte: 'isa_escritorio',
      dados: { lead_id: leadId, motivo: 'transferencia_solicitada' }
    });
  }

  if (response.includes('[AGENDAR_ADVOGADO]')) {
    console.log('[ISA-ESCRITORIO] 📅 Solicitação de agendamento');
    
    await supabase.from('system_events').insert({
      tipo: 'agendamento_solicitado',
      fonte: 'isa_escritorio',
      dados: { lead_id: leadId, motivo: 'cliente_quer_falar_advogado' }
    });
  }

  if (response.includes('[FINANCEIRO_DUVIDA]')) {
    console.log('[ISA-ESCRITORIO] 💰 Dúvida financeira');
    
    await supabase.from('system_events').insert({
      tipo: 'duvida_financeira',
      fonte: 'isa_escritorio',
      dados: { lead_id: leadId }
    });
  }
}

// ============================================================
// DETECTAR INTENÇÃO DE AGENDAMENTO
// ============================================================
function detectarIntencaoAgendamento(message: string): boolean {
  const palavras = ['agendar', 'agenda', 'marcar', 'horário', 'horario', 'reunião', 'reuniao', 
                    'consulta', 'falar com', 'advogado', 'atendimento', 'dia', 'semana que vem',
                    'disponibilidade', 'disponível', 'disponivel'];
  const msgLower = message.toLowerCase();
  return palavras.some(p => msgLower.includes(p));
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    console.log('[ISA-ESCRITORIO] 📨 Payload:', JSON.stringify(body).substring(0, 300));

    const { lead_id, mensagem, subscriber_id, subscriber_nome, tipo_mensagem, media_url } = body;

    if (!lead_id || !mensagem) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'lead_id e mensagem são obrigatórios' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se atendimento humano está ativo
    const { data: subscriber } = await supabase
      .from('manychat_subscribers')
      .select('atendimento_humano')
      .eq('lead_id', lead_id)
      .maybeSingle();

    if (subscriber?.atendimento_humano) {
      console.log('[ISA-ESCRITORIO] ⏸️ Atendimento humano ativo, ignorando');
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        reason: 'atendimento_humano_ativo' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Processar mídia se presente (áudio/imagem/documento)
    let processedMessage = mensagem;
    if (media_url && (tipo_mensagem === 'audio' || tipo_mensagem === 'image' || tipo_mensagem === 'document')) {
      try {
        const mediaResponse = await fetch(`${supabaseUrl}/functions/v1/isa-multimodal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            action: 'process_media',
            mediaUrl: media_url,
            mediaType: tipo_mensagem,
            leadId: lead_id,
          }),
        });

        if (mediaResponse.ok) {
          const mediaResult = await mediaResponse.json();
          if (mediaResult.success) {
            if (mediaResult.transcription) {
              processedMessage = `[ÁUDIO TRANSCRITO]: "${mediaResult.transcription}"`;
            } else if (mediaResult.analysis) {
              processedMessage = `[DOCUMENTO/IMAGEM ANALISADO]: ${mediaResult.analysis}`;
            }
          }
        }
      } catch (e) {
        console.error('[ISA-ESCRITORIO] Erro ao processar mídia:', e);
      }
    }

    // ============================================================
    // DETECTAR CPF/NOME E BUSCAR PROCESSOS INTERNOS PRIMEIRO
    // ============================================================
    let processosContext = '';
    const cpfDetectado = extractCPF(processedMessage);

    // Também extrair possível número CNJ da mensagem
    const cnjMatch = processedMessage.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
    const cnjDetectado = cnjMatch ? cnjMatch[0] : null;

    // Buscar nome do lead para busca por nome
    let nomeLead: string | null = null;
    const { data: leadInfo } = await supabase
      .from('leads_juridicos')
      .select('nome, cpf')
      .eq('id', lead_id)
      .maybeSingle();
    if (leadInfo?.nome) nomeLead = leadInfo.nome;

    // CPF do lead (caso não tenha sido enviado na mensagem)
    const cpfParaBusca = cpfDetectado || (leadInfo?.cpf ? leadInfo.cpf.replace(/\D/g, '') : null);

    if (cpfParaBusca || cnjDetectado || nomeLead) {
      console.log(`[ISA-ESCRITORIO] 🔍 Buscando processos internos — CPF: ${cpfParaBusca || 'N/A'}, CNJ: ${cnjDetectado || 'N/A'}, Nome: ${nomeLead || 'N/A'}`);

      // 1. Buscar primeiro no sistema interno
      const { processos: internos, found } = await buscarProcessosInternos(supabase, cpfParaBusca, nomeLead, cnjDetectado);

      if (found) {
        console.log(`[ISA-ESCRITORIO] ✅ Encontrados ${internos.length} processos no sistema interno`);
        processosContext = formatarProcessosInternos(internos);
      } else if (cpfDetectado) {
        // 2. Fallback: buscar no Escavador apenas se CPF foi fornecido explicitamente e nada foi encontrado internamente
        console.log(`[ISA-ESCRITORIO] 📡 Nada encontrado internamente, buscando no Escavador...`);
        const { processos, error: escError } = await buscarProcessosPorCPF(cpfDetectado);

        if (escError) {
          processosContext = `\n[RESULTADO BUSCA]\nErro ao consultar: ${escError}. Informe ao cliente que houve uma falha temporária.`;
        } else if (processos.length === 0) {
          processosContext = `\n[RESULTADO BUSCA]\nNenhum processo encontrado para o CPF ${cpfDetectado}.`;
        } else {
          const detalhesMap = new Map<string, any>();
          const detailPromises = processos.slice(0, 10).map(async (proc: any) => {
            const cnj = proc.numero_cnj || proc.numero_processo;
            if (cnj) {
              const detalhe = await buscarDetalhesProcesso(cnj);
              if (detalhe) detalhesMap.set(cnj, detalhe);
            }
          });
          await Promise.all(detailPromises);
          processosContext = formatarProcessosEscavador(processos, detalhesMap);
        }
      } else {
        processosContext = `\n[PROCESSOS] Nenhum processo encontrado vinculado a este cliente no sistema.`;
      }

      await supabase.from('system_events').insert({
        tipo: 'processo_search',
        fonte: 'isa_escritorio',
        dados: { lead_id, cpf: cpfParaBusca, cnj: cnjDetectado, fonte: found ? 'interno' : 'escavador', resultados: found ? internos.length : 0 }
      });
    }

    // Detectar se o cliente quer agendar → incluir disponibilidade da agenda
    const querAgendar = detectarIntencaoAgendamento(processedMessage);

    // Buscar contexto completo do lead
    const context = await getLeadFullContext(lead_id, supabase, querAgendar);

    // Combinar contextos
    const fullContext = context + processosContext;

    // Gerar resposta
    const response = await generateResponse(processedMessage, fullContext);

    // Limpar tags da resposta para envio
    const cleanResponse = response
      .replace(/\[TRANSFERIR_HUMANO\]\s*/g, '')
      .replace(/\[AGENDAR_ADVOGADO\]\s*/g, '')
      .replace(/\[FINANCEIRO_DUVIDA\]\s*/g, '')
      .trim();

    // Processar tags de ação
    await processActionTags(response, lead_id, supabase);

    console.log('[ISA-ESCRITORIO] ✅ Resposta gerada:', cleanResponse.substring(0, 100));

    return new Response(JSON.stringify({ 
      success: true, 
      response: cleanResponse 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[ISA-ESCRITORIO] Erro:', errorMessage);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
