import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone } from "@/lib/chatUtils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  PenLine, Loader2, FileText, Zap, CheckCircle2, Clock,
  XCircle, AlertTriangle, MessageCircle, Search, ExternalLink,
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
  leadId?: string | null;     // lead_id gravado no contrato
  phoneCore?: string;         // últimos dígitos do telefone do signatário (p/ casar)
}

interface ChatContractReminderProps {
  leadId?: string | null;
  leadNome?: string;
  leadPhone?: string | null;
  triggerClassName?: string;
}

// Núcleo do telefone: últimos 8 dígitos (número local), tolerante a formatação
// e a códigos de país/DDD diferentes entre o cadastro e o contrato.
const phoneCore = (p?: string | null) => {
  const d = normalizePhone(p || "");
  return d.length >= 8 ? d.slice(-8) : "";
};

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
    leadId: r.lead_id ?? null, phoneCore: phoneCore(r.signer_phone),
  };
}

// Carrega os contratos recentes de um provedor (as tabelas são pequenas). O
// casamento com o lead — por lead_id, TELEFONE ou nome — é feito no cliente,
// porque muitos contratos não têm lead_id e o nome do lead no chat pode diferir
// do signatário. O telefone é o elo mais confiável com a conversa.
function useProviderContracts(provider: Provider, enabled: boolean) {
  return useQuery({
    queryKey: ["chat-provider-contracts", provider],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<ProviderContract[]> => {
      const table = provider === "clicksign" ? "contract_reminders" : "contract_reminders_zapsign";
      const { data } = await supabase.from(table as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      return ((data as any[]) || []).map((r) => normalize(provider, r)).filter(Boolean) as ProviderContract[];
    },
  });
}

// Contador barato p/ o badge (dot) do botão — só por lead_id. É apenas um
// indicador; a listagem do modal faz o casamento completo (id/telefone/nome).
function usePendingBadge(leadId?: string | null) {
  return useQuery({
    queryKey: ["chat-pending-badge", leadId],
    enabled: !!leadId,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      if (!leadId) return 0;
      const [cs, zs] = await Promise.all([
        supabase.from("contract_reminders").select("id").eq("lead_id", leadId).eq("status", "pending"),
        supabase.from("contract_reminders_zapsign").select("id").eq("lead_id", leadId).eq("status", "pending"),
      ]);
      return ((cs.data as any[])?.length || 0) + ((zs.data as any[])?.length || 0);
    },
  });
}

/**
 * Botão do header do chat que abre um modal para enviar o lembrete de assinatura
 * com o LINK REAL do contrato do lead — ClickSign (/sign/) ou ZapSign (/verificar/).
 * O lembrete é enviado no próprio chat (WhatsApp via Z-API) pelas edge functions
 * contract-reminder / zapsign-reminder, que resolvem o link correto no servidor.
 */
