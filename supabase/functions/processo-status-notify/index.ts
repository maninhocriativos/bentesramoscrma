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
  // Fallback genérico
  return `Houve uma movimentação: ${nome}`;
}

function formatarData(dateStr: string): string {
  try {
    if (!dateStr || dateStr === "null" || dateStr === "undefined") return "";
    // Handle ISO dates, BR dates, and timestamps
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      // Try BR format DD/MM/YYYY
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

    // Buscar instância Z-API ativa e padrão
    const { data: zapiInstance } = await supabase
      .from("zapi_instances")
      .select("*")
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    // Fallback para integrations_config
    let instance: { instanceId: string; token: string; clientToken: string } | null = null;

    if (zapiInstance) {
      instance = {
        instanceId: zapiInstance.instance_id,
        token: zapiInstance.token,
        clientToken: zapiInstance.client_token || "",
      };
    } else {
      const { data: zapiConfig } = await supabase
        .from("integrations_config")
        .select("config_json")
        .eq("provider", "zapi")
        .eq("is_active", true)
        .maybeSingle();

      if (zapiConfig?.config_json) {
        const config = zapiConfig.config_json as any;
        const instances = config.instances || [];
        const inst = instances.find((i: any) => i.isDefault) || instances[0];
        if (inst) {
          instance = {
            instanceId: inst.instanceId,
            token: inst.token,
            clientToken: inst.clientToken || "",
          };
        }
      }
    }

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
    let textoMensagem = mensagem;
    if (!textoMensagem) {
      const numProcesso = processo.numero_processo || "N/A";
      const statusTraduzido = traduzirStatus(processo.status || "Em Andamento");
      const tribunal = processo.tribunal || "";
      const ultimaAtualizacao = processo.data_ultima_atualizacao 
        ? formatarData(processo.data_ultima_atualizacao)
        : "não disponível";

      // Pegar últimas movimentações (até 3) e traduzir
      const movimentos = (processo.movimentos_json || []).slice(0, 3);
      let movimentosTexto = "";
      if (movimentos.length > 0) {
        movimentosTexto = "\n📌 *Últimas movimentações:*\n";
        for (const mov of movimentos) {
          const dataFormatada = mov.dataHora ? formatarData(mov.dataHora) : "";
          const traducao = traduzirMovimento(mov.nome || "");
          movimentosTexto += `• ${traducao}${dataFormatada ? ` (${dataFormatada})` : ""}\n`;
        }
      } else {
        movimentosTexto = "\nℹ️ *Não houve novas movimentações* nesta semana. Isso é normal — alguns processos podem levar semanas ou meses sem movimentação. Fique tranquilo(a), estamos acompanhando de perto!\n";
      }

      const nomeCliente = (cliente.nome || "").split(" ")[0] || "";
      const saudacao = nomeCliente ? `Olá ${nomeCliente}, aqui` : "Olá, aqui";

      textoMensagem = `${saudacao} é a Isa do Bentes & Ramos! 👋\n\n` +
        `Segue a atualização semanal do seu processo:\n\n` +
        `📋 *Processo:* ${numProcesso}\n` +
        `⚖️ *Ação:* ${processo.titulo_acao || "N/A"}\n` +
        `📊 *Situação atual:* ${statusTraduzido}\n` +
        (tribunal ? `🏛️ *Tribunal:* ${tribunal}\n` : "") +
        `📅 *Última atualização:* ${ultimaAtualizacao}\n` +
        movimentosTexto +
        `\nQualquer dúvida, pode nos chamar por aqui mesmo! 🙂\n\n` +
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
