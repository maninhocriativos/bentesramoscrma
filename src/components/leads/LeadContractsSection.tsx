import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileSignature, Clock, CheckCircle2, XCircle, ExternalLink,
  MessageSquare, Loader2, AlertTriangle, Calendar, Zap, Plus,
  Building2, MessageCircle,
} from 'lucide-react';
import { useLeadContracts, ContractReminder } from '@/hooks/useLeadContracts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CriarContratoZapsignModal } from '@/components/contratos/CriarContratoZapsignModal';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadContractsSectionProps {
  leadId: string;
  leadNome?: string;
  leadEmail?: string;
  leadPhone?: string;
}

// ── Clicksign status config ──────────────────────────────────────────────────
const clicksignStatusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  pending:    { label: 'Aguardando',   color: 'text-amber-700',   bgColor: 'bg-amber-100',   icon: <Clock       className="h-3 w-3" /> },
  sent_12h:   { label: 'Lembrete 12h', color: 'text-blue-700',    bgColor: 'bg-blue-100',    icon: <MessageSquare className="h-3 w-3" /> },
  sent_24h:   { label: 'Lembrete 24h', color: 'text-blue-700',    bgColor: 'bg-blue-100',    icon: <MessageSquare className="h-3 w-3" /> },
  sent_48h:   { label: 'Lembrete 48h', color: 'text-orange-700',  bgColor: 'bg-orange-100',  icon: <AlertTriangle className="h-3 w-3" /> },
  sent_5d:    { label: 'Urgente 5d',   color: 'text-red-700',     bgColor: 'bg-red-100',     icon: <AlertTriangle className="h-3 w-3" /> },
  signed:     { label: 'Assinado',     color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: <CheckCircle2  className="h-3 w-3" /> },
  cancelled:  { label: 'Cancelado',    color: 'text-gray-700',    bgColor: 'bg-gray-100',    icon: <XCircle       className="h-3 w-3" /> },
};

// ── Zapsign status config ────────────────────────────────────────────────────
const zapsignStatusColors: Record<string, string> = {
  'Assinado':              'bg-emerald-100 text-emerald-700',
  'Assinatura Parcial':    'bg-blue-100 text-blue-700',
  'Aguardando Assinatura': 'bg-amber-100 text-amber-700',
  'Rejeitado':             'bg-red-100 text-red-700',
  'Cancelado':             'bg-zinc-100 text-zinc-600',
  'Expirado':              'bg-orange-100 text-orange-700',
};

const REMINDER_STAGE_LABELS = ['Inicial', '12h', '24h', '48h', '5d'];

