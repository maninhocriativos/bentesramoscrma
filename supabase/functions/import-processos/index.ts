import "npm:@supabase/supabase-js@2";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lista de tribunais disponíveis na API DataJud (fallback para api_publica_{tribunal})
const TRIBUNAIS: Record<string, string> = {
  'trt11': 'api_publica_trt11',
  'tjam': 'api_publica_tjam',
  'trf1': 'api_publica_trf1',
  'trf2': 'api_publica_trf2',
  'trf3': 'api_publica_trf3',
  'tjsp': 'api_publica_tjsp',
  'tjrj': 'api_publica_tjrj',
  'tjmg': 'api_publica_tjmg',
  'tjrs': 'api_publica_tjrs',
  'tjpr': 'api_publica_tjpr',
};

// =====================================================
// ESCAVADOR API v2 - Fonte alternativa de busca
// =====================================================
async function buscarProcessoEscavador(numeroProcesso: string): Promise<any> {
  const ESCAVADOR_API_KEY = Deno.env.get('ESCAVADOR_API_KEY');
  
  if (!ESCAVADOR_API_KEY) {
    console.log('⚠️ ESCAVADOR_API_KEY não configurada');
    return null;
  }
  
  const numeroCNJ = numeroProcesso.trim();
  
  console.log(`🔍 Buscando processo ${numeroCNJ} no Escavador...`);
  
  try {
    const response = await fetch(`https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(numeroCNJ)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`❌ Erro Escavador: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`✅ Escavador retornou dados`);
    return data;
  } catch (error) {
    console.error('❌ Erro Escavador:', error);
    return null;
  }
}

function extrairDadosEscavador(escavadorData: any): { autorNome?: string; advogado?: string; status: string; classe: string } {
  const fonteTribunal = escavadorData?.fontes?.find((f: any) => f.tipo === 'TRIBUNAL') || escavadorData?.fontes?.[0];
  
  // Extrair partes
  const partes = fonteTribunal?.partes || escavadorData?.partes || escavadorData?.envolvidos || [];
  const parteAutor = partes.find((p: any) => 
    p.tipo_participacao?.toUpperCase().includes('AUTOR') || 
    p.polo?.toUpperCase() === 'ATIVO' ||
    p.tipo?.toUpperCase().includes('AUTOR')
  );
  
  const autorNome = parteAutor?.nome || parteAutor?.pessoa?.nome;
  
  const adv0 = parteAutor?.advogados?.[0];
  const advNome = adv0?.nome;
  const advOab = adv0?.inscricoes?.[0] 
    ? `OAB/${adv0.inscricoes[0].uf || ''} ${adv0.inscricoes[0].numero || ''}`.trim()
    : adv0?.oab;
  const advogado = advNome ? (advOab ? `${advNome} (${advOab})` : advNome) : undefined;
  
  // Status
  let status = 'Em Andamento';
  const statusPredito = fonteTribunal?.status_predito || escavadorData?.status_predito;
  if (statusPredito === 'INATIVO' || statusPredito === 'BAIXADO') status = 'Arquivado';
  else if (statusPredito === 'SUSPENSO') status = 'Suspenso';
  
  // Classe
  const classe = fonteTribunal?.classe?.nome || escavadorData?.titulo_classe || escavadorData?.classe || 'Processo Importado';
  
  return { autorNome, advogado, status, classe };
}

// Extrai dados do DataJud
function determinarStatusBasico(processo: any): string {
  const movimentos = processo?.movimentos || [];
  if (movimentos.length > 0) {
    const ultima = (movimentos[0]?.nome || '').toLowerCase();
    if (ultima.includes('arquiv')) return 'Arquivado';
    if (ultima.includes('baixa') || ultima.includes('trânsito')) return 'Arquivado';
    if (ultima.includes('suspen')) return 'Suspenso';
  }
  return 'Em Andamento';
}

