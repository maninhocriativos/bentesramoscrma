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
    `Olá, aqui é a Isa do Bentes & Ramos! 👋\n\n` +
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
