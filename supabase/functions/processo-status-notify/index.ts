import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  processoId: string;
  mensagem?: string;
  tipo?: 'status_update' | 'movimento' | 'audiencia' | 'prazo';
}

// Traduz status técnico para linguagem acessível ao cliente
function traduzirStatus(status: string): string {
  const mapa: Record<string, string> = {
    "Em Andamento": "em andamento — o processo segue tramitando normalmente",
    "Suspenso": "temporariamente suspenso — aguardando uma decisão ou prazo",
    "Arquivado": "arquivado — o processo foi encerrado",
    "Ganho": "encerrado com decisão favorável 🎉",
    "Perdido": "encerrado com decisão desfavorável",
  };
  return mapa[status] || status;
}

// Traduz movimentações técnicas para linguagem acessível
function traduzirMovimento(nome: string): string {
  const n = nome.toLowerCase();
  if (n.includes("juntada de petição")) return "Uma petição foi anexada ao processo";
  if (n.includes("juntada de documento")) return "Um novo documento foi anexado ao processo";
  if (n.includes("juntada")) return "Novos documentos foram anexados";
  if (n.includes("conclusão") || n.includes("conclusos")) return "O processo foi enviado ao juiz para análise";
  if (n.includes("despacho")) return "O juiz emitiu um despacho (decisão intermediária)";
  if (n.includes("sentença")) return "Foi proferida sentença no processo";
  if (n.includes("intimação")) return "Foi enviada uma intimação (comunicação oficial do tribunal)";
  if (n.includes("citação")) return "Foi realizada a citação da parte contrária";
  if (n.includes("audiência") || n.includes("audiencia")) return "Uma audiência foi agendada ou realizada";
  if (n.includes("recurso")) return "Um recurso foi interposto";
  if (n.includes("distribuição") || n.includes("distribuicao")) return "O processo foi distribuído a uma vara";
  if (n.includes("trânsito em julgado") || n.includes("transito em julgado")) return "A decisão se tornou definitiva (sem mais recursos)";
  if (n.includes("acordo") || n.includes("homologação")) return "Um acordo foi firmado ou homologado";
  if (n.includes("penhora")) return "Foi realizada penhora de bens";
  if (n.includes("alvará")) return "Foi expedido um alvará";
  if (n.includes("perícia") || n.includes("pericia")) return "Uma perícia foi solicitada ou realizada";
  if (n.includes("decisão") || n.includes("decisao")) return "O juiz tomou uma decisão no processo";
  if (n.includes("expedição") || n.includes("expedicao")) return "Um documento oficial foi expedido";
  if (n.includes("remessa")) return "O processo foi encaminhado para outra instância";
  if (n.includes("baixa") || n.includes("arquivamento")) return "O processo foi arquivado";
  if (n.includes("suspensão") || n.includes("suspensao")) return "O processo foi suspenso temporariamente";
  return `Houve uma movimentação: ${nome}`;
}

