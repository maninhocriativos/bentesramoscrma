import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getZapiConfig, sendImage, sendText, normalizePhone } from '../_shared/zapi-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DEFAULT_IMAGE_URL = 'https://bentesramoscrma.lovable.app/images/prova-social-bradesco.jpg';

const DEFAULT_MENSAGEM = `Olá{nome_prefix}! Aqui é a *Isa do Bentes & Ramos* 🏛️

Passando para te lembrar que ainda estamos à disposição para te ajudar! 💼

Olha só essa decisão recente que conquistamos: um banco foi *condenado a pagar R$ 8.000,00* por cobrança indevida em contrato de financiamento. 🎉

Se você está enfrentando problemas com cobranças abusivas, empréstimos indevidos ou qualquer irregularidade bancária, *nós podemos te ajudar a buscar seus direitos*.

📩 Me responda aqui que eu te oriento sobre os próximos passos!`;

function buildMessage(template: string, nome: string): string {
  const primeiro = nome?.split(' ')[0] || '';
  // Support {nome} placeholder
  let msg = template.replace(/\{nome\}/g, primeiro || '');
  // Support legacy {nome_prefix} placeholder
  msg = msg.replace(/\{nome_prefix\}/g, primeiro ? ` ${primeiro}` : '');
  return msg;
}

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
      dias_sem_contato = 7,
      mensagem_template,
      imagem_url,
    } = body;

    const template = mensagem_template || DEFAULT_MENSAGEM;
    const imageUrl = imagem_url || DEFAULT_IMAGE_URL;

    console.log(`[Follow-up Tráfego] dry_run: ${dry_run}, intervalo: ${intervalo_minutos}min, dias: ${dias_sem_contato}`);

    const cutoffDate = new Date(Date.now() - dias_sem_contato * 24 * 60 * 60 * 1000).toISOString();

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
        mensagem_exemplo: buildMessage(template, 'Cliente'),
        imagem_url: imageUrl,
        intervalo_minutos,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // REGRA ESTRITA: Follow-up de tráfego DEVE usar a instância de tráfego (não-default)
    const { data: instances } = await supabase
      .from('zapi_instances')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: true }); // não-default primeiro

    const trafegoInstance = instances?.find((i: any) => !i.is_default) || instances?.[0];
    if (!trafegoInstance) {
      return new Response(JSON.stringify({ error: 'Z-API não configurado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const zapiConfig = {
      instance_id: trafegoInstance.instance_id,
      token: trafegoInstance.token,
      client_token: trafegoInstance.client_token,
      name: trafegoInstance.name,
      phone_number: trafegoInstance.phone_number,
    };
    console.log(`[Follow-up Tráfego] 📱 Usando instância de tráfego: ${zapiConfig.name}`);

    let enviados = 0;
    let erros = 0;
    const results: any[] = [];
    const intervaloMs = intervalo_minutos * 60 * 1000;

    for (let i = 0; i < leadsElegiveis.length; i++) {
      const lead = leadsElegiveis[i];
      try {
        const telefone = normalizePhone(lead.telefone);
        const mensagem = buildMessage(template, lead.nome || '');

        console.log(`[Follow-up Tráfego] [${i + 1}/${leadsElegiveis.length}] Enviando para ${lead.nome} (${telefone})`);

        const imgResult = await sendImage(zapiConfig, telefone, imageUrl, 'Decisão judicial real | Caso ganho ✅');
        await new Promise(r => setTimeout(r, 3000));
        const txtResult = await sendText(zapiConfig, telefone, mensagem);

        const success = imgResult.success || txtResult.success;

        if (success) {
          enviados++;
          const subscriberId = `zapi_${telefone}`;

          await supabase.from('manychat_mensagens').insert([
            {
              subscriber_id: subscriberId,
              subscriber_nome: 'Isa do Bentes & Ramos',
              lead_id: lead.id,
              conteudo: imageUrl,
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

          await supabase.from('interacoes').insert({
            cliente_id: lead.id,
            tipo: 'WhatsApp',
            direcao: 'Saída',
            resumo: `Follow-up Tráfego Estagnado (${dias_sem_contato}d) - Prova Social`,
            detalhes: mensagem.substring(0, 200),
          });

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

        if (i < leadsElegiveis.length - 1) {
          console.log(`[Follow-up Tráfego] Aguardando ${intervalo_minutos} min...`);
          await new Promise(r => setTimeout(r, intervaloMs));
        }
      } catch (err: any) {
        erros++;
        results.push({ nome: lead.nome, success: false, error: err.message });
      }
    }

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
