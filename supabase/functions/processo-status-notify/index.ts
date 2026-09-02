import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buscarMovimentosPendentes,
  classificarRelevanciaMovimentos,
  marcarMovimentosNotificados,
  type MovimentoPendente,
} from "../_shared/movimento-relevancia.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  processoId: string;
  mensagem?: string;
  tipo?: 'status_update' | 'movimento' | 'audiencia' | 'prazo';
  force?: boolean;
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
    // Verificar formato DD/MM/YYYY ANTES de new Date() para evitar interpretação MM/DD americana
    const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
      const d = new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      }
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

// Resolve the correct Z-API instance based on client's linha_whatsapp
async function resolveInstance(supabase: any, cliente: any) {
  const linhaWhatsapp = cliente.linha_whatsapp || "indefinido";
  const tipoOrigem = cliente.tipo_origem || "indefinido";

  // REGRA ABSOLUTA: tipo_origem é a fonte de verdade para roteamento
  // Tráfego → "Bentes Ramos Trafego" (92) 98588-8190 [5592985888190]
  // Escritório → "Bentes Ramos" (92) 99160-4348 [5592991604348]
  const isTrafego = tipoOrigem === "trafego" || tipoOrigem === "trafego_isa" ||
                    linhaWhatsapp === "trafego" || linhaWhatsapp === "trafego_isa";

  const PHONE_TRAFEGO    = "5592985888190"; // (92) 98588-8190
  const PHONE_ESCRITORIO = "5592991604348"; // (92) 99160-4348
  const targetPhone = isTrafego ? PHONE_TRAFEGO : PHONE_ESCRITORIO;

  console.log(`📱 Roteamento: tipo_origem=${tipoOrigem}, linha_whatsapp=${linhaWhatsapp}, isTrafego=${isTrafego}, targetPhone=${targetPhone}`);

  // Try zapi_instances table first
  const { data: instances } = await supabase
    .from("zapi_instances")
    .select("*")
    .eq("is_active", true)
    .order("is_default", { ascending: false });

  if (instances && instances.length > 0) {
    // 1º: match pelo número de telefone (mais confiável)
    const byPhone = instances.find((i: any) =>
      i.phone_number?.replace(/\D/g, "") === targetPhone
    );
    // 2º: fallback pelo flag is_default
    const byFlag = isTrafego
      ? instances.find((i: any) => !i.is_default) || instances[0]
      : instances.find((i: any) => i.is_default) || instances[0];

    const target = byPhone || byFlag;

    console.log(`✅ Instância selecionada: ${target.name || target.instance_id} (via=${byPhone ? 'phone' : 'flag'})`);

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

function buildMovimentosTemplate(movimentos: MovimentoPendente[]): string {
  let texto = "\n─────────────────\n\n📌 *Movimentações recentes:*\n\n";
  for (const mov of movimentos) {
    const dataFormatada = formatarData(mov.data_movimento || "");
    const traducao = traduzirMovimento(mov.movimento_titulo || "");
    const raw = (mov.movimento_descricao || "").trim();
    const detalhe = raw && raw.toLowerCase() !== (mov.movimento_titulo || "").toLowerCase()
      ? `\n     📄 _${raw.length > 200 ? raw.slice(0, 200) + "…" : raw}_`
      : "";
    if (dataFormatada) {
      texto += `  ▸ ${traducao}${detalhe}\n     _${dataFormatada}_\n\n`;
    } else {
      texto += `  ▸ ${traducao}${detalhe}\n\n`;
    }
  }
  return texto;
}

function buildMessage(
  processo: any,
  cliente: any,
  relevantes: MovimentoPendente[],
  explicacaoIA: string | null,
): string {
  const nomeCliente = (cliente.nome || "").split(" ")[0] || "";
  const saudacao = nomeCliente ? `Olá, ${nomeCliente}!` : "Olá!";
  const numProcesso = processo.numero_processo || "N/A";
  const statusTraduzido = traduzirStatus(processo.status || "Em Andamento");
  const tribunal = processo.tribunal || "";

  let movimentosTexto = "";

  if (relevantes.length > 0) {
    if (explicacaoIA) {
      movimentosTexto = `\n─────────────────\n\n📌 *O que aconteceu no seu processo:*\n\n${explicacaoIA}\n\n`;
    } else {
      movimentosTexto = buildMovimentosTemplate(relevantes);
    }
  } else {
    movimentosTexto =
      "\n─────────────────\n\n" +
      "ℹ️ Não houve novidades que exijam sua atenção desde o último contato.\n" +
      "Isso é algo normal no andamento processual, já que alguns processos podem permanecer por semanas sem atualizações relevantes.\n\n" +
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
    const { processoId, mensagem, tipo = 'status_update', force = false } = body;

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

    // Trava de frequência: no máximo 1 notificação a cada `frequencia_notificacao_dias`
    // (padrão 30) por processo. É a ÚNICA barreira compartilhada por todos os
    // chamadores (processo-auto-sync, processo-status-monitor, botão manual no CRM),
    // então fica aqui e não em cada chamador. O "claim" é uma UPDATE condicional
    // atômica — evita a corrida de duas chamadas quase simultâneas lendo
    // ultima_notificacao_at "livre" ao mesmo tempo e ambas enviando.
    const ultimaNotificacaoAnterior = processo.ultima_notificacao_at;
    let janelaReclamada = false;

    if (!force) {
      const frequenciaDias = processo.frequencia_notificacao_dias || 30;
      const cutoff = new Date(Date.now() - frequenciaDias * 24 * 60 * 60 * 1000).toISOString();

      // Sem .or() de propósito — evita depender do parser de filtros combinados do
      // PostgREST; a condição (null vs. < cutoff) já é decidida com o valor que
      // acabamos de ler, mas a comparação em si roda contra a linha atual no
      // momento da UPDATE, então a atomicidade contra outra chamada concorrente
      // é preservada de qualquer forma.
      let claimQuery = supabase
        .from("processos")
        .update({ ultima_notificacao_at: new Date().toISOString() })
        .eq("id", processoId);
      claimQuery = ultimaNotificacaoAnterior
        ? claimQuery.lt("ultima_notificacao_at", cutoff)
        : claimQuery.is("ultima_notificacao_at", null);

      const { data: claimed, error: claimError } = await claimQuery.select("id");

      if (claimError) {
        console.error("Erro ao verificar janela de notificação:", claimError);
        return new Response(
          JSON.stringify({ error: claimError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!claimed || claimed.length === 0) {
        console.log(`⏳ Notificação de ${processo.numero_processo} pulada — dentro da janela de ${frequenciaDias} dias (última em ${processo.ultima_notificacao_at}).`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, motivo: "dentro_da_janela", frequenciaDias, ultimaNotificacao: processo.ultima_notificacao_at }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      janelaReclamada = true;
    }

    // Se algo falhar depois de reclamar a janela (Z-API fora do ar, instância não
    // configurada, etc.), desfaz o carimbo para não bloquear o cliente pelo resto
    // da janela de frequência por causa de uma falha passageira.
    const desfazerReclamacaoDaJanela = async () => {
      if (!janelaReclamada) return;
      await supabase
        .from("processos")
        .update({ ultima_notificacao_at: ultimaNotificacaoAnterior })
        .eq("id", processoId);
    };

    // Busca movimentações ainda não avaliadas para notificação (fonte de
    // verdade: processo_movimentacoes, imune a reordenação/reescrita de
    // movimentos_json) e classifica quais são relevantes o suficiente para
    // o cliente — evita reenviar mero expediente ou, pior, movimentação já
    // comunicada antes. Só roda quando a mensagem é auto-gerada (sem `mensagem`
    // customizada no payload).
    let pendentes: MovimentoPendente[] = [];
    let relevantes: MovimentoPendente[] = [];
    let explicacaoIA: string | null = null;

    if (!mensagem) {
      pendentes = await buscarMovimentosPendentes(supabase, processoId);
      if (pendentes.length > 0) {
        const classificacao = await classificarRelevanciaMovimentos(
          pendentes,
          processo.numero_processo || "N/A",
          (cliente.nome || "").split(" ")[0] || "",
        );
        relevantes = classificacao.relevantes;
        explicacaoIA = classificacao.explicacaoRelevantes;
      }

      // Chamada automática (auto-sync) sem nada relevante pra contar: não manda
      // mensagem nenhuma. O botão manual (force=true) sempre manda algo, mesmo
      // que seja só a confirmação de "sem novidades", porque foi um pedido
      // explícito da equipe.
      if (!force && relevantes.length === 0) {
        await desfazerReclamacaoDaJanela();
        if (pendentes.length > 0) {
          await marcarMovimentosNotificados(supabase, pendentes, relevantes);
        }
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            motivo: pendentes.length === 0 ? "sem_movimentacao_nova" : "sem_novidade_relevante",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Resolve the correct Z-API instance based on client origin
    const instance = await resolveInstance(supabase, cliente);

    if (!instance) {
      await desfazerReclamacaoDaJanela();
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
    const textoMensagem = mensagem || buildMessage(processo, cliente, relevantes, explicacaoIA);

    // Enviar via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${instance.instanceId}/token/${instance.token}/send-text`;

    let zapiResponse: Response;
    let zapiResult: any;
    try {
      zapiResponse = await fetch(zapiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": instance.clientToken || "",
        },
        body: JSON.stringify({
          phone: telefone,
          message: textoMensagem,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      zapiResult = await zapiResponse.json();
    } catch (fetchErr) {
      await desfazerReclamacaoDaJanela();
      throw fetchErr;
    }

    console.log(`Z-API response (via ${instance.instanceName}):`, zapiResult);

    if (!zapiResponse.ok) {
      await desfazerReclamacaoDaJanela();
      throw new Error(`Z-API error: ${JSON.stringify(zapiResult)}`);
    }

    // Se veio de um envio forçado (botão manual), a janela não foi reclamada acima —
    // registra agora para que a próxima automática respeite a janela a partir daqui.
    if (force) {
      await supabase
        .from("processos")
        .update({ ultima_notificacao_at: new Date().toISOString() })
        .eq("id", processoId);
    }

    // Envio confirmado — agora sim marca as movimentações avaliadas como
    // notificadas (relevantes ou não), pra não reavaliar/reenviar de novo.
    if (pendentes.length > 0) {
      await marcarMovimentosNotificados(supabase, pendentes, relevantes);
    }

    // Registrar na tabela de mensagens (subscriber_id = zapi_<phone> para aparecer no chat)
    await supabase.from("manychat_mensagens").insert({
      subscriber_id:   `zapi_${telefone}`,
      lead_id:         cliente.id,
      conteudo:        textoMensagem,
      direcao:         "saida",
      tipo:            "text",
      canal:           "whatsapp",
      subscriber_nome: "Bentes & Ramos (Processos)",
      metadata: {
        source:          "processo_notify",
        processo_id:     processoId,
        tipo_notificacao: tipo,
        message_id:      zapiResult.messageId,
        instance_name:   instance.instanceName,
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
      JSON.stringify({ error: (error as Error)?.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
