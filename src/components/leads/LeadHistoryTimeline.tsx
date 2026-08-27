import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MessageCircle,
  Phone,
  Mail,
  Bot,
  Settings,
  ArrowDownLeft,
  ArrowUpRight,
  Video,
  FileText,
  Loader2,
  RefreshCw,
  FileSignature,
  Mic,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { detectMediaType } from '@/lib/chatUtils';

interface HistoryItem {
  id: string;
  type: 'message' | 'interacao' | 'system' | 'isa';
  direction?: 'in' | 'out';
  content: string;
  timestamp: string;
  sender: string;
  channel?: string;
  mediaKind?: 'audio' | 'image' | 'video' | 'document';
  mediaUrl?: string;
}

const MEDIA_LABELS: Record<string, string> = {
  audio: 'Mensagem de áudio',
  image: 'Imagem enviada',
  video: 'Vídeo enviado',
  document: 'Documento enviado',
};

const MEDIA_ICONS: Record<string, React.ElementType> = {
  audio: Mic,
  image: ImageIcon,
  video: Video,
  document: FileText,
};

interface LeadHistoryTimelineProps {
  leadId: string;
  telefone?: string | null;
}

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  'WhatsApp': MessageCircle,
  'Chat': MessageCircle,
  'Ligação': Phone,
  'Email': Mail,
  'Reunião': Video,
  'Documento': FileText,
  'Contrato': FileSignature,
  'Anotação': FileText,
};

// changed_by em lead_state_history nunca é um usuário humano — é sempre uma
// origem automática (webhook, sync, IA). Rotular com esses nomes evita o bug
// anterior, que mostrava "Humano" pra toda mudança de etapa (o código só
// checava === 'system', e nenhum valor real é literalmente esse).
const ORIGEM_ETAPA_LABELS: Record<string, string> = {
  zapi: 'Sincronização (Z-API)',
  isa: 'Isa (IA)',
  'migration-sync-states': 'Migração do sistema',
  clicksign_webhook: 'ClickSign',
};