export function ChatContractReminder({ leadId, leadNome, leadPhone, triggerClassName }: ChatContractReminderProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>("clicksign");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProviderContract | null>(null);
  const [sending, setSending] = useState<"soft" | "urgent" | null>(null);

  const { data: pendingCount = 0 } = usePendingBadge(leadId);
  const { data: allContracts = [], isLoading } = useProviderContracts(provider, open);

  const leadCore = phoneCore(leadPhone);
  const term = sanitize(search).toLowerCase();

  // Sem busca: contratos DESTE lead — casa por lead_id OU telefone (elo confiável).
  // Com busca: procura por nome/documento em todos os contratos do provedor.
  const contracts = useMemo(() => {
    if (term.length >= 2) {
      return allContracts.filter((c) =>
        c.name?.toLowerCase().includes(term) || (c.signerName || "").toLowerCase().includes(term));
    }
    return allContracts.filter((c) => {
      const byId = !!leadId && c.leadId === leadId;
      const byPhone = !!leadCore && c.phoneCore === leadCore;
      return byId || byPhone;
    });
  }, [allContracts, term, leadId, leadCore]);

  if (!leadId && !leadPhone) return null;

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
        className={cn(
          "relative h-8 w-8 md:h-10 md:w-10 rounded-full transition-colors",
          pendingCount > 0 ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20" : triggerClassName,
        )}
      >
        <PenLine className="h-4 w-4 md:h-[18px] md:w-[18px]" />
        {pendingCount > 0 && (
          <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background animate-pulse" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-2xl">
          {/* Header */}
          <DialogHeader className="px-5 pt-5 pb-4 space-y-0 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00A884]/10 text-[#00A884] shrink-0">
                <PenLine className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[15px] font-semibold leading-tight">Lembrete de assinatura</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {leadNome ? <>Para <span className="font-medium text-foreground/80">{leadNome}</span> · enviado no chat</> : "Enviado no chat"}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-5 pb-1 space-y-3">
            {/* Provedor */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted/60">
              {providerBtn("clicksign", "ClickSign", FileText, "bg-background text-[#c9a96e] shadow-sm ring-1 ring-black/5")}
              {providerBtn("zapsign", "ZapSign", Zap, "bg-background text-cyan-600 shadow-sm ring-1 ring-black/5")}
            </div>

            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar contrato por nome…"
                className="h-10 pl-9 text-[13px] rounded-xl bg-muted/40 border-transparent focus-visible:bg-background"
              />
            </div>

            {/* Lista */}
            <div className="max-h-[248px] overflow-y-auto -mx-1 px-1 space-y-1.5">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin opacity-70" /> Buscando contratos…
                </div>
              ) : contracts.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <FileText className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-[13px] font-medium">Nenhum contrato {provider === "clicksign" ? "ClickSign" : "ZapSign"}</p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">Busque pelo nome ou troque de provedor acima.</p>
                  <button
                    onClick={() => { setOpen(false); navigate("/contratos"); }}
                    className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-[#00A884] hover:underline"
                  >
                    Ir para Contratos <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                contracts.map((c) => {
                  const meta = statusMeta(c.status);
                  const isSel = selected?.id === c.id;
                  const accent = c.provider === "clicksign" ? "text-[#c9a96e]" : "text-cyan-500";
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelected(c)}
                      className={cn(
                        "group/row relative w-full text-left pl-3.5 pr-3 py-2.5 rounded-xl border transition-all overflow-hidden",
                        isSel
                          ? "border-[#00A884]/50 bg-[#00A884]/[0.07] ring-1 ring-[#00A884]/25"
                          : "border-border/50 hover:border-border hover:bg-muted/40",
                      )}
                    >
                      <span className={cn(
                        "absolute left-0 top-0 h-full w-[3px] rounded-r transition-opacity",
                        c.provider === "clicksign" ? "bg-[#c9a96e]" : "bg-cyan-500",
                        isSel ? "opacity-100" : "opacity-0 group-hover/row:opacity-40",
                      )} />
                      <div className="flex items-center gap-2 min-w-0">
                        {c.provider === "clicksign"
                          ? <FileText className={cn("h-4 w-4 shrink-0", accent)} />
                          : <Zap className={cn("h-4 w-4 shrink-0", accent)} />}
                        <span className="text-[13px] font-medium truncate flex-1" title={c.name}>{c.name}</span>
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold shrink-0", meta.cls)}>
                          <meta.Icon className="h-2.5 w-2.5" />{meta.label}
                        </span>
                      </div>
                      {c.signerName && (
                        <p className="text-[11px] text-muted-foreground truncate mt-1 pl-6">👤 {c.signerName}</p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter className="px-5 py-4 gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="flex-1 h-10 gap-1.5 text-[13px] rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600 disabled:opacity-40"
              disabled={!selected || sending !== null}
              onClick={() => send("soft")}
            >
              {sending === "soft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              Lembrete
            </Button>
            <Button
              className="flex-1 h-10 gap-1.5 text-[13px] rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/25 disabled:opacity-40 disabled:shadow-none"
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
