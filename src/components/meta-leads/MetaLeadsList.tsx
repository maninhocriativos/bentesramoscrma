import { MetaFormLead, MetaFormLeadStatus } from '@/types/metaFormLeads';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, Phone, Mail, Clock, Calendar } from 'lucide-react';
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
            <div className="flex items-start gap-2 mb-2">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="font-medium truncate text-sm" title={lead.nome || 'Sem nome'}>
                    {lead.nome || 'Sem nome'}
                  </p>
                  <Badge variant="outline" className={cn("shrink-0 text-[10px] px-1.5 whitespace-nowrap", statusColors[lead.status])}>
                    {statusLabels[lead.status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {lead.telefone && (
                    <span className="flex items-center gap-1" title={lead.telefone}>
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{lead.telefone}</span>
                    </span>
                  )}
                  {lead.email && (
                    <span className="flex items-center gap-1 truncate" title={lead.email}>
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{lead.email}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1 gap-2">
                  <Badge variant="secondary" className={`text-[10px] shrink-0 px-1.5 py-0 ${
                    lead.source === 'google_sheets' 
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                      : 'bg-purple-100 text-purple-700 border-purple-200'
                  }`}>
                    {lead.source === 'google_sheets' ? '📊 Sheets' : '📋 META'}
                  </Badge>
                  <span className="flex items-center gap-1 whitespace-nowrap" title={format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}>
                    <Calendar className="h-3 w-3 shrink-0" />
                    {formatDistanceToNow(new Date(lead.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
