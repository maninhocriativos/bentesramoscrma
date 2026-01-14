import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MessageCircle, 
  Clock, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LeadFollowup {
  id: string;
  lead_id: string;
  subscriber_id: string | null;
  canal: string | null;
  status: string | null;
  primeiro_contato_em: string;
  followup_1_enviado: boolean | null;
  followup_1_enviado_em: string | null;
  followup_2_enviado: boolean | null;
  followup_2_enviado_em: string | null;
  followup_3_enviado: boolean | null;
  followup_3_enviado_em: string | null;
  followup_stage_fast: number | null;
  followup_stage_slow: number | null;
  respondido: boolean | null;
  respondido_em: string | null;
  lead_nome?: string;
}

export function FollowupStatusPanel() {
  const [followups, setFollowups] = useState<LeadFollowup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowups = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lead_followups')
      .select(`
        *,
        leads_juridicos!lead_followups_lead_id_fkey(nome)
      `)
      .order('created_at', { ascending: false })
      .limit(15);

    if (!error && data) {
      setFollowups(data.map((f: any) => ({
        ...f,
        lead_nome: f.leads_juridicos?.nome || 'Lead sem nome'
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFollowups();

    const channel = supabase
      .channel('followups-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'lead_followups' 
      }, fetchFollowups)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getStatusBadge = (followup: LeadFollowup) => {
    if (followup.respondido) {
      return (
        <Badge className="bg-success/20 text-success text-[9px] px-1.5 py-0 h-4">
          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
          Respondeu
        </Badge>
      );
    }
    if (followup.status === 'finalizado') {
      return (
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
          <XCircle className="h-2.5 w-2.5 mr-0.5" />
          Sem resposta
        </Badge>
      );
    }
    return (
      <Badge className="bg-accent/20 text-accent-foreground text-[9px] px-1.5 py-0 h-4">
        <Clock className="h-2.5 w-2.5 mr-0.5" />
        Aguardando
      </Badge>
    );
  };

  const getFollowupProgress = (followup: LeadFollowup) => {
    const fastCount = followup.followup_stage_fast || 0;
    const slowCount = followup.followup_stage_slow || 0;
    return { fast: fastCount, slow: slowCount };
  };

  return (
    <Card className="h-full bg-card border-border/50 shadow-soft">
      <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Follow-ups Automáticos
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
          onClick={fetchFollowups}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <ScrollArea className="h-[180px] pr-2">
          <div className="space-y-2">
            {followups.length === 0 ? (
              <div className="text-center py-6">
                <Send className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Nenhum follow-up ativo
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  Follow-ups são criados automaticamente para novos leads
                </p>
              </div>
            ) : (
              followups.map((followup) => (
                <div
                  key={followup.id}
                  className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-0.5 p-1.5 rounded-full bg-muted/80">
                    <MessageCircle className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-foreground leading-tight truncate">
                        {followup.lead_nome}
                      </p>
                      {getStatusBadge(followup)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {/* FAST Progress (3 stages) */}
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map((step) => (
                          <div
                            key={`fast-${step}`}
                            className={`h-1.5 w-3 rounded-full ${
                              (getFollowupProgress(followup).fast >= step) ? 'bg-blue-500' : 'bg-muted'
                            }`}
                            title={`FAST ${step}`}
                          />
                        ))}
                      </div>
                      {/* SLOW Progress (4 stages) */}
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={`slow-${step}`}
                            className={`h-1.5 w-3 rounded-full ${
                              (getFollowupProgress(followup).slow >= step) ? 'bg-amber-500' : 'bg-muted'
                            }`}
                            title={`SLOW ${step}`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {getFollowupProgress(followup).fast}/3 + {getFollowupProgress(followup).slow}/4
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(followup.primeiro_contato_em), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                      {followup.canal && (
                        <span className="ml-1.5 text-muted-foreground/70">
                          • {followup.canal}
                        </span>
                      )}
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
