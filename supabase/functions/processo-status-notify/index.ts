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

    // Buscar configuração Z-API
    const { data: zapiConfig } = await supabase
      .from("integrations_config")
      .select("config_json")
      .eq("provider", "zapi")
      .eq("is_active", true)
      .maybeSingle();

    if (!zapiConfig?.config_json) {
      return new Response(
        JSON.stringify({ error: "Z-API não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = zapiConfig.config_json as any;
    const instances = config.instances || [];
    const instance = instances.find((i: any) => i.isDefault) || instances[0];

    if (!instance) {
      return new Response(
        JSON.stringify({ error: "Nenhuma instância Z-API configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Formatar telefone
    let telefone = cliente.telefone.replace(/\D/g, '');
    if (telefone.length === 10 || telefone.length === 11) {
      telefone = "55" + telefone;
    }

    // Montar mensagem
    let textoMensagem = mensagem;
    if (!textoMensagem) {
      const numProcesso = processo.numero_processo || "N/A";
      const statusProc = processo.status || "Em Andamento";
      const tribunal = processo.tribunal || "";
      const ultimaAtualizacao = processo.data_ultima_atualizacao 
        ? new Date(processo.data_ultima_atualizacao).toLocaleDateString('pt-BR')
        : "não disponível";

      textoMensagem = `Olá, aqui é a Isa do Bentes & Ramos! 👋\n\n` +
        `Segue atualização do seu processo:\n\n` +
        `📋 *Número:* ${numProcesso}\n` +
        `⚖️ *Ação:* ${processo.titulo_acao || "N/A"}\n` +
        `📊 *Status:* ${statusProc}\n` +
        (tribunal ? `🏛️ *Tribunal:* ${tribunal}\n` : "") +
        `📅 *Última atualização:* ${ultimaAtualizacao}\n\n` +
        `Caso tenha dúvidas, estamos à disposição! 🙂\n\n` +
        `*Bentes & Ramos Advogados*`;
    }

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
    console.log("Z-API response:", zapiResult);

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
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: zapiResult.messageId,
        telefone,
        processo: processo.numero_processo 
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
