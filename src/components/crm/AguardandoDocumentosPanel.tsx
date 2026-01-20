import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { FileWarning, CheckCircle2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LeadAguardandoDoc {
  id: string;
  lead_id: string;
  lead_nome: string;
  dias_aguardando: number;
  status_doc: 'pendente' | 'notificado' | 'parcial';
}

export function AguardandoDocumentosPanel() {
  const [leads, setLeads] = useState<LeadAguardandoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    
    // Get leads in negotiation status with few documents
    const { data: leadsData } = await supabase
      .from('leads_juridicos')
      .select('id, nome, updated_at')
      .in('status', ['Em Negociação', 'Aguardando Contrato'])
      .order('updated_at', { ascending: false })
      .limit(20);

    if (!leadsData) {
      setLoading(false);
      return;
    }

    const results: LeadAguardandoDoc[] = [];
    
    for (const lead of leadsData.slice(0, 10)) {
      const { count } = await supabase
        .from('documentos')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', lead.id);
      
      if (count !== null && count < 3) {
        const diasAguardando = Math.floor(
          (new Date().getTime() - new Date(lead.updated_at || new Date()).getTime()) / (1000 * 60 * 60 * 24)
        );
        results.push({
          id: lead.id,
          lead_id: lead.id,
          lead_nome: lead.nome || 'Sem nome',
          dias_aguardando: diasAguardando,
          status_doc: count === 0 ? 'pendente' : 'parcial',
        });
      }
    }

    setLeads(results.sort((a, b) => b.dias_aguardando - a.dias_aguardando));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();
    const channel = supabase
      .channel('docs-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, fetchLeads)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads]);

  return (
    <Card className="bg-card/50 border-border/40">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-xs font-medium text-foreground flex items-center gap-2">
          <FileWarning className="h-3.5 w-3.5 text-amber-500" />
          Aguardando Documentos
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <ScrollArea className="h-[160px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 mb-1 opacity-40 text-success" />
              <span className="text-xs">Tudo em dia</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {leads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.lead_id}`)}
                  className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${lead.status_doc === 'pendente' ? 'bg-destructive' : 'bg-amber-500'}`} />
                  <span className="text-xs text-foreground truncate flex-1">{lead.lead_nome}</span>
                  <span className={`text-[10px] shrink-0 ${lead.dias_aguardando >= 7 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {lead.dias_aguardando}d
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
