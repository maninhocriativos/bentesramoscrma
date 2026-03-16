import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, RefreshCw, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import type { Processo } from "@/types/processos";
import type { LeadName } from "@/hooks/useLeadNames";

type SentNotification = {
  id: string;
  created_at: string;
  conteudo: string;
  canal: string | null;
  tipo: string | null;
};

export interface ProcessoNotificacoesTabProps {
  processo: Processo;
  cliente?: Lead;
  sending: boolean;
  onSendManual: () => void;
  config: React.ReactNode;
  previewData: {
    nomeCliente?: string | null;
    numeroProcesso?: string | null;
    acao?: string | null;
    status?: string | null;
    tribunal?: string | null;
    ultimaAtualizacao?: string | null;
    movimentos?: Array<{ dataHora: string; nome: string; complemento?: string }>;
  };
}

function formatDateTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

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

function traduzirMovimento(nome: string): string {
  const n = nome.toLowerCase();
  if (n.includes("juntada de petição")) return "Uma petição foi anexada ao processo";
  if (n.includes("juntada de documento")) return "Um novo documento foi anexado";
  if (n.includes("juntada")) return "Novos documentos foram anexados";
  if (n.includes("conclusão") || n.includes("conclusos")) return "O processo foi enviado ao juiz para análise";
  if (n.includes("despacho")) return "O juiz emitiu um despacho";
  if (n.includes("sentença")) return "Foi proferida sentença";
  if (n.includes("intimação")) return "Foi enviada uma intimação";
  if (n.includes("citação")) return "Foi realizada a citação da parte contrária";
  if (n.includes("audiência") || n.includes("audiencia")) return "Uma audiência foi agendada ou realizada";
  if (n.includes("recurso")) return "Um recurso foi interposto";
  if (n.includes("distribuição")) return "O processo foi distribuído";
  if (n.includes("decisão") || n.includes("decisao")) return "O juiz tomou uma decisão";
  return `Movimentação: ${nome}`;
}

function formatarDataLonga(dateStr: string): string {
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

function buildPreviewMessage(d: ProcessoNotificacoesTabProps["previewData"]) {
  const numProcesso = d.numeroProcesso || "N/A";
  const statusTraduzido = traduzirStatus(d.status || "Em Andamento");
  const tribunal = d.tribunal || "";

  const movimentos = (d.movimentos || []).slice(0, 3);
  let movimentosTexto = "";
  if (movimentos.length > 0) {
    movimentosTexto = "\n─────────────────\n\n📌 *Movimentações recentes:*\n\n";
    for (const mov of movimentos) {
      const dataFormatada = mov.dataHora ? formatarDataLonga(mov.dataHora) : "";
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

  const nomeCliente = (d.nomeCliente || "").split(" ")[0] || "";
  const saudacao = nomeCliente ? `Olá, ${nomeCliente}!` : "Olá!";

  return (
    `${saudacao} Aqui é a *Isa*, assistente virtual do escritório *Bentes Ramos Advogados*. 👋\n\n` +
    `Passando para te atualizar sobre o andamento do seu processo:\n\n` +
    `📋 *Processo:* ${numProcesso}\n` +
    `⚖️ *Tipo:* ${d.acao || "N/A"}\n` +
    `📊 *Status:* ${statusTraduzido}\n` +
    (tribunal ? `🏛️ *Tribunal:* ${tribunal}\n` : "") +
    movimentosTexto +
    `─────────────────\n\n` +
    `Se tiver qualquer dúvida, é só me chamar por aqui mesmo! 😊\n\n` +
    `_Bentes Ramos Advogados_\n` +
    `_Cuidando do seu direito._`
  );
}

export function ProcessoNotificacoesTab({
  processo,
  cliente,
  sending,
  onSendManual,
  config,
  previewData,
}: ProcessoNotificacoesTabProps) {
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sent, setSent] = useState<SentNotification[]>([]);

  const previewText = useMemo(() => buildPreviewMessage(previewData), [previewData]);

  const fetchHistory = useCallback(async () => {
    if (!processo.id) return;

    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("manychat_mensagens")
        .select("id, created_at, conteudo, canal, tipo")
        .eq("direcao", "saida")
        .eq("metadata->>source", "processo_notify")
        .eq("metadata->>processo_id", processo.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setSent((data as SentNotification[]) || []);
    } catch (err) {
      console.error("Erro ao buscar notificações enviadas:", err);
      toast.error("Não foi possível carregar o histórico de notificações");
    } finally {
      setLoadingHistory(false);
    }
  }, [processo.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="space-y-4">
      {config}

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Prévia da Mensagem WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Esta é a mensagem que será enviada ao cliente via WhatsApp. Ela é gerada automaticamente com os dados do processo.
          </p>
          
          {/* Simulação de celular WhatsApp */}
          <div className="relative max-w-sm mx-auto">
            <div className="bg-[#0b141a] rounded-2xl p-2 shadow-lg">
              {/* Header do chat */}
              <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-700">
                <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">BR</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-white">Bentes & Ramos</p>
                  <p className="text-[10px] text-gray-400">Escritório</p>
                </div>
              </div>
              
              {/* Área de mensagens com fundo do WhatsApp */}
              <div 
                className="p-3 min-h-[200px]" 
                style={{ 
                  backgroundColor: '#0b141a',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23182229\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
                }}
              >
                {/* Balão de mensagem */}
                <div className="bg-[#005c4b] rounded-lg p-3 max-w-[280px] ml-auto shadow">
                  <pre className="whitespace-pre-wrap break-words text-sm text-white font-sans leading-relaxed">
                    {previewText}
                  </pre>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-gray-300">
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 16 15">
                      <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Prévia ilustrativa — a mensagem real pode variar levemente
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Notificações enviadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {loadingHistory
                ? "Carregando…"
                : sent.length > 0
                  ? `${sent.length} registro(s) encontrado(s)`
                  : "Nenhuma notificação registrada ainda"}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="rounded-xl"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          {sent.length > 0 ? (
            <ScrollArea className="h-64 pr-3">
              <div className="space-y-2">
                {sent.map((m) => (
                  <div key={m.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{formatDateTime(m.created_at)}</span>
                      <span>{(m.canal || "whatsapp").toUpperCase()}</span>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-sm">{m.conteudo}</pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Quando uma notificação for enviada, ela aparecerá aqui.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Envio manual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cliente ? (
            <>
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p>
                  <strong>Cliente:</strong> {cliente.nome}
                </p>
                <p>
                  <strong>WhatsApp:</strong> {cliente.telefone || "Não informado"}
                </p>
              </div>
              <Button
                type="button"
                onClick={onSendManual}
                disabled={sending || !cliente.telefone}
                className="w-full rounded-xl"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Enviar atualização via WhatsApp
              </Button>
              {!cliente.telefone && (
                <p className="text-xs text-muted-foreground">
                  Cadastre o telefone do cliente para habilitar o envio manual.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Selecione um cliente na aba “Dados” para enviar notificações.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
