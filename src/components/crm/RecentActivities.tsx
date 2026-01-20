import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lead } from '@/types/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, UserPlus, ArrowRight, FileText } from 'lucide-react';

interface RecentActivitiesProps {
  leads: Lead[];
}

interface ActivityItem {
  id: string;
  type: 'new_lead' | 'status_change' | 'contract';
  description: string;
  time: Date;
}

export function RecentActivities({ leads }: RecentActivitiesProps) {
  const activities = useMemo(() => {
    const acts: ActivityItem[] = [];
    
    leads.forEach((lead) => {
      acts.push({
        id: `${lead.id}-created`,
        type: 'new_lead',
        description: lead.nome || 'Novo Lead',
        time: new Date(lead.created_at),
      });

      if (lead.updated_at && lead.updated_at !== lead.created_at) {
        acts.push({
          id: `${lead.id}-updated`,
          type: 'status_change',
          description: `${lead.nome || 'Lead'} → ${lead.status}`,
          time: new Date(lead.updated_at),
        });
      }

      if (lead.link_contrato) {
        acts.push({
          id: `${lead.id}-contract`,
          type: 'contract',
          description: `Contrato: ${lead.nome || 'Lead'}`,
          time: new Date(lead.updated_at || lead.created_at),
        });
      }
    });

    return acts.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 8);
  }, [leads]);

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'new_lead': return <UserPlus className="h-3 w-3 text-success" />;
      case 'status_change': return <ArrowRight className="h-3 w-3 text-primary" />;
      case 'contract': return <FileText className="h-3 w-3 text-accent" />;
    }
  };

  return (
    <Card className="bg-card/50 border-border/40">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-xs font-medium text-foreground flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          Últimas Movimentações
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <ScrollArea className="h-[160px]">
          {activities.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <span className="text-xs">Sem movimentações</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
                  {getIcon(activity.type)}
                  <span className="text-xs text-foreground truncate flex-1">{activity.description}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(activity.time, { addSuffix: false, locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
