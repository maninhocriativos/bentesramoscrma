import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, RefreshCw, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import type { Processo } from "@/types/processos";
import type { Lead } from "@/types/leads";

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

function buildPreviewMessage(d: ProcessoNotificacoesTabProps["previewData"]) {
  const nomeCliente = d.nomeCliente || "Cliente";
  const numProcesso = d.numeroProcesso || "N/A";
  const statusProc = d.status || "Em Andamento";
  const tribunal = d.tribunal || "";

  const ultimaAtualizacao = d.ultimaAtualizacao
    ? (() => {
        try {
          return new Date(d.ultimaAtualizacao).toLocaleDateString("pt-BR");
        } catch {
          return d.ultimaAtualizacao;
        }
      })()
    : "não disponível";

  return (
    `Olá, ${nomeCliente}! 👋\n\n` +
    `Segue atualização do seu processo:\n\n` +
    `📋 *Número:* ${numProcesso}\n` +
    `⚖️ *Ação:* ${d.acao || "N/A"}\n` +
    `📊 *Status:* ${statusProc}\n` +
    (tribunal ? `🏛️ *Tribunal:* ${tribunal}\n` : "") +
    `📅 *Última atualização:* ${ultimaAtualizacao}\n\n` +
    `Caso tenha dúvidas, estamos à disposição! 🙂\n\n` +
    `*Bentes & Ramos Advogados*`
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Prévia da mensagem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Esta é a mensagem padrão usada no envio (automático e manual) para este processo.
          </p>
          <div className="rounded-lg bg-muted/50 p-3">
            <pre className="whitespace-pre-wrap break-words text-sm">{previewText}</pre>
          </div>
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
