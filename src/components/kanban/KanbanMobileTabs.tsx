import { useState } from 'react';
import { Lead, LeadStatus } from '@/types/leads';
import { LeadCard } from './LeadCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUSES } from './KanbanBoard';
import { 
  Snowflake, Building2, MessageSquare, Handshake, 
  FileSignature, CheckCircle2, Trophy, XCircle 
} from 'lucide-react';

interface IsaInsight {
  sentimento: 'positivo' | 'neutro' | 'negativo' | null;
  urgencia: 'baixa' | 'media' | 'alta' | 'urgente' | null;
}

interface LeadExtra {
  leadId: string;
  ultimaInteracao: { resumo: string; data: string; } | null;
  temAgendamento: boolean;
  proximoAgendamento: { titulo: string; data: string; } | null;
}

interface KanbanMobileTabsProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  isaInsights?: Record<string, IsaInsight>;
  leadExtras?: Record<string, LeadExtra>;
}

const STATUS_ICONS: Record<LeadStatus, React.ElementType> = {
  'Lead Frio': Snowflake,
  'Bentes Ramos': Building2,
  'Em Atendimento': MessageSquare,
  'Em Negociação': Handshake,
  'Aguardando Contrato': FileSignature,
  'Contrato Assinado': CheckCircle2,
  'Ganho': Trophy,
  'Perdido': XCircle,
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  'Lead Frio': 'Frio',
  'Bentes Ramos': 'B&R',
  'Em Atendimento': 'Atendim.',
  'Em Negociação': 'Negoc.',
  'Aguardando Contrato': 'Aguard.',
  'Contrato Assinado': 'Assinado',
  'Ganho': 'Ganho',
  'Perdido': 'Perdido',
};

export function KanbanMobileTabs({ 
  leads, 
  onLeadClick, 
  isaInsights = {},
  leadExtras = {} 
}: KanbanMobileTabsProps) {
  const [activeTab, setActiveTab] = useState<LeadStatus>('Lead Frio');

  const getLeadsByStatus = (status: LeadStatus) => 
    leads.filter(lead => lead.status === status);

  const activeLeads = getLeadsByStatus(activeTab);

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LeadStatus)} className="flex flex-col h-full">
        {/* Scrollable Tabs */}
        <div className="overflow-x-auto border-b border-border bg-card -mx-4 px-4">
          <TabsList className="inline-flex h-12 bg-transparent gap-1 p-1 min-w-max">
            {STATUSES.map((status) => {
              const Icon = STATUS_ICONS[status];
              const count = getLeadsByStatus(status).length;
              const isActive = activeTab === status;
              
              return (
                <TabsTrigger
                  key={status}
                  value={status}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                    "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{STATUS_LABELS[status]}</span>
                  <Badge 
                    variant={isActive ? "secondary" : "outline"}
                    className={cn(
                      "h-5 min-w-[20px] px-1.5 text-[10px] font-bold",
                      isActive && "bg-primary-foreground/20 text-primary-foreground border-0"
                    )}
                  >
                    {count}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Cards List */}
        <div className="flex-1 overflow-y-auto py-4">
          {STATUSES.map((status) => (
            <TabsContent key={status} value={status} className="mt-0 h-full">
              {activeLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <div className="p-4 rounded-full bg-muted/50 mb-3">
                    {(() => {
                      const Icon = STATUS_ICONS[status];
                      return <Icon className="h-8 w-8" />;
                    })()}
                  </div>
                  <p className="text-sm font-medium">Nenhum lead nesta etapa</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {activeLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onClick={() => onLeadClick(lead)}
                      isaInsight={isaInsights[lead.id]}
                      leadExtra={leadExtras[lead.id]}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
