import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  PenLine, Loader2, FileText, Zap, CheckCircle2, Clock,
  XCircle, AlertTriangle, MessageCircle, ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type Provider = "clicksign" | "zapsign";

interface ProviderContract {
  provider: Provider;
  id: string;
  docId: string;              // document_key (ClickSign) | document_id (ZapSign)
  name: string;
  status: string;
  signerName?: string | null;
  link?: string | null;       // contract_link (ClickSign)
  createdAt?: string | null;
}

interface ChatContractReminderProps {
  leadId?: string | null;
  leadNome?: string;
  triggerClassName?: string;
}

const STATUS_META: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending:   { label: "Aguardando", cls: "text-amber-500",   Icon: Clock },
  signed:    { label: "Assinado",   cls: "text-emerald-500", Icon: CheckCircle2 },
  cancelled: { label: "Cancelado",  cls: "text-zinc-400",    Icon: XCircle },
  canceled:  { label: "Cancelado",  cls: "text-zinc-400",    Icon: XCircle },
  rejected:  { label: "Rejeitado",  cls: "text-red-500",     Icon: XCircle },
  expired:   { label: "Expirado",   cls: "text-orange-500",  Icon: XCircle },
};
const statusMeta = (s: string) => STATUS_META[s] || { label: s || "—", cls: "text-muted-foreground", Icon: Clock };

function useLeadProviderContracts(leadId?: string | null) {
  return useQuery({
    queryKey: ["chat-lead-contracts", leadId],
    enabled: !!leadId,
    staleTime: 30_000,
    queryFn: async (): Promise<ProviderContract[]> => {
      if (!leadId) return [];
      const [cs, zs] = await Promise.all([
        supabase
          .from("contract_reminders")
          .select("id, document_key, document_name, contract_link, signer_name, status, created_at")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false }),
        supabase
          .from("contract_reminders_zapsign")
          .select("id, document_id, document_name, signer_name, status, created_at")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false }),
      ]);
      const list: ProviderContract[] = [];
      for (const r of (cs.data as any[]) || []) {
        if (!r.document_key) continue;
        list.push({
          provider: "clicksign", id: `cs-${r.id}`, docId: r.document_key,
          name: r.document_name || "Contrato", status: r.status || "pending",
          signerName: r.signer_name, link: r.contract_link, createdAt: r.created_at,
        });
      }
      for (const r of (zs.data as any[]) || []) {
        if (!r.document_id) continue;
        list.push({
          provider: "zapsign", id: `zs-${r.id}`, docId: r.document_id,
          name: r.document_name || "Contrato", status: r.status || "pending",
          signerName: r.signer_name, createdAt: r.created_at,
        });
      }
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return list;
    },
  });
}

/**
 * Botão do header do chat que envia o lembrete de assinatura com o LINK REAL do
 * contrato daquele lead — ClickSign (/sign/) ou ZapSign (/verificar/). Reaproveita
 * as edge functions contract-reminder e zapsign-reminder, que resolvem o link
 * correto no servidor e nunca mandam link quebrado ao cliente.
 */
export function ChatContractReminder({ leadId, leadNome, triggerClassName }: ChatContractReminderProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const { data: contracts = [], isLoading, refetch } = useLeadProviderContracts(leadId);

  if (!leadId) return null;

  const pendingCount = contracts.filter(c => c.status === "pending").length;

  const sendReminder = async (c: ProviderContract, type: "soft" | "urgent") => {
    setSending(`${c.id}-${type}`);
    try {
      const fn = c.provider === "clicksign" ? "contract-reminder" : "zapsign-reminder";
      const body = c.provider === "clicksign"
        ? { documentKey: c.docId, documentName: c.name, contractLink: c.link, reminderType: type }
        : { documentId: c.docId, documentName: c.name, reminderType: type, leadId };
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) {
        let msg = error.message || "Falha ao enviar";
        try { const b = await (error as any)?.context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (!data?.success) throw new Error(data?.error || "Falha ao enviar");
      toast({
        title: type === "urgent" ? "⚠️ Cobrança urgente enviada" : "✅ Lembrete enviado",
        description: `Link de assinatura enviado no WhatsApp de ${c.signerName || leadNome || "cliente"}.`,
      });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Não foi possível enviar", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSending(null);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); if (v) refetch(); }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Enviar lembrete de assinatura"
          className={`relative h-8 w-8 md:h-10 md:w-10 rounded-full ${triggerClassName || ""}`}
        >
          <PenLine className="h-4 w-4 md:h-[18px] md:w-[18px]" />
          {pendingCount > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[300px] p-0 overflow-hidden">
        <DropdownMenuLabel className="flex items-center gap-2 px-3 py-2.5 text-[13px]">
          <PenLine className="h-3.5 w-3.5 opacity-60" />
          Lembrete de assinatura
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando contratos…
          </div>
        ) : contracts.length === 0 ? (
          <div className="px-3 py-5 text-center">
            <FileText className="h-6 w-6 mx-auto mb-2 opacity-30" />
            <p className="text-xs text-muted-foreground">Nenhum contrato gerado para este lead.</p>
            <button
              onClick={() => { setOpen(false); navigate("/contratos"); }}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#00A884] hover:underline"
            >
              Ir para Contratos <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto py-1">
            {contracts.map((c) => {
              const meta = statusMeta(c.status);
              const isPending = c.status === "pending";
              const busy = sending?.startsWith(c.id);
              return (
                <div key={c.id} className="px-3 py-2 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {c.provider === "clicksign"
                      ? <FileText className="h-3.5 w-3.5 shrink-0 text-[#c9a96e]" />
                      : <Zap className="h-3.5 w-3.5 shrink-0 text-cyan-500" />}
                    <span className="text-[12px] font-medium truncate flex-1" title={c.name}>{c.name}</span>
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold shrink-0 ${meta.cls}`}>
                      <meta.Icon className="h-3 w-3" />{meta.label}
                    </span>
                  </div>
                  {c.signerName && (
                    <p className="text-[10.5px] text-muted-foreground truncate mt-0.5 pl-5">👤 {c.signerName}</p>
                  )}
                  {isPending && (
                    <div className="flex items-center gap-1.5 mt-1.5 pl-5">
                      <Button
                        size="sm" variant="outline"
                        className="h-6 gap-1 px-2 text-[11px] rounded-full"
                        disabled={busy}
                        onClick={() => sendReminder(c, "soft")}
                      >
                        {sending === `${c.id}-soft` ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3 text-emerald-600" />}
                        Lembrete
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="h-6 gap-1 px-2 text-[11px] rounded-full text-amber-600 border-amber-300/70 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        disabled={busy}
                        onClick={() => sendReminder(c, "urgent")}
                      >
                        {sending === `${c.id}-urgent` ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                        Urgente
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
