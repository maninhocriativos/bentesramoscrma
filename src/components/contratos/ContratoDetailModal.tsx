import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  FileSignature, Clock, CheckCircle2, XCircle, AlertCircle,
  ExternalLink, MessageSquare, Loader2, AlertTriangle,
  Calendar, Mail, User, FileText, Phone, Copy, Ban,
  Send, RefreshCw, Megaphone,
} from 'lucide-react';
import { ContratoComStatus } from '@/pages/ContratosPage';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ContratoDetailModalProps {
  contrato: ContratoComStatus | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

// ─── Config de status ─────────────────────────────────────────────────────────
const statusConfig: Record<string, {
  label: string; color: string; bgColor: string;
  borderColor: string; dotColor: string; icon: React.ReactNode;
}> = {
  'Documento Enviado': {
    label: 'Enviado', color: 'text-blue-700', bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200', dotColor: 'bg-blue-500',
    icon: <FileSignature className="h-4 w-4" />,
  },
  'Aguardando Assinatura': {
    label: 'Aguardando Assinatura', color: 'text-amber-700', bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200', dotColor: 'bg-amber-500',
    icon: <Clock className="h-4 w-4" />,
  },
  'Assinatura Parcial': {
    label: 'Assinatura Parcial', color: 'text-orange-700', bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200', dotColor: 'bg-orange-500',
    icon: <AlertCircle className="h-4 w-4" />,
  },
  'Assinado': {
    label: 'Assinado', color: 'text-emerald-700', bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200', dotColor: 'bg-emerald-500',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  'Finalizado': {
    label: 'Finalizado', color: 'text-emerald-700', bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200', dotColor: 'bg-emerald-500',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  'Prazo Expirado': {
    label: 'Prazo Expirado', color: 'text-red-700', bgColor: 'bg-red-50',
    borderColor: 'border-red-200', dotColor: 'bg-red-500',
    icon: <XCircle className="h-4 w-4" />,
  },
  'Cancelado': {
    label: 'Cancelado', color: 'text-zinc-500', bgColor: 'bg-zinc-100',
    borderColor: 'border-zinc-200', dotColor: 'bg-zinc-400',
    icon: <XCircle className="h-4 w-4" />,
  },
  'Recusado': {
    label: 'Recusado', color: 'text-red-700', bgColor: 'bg-red-50',
    borderColor: 'border-red-200', dotColor: 'bg-red-500',
    icon: <XCircle className="h-4 w-4" />,
  },
};

// ─── InfoRow ──────────────────────────────────────────────────────────────────
function InfoRow({
  icon, label, value, onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#c9a96e]/8 last:border-0">
      <span className="text-[#c9a96e]/50 shrink-0">{icon}</span>
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <span className={cn('text-sm flex-1 font-medium', value ? 'text-foreground' : 'text-muted-foreground/30')}>
        {value || '—'}
      </span>
      {onCopy && value && (
        <button
          onClick={onCopy}
          className="text-[#c9a96e]/40 hover:text-[#c9a96e] transition-colors shrink-0"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function ContratoDetailModal({ contrato, isOpen, onClose, onRefresh }: ContratoDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sendingReminder, setSendingReminder] = useState<'soft' | 'urgent' | null>(null);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [cancelingDoc, setCancelingDoc] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [markingTrafego, setMarkingTrafego] = useState(false);

  // ── Buscar dados do signatário e lead ────────────────────────────────────
  const { data: leadInfo, isLoading } = useQuery({
    queryKey: ['contrato-lead-info', contrato?.key],
    queryFn: async () => {
      if (!contrato?.key) return null;
      const { data: reminder } = await supabase
        .from('contract_reminders')
        .select('lead_id, signer_name, signer_email, signer_phone, document_name, reminder_stage, last_reminder_at, next_reminder_at, contract_link')
        .eq('document_key', contrato.key)
        .maybeSingle();
      if (!reminder?.lead_id) return { reminder, lead: null };
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('id, nome, email, telefone, tipo_acao, lead_state, canal_origem, cpf, rg')
        .eq('id', reminder.lead_id)
        .maybeSingle();
      return { reminder, lead };
    },
    enabled: isOpen && !!contrato?.key,
    staleTime: 30000,
  });

  if (!contrato) return null;

  const config = statusConfig[contrato.status] || statusConfig['Aguardando Assinatura'];
  const isPending = ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'].includes(contrato.status);
  const isCancelable = ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'].includes(contrato.status);
  const lead = leadInfo?.lead;
  const reminder = leadInfo?.reminder;

  const signerName  = contrato.signatarioNome || reminder?.signer_name  || lead?.nome;
  const signerEmail = contrato.leadEmail       || reminder?.signer_email || lead?.email;
  const signerPhone = reminder?.signer_phone   || lead?.telefone;
  const signLink    = reminder?.contract_link  || contrato.linkContrato;

  // ── Copiar link ──────────────────────────────────────────────────────────
  const handleCopyLink = () => {
    navigator.clipboard.writeText(signLink);
    toast({ title: 'Link copiado!', description: 'Link de assinatura copiado para a área de transferência.' });
  };

  // ── Enviar lembrete ──────────────────────────────────────────────────────
  const sendReminder = async (type: 'soft' | 'urgent') => {
    if (!contrato) return;
    setSendingReminder(type);
    try {
      const { data, error } = await supabase.functions.invoke('contract-reminder', {
        body: { documentKey: contrato.key, documentName: contrato.leadNome, reminderType: type },
      });
      if (error) throw new Error(error.message);
      if (data?.success) {
        toast({ title: 'Cobrança enviada!', description: `Mensagem ${type === 'urgent' ? 'urgente' : 'de lembrete'} enviada.` });
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (err: any) {
      toast({ title: 'Erro ao enviar cobrança', description: err.message, variant: 'destructive' });
    } finally {
      setSendingReminder(null);
    }
  };

  // ── Reenviar via WhatsApp ────────────────────────────────────────────────
  const handleSendWhatsapp = async () => {
    if (!signerPhone) {
      toast({ title: 'Telefone não encontrado', description: 'O signatário não tem telefone cadastrado.', variant: 'destructive' });
      return;
    }
    setSendingWhatsapp(true);
    try {
      const firstName = (signerName || 'cliente').split(' ')[0];
      const message =
        `Olá ${firstName}! 👋\n\n` +
        `Seu documento *${contrato.leadNome}* aguarda sua assinatura.\n\n` +
        `✍️ *Assine aqui:*\n${signLink}\n\n` +
        `_Bentes Ramos Advocacia_\n📞 (92) 99160-4348`;

      const { error } = await supabase.functions.invoke('zapi-send', {
        body: {
          to_phone: signerPhone,
          message,
          lead_id: lead?.id,
          type: 'text',
        },
      });
      if (error) throw new Error(error.message);
      toast({ title: 'WhatsApp enviado!', description: `Link enviado para ${signerPhone}` });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar WhatsApp', description: err.message, variant: 'destructive' });
    } finally {
      setSendingWhatsapp(false);
    }
  };

  // ── Cancelar documento no Clicksign ─────────────────────────────────────
  const handleCancelDocument = async () => {
    if (!contrato.key) return;
    setCancelingDoc(true);
    try {
      const { error } = await supabase.functions.invoke('clicksign', {
        body: { action: 'cancel_document', document_key: contrato.key },
      });
      if (error) throw new Error(error.message);

      // Atualizar status no banco
      await supabase
        .from('contract_reminders')
        .update({ status: 'canceled' })
        .eq('document_key', contrato.key);

      toast({ title: 'Contrato cancelado', description: 'O documento foi cancelado no Clicksign.' });
      queryClient.invalidateQueries({ queryKey: ['contrato-lead-info'] });
      onRefresh?.();
      onClose();
    } catch (err: any) {
      toast({ title: 'Erro ao cancelar', description: err.message, variant: 'destructive' });
    } finally {
      setCancelingDoc(false);
      setShowCancelConfirm(false);
    }
  };

  // ── Marcar / desmarcar como tráfego ─────────────────────────────────────
  const handleToggleTrafego = async () => {
    setMarkingTrafego(true);
    const novoValor = contrato.tipoOrigem === 'trafego' ? null : 'trafego';
    try {
      let leadId: string | null = leadInfo?.reminder?.lead_id ?? null;

      if (!leadId && signerEmail) {
        const { data: found } = await supabase
          .from('leads_juridicos')
          .select('id')
          .eq('email', signerEmail)
          .maybeSingle();
        leadId = found?.id ?? null;
      }

      if (!leadId && signerName) {
        const { data: found } = await supabase
          .from('leads_juridicos')
          .select('id')
          .ilike('nome', signerName)
          .maybeSingle();
        leadId = found?.id ?? null;
      }

      if (!leadId) {
        toast({
          title: 'Lead não encontrado',
          description: 'Não foi possível vincular o contrato a um lead. Verifique se o lead está cadastrado.',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('leads_juridicos')
        .update({ tipo_origem: novoValor })
        .eq('id', leadId);
      if (error) throw error;

      toast({
        title: novoValor === 'trafego' ? 'Marcado como Tráfego' : 'Origem removida',
        description: novoValor === 'trafego'
          ? 'O lead foi marcado como tráfego pago.'
          : 'A marcação de tráfego foi removida.',
      });
      onRefresh?.();
      onClose();
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
    } finally {
      setMarkingTrafego(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden rounded-2xl">

          {/* ── Header marrom com status ── */}
          <div className="bg-[#3d2b1f] px-5 pt-5 pb-4">
            <div className="flex items-start gap-3">
              <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shrink-0 mt-0.5', config.bgColor, config.color, config.borderColor)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
                {config.label}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[#c9a96e] text-[15px] leading-snug break-words">
                  {contrato.leadNome}
                </h3>
                {contrato.tipoAcao && (
                  <span className="text-[11px] text-[#c9a96e]/50">{contrato.tipoAcao}</span>
                )}
              </div>
            </div>

            {/* Link de assinatura */}
            {signLink && (
              <div className="mt-3 flex items-center gap-2 bg-[#c9a96e]/10 border border-[#c9a96e]/20 rounded-lg px-3 py-2">
                <ExternalLink className="h-3.5 w-3.5 text-[#c9a96e]/60 shrink-0" />
                <span className="text-[11px] text-[#c9a96e]/60 flex-1 truncate">{signLink}</span>
                <button onClick={handleCopyLink} className="text-[#c9a96e]/50 hover:text-[#c9a96e] transition-colors shrink-0">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* ── Conteúdo ── */}
          <div className="px-5 py-4 space-y-5">

            {/* Signatário */}
            <div>
              <p className="text-[10px] font-semibold text-[#3d2b1f]/40 uppercase tracking-widest mb-2">Signatário</p>
              <div className="rounded-xl border border-[#c9a96e]/15 bg-[#faf8f5] dark:bg-[#2a1f14]/30 px-3 divide-y divide-[#c9a96e]/8">
                <InfoRow
                  icon={<User className="h-3.5 w-3.5" />}
                  label="Nome"
                  value={signerName}
                />
                <InfoRow
                  icon={<Mail className="h-3.5 w-3.5" />}
                  label="Email"
                  value={signerEmail}
                  onCopy={signerEmail ? () => { navigator.clipboard.writeText(signerEmail); toast({ title: 'Email copiado!' }); } : undefined}
                />
                <InfoRow
                  icon={<Phone className="h-3.5 w-3.5" />}
                  label="Telefone"
                  value={signerPhone}
                  onCopy={signerPhone ? () => { navigator.clipboard.writeText(signerPhone); toast({ title: 'Telefone copiado!' }); } : undefined}
                />
                <InfoRow
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Atualização"
                  value={contrato.lastUpdate
                    ? new Date(contrato.lastUpdate).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : null}
                />
              </div>
            </div>

            {/* Lead vinculado */}
            {lead && (
              <div>
                <p className="text-[10px] font-semibold text-[#3d2b1f]/40 uppercase tracking-widest mb-2">Lead Vinculado</p>
                <div className="rounded-xl border border-[#c9a96e]/15 bg-[#faf8f5] dark:bg-[#2a1f14]/30 px-3 divide-y divide-[#c9a96e]/8">
                  <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Nome" value={lead.nome} />
                  {lead.cpf && <InfoRow icon={<FileText className="h-3.5 w-3.5" />} label="CPF" value={lead.cpf} />}
                  {lead.tipo_acao && <InfoRow icon={<FileText className="h-3.5 w-3.5" />} label="Tipo ação" value={lead.tipo_acao} />}
                  {lead.lead_state && <InfoRow icon={<AlertCircle className="h-3.5 w-3.5" />} label="Status lead" value={lead.lead_state} />}
                </div>
              </div>
            )}

            {/* Cobranças automáticas */}
            {isPending && reminder && (
              <div>
                <p className="text-[10px] font-semibold text-[#3d2b1f]/40 uppercase tracking-widest mb-2">Cobranças Automáticas</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#c9a96e]/15 bg-[#faf8f5] dark:bg-[#2a1f14]/30 p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Estágio</p>
                    <p className="text-sm font-bold text-[#3d2b1f] dark:text-[#c9a96e]">
                      {['Nenhum', '12h', '24h', '48h', '5 dias'][reminder.reminder_stage] ?? reminder.reminder_stage}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#c9a96e]/15 bg-[#faf8f5] dark:bg-[#2a1f14]/30 p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Último envio</p>
                    <p className="text-sm font-bold text-[#3d2b1f] dark:text-[#c9a96e]">
                      {reminder.last_reminder_at
                        ? new Date(reminder.last_reminder_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer com ações ── */}
          <div className="px-5 py-3 border-t border-[#c9a96e]/10 bg-[#faf8f5]/60 dark:bg-[#2a1f14]/20">

            {/* Ações de cobrança (só se pendente) */}
            {isPending && (
              <div className="flex flex-wrap gap-2 mb-3">
                {/* WhatsApp */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={handleSendWhatsapp}
                  disabled={sendingWhatsapp}
                >
                  {sendingWhatsapp
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />
                  }
                  WhatsApp
                </Button>

                {/* Lembrete */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs border-[#c9a96e]/30 text-[#3d2b1f] hover:bg-[#c9a96e]/10"
                  onClick={() => sendReminder('soft')}
                  disabled={!!sendingReminder}
                >
                  {sendingReminder === 'soft'
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <MessageSquare className="h-3.5 w-3.5" />
                  }
                  Lembrete
                </Button>

                {/* Urgente */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => sendReminder('urgent')}
                  disabled={!!sendingReminder}
                >
                  {sendingReminder === 'urgent'
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <AlertTriangle className="h-3.5 w-3.5" />
                  }
                  Urgente
                </Button>
              </div>
            )}

            {/* Ações principais */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Marcar/desmarcar tráfego */}
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 gap-1.5 text-xs',
                  contrato.tipoOrigem === 'trafego'
                    ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                    : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                )}
                onClick={handleToggleTrafego}
                disabled={markingTrafego}
              >
                {markingTrafego
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Megaphone className="h-3.5 w-3.5" />
                }
                {contrato.tipoOrigem === 'trafego' ? 'Tráfego (ativo)' : 'Tráfego'}
              </Button>

              {/* Cancelar (só se cancelável) */}
              {isCancelable && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={cancelingDoc}
                >
                  {cancelingDoc
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Ban className="h-3.5 w-3.5" />
                  }
                  Cancelar contrato
                </Button>
              )}

              {/* Copiar link */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs border-[#c9a96e]/30 text-[#3d2b1f] hover:bg-[#c9a96e]/10"
                onClick={handleCopyLink}
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar link
              </Button>

              {/* Abrir no Clicksign */}
              <Button
                asChild
                size="sm"
                className="h-8 gap-1.5 text-xs ml-auto bg-[#3d2b1f] text-[#c9a96e] border border-[#c9a96e]/30 hover:bg-[#5c3d2e]"
              >
                <a href={signLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir no Clicksign
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirmação de cancelamento ── */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento <strong>{contrato.leadNome}</strong> será cancelado no Clicksign e o cliente não poderá mais assinar. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelDocument}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelingDoc ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Sim, cancelar contrato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
