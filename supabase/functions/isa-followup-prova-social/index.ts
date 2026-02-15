import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getZapiConfig, sendImage, sendText, normalizePhone } from '../_shared/zapi-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const IMAGE_URL = 'https://bentesramoscrma.lovable.app/images/prova-social-bradesco.jpg';

const MENSAGEM_FOLLOWUP = (nome: string) => {
  const primeiro = nome?.split(' ')[0] || '';
  return `Olá${primeiro ? ` ${primeiro}` : ''}! Aqui é a *Isa do Bentes & Ramos* 🏛️

Olha só essa decisão que acabamos de ganhar! 🎉

Um banco foi *condenado a pagar R$ 8.000,00* por cobrança indevida em contrato de financiamento.

Se você também está passando por problemas com cobranças abusivas, empréstimos indevidos ou qualquer irregularidade bancária, *seus direitos podem estar sendo violados*.

💬 Quer saber se o seu caso também pode gerar uma indenização? Me responda aqui que eu te ajudo!`;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { 
      dry_run = false, 
      intervalo_minutos = 10,
      mode = 'meta_form' // 'meta_form' ou 'stagnant'
    } = body;

    console.log(`[Prova Social Campaign] Mode: ${mode}, dry_run: ${dry_run}, intervalo: ${intervalo_minutos}min`);

    let leadsParaEnviar: { nome: string; telefone: string; lead_id: string | null }[] = [];

    if (mode === 'meta_form') {
      // ===== LEADS DE FORMULÁRIO META =====
      const { data: metaLeads, error } = await supabase
        .from('meta_form_leads')
        .select('id, nome, telefone, linked_lead_id, status')
        .not('telefone', 'is', null);

      if (error) throw new Error(`Erro meta_form_leads: ${error.message}`);

      leadsParaEnviar = (metaLeads || [])
        .filter(l => {
          const tel = l.telefone?.replace(/\D/g, '');
          return tel && tel.length >= 10 && l.status !== 'converted';
        })
        .map(l => ({ nome: l.nome || '', telefone: l.telefone, lead_id: l.linked_lead_id }));

    } else if (mode === 'stagnant') {
      // ===== LEADS ESTAGNADOS =====
      // Leads sem contato há 3+ dias, excluindo convertidos/perdidos
      const cutoffDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

      const { data: stagnantLeads, error } = await supabase
        .from('leads_juridicos')
        .select('id, nome, telefone, status, last_contact_at, lead_state')
        .not('telefone', 'is', null)
        .not('status', 'in', '("Contrato Assinado","Ganho","Perdido")')
        .not('lead_state', 'in', '("CONTRACT_SIGNED","READY_FOR_LAWYER")')
        .or(`last_contact_at.lt.${cutoffDate},last_contact_at.is.null`)
        .order('last_contact_at', { ascending: true, nullsFirst: true });

      if (error) throw new Error(`Erro leads_juridicos: ${error.message}`);

      // Excluir leads que já foram enviados pelo modo meta_form (evitar duplicação)
      const { data: metaLinked } = await supabase
        .from('meta_form_leads')
        .select('linked_lead_id')
        .not('linked_lead_id', 'is', null);
      
      const metaLinkedIds = new Set((metaLinked || []).map(m => m.linked_lead_id));

      leadsParaEnviar = (stagnantLeads || [])
        .filter(l => !metaLinkedIds.has(l.id)) // Não duplicar com leads de formulário
        .map(l => ({ nome: l.nome || '', telefone: l.telefone, lead_id: l.id }));
    }

    // Deduplicar por telefone normalizado
    const seen = new Set<string>();
    leadsParaEnviar = leadsParaEnviar.filter(l => {
      const tel = normalizePhone(l.telefone);
      if (seen.has(tel)) return false;
      seen.add(tel);
      return true;
    });

    console.log(`[Prova Social Campaign] ${leadsParaEnviar.length} leads elegíveis (mode: ${mode})`);

    if (dry_run) {
      return new Response(JSON.stringify({
        dry_run: true,
        mode,
        total_leads: leadsParaEnviar.length,
        leads: leadsParaEnviar.map(l => ({ nome: l.nome, telefone: l.telefone })),
        mensagem_exemplo: MENSAGEM_FOLLOWUP('Cliente'),
        imagem_url: IMAGE_URL,
        intervalo_minutos,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
    const intervaloMs = intervalo_minutos * 60 * 1000;

    for (let i = 0; i < leadsParaEnviar.length; i++) {
      const lead = leadsParaEnviar[i];
      try {
        const telefone = normalizePhone(lead.telefone);
        if (!telefone) continue;

        console.log(`[Prova Social Campaign] [${i + 1}/${leadsParaEnviar.length}] Enviando para ${lead.nome} (${telefone})`);

        // 1. Enviar imagem
        const imgResult = await sendImage(zapiConfig, telefone, IMAGE_URL, 'Decisão judicial real | Caso ganho ✅');
        
        // 2. Aguardar e enviar texto
        await new Promise(r => setTimeout(r, 3000));
        const mensagem = MENSAGEM_FOLLOWUP(lead.nome);
        const txtResult = await sendText(zapiConfig, telefone, mensagem);

        const success = imgResult.success || txtResult.success;

        if (success) {
          enviados++;
          const subscriberId = `zapi_${telefone}`;
          
          await supabase.from('manychat_mensagens').insert([
            {
              subscriber_id: subscriberId,
              subscriber_nome: 'Isa do Bentes & Ramos',
              lead_id: lead.lead_id,
              conteudo: IMAGE_URL,
              direcao: 'saida',
              tipo: 'image',
              canal: 'whatsapp',
              metadata: { source: 'prova_social_campaign', campaign: 'bradesco_sentenca', mode },
            },
            {
              subscriber_id: subscriberId,
              subscriber_nome: 'Isa do Bentes & Ramos',
              lead_id: lead.lead_id,
              conteudo: mensagem,
              direcao: 'saida',
              tipo: 'text',
              canal: 'whatsapp',
              metadata: { source: 'prova_social_campaign', campaign: 'bradesco_sentenca', mode },
            }
          ]);

          if (lead.lead_id) {
            await supabase.from('interacoes').insert({
              cliente_id: lead.lead_id,
              tipo: 'WhatsApp',
              direcao: 'Saída',
              resumo: `Campanha Prova Social (${mode}) - Sentença Bradesco R$ 8.000`,
              detalhes: mensagem.substring(0, 200),
            });
            await supabase.from('leads_juridicos')
              .update({ last_contact_at: new Date().toISOString() })
              .eq('id', lead.lead_id);
          }

          results.push({ nome: lead.nome, telefone, success: true });
          console.log(`[Prova Social Campaign] ✅ ${lead.nome}`);
        } else {
          erros++;
          results.push({ nome: lead.nome, telefone, success: false, error: txtResult.error || imgResult.error });
          console.error(`[Prova Social Campaign] ❌ ${lead.nome}:`, txtResult.error);
        }

        if (i < leadsParaEnviar.length - 1) {
          console.log(`[Prova Social Campaign] Aguardando ${intervalo_minutos} min...`);
          await new Promise(r => setTimeout(r, intervaloMs));
        }
      } catch (err: any) {
        erros++;
        results.push({ nome: lead.nome, success: false, error: err.message });
      }
    }

    console.log(`[Prova Social Campaign] Concluído (${mode}) - Enviados: ${enviados}, Erros: ${erros}`);

    return new Response(JSON.stringify({
      success: true, mode, total: leadsParaEnviar.length, enviados, erros, results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Prova Social Campaign] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
