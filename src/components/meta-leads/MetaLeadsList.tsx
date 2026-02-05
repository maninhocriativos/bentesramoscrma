import { MetaFormLead, MetaFormLeadStatus } from '@/types/metaFormLeads';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, Phone, Mail, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetaLeadsListProps {
  leads: MetaFormLead[];
  selectedId: string | null;
  onSelect: (lead: MetaFormLead) => void;
}

const statusColors: Record<MetaFormLeadStatus, string> = {
  novo: 'bg-blue-100 text-blue-800 border-blue-200',
  em_atendimento: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  concluido: 'bg-green-100 text-green-800 border-green-200',
  perdido: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabels: Record<MetaFormLeadStatus, string> = {
  novo: 'Novo',
  em_atendimento: 'Em Atendimento',
  concluido: 'Concluído',
  perdido: 'Perdido',
};

export function MetaLeadsList({ leads, selectedId, onSelect }: MetaLeadsListProps) {
  if (leads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">Nenhum lead encontrado</p>
          <p className="text-sm">Leads de formulários do Facebook/Instagram aparecerão aqui.</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="divide-y divide-border">
        {leads.map((lead) => (
          <div
            key={lead.id}
            onClick={() => onSelect(lead)}
            className={cn(
              "p-4 cursor-pointer transition-colors hover:bg-accent/50",
              selectedId === lead.id && "bg-accent"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {lead.nome || 'Sem nome'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {lead.telefone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {lead.telefone}
                      </span>
                    )}
                    {lead.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3" />
                        {lead.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className={cn("shrink-0 text-[10px] px-1.5", statusColors[lead.status])}>
                {statusLabels[lead.status]}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700 border-purple-200">
                📋 FORM META
              </Badge>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(lead.created_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
