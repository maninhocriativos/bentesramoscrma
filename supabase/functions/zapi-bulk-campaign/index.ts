import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getZapiConfig, sendText, normalizePhone } from '../_shared/zapi-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Mensagem padrão de reativação (estilo SLOW)
const MENSAGEM_REATIVACAO = (nome: string) => 
  `Olá${nome ? ` ${nome}` : ''}! 🌟\n\nAqui é da equipe Bentes & Ramos Advocacia.\n\nNotamos que faz um tempinho que não falamos e gostaríamos de saber se surgiu alguma dúvida ou se podemos ajudar em algo sobre seu caso.\n\nEstamos à disposição! 💼`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const body = await req.json().catch(() => ({}));
    const { 
      dias_sem_contato = 7,
      dry_run = false, // Se true, só retorna quantos seriam enviados
      limite = 50, // Máximo por execução para evitar rate limiting
    } = body;
    
    console.log(`[Bulk Campaign] Iniciando campanha - dias_sem_contato: ${dias_sem_contato}, dry_run: ${dry_run}`);
    
    // Get Z-API config
    const zapiConfig = await getZapiConfig(supabase);
    if (!zapiConfig && !dry_run) {
      return new Response(JSON.stringify({ error: 'Z-API não configurado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const cutoffDate = new Date(Date.now() - dias_sem_contato * 24 * 60 * 60 * 1000).toISOString();
    
    // Buscar leads elegíveis:
    // - Com telefone
    // - Não são Ganho/Perdido/Contrato Assinado
    // - Última interação ou updated_at > X dias
    const { data: leads, error: leadsError } = await supabase
      .from('leads_juridicos')
      .select('id, nome, telefone, status, updated_at, last_contact_at')
      .not('telefone', 'is', null)
      .not('status', 'in', '("Contrato Assinado","Ganho","Perdido")')
      .or(`last_contact_at.lt.${cutoffDate},last_contact_at.is.null`)
      .order('updated_at', { ascending: true })
      .limit(limite);
    
    if (leadsError) {
      console.error('[Bulk Campaign] Erro ao buscar leads:', leadsError);
      return new Response(JSON.stringify({ error: leadsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[Bulk Campaign] Encontrados ${leads?.length || 0} leads elegíveis`);
    
    if (dry_run) {
      return new Response(JSON.stringify({
        dry_run: true,
        leads_encontrados: leads?.length || 0,
        leads: leads?.map(l => ({ id: l.id, nome: l.nome, telefone: l.telefone, status: l.status })),
        mensagem_exemplo: MENSAGEM_REATIVACAO('Cliente'),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const results: any[] = [];
    let enviados = 0;
    let erros = 0;
    
    for (const lead of leads || []) {
      try {
        const telefone = normalizePhone(lead.telefone);
        if (!telefone) {
          console.log(`[Bulk Campaign] Lead ${lead.id} sem telefone válido`);
          continue;
        }
        
        if (!zapiConfig) {
          console.error('[Bulk Campaign] Z-API não configurado');
          break;
        }
        
        const mensagem = MENSAGEM_REATIVACAO(lead.nome?.split(' ')[0] || '');
        
        console.log(`[Bulk Campaign] Enviando para ${lead.nome} (${telefone})`);
        const sendResult = await sendText(zapiConfig, telefone, mensagem);
        
        if (sendResult.success) {
          enviados++;
          
          // Buscar subscriber para associar a mensagem
          const { data: subscriber } = await supabase
            .from('manychat_subscribers')
            .select('subscriber_id')
            .or(`telefone_normalizado.eq.${telefone},lead_id.eq.${lead.id}`)
            .maybeSingle();
          
          const subscriberId = subscriber?.subscriber_id || `zapi_${telefone}`;
          
          // Salvar mensagem no histórico
          await supabase.from('manychat_mensagens').insert({
            subscriber_id: subscriberId,
            subscriber_nome: 'Bentes & Ramos',
            lead_id: lead.id,
            conteudo: mensagem,
            direcao: 'saida',
            tipo: 'text',
            canal: 'whatsapp',
            metadata: {
              source: 'bulk_campaign',
              campaign_type: 'reativacao_7dias',
              message_id: sendResult.messageId,
            },
          });
          
          // Registrar interação
          await supabase.from('interacoes').insert({
            cliente_id: lead.id,
            tipo: 'WhatsApp',
            direcao: 'Saída',
            resumo: 'Campanha de reativação - Follow-up automático',
            detalhes: mensagem.substring(0, 200),
          });
          
          // Atualizar last_contact_at do lead
          await supabase
            .from('leads_juridicos')
            .update({ last_contact_at: new Date().toISOString() })
            .eq('id', lead.id);
          
          results.push({
            lead_id: lead.id,
            nome: lead.nome,
            telefone,
            success: true,
          });
          
          console.log(`[Bulk Campaign] ✅ Enviado para ${lead.nome}`);
          
          // Rate limiting - aguardar 2 segundos entre envios
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } else {
          erros++;
          results.push({
            lead_id: lead.id,
            nome: lead.nome,
            telefone,
            success: false,
            error: sendResult.error,
          });
          console.error(`[Bulk Campaign] ❌ Falha para ${lead.nome}:`, sendResult.error);
        }
        
      } catch (err: any) {
        erros++;
        console.error(`[Bulk Campaign] Erro ao processar ${lead.id}:`, err);
        results.push({
          lead_id: lead.id,
          nome: lead.nome,
          success: false,
          error: err.message,
        });
      }
    }
    
    console.log(`[Bulk Campaign] Concluído - Enviados: ${enviados}, Erros: ${erros}`);
    
    return new Response(JSON.stringify({
      success: true,
      total_leads: leads?.length || 0,
      enviados,
      erros,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('[Bulk Campaign] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
