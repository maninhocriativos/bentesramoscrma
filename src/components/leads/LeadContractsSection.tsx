import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileSignature, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ExternalLink,
  MessageSquare,
  Loader2,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { useLeadContracts, ContractReminder } from '@/hooks/useLeadContracts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface LeadContractsSectionProps {
  leadId: string;
  leadNome?: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  pending: { 
    label: 'Aguardando', 
    color: 'text-amber-700 dark:text-amber-400', 
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    icon: <Clock className="h-3 w-3" /> 
  },
  sent_12h: { 
    label: 'Lembrete 12h', 
    color: 'text-blue-700 dark:text-blue-400', 
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: <MessageSquare className="h-3 w-3" /> 
  },
  sent_24h: { 
    label: 'Lembrete 24h', 
    color: 'text-blue-700 dark:text-blue-400', 
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: <MessageSquare className="h-3 w-3" /> 
  },
  sent_48h: { 
    label: 'Lembrete 48h', 
    color: 'text-orange-700 dark:text-orange-400', 
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    icon: <AlertTriangle className="h-3 w-3" /> 
  },
  sent_5d: { 
    label: 'Urgente 5d', 
    color: 'text-red-700 dark:text-red-400', 
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: <AlertTriangle className="h-3 w-3" /> 
  },
  signed: { 
    label: 'Assinado', 
    color: 'text-emerald-700 dark:text-emerald-400', 
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    icon: <CheckCircle2 className="h-3 w-3" /> 
  },
  cancelled: { 
    label: 'Cancelado', 
    color: 'text-gray-700 dark:text-gray-400', 
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    icon: <XCircle className="h-3 w-3" /> 
  },
};

const REMINDER_STAGE_LABELS = ['Inicial', '12h', '24h', '48h', '5d'];

export function LeadContractsSection({ leadId, leadNome }: LeadContractsSectionProps) {
  const { data: contracts, isLoading, refetch } = useLeadContracts(leadId);
  const { toast } = useToast();
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

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
        toast({
          title: 'Cobrança enviada!',
          description: `Mensagem ${type === 'urgent' ? 'urgente' : 'de lembrete'} enviada.`,
        });
        refetch();
      } else {
        throw new Error(data?.error || 'Erro ao enviar');
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSendingReminder(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!contracts || contracts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <FileSignature className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum contrato vinculado</p>
        </CardContent>
      </Card>
    );
  }

  const pendingCount = contracts.filter(c => c.status === 'pending' || c.status.startsWith('sent_')).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Contratos
            {pendingCount > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {contracts.map((contract) => {
          const config = statusConfig[contract.status] || statusConfig.pending;
          const isPending = contract.status === 'pending' || contract.status.startsWith('sent_');
          
          return (
            <div 
              key={contract.id}
              className="p-3 rounded-lg border bg-card"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {contract.document_name || 'Contrato'}
                  </p>
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
                
                <Badge 
                  variant="secondary"
                  className={cn(
                    "flex items-center gap-1 shrink-0 text-xs",
                    config.bgColor,
                    config.color
                  )}
                >
                  {config.icon}
                  {config.label}
                </Badge>
              </div>

              <div className="flex items-center gap-2 mt-3">
                {isPending && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 gap-1"
                      onClick={() => sendManualReminder(contract, 'soft')}
                      disabled={sendingReminder === contract.id}
                    >
                      {sendingReminder === contract.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <MessageSquare className="h-3 w-3" />
                      )}
                      Lembrar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 gap-1 text-destructive hover:text-destructive"
                      onClick={() => sendManualReminder(contract, 'urgent')}
                      disabled={sendingReminder === contract.id}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Urgente
                    </Button>
                  </>
                )}
                
                {contract.contract_link && (
                  <a
                    href={contract.contract_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto"
                  >
                    <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                      <ExternalLink className="h-3 w-3" />
                      Abrir
                    </Button>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
