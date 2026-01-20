import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageCircle, CheckCircle2, Clock, Send } from 'lucide-react';

interface LeadFollowup {
  id: string;
  lead_id: string;
  followup_stage_fast: number | null;
  followup_stage_slow: number | null;
  respondido: boolean | null;
  status: string | null;
  primeiro_contato_em: string;
  canal: string | null;
  lead_nome?: string;
}

export function FollowupStatusPanel() {
  const [followups, setFollowups] = useState<LeadFollowup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowups = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('lead_followups')
      .select(`*, leads_juridicos!lead_followups_lead_id_fkey(nome)`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
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
      .channel('followups-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_followups' }, fetchFollowups)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <Card className="bg-card/50 border-border/40">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-xs font-medium text-foreground flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5 text-primary" />
          Follow-ups Automáticos
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <ScrollArea className="h-[160px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : followups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Send className="h-6 w-6 mb-1 opacity-40" />
              <span className="text-xs">Nenhum follow-up</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {followups.map((f) => (
                <div key={f.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
                  <div className={`w-1.5 h-1.5 rounded-full ${f.respondido ? 'bg-success' : 'bg-amber-500'}`} />
                  <span className="text-xs text-foreground truncate flex-1">{f.lead_nome}</span>
                  {f.respondido ? (
                    <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {(f.followup_stage_fast ?? 0) + 1}/3
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