function formatarData(dateStr: string): string {
  try {
    if (!dateStr || dateStr === "null" || dateStr === "undefined") return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (match) {
        const d2 = new Date(`${match[3]}-${match[2]}-${match[1]}`);
        if (!isNaN(d2.getTime())) {
          return d2.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
        }
      }
      return "";
    }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

// Resolve the correct Z-API instance based on client's linha_whatsapp
async function resolveInstance(supabase: any, cliente: any) {
  const linhaWhatsapp = cliente.linha_whatsapp || "indefinido";
  const tipoOrigem = cliente.tipo_origem || "indefinido";

  // Determine which instance to use
  // Tráfego clients → Tráfego instance (non-default)
  // Bentes Ramos / organic clients → Bentes Ramos instance (default)
  const isTrafego = linhaWhatsapp === "trafego" || tipoOrigem === "trafego" || tipoOrigem === "trafego_isa";

  console.log(`📱 Roteamento: linha_whatsapp=${linhaWhatsapp}, tipo_origem=${tipoOrigem}, isTrafego=${isTrafego}`);

  // Try zapi_instances table first
  const { data: instances } = await supabase
    .from("zapi_instances")
    .select("*")
    .eq("is_active", true)
    .order("is_default", { ascending: false });

  if (instances && instances.length > 0) {
    let target;
    if (isTrafego) {
      // Find non-default (tráfego) instance
      target = instances.find((i: any) => !i.is_default) || instances[0];
    } else {
      // Find default (Bentes Ramos) instance
      target = instances.find((i: any) => i.is_default) || instances[0];
    }

    console.log(`✅ Instância selecionada: ${target.name || target.instance_id} (default=${target.is_default})`);

    return {
      instanceId: target.instance_id,
      token: target.token,
      clientToken: target.client_token || "",
      instanceName: target.name || (target.is_default ? "Bentes Ramos" : "Tráfego"),
    };
  }

  // Fallback to integrations_config
  const { data: zapiConfig } = await supabase
    .from("integrations_config")
    .select("config_json")
    .eq("provider", "zapi")
    .eq("is_active", true)
    .maybeSingle();

  if (zapiConfig?.config_json) {
    const config = zapiConfig.config_json as any;
    const allInstances = config.instances || [];
    let inst;
    if (isTrafego) {
      inst = allInstances.find((i: any) => !i.isDefault) || allInstances[0];
    } else {
      inst = allInstances.find((i: any) => i.isDefault) || allInstances[0];
    }
    if (inst) {
      return {
        instanceId: inst.instanceId,
        token: inst.token,
        clientToken: inst.clientToken || "",
        instanceName: inst.name || "Z-API",
      };
    }
  }

  return null;
}

function buildMessage(processo: any, cliente: any): string {
  const nomeCliente = (cliente.nome || "").split(" ")[0] || "";
  const saudacao = nomeCliente ? `Olá, ${nomeCliente}!` : "Olá!";
  const numProcesso = processo.numero_processo || "N/A";
  const statusTraduzido = traduzirStatus(processo.status || "Em Andamento");
  const tribunal = processo.tribunal || "";

  const movimentos = (processo.movimentos_json || []).slice(0, 3);
  let movimentosTexto = "";

  if (movimentos.length > 0) {
    movimentosTexto = "\n─────────────────\n\n📌 *Movimentações recentes:*\n\n";
    for (const mov of movimentos) {
      const dataFormatada = mov.dataHora ? formatarData(mov.dataHora) : "";
      const traducao = traduzirMovimento(mov.nome || "");
      if (dataFormatada) {
        movimentosTexto += `  ▸ ${traducao}\n     _${dataFormatada}_\n\n`;
      } else {
        movimentosTexto += `  ▸ ${traducao}\n\n`;
      }
    }
  } else {
    movimentosTexto =
      "\n─────────────────\n\n" +
      "ℹ️ Até o momento, não houve novas movimentações nesta semana.\n" +
      "Isso é algo normal no andamento processual, já que alguns processos podem permanecer por semanas sem atualizações.\n\n" +
      "Mas fique tranquilo(a): estamos acompanhando tudo de perto e, assim que houver qualquer novidade, você será informado(a).\n\n";
  }

  return (
    `${saudacao} Aqui é a *Isa*, assistente virtual do escritório *Bentes Ramos Advogados*. 👋\n\n` +
    `Passando para te atualizar sobre o andamento do seu processo:\n\n` +
    `📋 *Processo:* ${numProcesso}\n` +
    `⚖️ *Tipo:* ${processo.titulo_acao || "N/A"}\n` +
    `📊 *Status:* ${statusTraduzido}\n` +
    (tribunal ? `🏛️ *Tribunal:* ${tribunal}\n` : "") +
    movimentosTexto +
    `─────────────────\n\n` +
    `Se tiver qualquer dúvida, é só me chamar por aqui mesmo! 😊\n\n` +
    `_Bentes Ramos Advogados_\n` +
    `_Cuidando do seu direito._`
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json() as NotificationPayload;
    const { processoId, mensagem, tipo = 'status_update' } = body;

    if (!processoId) {
      return new Response(
        JSON.stringify({ error: "processoId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar processo com cliente
    const { data: processo, error: procError } = await supabase
      .from("processos")
      .select("*, cliente:leads_juridicos!cliente_id(*)")
      .eq("id", processoId)
      .single();

    if (procError || !processo) {
      console.error("Processo não encontrado:", procError);
      return new Response(
        JSON.stringify({ error: "Processo não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cliente = processo.cliente;
    if (!cliente?.telefone) {
      console.log("Cliente sem telefone:", cliente);
      return new Response(
        JSON.stringify({ error: "Cliente não possui telefone cadastrado", processo }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve the correct Z-API instance based on client origin
    const instance = await resolveInstance(supabase, cliente);

    if (!instance) {
      return new Response(
        JSON.stringify({ error: "Z-API não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Formatar telefone
    let telefone = cliente.telefone.replace(/\D/g, '');
    if (telefone.length === 10 || telefone.length === 11) {
      telefone = "55" + telefone;
    }

    // Montar mensagem
    const textoMensagem = mensagem || buildMessage(processo, cliente);

    // Enviar via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${instance.instanceId}/token/${instance.token}/send-text`;
    
    const zapiResponse = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": instance.clientToken || "",
      },
      body: JSON.stringify({
        phone: telefone,
        message: textoMensagem,
      }),
    });

    const zapiResult = await zapiResponse.json();
    console.log(`Z-API response (via ${instance.instanceName}):`, zapiResult);

    if (!zapiResponse.ok) {
      throw new Error(`Z-API error: ${JSON.stringify(zapiResult)}`);
    }

    // Atualizar última notificação
    await supabase
      .from("processos")
      .update({ ultima_notificacao_at: new Date().toISOString() })
      .eq("id", processoId);

    // Registrar na tabela de mensagens
    await supabase.from("manychat_mensagens").insert({
      subscriber_id: `lead_${cliente.id}`,
      lead_id: cliente.id,
      conteudo: textoMensagem,
      direcao: "saida",
      tipo: "text",
      canal: "whatsapp",
      subscriber_nome: cliente.nome,
      metadata: {
        source: "processo_notify",
        processo_id: processoId,
        tipo_notificacao: tipo,
        message_id: zapiResult.messageId,
        instance_name: instance.instanceName,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: zapiResult.messageId,
        telefone,
        processo: processo.numero_processo,
        instance: instance.instanceName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro ao enviar notificação:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