function extrairAutorEAdvogado(processoData: any): { autorNome?: string; advogado?: string } {
  const partes = processoData?.partes || [];
  const parteAutor = partes.find((p: any) =>
    p?.polo === 'AT' || p?.polo === 'PA' || String(p?.tipoParte || '').toUpperCase().includes('AUTOR')
  );

  const autorNome = parteAutor?.nome || parteAutor?.pessoa?.nome;

  const adv0 = parteAutor?.advogados?.[0];
  const advNome = adv0?.nome;
  const advOab = adv0?.inscricao
    ? `OAB/${adv0.inscricao.unidadeFederativa || ''} ${adv0.inscricao.numero || ''}`.trim()
    : undefined;

  const advogado = advNome ? (advOab ? `${advNome} (${advOab})` : advNome) : undefined;
  return { autorNome, advogado };
}

// Detecta tribunal pelo número do processo
function detectarTribunal(numeroProcesso: string): string | null {
  const match = numeroProcesso.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/);
  if (!match) return null;
  
  const justica = match[1];
  const tribunal = match[2];
  
  if (justica === '5') {
    const trtNum = parseInt(tribunal);
    if (trtNum >= 1 && trtNum <= 24) return `trt${trtNum}`;
  }
  
  if (justica === '4') {
    const trfNum = parseInt(tribunal);
    if (trfNum >= 1 && trfNum <= 6) return `trf${trfNum}`;
  }
  
  if (justica === '8') {
    const tjNum = parseInt(tribunal);
    const TJ_CODES: Record<number, string> = {
      1: 'tjac', 2: 'tjal', 3: 'tjap', 4: 'tjam', 5: 'tjba',
      6: 'tjce', 7: 'tjdft', 8: 'tjes', 9: 'tjgo', 10: 'tjma',
      11: 'tjmt', 12: 'tjms', 13: 'tjmg', 14: 'tjpa', 15: 'tjpb',
      16: 'tjpr', 17: 'tjpe', 18: 'tjpi', 19: 'tjrj', 20: 'tjrn',
      21: 'tjrs', 22: 'tjro', 23: 'tjrr', 24: 'tjsc', 25: 'tjsp',
      26: 'tjse', 27: 'tjto'
    };
    if (TJ_CODES[tjNum]) return TJ_CODES[tjNum];
  }
  
  return null;
}

