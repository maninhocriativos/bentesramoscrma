import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getZapiConfig, sendText, normalizePhone } from '../_shared/zapi-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MENSAGEM_PRIMEIRO_CONTATO = (nome: string) => {
  const primeiro = nome?.split(' ')[0] || '';
  return `Olá${primeiro ? ` ${primeiro}` : ''}! 👋 Aqui é a *Isa do Bentes & Ramos* 🏛️

Estou entrando em contato porque vi que você preencheu nosso formulário para *análise de juros abusivos* em contratos bancários.

Que bom que deu esse primeiro passo! Muitas pessoas nem sabem que estão pagando juros muito acima do permitido por lei. 💡

Vou te fazer algumas perguntas rápidas para entender melhor o seu caso e ver como podemos te ajudar, tá bom?

Me conta: *qual banco é o seu contrato?* E se você sabe informar, *qual o valor aproximado do empréstimo ou financiamento?* 🏦`;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { dry_run = false, intervalo_segundos = 15 } = body;

    // Buscar os 7 leads específicos do CSV importado
    const metaLeadIds = [
      '944081828184073', '766011589918501', '1272900245032056',
      '913101351177501', '1204462675184779', '1429963975280587', '1528241038273179'
    ];

    const { data: metaLeads, error } = await supabase
      .from('meta_form_leads')
      .select('id, nome, telefone, linked_lead_id, status')
      .in('meta_lead_id', metaLeadIds);

    if (error) throw new Error(`Erro buscando leads: ${error.message}`);

    const leads = (metaLeads || []).filter(l => l.telefone);

    console.log(`[First Contact CSV] ${leads.length} leads encontrados`);

    if (dry_run) {
      return new Response(JSON.stringify({
        dry_run: true,
        total: leads.length,
        leads: leads.map(l => ({ nome: l.nome, telefone: l.telefone })),
        mensagem_exemplo: MENSAGEM_PRIMEIRO_CONTATO('Cliente'),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const zapiConfig = await getZapiConfig(supabase);
    if (!zapiConfig) {
      return new Response(JSON.stringify({ error: 'Z-API não configurado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let enviados = 0;
    let erros = 0;
    const results: any[] = [];

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      try {
        const telefone = normalizePhone(lead.telefone);
        if (!telefone) continue;

        console.log(`[First Contact CSV] [${i + 1}/${leads.length}] Enviando para ${lead.nome} (${telefone})`);

        const mensagem = MENSAGEM_PRIMEIRO_CONTATO(lead.nome);
        const txtResult = await sendText(zapiConfig, telefone, mensagem);

        if (txtResult.success) {
          enviados++;
          const subscriberId = `zapi_${telefone}`;

          // Salvar mensagem no banco
          await supabase.from('manychat_mensagens').insert({
            subscriber_id: subscriberId,
            subscriber_nome: 'Isa do Bentes & Ramos',
            lead_id: lead.linked_lead_id,
            conteudo: mensagem,
            direcao: 'saida',
            tipo: 'text',
            canal: 'whatsapp',
            metadata: { 
              source: 'isa_first_contact_csv', 
              message_id: txtResult.messageId,
              instance_name: zapiConfig.name
            },
          });

          // Registrar interação
          if (lead.linked_lead_id) {
            await supabase.from('interacoes').insert({
              cliente_id: lead.linked_lead_id,
              tipo: 'WhatsApp',
              direcao: 'Saída',
              resumo: 'Primeiro contato ISA - Formulário Juros Abusivos',
              detalhes: mensagem.substring(0, 200),
            });

            // Atualizar status do lead
            await supabase.from('leads_juridicos').update({
              last_contact_at: new Date().toISOString(),
              status: 'Em Atendimento',
            }).eq('id', lead.linked_lead_id);
          }

          // Atualizar status no meta_form_leads
          await supabase.from('meta_form_leads').update({
            status: 'em_atendimento',
            last_contact_at: new Date().toISOString(),
          }).eq('id', lead.id);

          // Criar/atualizar lead_followups
          if (lead.linked_lead_id) {
            await supabase.from('lead_followups').upsert({
              lead_id: lead.linked_lead_id,
              primeiro_contato_em: new Date().toISOString(),
              last_outbound_at: new Date().toISOString(),
              last_isa_outbound_at: new Date().toISOString(),
              status: 'aguardando',
              waiting_reply: true,
              canal: 'whatsapp',
              subscriber_id: subscriberId,
            }, { onConflict: 'lead_id' });
          }

          results.push({ nome: lead.nome, telefone, success: true });
          console.log(`[First Contact CSV] ✅ ${lead.nome}`);
        } else {
          erros++;
          results.push({ nome: lead.nome, telefone, success: false, error: txtResult.error });
          console.error(`[First Contact CSV] ❌ ${lead.nome}: ${txtResult.error}`);
        }

        // Intervalo entre envios
        if (i < leads.length - 1) {
          await new Promise(r => setTimeout(r, intervalo_segundos * 1000));
        }
      } catch (err: any) {
        erros++;
        results.push({ nome: lead.nome, success: false, error: err.message });
      }
    }

    console.log(`[First Contact CSV] Concluído - Enviados: ${enviados}, Erros: ${erros}`);

    return new Response(JSON.stringify({
      success: true, total: leads.length, enviados, erros, results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[First Contact CSV] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
