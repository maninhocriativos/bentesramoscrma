import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  FileSignature, Clock, CheckCircle2, XCircle, AlertCircle,
  ExternalLink, MessageSquare, Loader2, AlertTriangle,
  Calendar, Mail, User, FileText, Phone,
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
  'Documento Enviado': { label: 'Enviado', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/30', icon: <FileSignature className="h-3.5 w-3.5" /> },
  'Aguardando Assinatura': { label: 'Aguardando Assinatura', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/30', icon: <Clock className="h-3.5 w-3.5" /> },
  'Assinatura Parcial': { label: 'Assinatura Parcial', color: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/30', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  'Assinado': { label: 'Assinado', color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  'Finalizado': { label: 'Finalizado', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/30', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  'Prazo Expirado': { label: 'Expirado', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/30', icon: <XCircle className="h-3.5 w-3.5" /> },
  'Cancelado': { label: 'Cancelado', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: <XCircle className="h-3.5 w-3.5" /> },
  'Recusado': { label: 'Recusado', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/30', icon: <XCircle className="h-3.5 w-3.5" /> },
};

export function ContratoDetailModal({ contrato, isOpen, onClose }: ContratoDetailModalProps) {
  const { toast } = useToast();
  const [sendingReminder, setSendingReminder] = useState<'soft' | 'urgent' | null>(null);

  // Fetch linked lead info from contract_reminders
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

  const STAGE_LABELS: Record<number, string> = { 0: 'Inicial', 1: '12h', 2: '24h', 3: '48h', 4: '5 dias' };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-5 w-5 text-primary" />
            Detalhes do Contrato
          </DialogTitle>
        </DialogHeader>

        {/* Status + Document Name */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground text-sm leading-snug break-words">
                {contrato.leadNome}
              </p>
              {contrato.tipoAcao && (
                <Badge variant="secondary" className="mt-1.5 text-[10px] font-normal bg-muted text-muted-foreground">
                  {contrato.tipoAcao}
                </Badge>
              )}
            </div>
            <Badge className={cn('gap-1.5 text-xs font-medium px-2.5 py-1 shrink-0', config.bgColor, config.color)}>
              {config.icon}
              {config.label}
            </Badge>
          </div>

          {/* Contract Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Signatário</p>
              <p className="text-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {contrato.signatarioNome || reminder?.signer_name || '—'}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Atualização</p>
              <p className="text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {contrato.lastUpdate
                  ? new Date(contrato.lastUpdate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Email</p>
              <p className="text-foreground flex items-center gap-1.5 break-all">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {contrato.leadEmail || reminder?.signer_email || '—'}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Telefone</p>
              <p className="text-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {reminder?.signer_phone || '—'}
              </p>
            </div>
          </div>

          {/* Reminder Stage Info */}
          {reminder && isPending && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cobranças</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-0.5">
                    <p className="text-[11px] text-muted-foreground">Estágio atual</p>
                    <p className="font-medium">{STAGE_LABELS[reminder.reminder_stage] || `Estágio ${reminder.reminder_stage}`}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] text-muted-foreground">Último lembrete</p>
                    <p className="text-foreground">
                      {reminder.last_reminder_at
                        ? new Date(reminder.last_reminder_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : 'Nenhum'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Lead Info Section */}
          {lead && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Informações do Lead</p>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{lead.nome || '—'}</span>
                    {lead.lead_state && (
                      <Badge variant="outline" className="text-[10px]">{lead.lead_state}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {lead.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3" /> {lead.email}
                      </div>
                    )}
                    {lead.telefone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" /> {lead.telefone}
                      </div>
                    )}
                    {lead.tipo_acao && (
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3" /> {lead.tipo_acao}
                      </div>
                    )}
                    {lead.canal_origem && (
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3" /> {lead.canal_origem}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {isPending && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => sendReminder('soft')}
                  disabled={!!sendingReminder}
                >
                  {sendingReminder === 'soft' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                  Lembrete Amigável
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => sendReminder('urgent')}
                  disabled={!!sendingReminder}
                >
                  {sendingReminder === 'urgent' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  Cobrança Urgente
                </Button>
              </>
            )}
            <Button asChild variant="secondary" size="sm" className="gap-1.5 text-xs ml-auto">
              <a href={contrato.linkContrato} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir no Clicksign
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