async function buscarProcessoDataJud(numeroProcesso: string, tribunal: string): Promise<any> {
  const DATAJUD_API_KEY = Deno.env.get('DATAJUD_API_KEY');
  if (!DATAJUD_API_KEY) throw new Error('DATAJUD_API_KEY not configured');
  
  const apiName = TRIBUNAIS[tribunal] || `api_publica_${tribunal}`;
  const url = `https://api-publica.datajud.cnj.jus.br/${apiName}/_search`;
  
  console.log(`🔍 Buscando ${numeroProcesso} no ${tribunal}...`);
  
  const numeroLimpo = numeroProcesso.replace(/[^\d]/g, '');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `APIKey ${DATAJUD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: { match: { numeroProcesso: numeroLimpo } },
      size: 1
    }),
  });
  
  if (!response.ok) {
    console.error(`❌ Erro API: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  return data.hits?.hits?.[0]?._source || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { processos } = await req.json();
    
    if (!processos || !Array.isArray(processos)) {
      return new Response(
        JSON.stringify({ error: 'Array de processos é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const resultados = [];
    
    for (const numero of processos) {
      console.log(`\n📋 Processando: ${numero}`);
      
      // Verificar se já existe
      const { data: existing } = await supabaseClient
        .from('processos')
        .select('id, numero_processo, titulo_acao, status, advogado_responsavel, cliente_id')
        .eq('numero_processo', numero)
        .maybeSingle();

      // Detectar tribunal
      const tribunal = detectarTribunal(numero);
      if (!tribunal) {
        console.log(`❌ Tribunal não detectado: ${numero}`);
        resultados.push({ numero, status: 'error', message: 'Tribunal não detectado' });
        continue;
      }
      
      // 1. Tentar DataJud primeiro
      let processoData = await buscarProcessoDataJud(numero, tribunal);
      let fonteUsada = 'DataJud';
      let autorNome: string | undefined;
      let advogado: string | undefined;
      let statusBasico: string;
      let tituloAcao: string;
      
      if (processoData) {
        const extracted = extrairAutorEAdvogado(processoData);
        autorNome = extracted.autorNome;
        advogado = extracted.advogado;
        statusBasico = determinarStatusBasico(processoData);
        tituloAcao = processoData?.classe?.nome || processoData?.classeProcessual?.nome || 'Processo Importado';
      } else {
        // 2. Fallback: tentar Escavador
        console.log(`⚠️ Não encontrado no DataJud, tentando Escavador...`);
        const escavadorData = await buscarProcessoEscavador(numero);
        
        if (escavadorData) {
          const extracted = extrairDadosEscavador(escavadorData);
          autorNome = extracted.autorNome;
          advogado = extracted.advogado;
          statusBasico = extracted.status;
          tituloAcao = extracted.classe;
          fonteUsada = 'Escavador';
          processoData = escavadorData;
        } else {
          // Nenhuma fonte encontrou
          statusBasico = 'Em Andamento';
          tituloAcao = 'Processo Importado';
        }
      }

      // Preparar dados para inserção/atualização
      const baseData = {
        numero_processo: numero,
        titulo_acao: tituloAcao,
        status: statusBasico,
        advogado_responsavel: advogado || null,
        cliente_id: null as string | null,
        frequencia_notificacao_dias: 7,
        notificacao_ativa: true,
      };
      
      // Tentar vincular cliente pelo nome completo (mais assertivo)
      if (autorNome) {
        const { data: lead } = await supabaseClient
          .from('leads_juridicos')
          .select('id, nome')
          .ilike('nome', `%${autorNome}%`)
          .limit(1)
          .maybeSingle();
        
        if (lead) {
          baseData.cliente_id = lead.id;
          console.log(`✅ Cliente vinculado: ${lead.nome}`);
        }
      }

      if (existing) {
        // Atualiza somente campos faltantes/ruins, mantendo o que o usuário já editou manualmente
        const updates: Record<string, any> = {};

        if (!existing.titulo_acao || existing.titulo_acao === 'Processo Importado') {
          updates.titulo_acao = baseData.titulo_acao;
        }
        if (!existing.status) {
          updates.status = baseData.status;
        }
        if (!existing.advogado_responsavel && baseData.advogado_responsavel) {
          updates.advogado_responsavel = baseData.advogado_responsavel;
        }
        if (!existing.cliente_id && baseData.cliente_id) {
          updates.cliente_id = baseData.cliente_id;
        }

        // Não forçar configs de notificação em processos já existentes

        if (Object.keys(updates).length === 0) {
          console.log(`ℹ️ Já está atualizado: ${numero}`);
          resultados.push({ numero, status: 'exists', id: existing.id, updated: false });
          continue;
        }

        const { error: updError } = await supabaseClient
          .from('processos')
          .update(updates)
          .eq('id', existing.id);

        if (updError) {
          console.error(`❌ Erro ao atualizar: ${updError.message}`);
          resultados.push({ numero, status: 'error', message: updError.message, id: existing.id });
        } else {
          console.log(`✅ Processo atualizado: ${numero}`);
          resultados.push({ numero, status: 'updated', id: existing.id, updates });
        }

        continue;
      }

      // Inserir no banco
      const { data: inserted, error } = await supabaseClient
        .from('processos')
        .insert(baseData)
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Erro ao inserir: ${error.message}`);
        resultados.push({ numero, status: 'error', message: error.message });
      } else {
        console.log(`✅ Processo importado: ${numero}`);
        resultados.push({ numero, status: 'imported', id: inserted.id, titulo: baseData.titulo_acao });
      }
    }
    
    console.log(`\n📊 Resumo: ${resultados.filter(r => r.status === 'imported').length} importados, ${resultados.filter(r => r.status === 'updated').length} atualizados`);
    
    return new Response(
      JSON.stringify({ success: true, resultados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Erro:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

