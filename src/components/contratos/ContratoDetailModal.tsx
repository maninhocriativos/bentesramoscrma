import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileSignature, Clock, CheckCircle2, XCircle, AlertCircle,
  ExternalLink, MessageSquare, Loader2, AlertTriangle,
  Calendar, Mail, User, FileText, Phone, Copy, ChevronRight,
} from 'lucide-react';
import { ContratoComStatus } from '@/pages/ContratosPage';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface ContratoDetailModalProps {
  contrato: ContratoComStatus | null;
  isOpen: boolean;
  onClose: () => void;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  'Documento Enviado': { label: 'Enviado', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/30', icon: <FileSignature className="h-4 w-4" /> },
  'Aguardando Assinatura': { label: 'Aguardando Assinatura', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/30', icon: <Clock className="h-4 w-4" /> },
  'Assinatura Parcial': { label: 'Assinatura Parcial', color: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/30', icon: <AlertCircle className="h-4 w-4" /> },
  'Assinado': { label: 'Assinado', color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30', icon: <CheckCircle2 className="h-4 w-4" /> },
  'Finalizado': { label: 'Finalizado', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/30', icon: <CheckCircle2 className="h-4 w-4" /> },
  'Prazo Expirado': { label: 'Expirado', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/30', icon: <XCircle className="h-4 w-4" /> },
  'Cancelado': { label: 'Cancelado', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: <XCircle className="h-4 w-4" /> },
  'Recusado': { label: 'Recusado', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/30', icon: <XCircle className="h-4 w-4" /> },
};

const STAGE_LABELS: Record<number, string> = { 0: 'Nenhum envio', 1: '12h', 2: '24h', 3: '48h', 4: '5 dias' };

export function ContratoDetailModal({ contrato, isOpen, onClose }: ContratoDetailModalProps) {
  const { toast } = useToast();
  const [sendingReminder, setSendingReminder] = useState<'soft' | 'urgent' | null>(null);

  const { data: leadInfo } = useQuery({
    queryKey: ['contrato-lead-info', contrato?.key],
    queryFn: async () => {
      if (!contrato?.key) return null;
      const { data: reminder } = await supabase
        .from('contract_reminders')
        .select('lead_id, signer_name, signer_email, signer_phone, document_name, reminder_stage, last_reminder_at, next_reminder_at')
        .eq('document_key', contrato.key)
        .maybeSingle();
      if (!reminder?.lead_id) return { reminder, lead: null };
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('id, nome, email, telefone, tipo_acao, lead_state, canal_origem, created_at')
        .eq('id', reminder.lead_id)
        .maybeSingle();
      return { reminder, lead };
    },
    enabled: isOpen && !!contrato?.key,
    staleTime: 30000,
  });

  const sendReminder = async (type: 'soft' | 'urgent') => {
    if (!contrato) return;
    setSendingReminder(type);
    try {
      const { data, error } = await supabase.functions.invoke('contract-reminder', {
        body: { documentKey: contrato.key, documentName: contrato.leadNome, reminderType: type },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: 'Cobrança enviada!', description: `Mensagem ${type === 'urgent' ? 'urgente' : 'de lembrete'} enviada.` });
      } else {
        throw new Error(data?.error || 'Erro ao enviar');
      }
    } catch (error: any) {
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
    } finally {
      setSendingReminder(null);
    }
  };

  if (!contrato) return null;

  const config = statusConfig[contrato.status] || statusConfig['Aguardando Assinatura'];
  const isPending = ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'].includes(contrato.status);
  const lead = leadInfo?.lead;
  const reminder = leadInfo?.reminder;
  const signerName = contrato.signatarioNome || reminder?.signer_name;
  const signerEmail = contrato.leadEmail || reminder?.signer_email;
  const signerPhone = reminder?.signer_phone || lead?.telefone;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
        {/* Header with status banner */}
        <div className={cn('px-5 pt-5 pb-4', config.bgColor)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                {config.icon}
                <span className={cn('text-xs font-semibold uppercase tracking-wider', config.color)}>
                  {config.label}
                </span>
              </div>
              <h3 className="font-semibold text-foreground text-[15px] leading-snug break-words">
                {contrato.leadNome}
              </h3>
              {contrato.tipoAcao && (
                <span className="inline-block text-[11px] text-muted-foreground bg-background/60 px-2 py-0.5 rounded">
                  {contrato.tipoAcao}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Signatário info */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Signatário</h4>
            <div className="space-y-2">
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Nome" value={signerName} />
              <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={signerEmail} />
              <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={signerPhone} />
              <InfoRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Última atualização"
                value={contrato.lastUpdate
                  ? new Date(contrato.lastUpdate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : null}
              />
            </div>
          </div>

          {/* Cobranças */}
          {isPending && reminder && (
            <div className="space-y-3">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cobranças Automáticas</h4>
              <div className="flex gap-3">
                <div className="flex-1 rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Estágio</p>
                  <p className="text-sm font-semibold text-foreground">{STAGE_LABELS[reminder.reminder_stage] ?? reminder.reminder_stage}</p>
                </div>
                <div className="flex-1 rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Último envio</p>
                  <p className="text-sm font-semibold text-foreground">
                    {reminder.last_reminder_at
                      ? new Date(reminder.last_reminder_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Lead vinculado */}
          {lead && (
            <div className="space-y-3">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Lead Vinculado</h4>
              <div className="rounded-lg border p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{lead.nome || '—'}</span>
                  {lead.lead_state && (
                    <Badge variant="outline" className="text-[10px] font-medium">{lead.lead_state}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  {lead.telefone && (
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.telefone}</span>
                  )}
                  {lead.email && (
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>
                  )}
                  {lead.tipo_acao && (
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{lead.tipo_acao}</span>
                  )}
                  {lead.canal_origem && (
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{lead.canal_origem}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t bg-muted/20 flex flex-wrap items-center gap-2">
          {isPending && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => sendReminder('soft')}
                disabled={!!sendingReminder}
              >
                {sendingReminder === 'soft' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                Lembrete
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8 border-destructive/30 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => sendReminder('urgent')}
                disabled={!!sendingReminder}
              >
                {sendingReminder === 'urgent' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                Urgente
              </Button>
            </>
          )}
          <Button asChild variant="secondary" size="sm" className="gap-1.5 text-xs h-8 ml-auto">
            <a href={contrato.linkContrato} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Clicksign
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-muted-foreground text-xs min-w-[70px]">{label}</span>
      <span className={cn('font-medium flex-1', value ? 'text-foreground' : 'text-muted-foreground/40')}>
        {value || '—'}
      </span>
    </div>
  );
}
