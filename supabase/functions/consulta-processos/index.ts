import "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =====================================================
// ESCAVADOR API v2 - Fonte única de busca
// =====================================================

async function buscarProcessoEscavador(numeroProcesso: string): Promise<any> {
  const ESCAVADOR_API_KEY = Deno.env.get('ESCAVADOR_API_KEY');
  
  if (!ESCAVADOR_API_KEY) {
    throw new Error('ESCAVADOR_API_KEY não configurada');
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
      const errorText = await response.text();
      console.error(`❌ Erro Escavador: ${response.status} - ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`✅ Escavador retornou dados para ${numeroCNJ}`);
    return data;
  } catch (error) {
    console.error('❌ Erro na chamada Escavador:', error);
    return null;
  }
}

async function buscarProcessosPorCPF(cpf: string): Promise<any[]> {
  const ESCAVADOR_API_KEY = Deno.env.get('ESCAVADOR_API_KEY');
  
  if (!ESCAVADOR_API_KEY) {
    throw new Error('ESCAVADOR_API_KEY não configurada');
  }
  
  // Limpar CPF (remover pontos, traços)
  const cpfLimpo = cpf.replace(/[^\d]/g, '');
  
  console.log(`🔍 Buscando processos por CPF ${cpfLimpo} no Escavador...`);
  
  try {
    const response = await fetch(`https://api.escavador.com/api/v2/envolvido/processos?cpf_cnpj=${cpfLimpo}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro Escavador CPF: ${response.status} - ${errorText}`);
      return [];
    }
    
    const data = await response.json();
    console.log(`✅ Escavador encontrou ${data.items?.length || 0} processos para CPF`);
    return data.items || [];
  } catch (error) {
    console.error('❌ Erro na busca por CPF:', error);
    return [];
  }
}

async function buscarProcessosPorNome(nome: string): Promise<any[]> {
  const ESCAVADOR_API_KEY = Deno.env.get('ESCAVADOR_API_KEY');
  
  if (!ESCAVADOR_API_KEY) {
    throw new Error('ESCAVADOR_API_KEY não configurada');
  }
  
  console.log(`🔍 Buscando processos por nome "${nome}" no Escavador...`);
  
  try {
    const response = await fetch(`https://api.escavador.com/api/v2/envolvido/processos?nome=${encodeURIComponent(nome)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro Escavador Nome: ${response.status} - ${errorText}`);
      return [];
    }
    
    const data = await response.json();
    console.log(`✅ Escavador encontrou ${data.items?.length || 0} processos para nome`);
    return data.items || [];
  } catch (error) {
    console.error('❌ Erro na busca por nome:', error);
    return [];
  }
}

async function buscarProcessosPorOAB(oab: string): Promise<any[]> {
  const ESCAVADOR_API_KEY = Deno.env.get('ESCAVADOR_API_KEY');
  
  if (!ESCAVADOR_API_KEY) {
    throw new Error('ESCAVADOR_API_KEY não configurada');
  }
  
  console.log(`🔍 Buscando processos por OAB "${oab}" no Escavador...`);
  
  try {
    const response = await fetch(`https://api.escavador.com/api/v2/advogado/processos?oab=${encodeURIComponent(oab)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro Escavador OAB: ${response.status} - ${errorText}`);
      return [];
    }
    
    const data = await response.json();
    console.log(`✅ Escavador encontrou ${data.items?.length || 0} processos para OAB`);
    return data.items || [];
  } catch (error) {
    console.error('❌ Erro na busca por OAB:', error);
    return [];
  }
}

// Formatar data para exibição
function formatarData(dataStr: string | null | undefined): string {
  if (!dataStr) return 'Não informado';
  
  try {
    const date = new Date(dataStr);
    if (isNaN(date.getTime())) return dataStr;
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dataStr;
  }
}

