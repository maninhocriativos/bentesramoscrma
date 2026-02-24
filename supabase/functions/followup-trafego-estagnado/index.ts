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

Passando para te lembrar que ainda estamos à disposição para te ajudar! 💼

Olha só essa decisão recente que conquistamos: um banco foi *condenado a pagar R$ 8.000,00* por cobrança indevida em contrato de financiamento. 🎉

Se você está enfrentando problemas com cobranças abusivas, empréstimos indevidos ou qualquer irregularidade bancária, *nós podemos te ajudar a buscar seus direitos*.

📩 Me responda aqui que eu te oriento sobre os próximos passos!`;
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
      dias_sem_contato = 7
    } = body;

    console.log(`[Follow-up Tráfego] dry_run: ${dry_run}, intervalo: ${intervalo_minutos}min, dias: ${dias_sem_contato}`);

    const cutoffDate = new Date(Date.now() - dias_sem_contato * 24 * 60 * 60 * 1000).toISOString();

    // Buscar leads de tráfego estagnados
    const { data: leads, error } = await supabase
      .from('leads_juridicos')
      .select('id, nome, telefone, status, last_contact_at, lead_state, tipo_origem, fonte_trafego')
      .not('telefone', 'is', null)
      .eq('tipo_origem', 'trafego')
      .eq('is_lost', false)
      .not('status', 'in', '("Contrato Assinado","Ganho","Perdido")')
      .not('lead_state', 'in', '("CONTRACT_SIGNED","READY_FOR_LAWYER")')
      .or(`last_contact_at.lt.${cutoffDate},last_contact_at.is.null`)
      .order('last_contact_at', { ascending: true, nullsFirst: true });

    if (error) throw new Error(`Erro ao buscar leads: ${error.message}`);

    // Filtrar telefones válidos e deduplicar
    const seen = new Set<string>();
    const leadsElegiveis = (leads || []).filter(l => {
      const tel = l.telefone?.replace(/\D/g, '');
      if (!tel || tel.length < 10) return false;
      const normalized = normalizePhone(l.telefone);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });

    console.log(`[Follow-up Tráfego] ${leadsElegiveis.length} leads elegíveis de ${leads?.length || 0} encontrados`);

    if (dry_run) {
      return new Response(JSON.stringify({
        dry_run: true,
        total_leads: leadsElegiveis.length,
        dias_sem_contato,
        leads: leadsElegiveis.slice(0, 50).map(l => ({
          nome: l.nome,
          telefone: l.telefone,
          status: l.status,
          last_contact_at: l.last_contact_at,
          fonte_trafego: l.fonte_trafego,
        })),
        mensagem_exemplo: MENSAGEM_FOLLOWUP('Cliente'),
        imagem_url: IMAGE_URL,
        intervalo_minutos,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar config Z-API
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

    for (let i = 0; i < leadsElegiveis.length; i++) {
      const lead = leadsElegiveis[i];
      try {
        const telefone = normalizePhone(lead.telefone);

        console.log(`[Follow-up Tráfego] [${i + 1}/${leadsElegiveis.length}] Enviando para ${lead.nome} (${telefone})`);

        // 1. Enviar imagem de prova social
        const imgResult = await sendImage(zapiConfig, telefone, IMAGE_URL, 'Decisão judicial real | Caso ganho ✅');

        // 2. Aguardar 3s e enviar texto
        await new Promise(r => setTimeout(r, 3000));
        const mensagem = MENSAGEM_FOLLOWUP(lead.nome || '');
        const txtResult = await sendText(zapiConfig, telefone, mensagem);

        const success = imgResult.success || txtResult.success;

        if (success) {
          enviados++;
          const subscriberId = `zapi_${telefone}`;

          // Registrar mensagens no chat
          await supabase.from('manychat_mensagens').insert([
            {
              subscriber_id: subscriberId,
              subscriber_nome: 'Isa do Bentes & Ramos',
              lead_id: lead.id,
              conteudo: IMAGE_URL,
              direcao: 'saida',
              tipo: 'image',
              canal: 'whatsapp',
              metadata: { source: 'followup_trafego_estagnado', campaign: 'prova_social_reengajamento' },
            },
            {
              subscriber_id: subscriberId,
              subscriber_nome: 'Isa do Bentes & Ramos',
              lead_id: lead.id,
              conteudo: mensagem,
              direcao: 'saida',
              tipo: 'text',
              canal: 'whatsapp',
              metadata: { source: 'followup_trafego_estagnado', campaign: 'prova_social_reengajamento' },
            }
          ]);

          // Registrar interação
          await supabase.from('interacoes').insert({
            cliente_id: lead.id,
            tipo: 'WhatsApp',
            direcao: 'Saída',
            resumo: `Follow-up Tráfego Estagnado (${dias_sem_contato}d) - Prova Social`,
            detalhes: mensagem.substring(0, 200),
          });

          // Atualizar last_contact_at
          await supabase.from('leads_juridicos')
            .update({ last_contact_at: new Date().toISOString() })
            .eq('id', lead.id);

          results.push({ nome: lead.nome, telefone, success: true });
          console.log(`[Follow-up Tráfego] ✅ ${lead.nome}`);
        } else {
          erros++;
          results.push({ nome: lead.nome, telefone, success: false, error: txtResult.error || imgResult.error });
          console.error(`[Follow-up Tráfego] ❌ ${lead.nome}:`, txtResult.error);
        }

        // Intervalo entre envios (anti-spam)
        if (i < leadsElegiveis.length - 1) {
          console.log(`[Follow-up Tráfego] Aguardando ${intervalo_minutos} min...`);
          await new Promise(r => setTimeout(r, intervaloMs));
        }
      } catch (err: any) {
        erros++;
        results.push({ nome: lead.nome, success: false, error: err.message });
      }
    }

    // Registrar evento no sistema
    await supabase.from('system_events').insert({
      tipo: 'campanha',
      fonte: 'followup_trafego',
      acao: 'campanha_executada',
      dados: { total: leadsElegiveis.length, enviados, erros, dias_sem_contato },
    });

    console.log(`[Follow-up Tráfego] Concluído - Enviados: ${enviados}, Erros: ${erros}`);

    return new Response(JSON.stringify({
      success: true,
      total: leadsElegiveis.length,
      enviados,
      erros,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Follow-up Tráfego] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
