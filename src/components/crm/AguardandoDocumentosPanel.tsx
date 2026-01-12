import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileWarning, 
  RefreshCw, 
  Send,
  MessageCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  User
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface LeadAguardandoDoc {
  id: string;
  lead_id: string;
  lead_nome: string;
  lead_telefone: string | null;
  subscriber_id: string | null;
  dias_aguardando: number;
  ultimo_lembrete: string | null;
  status_doc: 'pendente' | 'notificado' | 'parcial';
  tipo_documento: string | null;
  created_at: string;
}

export function AguardandoDocumentosPanel() {
  const [leads, setLeads] = useState<LeadAguardandoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificando, setNotificando] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchLeadsAguardandoDocs = useCallback(async () => {
    setLoading(true);
    
    try {
      // Buscar leads com system_events de documento pendente
      // ou leads em status que tipicamente precisam de documentos
      const { data: eventos, error: erroEventos } = await supabase
        .from('system_events')
        .select(`
          id,
          lead_id,
          dados,
          created_at,
          leads_juridicos!system_events_lead_id_fkey(id, nome, telefone, status)
        `)
        .eq('tipo', 'documento')
        .eq('acao', 'aguardando_documento')
        .eq('processado', false)
        .order('created_at', { ascending: false })
        .limit(20);

      // Também buscar leads em status "Em Negociação" ou "Aguardando Contrato" 
      // que podem precisar de documentação
      const { data: leadsNegociacao, error: erroLeads } = await supabase
        .from('leads_juridicos')
        .select('id, nome, telefone, status, updated_at')
        .in('status', ['Em Negociação', 'Aguardando Contrato'])
        .order('updated_at', { ascending: false })
        .limit(30);

      // Combinar dados e processar
      const leadsMap = new Map<string, LeadAguardandoDoc>();

      // Processar eventos de documento pendente
      if (eventos) {
        for (const evento of eventos) {
          const leadData = evento.leads_juridicos as any;
          if (!leadData) continue;
          
          const dados = evento.dados as any;
          const diasAguardando = Math.floor(
            (new Date().getTime() - new Date(evento.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          leadsMap.set(leadData.id, {
            id: evento.id,
            lead_id: leadData.id,
            lead_nome: leadData.nome || 'Sem nome',
            lead_telefone: leadData.telefone,
            subscriber_id: null,
            dias_aguardando: diasAguardando,
            ultimo_lembrete: dados?.ultimo_lembrete || null,
            status_doc: dados?.status_doc || 'pendente',
            tipo_documento: dados?.tipo_documento || 'Documentos gerais',
            created_at: evento.created_at,
          });
        }
      }

      // Processar leads em negociação (verificar se têm poucos documentos)
      if (leadsNegociacao) {
        for (const lead of leadsNegociacao) {
          if (leadsMap.has(lead.id)) continue;
          
          // Verificar quantidade de documentos
          const { count } = await supabase
            .from('documentos')
            .select('id', { count: 'exact', head: true })
            .eq('cliente_id', lead.id);
          
          // Se tem poucos documentos, considerar pendente
          if (count !== null && count < 3) {
            // Buscar subscriber para este lead
            const { data: subscriberData } = await supabase
              .from('manychat_subscribers')
              .select('subscriber_id')
              .eq('lead_id', lead.id)
              .maybeSingle();

            const diasAguardando = Math.floor(
              (new Date().getTime() - new Date(lead.updated_at || new Date()).getTime()) / (1000 * 60 * 60 * 24)
            );

            leadsMap.set(lead.id, {
              id: `lead-${lead.id}`,
              lead_id: lead.id,
              lead_nome: lead.nome || 'Sem nome',
              lead_telefone: lead.telefone,
              subscriber_id: subscriberData?.subscriber_id || null,
              dias_aguardando: diasAguardando,
              ultimo_lembrete: null,
              status_doc: count === 0 ? 'pendente' : 'parcial',
              tipo_documento: 'Documentos para análise',
              created_at: lead.updated_at || new Date().toISOString(),
            });
          }
        }
      }

      setLeads(Array.from(leadsMap.values()).sort((a, b) => b.dias_aguardando - a.dias_aguardando));
    } catch (error) {
      console.error('Erro ao buscar leads aguardando documentos:', error);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeadsAguardandoDocs();

    // Realtime subscription
    const channel = supabase
      .channel('docs-aguardando')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'system_events',
        filter: 'tipo=eq.documento'
      }, fetchLeadsAguardandoDocs)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'documentos'
      }, fetchLeadsAguardandoDocs)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLeadsAguardandoDocs]);

  const enviarLembreteDocumento = async (lead: LeadAguardandoDoc) => {
    if (!lead.subscriber_id) {
      toast({
        title: 'Não é possível notificar',
        description: 'Lead não tem subscriber ManyChat vinculado',
        variant: 'destructive',
      });
      return;
    }

    setNotificando(lead.lead_id);

    try {
      // Chamar edge function para enviar lembrete via Isa
      const { data, error } = await supabase.functions.invoke('isa-actions', {
        body: {
          action: 'notificar_documento_pendente',
          lead_id: lead.lead_id,
          subscriber_id: lead.subscriber_id,
          tipo_documento: lead.tipo_documento,
        },
      });

      if (error) throw error;

      // Atualizar evento como notificado
      await supabase
        .from('system_events')
        .update({
          dados: {
            status_doc: 'notificado',
            ultimo_lembrete: new Date().toISOString(),
          },
        })
        .eq('id', lead.id);

      toast({
        title: 'Lembrete enviado!',
        description: `Notificação enviada para ${lead.lead_nome}`,
      });

      fetchLeadsAguardandoDocs();
    } catch (error) {
      console.error('Erro ao enviar lembrete:', error);
      toast({
        title: 'Erro ao enviar lembrete',
        description: 'Não foi possível enviar a notificação',
        variant: 'destructive',
      });
    } finally {
      setNotificando(null);
    }
  };

  const getStatusBadge = (lead: LeadAguardandoDoc) => {
    if (lead.status_doc === 'notificado') {
      return (
        <Badge className="bg-amber-500/20 text-amber-600 text-[9px] px-1.5 py-0 h-4">
          <MessageCircle className="h-2.5 w-2.5 mr-0.5" />
          Notificado
        </Badge>
      );
    }
    if (lead.status_doc === 'parcial') {
      return (
        <Badge className="bg-blue-500/20 text-blue-600 text-[9px] px-1.5 py-0 h-4">
          <Clock className="h-2.5 w-2.5 mr-0.5" />
          Parcial
        </Badge>
      );
    }
    return (
      <Badge className="bg-destructive/20 text-destructive text-[9px] px-1.5 py-0 h-4">
        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
        Pendente
      </Badge>
    );
  };

  const getUrgenciaCor = (dias: number) => {
    if (dias >= 7) return 'text-destructive';
    if (dias >= 3) return 'text-amber-500';
    return 'text-muted-foreground';
  };

  return (
    <Card className="h-full bg-card border-border/50 shadow-soft">
      <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-amber-500" />
          Aguardando Documentos
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
          onClick={fetchLeadsAguardandoDocs}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <ScrollArea className="h-[180px] pr-2">
          <div className="space-y-2">
            {leads.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-8 w-8 text-success/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Nenhum documento pendente
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  A Isa monitora conversas para detectar documentos faltantes
                </p>
              </div>
            ) : (
              leads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                >
                  <div className="mt-0.5 p-1.5 rounded-full bg-amber-500/10">
                    <FileWarning className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => navigate(`/leads?lead_id=${lead.lead_id}`)}
                        className="text-xs font-medium text-foreground leading-tight truncate hover:text-primary transition-colors"
                      >
                        {lead.lead_nome}
                      </button>
                      {getStatusBadge(lead)}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {lead.tipo_documento}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-medium ${getUrgenciaCor(lead.dias_aguardando)}`}>
                        {lead.dias_aguardando === 0 ? 'Hoje' : `${lead.dias_aguardando}d aguardando`}
                      </span>
                      {lead.ultimo_lembrete && (
                        <span className="text-[9px] text-muted-foreground">
                          • Último lembrete: {formatDistanceToNow(new Date(lead.ultimo_lembrete), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => enviarLembreteDocumento(lead)}
                    disabled={notificando === lead.lead_id || !lead.subscriber_id}
                    title={lead.subscriber_id ? 'Enviar lembrete' : 'Sem WhatsApp vinculado'}
                  >
                    {notificando === lead.lead_id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
