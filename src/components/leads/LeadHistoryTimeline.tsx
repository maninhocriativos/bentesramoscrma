import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MessageCircle,
  Phone,
  Mail,
  Bot,
  User,
  Settings,
  ArrowDownLeft,
  ArrowUpRight,
  Video,
  FileText,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HistoryItem {
  id: string;
  type: 'message' | 'interacao' | 'system' | 'isa';
  direction?: 'in' | 'out';
  content: string;
  timestamp: string;
  sender?: string;
  channel?: string;
}

interface LeadHistoryTimelineProps {
  leadId: string;
  telefone?: string | null;
}

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  'WhatsApp': MessageCircle,
  'Ligação': Phone,
  'Email': Mail,
  'Reunião': Video,
  'Documento': FileText,
};

export function LeadHistoryTimeline({ leadId, telefone }: LeadHistoryTimelineProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [leadId, telefone]);

  const fetchHistory = async () => {
    setLoading(true);
    const items: HistoryItem[] = [];

    try {
      // Fetch interacoes
      const { data: interacoes } = await supabase
        .from('interacoes')
        .select('*')
        .eq('cliente_id', leadId)
        .order('data_interacao', { ascending: false });

      if (interacoes) {
        interacoes.forEach((i) => {
          items.push({
            id: `int-${i.id}`,
            type: 'interacao',
            direction: i.direcao === 'Entrada' ? 'in' : 'out',
            content: i.resumo,
            timestamp: i.data_interacao,
            channel: i.tipo,
          });
        });
      }

      // Fetch WhatsApp messages if we have subscriber
      if (telefone) {
        const normalizedPhone = telefone.replace(/\D/g, '');
        const { data: subscriber } = await supabase
          .from('manychat_subscribers')
          .select('subscriber_id')
          .or(`telefone.ilike.%${normalizedPhone}%,telefone_normalizado.ilike.%${normalizedPhone}%`)
          .maybeSingle();

        if (subscriber) {
          const { data: messages } = await supabase
            .from('manychat_mensagens')
            .select('*')
            .eq('subscriber_id', subscriber.subscriber_id)
            .order('created_at', { ascending: false })
            .limit(50);

          if (messages) {
            messages.forEach((m) => {
              const isIsa = m.direcao === 'saida' && (m.metadata as any)?.sent_by === 'isa';
              items.push({
                id: `msg-${m.id}`,
                type: isIsa ? 'isa' : 'message',
                direction: m.direcao === 'entrada' ? 'in' : 'out',
                content: m.conteudo.substring(0, 200) + (m.conteudo.length > 200 ? '...' : ''),
                timestamp: m.created_at,
                sender: isIsa ? 'ISA' : (m.direcao === 'entrada' ? 'Cliente' : 'Humano'),
                channel: 'WhatsApp',
              });
            });
          }
        }
      }

      // Fetch state history
      const { data: stateHistory } = await supabase
        .from('lead_state_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (stateHistory) {
        stateHistory.forEach((s) => {
          items.push({
            id: `state-${s.id}`,
            type: 'system',
            content: `Etapa: ${s.from_state || 'Início'} → ${s.to_state}${s.reason ? ` (${s.reason})` : ''}`,
            timestamp: s.created_at,
            sender: s.changed_by === 'system' ? 'Sistema' : 'Humano',
          });
        });
      }

      // Sort by timestamp desc
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setHistory(items);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum histórico encontrado</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Inicie uma conversa para ver o histórico aqui
        </p>
      </div>
    );
  }

  // Group by date
  const groupedHistory = history.reduce((acc, item) => {
    const date = format(new Date(item.timestamp), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {} as Record<string, HistoryItem[]>);

  return (
    <ScrollArea className="h-[calc(100vh-380px)]">
      <div className="p-4 space-y-6">
        {Object.entries(groupedHistory).map(([date, items]) => (
          <div key={date}>
            {/* Date Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {format(new Date(date), "dd 'de' MMMM", { locale: ptBR })}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Items */}
            <div className="space-y-2">
              {items.map((item) => {
                const Icon = item.channel ? (CHANNEL_ICONS[item.channel] || MessageCircle) : 
                  item.type === 'isa' ? Bot :
                  item.type === 'system' ? Settings :
                  MessageCircle;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex gap-2.5 p-2.5 rounded-lg text-sm transition-colors",
                      item.type === 'isa' && "bg-purple-50 border border-purple-100",
                      item.type === 'system' && "bg-muted/50 border border-border",
                      item.type === 'message' && item.direction === 'in' && "bg-blue-50 border border-blue-100",
                      item.type === 'message' && item.direction === 'out' && "bg-emerald-50 border border-emerald-100",
                      item.type === 'interacao' && "bg-card border border-border"
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                      item.type === 'isa' && "bg-purple-200 text-purple-700",
                      item.type === 'system' && "bg-muted text-muted-foreground",
                      item.type === 'message' && item.direction === 'in' && "bg-blue-200 text-blue-700",
                      item.type === 'message' && item.direction === 'out' && "bg-emerald-200 text-emerald-700",
                      item.type === 'interacao' && "bg-primary/10 text-primary"
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {item.sender || item.channel || 'Sistema'}
                        </span>
                        {item.direction && (
                          item.direction === 'in' 
                            ? <ArrowDownLeft className="h-2.5 w-2.5 text-blue-500" />
                            : <ArrowUpRight className="h-2.5 w-2.5 text-emerald-500" />
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {format(new Date(item.timestamp), 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        {item.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}