// Tipos de interação que são só um espelho automático das mensagens de
// WhatsApp (inseridos por ~15 pontos diferentes do sistema toda vez que uma
// mensagem chega/sai). Mostrá-los junto com manychat_mensagens duplicava
// cada mensagem da conversa duas vezes no histórico.
const TIPOS_ESPELHO_CHAT = new Set(['WhatsApp', 'Chat']);

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function LeadHistoryTimeline({ leadId, telefone }: LeadHistoryTimelineProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    fetchHistory();
    return () => { cancelRef.current = true; };
  }, [leadId, telefone]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchHistory = async () => {
    setLoading(true);
    const items: HistoryItem[] = [];

    try {
      // Interações manuais (Ligação, Email, Reunião, Documento, Contrato...).
      // Tipos WhatsApp/Chat ficam de fora — são espelho do que já vem de
      // manychat_mensagens abaixo, com texto completo e direção corretos.
      const { data: interacoes } = await supabase
        .from('interacoes')
        .select('*')
        .eq('cliente_id', leadId)
        .order('data_interacao', { ascending: false });

      const responsavelIds = new Set<string>();
      const interacoesRelevantes = (interacoes || []).filter(i => !TIPOS_ESPELHO_CHAT.has(i.tipo || ''));
      interacoesRelevantes.forEach(i => { if ((i as any).responsavel_id) responsavelIds.add((i as any).responsavel_id); });

      // Resolve nome de quem registrou a interação manual, quando houver.
      let perfisPorId = new Map<string, string>();
      if (responsavelIds.size > 0) {
        const { data: perfis } = await supabase
          .from('perfis')
          .select('id, nome, sobrenome')
          .in('id', Array.from(responsavelIds));
        perfisPorId = new Map((perfis || []).map((p: any) => [p.id, [p.nome, p.sobrenome].filter(Boolean).join(' ') || 'Equipe']));
      }

      interacoesRelevantes.forEach((i) => {
        const responsavelNome = (i as any).responsavel_id ? perfisPorId.get((i as any).responsavel_id) : null;
        items.push({
          id: `int-${i.id}`,
          type: 'interacao',
          direction: i.direcao?.toLowerCase() === 'entrada' ? 'in' : 'out',
          content: i.resumo || i.detalhes || 'Interação registrada',
          timestamp: i.data_interacao,
          sender: responsavelNome || (i.direcao?.toLowerCase() === 'entrada' ? 'Cliente' : 'Equipe'),
          channel: i.tipo,
        });
      });

      // Mensagens de WhatsApp — fonte principal da conversa.
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
              const meta = (m.metadata as any) || {};
              const isIsa = m.direcao === 'saida' && (meta.sent_by === 'isa' || meta.source === 'isa');
              const sender = m.direcao === 'entrada'
                ? 'Cliente'
                : isIsa
                  ? 'Isa (IA)'
                  : (meta.sent_by_nome || 'Equipe');

              // Mensagens de mídia chegam como só uma URL crua (áudio, foto,
              // documento) — mostrar o link inteiro quebrava o layout e não
              // dizia nada útil. Detecta pelo tipo salvo ou pela extensão
              // (mesma lógica já usada no chat completo) e mostra um card
              // compacto com um link "Abrir" em vez do texto cru.
              const kind = detectMediaType(m.conteudo, m.tipo || undefined);
              const isMedia = kind !== 'text' && kind !== 'sticker' && kind !== 'location'
                && /^https?:\/\//i.test(m.conteudo.trim());

              items.push({
                id: `msg-${m.id}`,
                type: isIsa ? 'isa' : 'message',
                direction: m.direcao === 'entrada' ? 'in' : 'out',
                content: isMedia ? '' : m.conteudo.substring(0, 200) + (m.conteudo.length > 200 ? '...' : ''),
                timestamp: m.created_at,
                sender,
                channel: 'WhatsApp',
                mediaKind: isMedia ? (kind as 'audio' | 'image' | 'video' | 'document') : undefined,
                mediaUrl: isMedia ? m.conteudo.trim() : undefined,
              });
            });
          }
        }
      }

      // Mudanças de etapa do funil.
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
            content: `Mudou de etapa: ${s.from_state || 'Início'} → ${s.to_state}${s.reason ? ` (${s.reason})` : ''}`,
            timestamp: s.created_at,
            sender: ORIGEM_ETAPA_LABELS[s.changed_by || ''] || s.changed_by || 'Sistema',
          });
        });
      }

      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (!cancelRef.current) setHistory(items);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      if (!cancelRef.current) setLoading(false);
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

  // Agrupado por dia, com o dia da semana no cabeçalho.
  const groupedHistory = history.reduce((acc, item) => {
    const date = format(new Date(item.timestamp), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {} as Record<string, HistoryItem[]>);

  const now = new Date();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <p className="text-[10px] text-muted-foreground">
          {history.length} evento{history.length !== 1 ? 's' : ''} no histórico
        </p>
        <button
          onClick={() => fetchHistory()}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-2.5 w-2.5" /> Atualizar
        </button>
      </div>
      <ScrollArea className="h-[58vh]">
        <div className="p-4 pt-2 space-y-6">
          {Object.entries(groupedHistory).map(([date, items]) => {
            const d = new Date(date);
            const sameYear = d.getFullYear() === now.getFullYear();
            const label = capitalize(format(d, sameYear ? "EEEE, dd 'de' MMMM" : "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }));

            return (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-medium text-muted-foreground tracking-wide">
                    {label}
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
                          "flex gap-2.5 p-2.5 rounded-lg text-sm transition-colors min-w-0",
                          item.type === 'isa' && "bg-violet-50 border border-violet-100 dark:bg-violet-950/20 dark:border-violet-900/40",
                          item.type === 'system' && "bg-muted/50 border border-border",
                          item.type === 'message' && item.direction === 'in' && "bg-blue-50 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40",
                          item.type === 'message' && item.direction === 'out' && "bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40",
                          item.type === 'interacao' && "bg-card border border-border"
                        )}
                      >
                        {/* Icon */}
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                          item.type === 'isa' && "bg-violet-200 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
                          item.type === 'system' && "bg-muted text-muted-foreground",
                          item.type === 'message' && item.direction === 'in' && "bg-blue-200 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
                          item.type === 'message' && item.direction === 'out' && "bg-emerald-200 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
                          item.type === 'interacao' && "bg-primary/10 text-primary"
                        )}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-semibold text-foreground">
                              {item.sender}
                            </span>
                            {item.channel && (
                              <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                                · {item.channel}
                              </span>
                            )}
                            {item.direction && (
                              item.direction === 'in'
                                ? <ArrowDownLeft className="h-2.5 w-2.5 text-blue-500 shrink-0" />
                                : <ArrowUpRight className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto tabular-nums shrink-0">
                              {format(new Date(item.timestamp), 'HH:mm')}
                            </span>
                          </div>
                          {item.mediaKind && item.mediaUrl ? (
                            <a
                              href={item.mediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-foreground/80 bg-background/60 hover:bg-background border border-border/50 rounded-lg px-2 py-1 transition-colors"
                            >
                              {(() => { const MediaIcon = MEDIA_ICONS[item.mediaKind]; return <MediaIcon className="h-3.5 w-3.5 shrink-0" />; })()}
                              {MEDIA_LABELS[item.mediaKind]}
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                            </a>
                          ) : (
                            <p className="text-xs text-foreground/80 leading-relaxed break-words">
                              {item.content}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