function formatarProcessoEscavador(escavadorData: any): any {
  // Pega a fonte do tribunal (primeira fonte disponível)
  const fonteTribunal = escavadorData?.fontes?.find((f: any) => f.tipo === 'TRIBUNAL') || escavadorData?.fontes?.[0];
  
  // Extrair partes
  const partes = fonteTribunal?.partes || escavadorData?.partes || escavadorData?.envolvidos || [];
  const partesFormatadas = partes.map((p: any) => ({
    nome: p.nome || p.pessoa?.nome || 'Desconhecido',
    tipo: p.tipo_participacao || p.tipo || 'Parte',
    polo: p.polo?.toUpperCase() === 'ATIVO' ? 'AT' : (p.polo?.toUpperCase() === 'PASSIVO' ? 'PA' : 'OUTRO'),
    tipoPessoa: p.tipo_pessoa || 'FISICA',
    documento: p.cpf || p.cnpj || null,
    advogados: (p.advogados || []).map((adv: any) => ({
      nome: adv.nome,
      oab: adv.inscricoes?.[0] ? `OAB/${adv.inscricoes[0].uf || ''} ${adv.inscricoes[0].numero || ''}`.trim() : adv.oab
    }))
  }));

  // Extrair movimentos (limitar a 50)
  const movimentosRaw = fonteTribunal?.movimentacoes || escavadorData?.movimentacoes || [];
  const movimentosFormatados = movimentosRaw.slice(0, 50).map((m: any) => ({
    dataHora: formatarData(m.data || m.data_hora),
    dataHoraRaw: m.data || m.data_hora || new Date().toISOString(),
    nome: m.titulo || m.conteudo || m.descricao || 'Movimentação',
    complemento: m.conteudo || m.complemento || null,
    codigo: null
  }));

  // Status
  let status = 'Em Andamento';
  const statusPredito = fonteTribunal?.status_predito || escavadorData?.status_predito;
  if (statusPredito === 'INATIVO' || statusPredito === 'BAIXADO') status = 'Arquivado';
  else if (statusPredito === 'SUSPENSO') status = 'Suspenso';

  // Assuntos
  const assuntosRaw = fonteTribunal?.assuntos || escavadorData?.assuntos || [];
  const assuntos = assuntosRaw.map((a: any) => ({
    nome: typeof a === 'string' ? a : (a.nome || a.descricao || String(a)),
    codigo: a.codigo ? String(a.codigo) : undefined
  }));

  return {
    numeroProcesso: escavadorData.numero_cnj || fonteTribunal?.numero_processo,
    classe: fonteTribunal?.classe?.nome || escavadorData?.titulo_classe || escavadorData?.classe || 'Processo',
    classeCodigo: fonteTribunal?.classe?.codigo ? String(fonteTribunal.classe.codigo) : undefined,
    assuntos,
    tribunal: fonteTribunal?.nome?.match(/TJ|TRT|TRF|STJ|STF/)?.[0] || fonteTribunal?.sigla || escavadorData?.sigla_tribunal || 'Não informado',
    dataAjuizamento: formatarData(fonteTribunal?.data_inicio || escavadorData?.data_inicio),
    grau: fonteTribunal?.grau || '1º Grau',
    nivelSigilo: escavadorData?.segredo_justica ? 'Segredo de Justiça' : 'Público',
    formato: 'Eletrônico',
    sistemaProcessual: fonteTribunal?.sistema || 'Escavador',
    orgaoJulgador: fonteTribunal?.orgao_julgador?.nome || fonteTribunal?.vara || 'Não informado',
    status,
    statusDetalhado: statusPredito || status,
    ultimaAtualizacao: formatarData(fonteTribunal?.data_ultima_movimentacao || escavadorData?.data_ultima_movimentacao),
    valorCausa: fonteTribunal?.valor_causa || escavadorData?.valor_causa || null,
    prioridade: [],
    movimentos: movimentosFormatados,
    partes: partesFormatadas,
    fonte: 'Escavador',
    fonteEscavador: true,
    fonteRaw: escavadorData
  };
}

function formatarProcessoListaEscavador(processo: any): any {
  return {
    numeroProcesso: processo.numero_cnj,
    titulo: processo.titulo || `${processo.titulo_polo_ativo || 'Autor'} X ${processo.titulo_polo_passivo || 'Réu'}`,
    tribunal: processo.sigla_tribunal || null,
    dataAjuizamento: formatarData(processo.data_inicio),
    ultimaAtualizacao: formatarData(processo.data_ultima_movimentacao),
    status: processo.status_predito === 'ATIVO' ? 'Em Andamento' : 
            processo.status_predito === 'INATIVO' ? 'Arquivado' : 
            processo.status_predito || 'Indefinido',
    fonte: 'Escavador'
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // Support both camelCase (frontend) and snake_case naming
    const numero_processo = body.numero_processo || body.numeroProcesso;
    const cpf = body.cpf;
    const nome = body.nome;
    const oab = body.oab;
    const action = body.action;
    const persistir = body.persistir;
    const advogadoResponsavel = body.advogadoResponsavel;
    
    console.log(`📋 Consulta recebida - action: ${action}, numero: ${numero_processo}, cpf: ${cpf}, nome: ${nome}, oab: ${oab}`);

    // Busca por CPF
    if ((action === 'buscar_por_cpf' || action === 'busca_cpf') && cpf) {
      const processos = await buscarProcessosPorCPF(cpf);
      
      if (processos.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Nenhum processo encontrado para este CPF',
            processos: [] 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const processosFormatados = processos.map(formatarProcessoListaEscavador);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          processos: processosFormatados,
          total: processosFormatados.length,
          fonte: 'Escavador'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Busca por nome
    if ((action === 'buscar_por_nome' || action === 'busca_nome') && nome) {
      const processos = await buscarProcessosPorNome(nome);
      
      if (processos.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Nenhum processo encontrado para este nome',
            processos: [] 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const processosFormatados = processos.map(formatarProcessoListaEscavador);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          processos: processosFormatados,
          total: processosFormatados.length,
          fonte: 'Escavador'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Busca por OAB
    if ((action === 'buscar_por_oab' || action === 'busca_oab') && oab) {
      const processos = await buscarProcessosPorOAB(oab);
      
      if (processos.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Nenhum processo encontrado para esta OAB',
            processos: [] 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const processosFormatados = processos.map(formatarProcessoListaEscavador);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          processos: processosFormatados,
          total: processosFormatados.length,
          fonte: 'Escavador'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Busca por número CNJ (padrão)
    if (!numero_processo) {
      return new Response(
        JSON.stringify({ error: 'Número do processo, CPF, nome ou OAB é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Busca direta no Escavador
    const escavadorData = await buscarProcessoEscavador(numero_processo);
    
    if (!escavadorData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Processo não encontrado no Escavador. Verifique o número e tente novamente.' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const processoFormatado = formatarProcessoEscavador(escavadorData);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        processo: processoFormatado,
        fonte: 'Escavador'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
