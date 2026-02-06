import "npm:@supabase/supabase-js@2";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function extrairDadosEscavador(escavadorData: any): { 
  autorNome?: string; 
  advogado?: string; 
  status: string; 
  classe: string;
  tribunal?: string;
  assunto?: string;
  valorCausa?: number;
  dataAjuizamento?: string;
  orgaoJulgador?: string;
} {
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
  
  // Tribunal
  const tribunal = fonteTribunal?.nome?.match(/TJ|TRT|TRF|STJ|STF/)?.[0] || fonteTribunal?.sigla || escavadorData?.sigla_tribunal;
  
  // Assunto
  const assunto = fonteTribunal?.assuntos?.[0]?.nome || escavadorData?.assuntos?.[0]?.nome;
  
  // Valor da causa
  const valorCausa = fonteTribunal?.valor_causa || escavadorData?.valor_causa;
  
  // Data ajuizamento
  const dataAjuizamento = fonteTribunal?.data_inicio || escavadorData?.data_inicio;
  
  // Órgão julgador
  const orgaoJulgador = fonteTribunal?.orgao_julgador?.nome || fonteTribunal?.vara;
  
  return { autorNome, advogado, status, classe, tribunal, assunto, valorCausa, dataAjuizamento, orgaoJulgador };
}

async function buscarProcessosPorCPF(cpf: string): Promise<any[]> {
  const ESCAVADOR_API_KEY = Deno.env.get('ESCAVADOR_API_KEY');
  
  if (!ESCAVADOR_API_KEY) {
    throw new Error('ESCAVADOR_API_KEY não configurada');
  }
  
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
      console.error(`❌ Erro Escavador CPF: ${response.status}`);
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { processos, cpf } = await req.json();
    
    // Modo 1: Importar por CPF (busca todos os processos do CPF e importa)
    if (cpf) {
      console.log(`\n📋 Importando processos por CPF: ${cpf}`);
      
      const processosEncontrados = await buscarProcessosPorCPF(cpf);
      
      if (processosEncontrados.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nenhum processo encontrado para este CPF', resultados: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const resultados = [];
      
      for (const proc of processosEncontrados) {
        const numero = proc.numero_cnj;
        if (!numero) continue;
        
        console.log(`\n📋 Processando: ${numero}`);
        
        // Verificar se já existe
        const { data: existing } = await supabaseClient
          .from('processos')
          .select('id, numero_processo')
          .eq('numero_processo', numero)
          .maybeSingle();

        if (existing) {
          console.log(`ℹ️ Já existe: ${numero}`);
          resultados.push({ numero, status: 'exists', id: existing.id });
          continue;
        }

        // Buscar detalhes completos do processo
        const escavadorData = await buscarProcessoEscavador(numero);
        const extracted = escavadorData ? extrairDadosEscavador(escavadorData) : {
          status: 'Em Andamento',
          classe: proc.titulo || 'Processo Importado',
          tribunal: proc.sigla_tribunal
        };

        const baseData = {
          numero_processo: numero,
          titulo_acao: extracted.classe,
          status: extracted.status,
          advogado_responsavel: extracted.advogado || null,
          tribunal: extracted.tribunal || null,
          assunto: extracted.assunto || null,
          valor_causa: extracted.valorCausa || null,
          data_ajuizamento: extracted.dataAjuizamento || null,
          orgao_julgador: extracted.orgaoJulgador || null,
          cliente_id: null as string | null,
          frequencia_notificacao_dias: 7,
          notificacao_ativa: true,
        };

        // Tentar vincular cliente pelo nome
        if (extracted.autorNome) {
          const { data: lead } = await supabaseClient
            .from('leads_juridicos')
            .select('id, nome')
            .ilike('nome', `%${extracted.autorNome}%`)
            .limit(1)
            .maybeSingle();
          
          if (lead) {
            baseData.cliente_id = lead.id;
            console.log(`✅ Cliente vinculado: ${lead.nome}`);
          }
        }

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
      
      console.log(`\n📊 Resumo CPF: ${resultados.filter(r => r.status === 'imported').length} importados`);
      
      return new Response(
        JSON.stringify({ success: true, resultados, total: processosEncontrados.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Modo 2: Importar por lista de números CNJ
    if (!processos || !Array.isArray(processos)) {
      return new Response(
        JSON.stringify({ error: 'Array de processos ou CPF é obrigatório' }),
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

      // Busca direta no Escavador
      const escavadorData = await buscarProcessoEscavador(numero);
      
      if (!escavadorData) {
        console.log(`❌ Processo não encontrado: ${numero}`);
        resultados.push({ numero, status: 'error', message: 'Processo não encontrado no Escavador' });
        continue;
      }
      
      const extracted = extrairDadosEscavador(escavadorData);

      // Preparar dados para inserção/atualização
      const baseData = {
        numero_processo: numero,
        titulo_acao: extracted.classe,
        status: extracted.status,
        advogado_responsavel: extracted.advogado || null,
        tribunal: extracted.tribunal || null,
        assunto: extracted.assunto || null,
        valor_causa: extracted.valorCausa || null,
        data_ajuizamento: extracted.dataAjuizamento || null,
        orgao_julgador: extracted.orgaoJulgador || null,
        cliente_id: null as string | null,
        frequencia_notificacao_dias: 7,
        notificacao_ativa: true,
      };
      
      // Tentar vincular cliente pelo nome completo
      if (extracted.autorNome) {
        const { data: lead } = await supabaseClient
          .from('leads_juridicos')
          .select('id, nome')
          .ilike('nome', `%${extracted.autorNome}%`)
          .limit(1)
          .maybeSingle();
        
        if (lead) {
          baseData.cliente_id = lead.id;
          console.log(`✅ Cliente vinculado: ${lead.nome}`);
        }
      }

      if (existing) {
        // Atualiza somente campos faltantes
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