// ── Hook: buscar contratos Zapsign do lead ────────────────────────────────────
function useLeadZapsignContracts(leadId: string) {
  return useQuery({
    queryKey: ['lead-zapsign-contracts', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_reminders_zapsign')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}

function mapLocalStatus(status: string): string {
  const map: Record<string, string> = {
    pending:   'Aguardando Assinatura',
    signed:    'Assinado',
    rejected:  'Rejeitado',
    expired:   'Expirado',
    cancelled: 'Cancelado',
  };
  return map[status] || status;
}

// ── Componente principal ──────────────────────────────────────────────────────
export function LeadContractsSection({ leadId, leadNome, leadEmail, leadPhone }: LeadContractsSectionProps) {
  const { data: clicksignContracts, isLoading: loadingClicksign, refetch: refetchClicksign } = useLeadContracts(leadId);
  const { data: zapsignContracts,   isLoading: loadingZapsign,   refetch: refetchZapsign }   = useLeadZapsignContracts(leadId);
  const { toast } = useToast();
  const [sendingReminder, setSendingReminder]       = useState<string | null>(null);
  const [sendingZapsignReminder, setSendingZapsignReminder] = useState<string | null>(null);
  const [activeProvider, setActiveProvider]         = useState<'clicksign' | 'zapsign'>('clicksign');
  const [criarZapsignOpen, setCriarZapsignOpen]     = useState(false);

  const sendZapsignReminder = async (contract: any, type: 'soft' | 'urgent') => {
    setSendingZapsignReminder(`${contract.id}-${type}`);
    try {
      const { data, error } = await supabase.functions.invoke('zapsign-reminder', {
        body: {
          documentId: contract.document_id,
          documentName: contract.document_name,
          reminderType: type,
          leadId: contract.lead_id,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast({
          title: type === 'urgent' ? '⚠️ Cobrança urgente enviada!' : '✅ Lembrete enviado!',
          description: `WhatsApp enviado para ${contract.signer_name || leadNome}`,
        });
      } else {
        throw new Error(data?.error || 'Erro ao enviar');
      }
    } catch (err: any) {
      toast({ title: 'Erro ao enviar lembrete', description: err.message, variant: 'destructive' });
    } finally {
      setSendingZapsignReminder(null);
    }
  };

  const sendManualReminder = async (contract: ContractReminder, type: 'soft' | 'urgent') => {
    setSendingReminder(contract.id);
    try {
      const { data, error } = await supabase.functions.invoke('contract-reminder', {
        body: {
          documentKey: contract.document_key,
          documentName: contract.document_name || leadNome,
          contractLink: contract.contract_link,
          reminderType: type,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: 'Cobrança enviada!', description: `Mensagem ${type === 'urgent' ? 'urgente' : 'de lembrete'} enviada.` });
        refetchClicksign();
      } else throw new Error(data?.error || 'Erro ao enviar');
    } catch (error: any) {
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
    } finally {
      setSendingReminder(null);
    }
  };

  const isLoading = activeProvider === 'clicksign' ? loadingClicksign : loadingZapsign;
  const clicksignCount = clicksignContracts?.length || 0;
  const zapsignCount   = zapsignContracts?.length   || 0;
  const zapsignPending = (zapsignContracts || []).filter(c => c.status === 'pending').length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              Contratos
            </CardTitle>

            {/* Seletor de provider */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setActiveProvider('clicksign')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all',
                  activeProvider === 'clicksign'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <FileSignature className="h-3 w-3" />
                Clicksign
                {clicksignCount > 0 && (
                  <span className="bg-[#c9a96e]/20 text-[#c9a96e] rounded-full px-1.5 text-[10px] font-semibold">
                    {clicksignCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveProvider('zapsign')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all',
                  activeProvider === 'zapsign'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Zap className="h-3 w-3" />
                Zapsign
                {zapsignCount > 0 && (
                  <span className={cn(
                    'rounded-full px-1.5 text-[10px] font-semibold',
                    zapsignPending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-cyan-100 text-cyan-700'
                  )}>
                    {zapsignCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : activeProvider === 'clicksign' ? (
            // ── CLICKSIGN ────────────────────────────────────────────────────
            !clicksignContracts || clicksignContracts.length === 0 ? (
              <div className="py-8 text-center border border-dashed rounded-lg">
                <FileSignature className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum contrato Clicksign vinculado</p>
              </div>
            ) : (
              clicksignContracts.map((contract) => {
                const config = clicksignStatusConfig[contract.status] || clicksignStatusConfig.pending;
                const isPending = contract.status === 'pending' || contract.status.startsWith('sent_');
                return (
                  <div key={contract.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{contract.document_name || 'Contrato'}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(contract.contract_created_at).toLocaleDateString('pt-BR')}
                          {contract.reminder_stage > 0 && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                              Estágio: {REMINDER_STAGE_LABELS[contract.reminder_stage] || contract.reminder_stage}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className={cn('flex items-center gap-1 shrink-0 text-xs', config.bgColor, config.color)}>
                        {config.icon}{config.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {isPending && (
                        <>
                          <Button variant="outline" size="sm" className="text-xs h-7 gap-1"
                            onClick={() => sendManualReminder(contract, 'soft')} disabled={sendingReminder === contract.id}>
                            {sendingReminder === contract.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                            Lembrar
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-destructive hover:text-destructive"
                            onClick={() => sendManualReminder(contract, 'urgent')} disabled={sendingReminder === contract.id}>
                            <AlertTriangle className="h-3 w-3" />Urgente
                          </Button>
                        </>
                      )}
                      {contract.contract_link?.startsWith('http') && (
                        <a href={contract.contract_link} target="_blank" rel="noopener noreferrer" className="ml-auto">
                          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                            <ExternalLink className="h-3 w-3" />Abrir
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            // ── ZAPSIGN ──────────────────────────────────────────────────────
            <div className="space-y-3">
              {/* Botão criar */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setCriarZapsignOpen(true)}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5 h-8"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo Contrato Zapsign
                </Button>
              </div>

              {!zapsignContracts || zapsignContracts.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-cyan-200 rounded-lg bg-cyan-50/30">
                  <Zap className="h-7 w-7 mx-auto text-cyan-400 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum contrato Zapsign vinculado</p>
                  <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Contrato Zapsign" para criar</p>
                </div>
              ) : (
                zapsignContracts.map((contract: any) => {
                  const statusLabel = mapLocalStatus(contract.status);
                  const statusClass = zapsignStatusColors[statusLabel] || 'bg-zinc-100 text-zinc-600';
                  const isPending   = contract.status === 'pending';

                  return (
                    <div key={contract.id} className="p-3 rounded-lg border border-cyan-100 bg-cyan-50/20">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Zap className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                            <p className="font-medium text-sm truncate">{contract.document_name}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(contract.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                            {contract.sent_at && (
                              <span className="text-cyan-600">Enviado</span>
                            )}
                            {contract.signed_at && (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {format(new Date(contract.signed_at), 'dd/MM/yyyy', { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className={cn('flex items-center gap-1 shrink-0 text-xs', statusClass)}>
                          {statusLabel}
                        </Badge>
                      </div>

                      {/* Background check */}
                      {contract.background_check_status && contract.background_check_status !== 'pending' && (
                        <div className={cn(
                          'flex items-center gap-1.5 text-xs px-2 py-1 rounded-md w-fit mb-2',
                          contract.background_check_status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700'
                            : contract.background_check_status === 'rejected'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                        )}>
                          <CheckCircle2 className="h-3 w-3" />
                          Validação: {contract.background_check_status === 'approved' ? 'Aprovada' : contract.background_check_status === 'rejected' ? 'Rejeitada' : 'Manual'}
                        </div>
                      )}

                      {/* Signatário */}
                      {(contract.signer_name || contract.signer_email) && (
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          {contract.signer_name  && <p>👤 {contract.signer_name}</p>}
                          {contract.signer_email && <p>✉️ {contract.signer_email}</p>}
                          {contract.signer_phone && <p>📱 {contract.signer_phone}</p>}
                        </div>
                      )}

                      {/* Ações */}
                      {isPending && (
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-cyan-100">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 gap-1 border-cyan-200 hover:border-cyan-400"
                            onClick={() => sendZapsignReminder(contract, 'soft')}
                            disabled={sendingZapsignReminder?.startsWith(contract.id)}
                          >
                            {sendingZapsignReminder === `${contract.id}-soft`
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <MessageCircle className="h-3 w-3 text-cyan-600" />
                            }
                            Lembrar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 gap-1 text-amber-600 border-amber-200 hover:border-amber-400"
                            onClick={() => sendZapsignReminder(contract, 'urgent')}
                            disabled={sendingZapsignReminder?.startsWith(contract.id)}
                          >
                            {sendingZapsignReminder === `${contract.id}-urgent`
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <AlertTriangle className="h-3 w-3" />
                            }
                            Urgente
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal criar contrato Zapsign */}
      <CriarContratoZapsignModal
        isOpen={criarZapsignOpen}
        onClose={() => setCriarZapsignOpen(false)}
        onSuccess={() => refetchZapsign()}
        leadId={leadId}
        leadNome={leadNome}
        leadEmail={leadEmail}
        leadPhone={leadPhone}
      />
    </>
  );
}
