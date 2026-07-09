import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  PenLine, Loader2, FileText, Zap, CheckCircle2, Clock,
  XCircle, AlertTriangle, MessageCircle, Search, Send, ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type Provider = "clicksign" | "zapsign";

interface ProviderContract {
  provider: Provider;
  id: string;
  docId: string;              // document_key (ClickSign) | document_id (ZapSign)
  name: string;
  status: string;
  signerName?: string | null;
  link?: string | null;       // contract_link (ClickSign)
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

const sanitize = (t: string) => t.replace(/[,()%*]/g, " ").replace(/\s+/g, " ").trim();

function normalize(provider: Provider, r: any): ProviderContract | null {
  const docId = provider === "clicksign" ? r.document_key : r.document_id;
  if (!docId) return null;
  return {
    provider, id: `${provider}-${r.id}`, docId,
    name: r.document_name || "Contrato", status: r.status || "pending",
    signerName: r.signer_name, link: provider === "clicksign" ? r.contract_link : null,
  };
}

// Contratos do lead (os dois provedores) — usado para o badge de pendência.
function useLeadContractsBadge(leadId?: string | null) {
  return useQuery({
    queryKey: ["chat-lead-contracts-badge", leadId],
    enabled: !!leadId,
    staleTime: 30_000,
    queryFn: async (): Promise<number> => {
      if (!leadId) return 0;
      const [cs, zs] = await Promise.all([
        supabase.from("contract_reminders").select("status").eq("lead_id", leadId).eq("status", "pending"),
        supabase.from("contract_reminders_zapsign").select("status").eq("lead_id", leadId).eq("status", "pending"),
      ]);
      return ((cs.data as any[])?.length || 0) + ((zs.data as any[])?.length || 0);
    },
  });
}

// Contratos por provedor: casa pelo lead_id e, se necessário, por nome (busca),
// para achar o contrato mesmo quando não está vinculado por lead_id.
function useProviderContracts(provider: Provider, leadId: string | null | undefined, leadNome: string | undefined, search: string, enabled: boolean) {
  const term = sanitize(search) || "";
  return useQuery({
    queryKey: ["chat-provider-contracts", provider, leadId, term],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<ProviderContract[]> => {
      const table = provider === "clicksign" ? "contract_reminders" : "contract_reminders_zapsign";
      const rows: any[] = [];
      const seen = new Set<string>();
      const push = (arr: any[] | null) => {
        for (const r of arr || []) { if (r?.id && !seen.has(r.id)) { seen.add(r.id); rows.push(r); } }
      };

      if (leadId) {
        const { data } = await supabase.from(table as any).select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
        push(data as any[]);
      }
      // Busca por nome: o que o operador digitou, ou o nome do lead se nada casou por id.
      const q = term || (rows.length === 0 ? sanitize(leadNome || "") : "");
      if (q && q.length >= 3) {
        const { data } = await supabase.from(table as any).select("*")
          .or(`signer_name.ilike.%${q}%,document_name.ilike.%${q}%`)
          .order("created_at", { ascending: false }).limit(25);
        push(data as any[]);
      }
      return rows.map((r) => normalize(provider, r)).filter(Boolean) as ProviderContract[];
    },
  });
}

/**
 * Botão do header do chat que abre um modal para enviar o lembrete de assinatura
 * com o LINK REAL do contrato do lead — ClickSign (/sign/) ou ZapSign (/verificar/).
 * O lembrete é enviado no próprio chat (WhatsApp via Z-API) pelas edge functions
 * contract-reminder / zapsign-reminder, que resolvem o link correto no servidor.
 */
export function ChatContractReminder({ leadId, leadNome, triggerClassName }: ChatContractReminderProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>("clicksign");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProviderContract | null>(null);
  const [sending, setSending] = useState<"soft" | "urgent" | null>(null);

  const { data: pendingCount = 0 } = useLeadContractsBadge(leadId);
  const { data: contracts = [], isLoading } = useProviderContracts(provider, leadId, leadNome, search, open);

  if (!leadId) return null;

  const switchProvider = (p: Provider) => { setProvider(p); setSelected(null); };

  const send = async (type: "soft" | "urgent") => {
    if (!selected) return;
    setSending(type);
    try {
      const fn = selected.provider === "clicksign" ? "contract-reminder" : "zapsign-reminder";
      const body = selected.provider === "clicksign"
        ? { documentKey: selected.docId, documentName: selected.name, contractLink: selected.link, reminderType: type }
        : { documentId: selected.docId, documentName: selected.name, reminderType: type, leadId };
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) {
        let msg = error.message || "Falha ao enviar";
        try { const b = await (error as any)?.context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (!data?.success) throw new Error(data?.error || "Falha ao enviar");
      toast({
        title: type === "urgent" ? "⚠️ Cobrança urgente enviada" : "✅ Lembrete enviado no chat",
        description: `Link de assinatura enviado no WhatsApp de ${selected.signerName || leadNome || "cliente"}.`,
      });
      setOpen(false);
      setSelected(null);
      setSearch("");
    } catch (e: any) {
      toast({ title: "Não foi possível enviar", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSending(null);
    }
  };

  const providerBtn = (p: Provider, label: string, Icon: typeof FileText, active: string) => (
    <button
      type="button"
      onClick={() => switchProvider(p)}
      className={cn(
        "flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold transition-all",
        provider === p ? active : "text-muted-foreground hover:bg-muted/60",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        title="Enviar lembrete de assinatura"
        onClick={() => setOpen(true)}
        className={cn("relative h-8 w-8 md:h-10 md:w-10 rounded-full", triggerClassName)}
      >
        <PenLine className="h-4 w-4 md:h-[18px] md:w-[18px]" />
        {pendingCount > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-border/60">
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <PenLine className="h-4 w-4 text-[#00A884]" />
              Enviar lembrete de assinatura
            </DialogTitle>
            {leadNome && <p className="text-xs text-muted-foreground mt-0.5">Para {leadNome} — enviado no chat</p>}
          </DialogHeader>

          <div className="p-4 space-y-3">
            {/* Provedor */}
            <div className="flex gap-1 p-1 rounded-xl bg-muted/50">
              {providerBtn("clicksign", "ClickSign", FileText, "bg-white dark:bg-zinc-800 text-[#c9a96e] shadow-sm")}
              {providerBtn("zapsign", "ZapSign", Zap, "bg-white dark:bg-zinc-800 text-cyan-600 shadow-sm")}
            </div>

            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar contrato por nome…"
                className="h-9 pl-8 text-[13px]"
              />
            </div>

            {/* Lista */}
            <div className="max-h-[240px] overflow-y-auto -mx-1 px-1 space-y-1">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando contratos…
                </div>
              ) : contracts.length === 0 ? (
                <div className="py-8 text-center">
                  <FileText className="h-7 w-7 mx-auto mb-2 opacity-30" />
                  <p className="text-xs text-muted-foreground">
                    Nenhum contrato {provider === "clicksign" ? "ClickSign" : "ZapSign"} encontrado.
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">Tente buscar pelo nome ou troque de provedor.</p>
                  <button
                    onClick={() => { setOpen(false); navigate("/contratos"); }}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#00A884] hover:underline"
                  >
                    Ir para Contratos <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                contracts.map((c) => {
                  const meta = statusMeta(c.status);
                  const isSel = selected?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelected(c)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg border transition-all",
                        isSel
                          ? "border-[#00A884] bg-[#00A884]/5 ring-1 ring-[#00A884]/30"
                          : "border-border/60 hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {c.provider === "clicksign"
                          ? <FileText className="h-3.5 w-3.5 shrink-0 text-[#c9a96e]" />
                          : <Zap className="h-3.5 w-3.5 shrink-0 text-cyan-500" />}
                        <span className="text-[12.5px] font-medium truncate flex-1" title={c.name}>{c.name}</span>
                        <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold shrink-0", meta.cls)}>
                          <meta.Icon className="h-3 w-3" />{meta.label}
                        </span>
                      </div>
                      {c.signerName && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5 pl-5">👤 {c.signerName}</p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter className="px-4 py-3 border-t border-border/60 gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="flex-1 h-9 gap-1.5 text-[13px]"
              disabled={!selected || sending !== null}
              onClick={() => send("soft")}
            >
              {sending === "soft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4 text-emerald-600" />}
              Lembrete
            </Button>
            <Button
              className="flex-1 h-9 gap-1.5 text-[13px] bg-amber-500 hover:bg-amber-600 text-white"
              disabled={!selected || sending !== null}
              onClick={() => send("urgent")}
            >
              {sending === "urgent" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Cobrança urgente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
