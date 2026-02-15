import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getZapiConfig, sendImage, sendText, normalizePhone } from '../_shared/zapi-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// URL pública da imagem de prova social
const IMAGE_URL = 'https://bentesramoscrma.lovable.app/images/prova-social-bradesco.jpg';

// Mensagem de follow-up com prova social
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
    const { dry_run = false, intervalo_minutos = 10 } = body;

    console.log(`[Prova Social Campaign] Iniciando - dry_run: ${dry_run}, intervalo: ${intervalo_minutos}min`);

    // Buscar TODOS os leads de formulário Meta que têm telefone
    const { data: metaLeads, error: metaError } = await supabase
      .from('meta_form_leads')
      .select('id, nome, telefone, linked_lead_id, status')
      .not('telefone', 'is', null);

    if (metaError) {
      console.error('[Prova Social Campaign] Erro ao buscar meta leads:', metaError);
      return new Response(JSON.stringify({ error: metaError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filtrar leads válidos (com telefone, excluir convertidos)
    const leadsValidos = (metaLeads || []).filter(l => {
      const tel = l.telefone?.replace(/\D/g, '');
      return tel && tel.length >= 10 && l.status !== 'converted';
    });

    console.log(`[Prova Social Campaign] ${leadsValidos.length} leads de formulário elegíveis`);

    if (dry_run) {
      return new Response(JSON.stringify({
        dry_run: true,
        total_leads: leadsValidos.length,
        leads: leadsValidos.map(l => ({ id: l.id, nome: l.nome, telefone: l.telefone })),
        mensagem_exemplo: MENSAGEM_FOLLOWUP('Cliente'),
        imagem_url: IMAGE_URL,
        intervalo_minutos,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Z-API config (instância de tráfego)
    const zapiConfig = await getZapiConfig(supabase);
    if (!zapiConfig) {
      return new Response(JSON.stringify({ error: 'Z-API não configurado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let enviados = 0;
    let erros = 0;
    const results: any[] = [];
    const intervaloMs = intervalo_minutos * 60 * 1000; // 10 min em ms

    for (let i = 0; i < leadsValidos.length; i++) {
      const lead = leadsValidos[i];
      try {
        const telefone = normalizePhone(lead.telefone);
        if (!telefone) continue;

        console.log(`[Prova Social Campaign] [${i + 1}/${leadsValidos.length}] Enviando para ${lead.nome} (${telefone})`);

        // 1. Enviar imagem com caption
        const imgResult = await sendImage(zapiConfig, telefone, IMAGE_URL, 'Decisão judicial real | Caso ganho ✅');

        // 2. Aguardar 3 segundos e enviar texto
        await new Promise(r => setTimeout(r, 3000));
        const mensagem = MENSAGEM_FOLLOWUP(lead.nome || '');
        const txtResult = await sendText(zapiConfig, telefone, mensagem);

        const success = imgResult.success || txtResult.success;

        if (success) {
          enviados++;

          // Salvar mensagem no histórico
          const subscriberId = `zapi_${telefone}`;
          await supabase.from('manychat_mensagens').insert([
            {
              subscriber_id: subscriberId,
              subscriber_nome: 'Isa do Bentes & Ramos',
              lead_id: lead.linked_lead_id,
              conteudo: IMAGE_URL,
              direcao: 'saida',
              tipo: 'image',
              canal: 'whatsapp',
              metadata: { source: 'prova_social_campaign', campaign: 'bradesco_sentenca' },
            },
            {
              subscriber_id: subscriberId,
              subscriber_nome: 'Isa do Bentes & Ramos',
              lead_id: lead.linked_lead_id,
              conteudo: mensagem,
              direcao: 'saida',
              tipo: 'text',
              canal: 'whatsapp',
              metadata: { source: 'prova_social_campaign', campaign: 'bradesco_sentenca' },
            }
          ]);

          // Registrar interação no lead vinculado
          if (lead.linked_lead_id) {
            await supabase.from('interacoes').insert({
              cliente_id: lead.linked_lead_id,
              tipo: 'WhatsApp',
              direcao: 'Saída',
              resumo: 'Campanha Prova Social - Sentença Bradesco R$ 8.000',
              detalhes: mensagem.substring(0, 200),
            });

            await supabase.from('leads_juridicos')
              .update({ last_contact_at: new Date().toISOString() })
              .eq('id', lead.linked_lead_id);
          }

          results.push({ nome: lead.nome, telefone, success: true });
          console.log(`[Prova Social Campaign] ✅ Enviado para ${lead.nome}`);
        } else {
          erros++;
          results.push({ nome: lead.nome, telefone, success: false, error: txtResult.error || imgResult.error });
          console.error(`[Prova Social Campaign] ❌ Falha para ${lead.nome}:`, txtResult.error);
        }

        // Aguardar intervalo entre leads (10 min) - exceto para o último
        if (i < leadsValidos.length - 1) {
          console.log(`[Prova Social Campaign] Aguardando ${intervalo_minutos} minutos...`);
          await new Promise(r => setTimeout(r, intervaloMs));
        }
      } catch (err: any) {
        erros++;
        results.push({ nome: lead.nome, success: false, error: err.message });
        console.error(`[Prova Social Campaign] Erro:`, err);
      }
    }

    console.log(`[Prova Social Campaign] Concluído - Enviados: ${enviados}, Erros: ${erros}`);

    return new Response(JSON.stringify({
      success: true,
      total: leadsValidos.length,
      enviados,
      erros,
      results,
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
