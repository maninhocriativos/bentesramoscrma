import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lead } from '@/types/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  UserPlus, 
  ArrowRight, 
  FileText, 
  Phone,
  MessageSquare
} from 'lucide-react';

interface RecentActivitiesProps {
  leads: Lead[];
}

interface Activity {
  id: string;
  type: 'new_lead' | 'status_change' | 'contract' | 'contact';
  description: string;
  time: Date;
  leadName: string;
}

export function RecentActivities({ leads }: RecentActivitiesProps) {
  const activities = useMemo(() => {
    const acts: Activity[] = [];
    
    leads.forEach((lead) => {
      // Activity for lead creation
      acts.push({
        id: `${lead.id}-created`,
        type: 'new_lead',
        description: `Novo Lead: ${lead.nome || 'Sem nome'}`,
        time: new Date(lead.created_at),
        leadName: lead.nome || 'Sem nome',
      });

      // Activity for recent updates
      if (lead.updated_at && lead.updated_at !== lead.created_at) {
        acts.push({
          id: `${lead.id}-updated`,
          type: 'status_change',
          description: `${lead.nome || 'Lead'} atualizado para "${lead.status}"`,
          time: new Date(lead.updated_at),
          leadName: lead.nome || 'Sem nome',
        });
      }

      // Activity for contract links
      if (lead.link_contrato) {
        acts.push({
          id: `${lead.id}-contract`,
          type: 'contract',
          description: `Contrato anexado para ${lead.nome || 'Lead'}`,
          time: new Date(lead.updated_at || lead.created_at),
          leadName: lead.nome || 'Sem nome',
        });
      }
    });

    // Sort by time descending and take last 10
    return acts
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 10);
  }, [leads]);

  const getIcon = (type: Activity['type']) => {
    switch (type) {
      case 'new_lead':
        return <UserPlus className="h-3.5 w-3.5 text-success" />;
      case 'status_change':
        return <ArrowRight className="h-3.5 w-3.5 text-primary" />;
      case 'contract':
        return <FileText className="h-3.5 w-3.5 text-accent" />;
      case 'contact':
        return <Phone className="h-3.5 w-3.5 text-muted-foreground" />;
      default:
        return <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <Card className="h-full bg-card border-border/50 shadow-soft">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Últimas Movimentações
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <ScrollArea className="h-[180px] pr-2">
          <div className="space-y-2">
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma movimentação recente
              </p>
            ) : (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-0.5 p-1.5 rounded-full bg-muted/80">
                    {getIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground leading-tight truncate">
                      {activity.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(activity.time, { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
