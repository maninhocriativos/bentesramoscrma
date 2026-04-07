import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Loader2, User, Plus, Sparkles, Clock, AlertCircle, Calendar, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import isaAvatar from '@/assets/isa-avatar.png';
import {
  ChatHistory,
  SavedConversation,
  getConversations,
  saveConversation,
  deleteConversation,
  generateConversationTitle,
  generatePreview,
} from './ChatHistory';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface DynamicSuggestion {
  icon: React.ElementType;
  label: string;
  prompt: string;
  color: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ASSISTANT_ID  = 'asst_rGFHqXnOLL6JA7UyRUdXQmaQ';
const STORAGE_KEY   = 'isa-chat';

// ─── Markdown Renderer ─────────────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines   = text.split('\n');
  const result: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      result.push(
        <ul key={`ul-${key++}`} className="my-1.5 space-y-0.5 pl-1">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  const renderInline = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Bold, italic, code inline
    const regex = /(\*\*(.+?)\*\*)|(__(.+?)__)|(\*(.+?)\*)|(_(.+?)_)|(`(.+?)`)/g;
    let last = 0;
    let match;
    while ((match = regex.exec(str)) !== null) {
      if (match.index > last) parts.push(str.slice(last, match.index));
      if (match[1])  parts.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
      else if (match[3]) parts.push(<strong key={key++} className="font-semibold">{match[4]}</strong>);
      else if (match[5]) parts.push(<em key={key++} className="italic">{match[6]}</em>);
      else if (match[7]) parts.push(<em key={key++} className="italic">{match[8]}</em>);
      else if (match[9]) parts.push(
        <code key={key++} className="bg-muted/60 text-foreground px-1.5 py-0.5 rounded-md text-[11px] font-mono">
          {match[10]}
        </code>
      );
      last = match.index + match[0].length;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts;
  };

  lines.forEach((line, i) => {
    // Heading 1
    if (/^# (.+)/.test(line)) {
      flushList();
      result.push(
        <p key={key++} className="font-bold text-base mt-3 mb-1 text-foreground">
          {renderInline(line.replace(/^# /, ''))}
        </p>
      );
    }
    // Heading 2/3
    else if (/^#{2,3} (.+)/.test(line)) {
      flushList();
      result.push(
        <p key={key++} className="font-semibold text-sm mt-2.5 mb-0.5 text-foreground">
          {renderInline(line.replace(/^#{2,3} /, ''))}
        </p>
      );
    }
    // Horizontal rule
    else if (/^---+$/.test(line.trim())) {
      flushList();
      result.push(<hr key={key++} className="border-border/50 my-2" />);
    }
    // Code block start/end
    else if (/^```/.test(line)) {
      flushList();
      // skip — handled below
    }
    // Bullet list
    else if (/^[\-\*\•] (.+)/.test(line)) {
      const content = line.replace(/^[\-\*\•] /, '');
      listItems.push(
        <li key={key++} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-muted-foreground mt-1.5 shrink-0">•</span>
          <span>{renderInline(content)}</span>
        </li>
      );
    }
    // Numbered list
    else if (/^\d+\. (.+)/.test(line)) {
      const match  = line.match(/^(\d+)\. (.+)/);
      const num    = match?.[1] || '';
      const content = match?.[2] || '';
      listItems.push(
        <li key={key++} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-muted-foreground shrink-0 font-medium w-4">{num}.</span>
          <span>{renderInline(content)}</span>
        </li>
      );
    }
    // Empty line
    else if (line.trim() === '') {
      flushList();
      if (result.length > 0) result.push(<div key={key++} className="h-1" />);
    }
    // Normal paragraph
    else {
      flushList();
      result.push(
        <p key={key++} className="text-sm leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  });

  flushList();
  return result;
}

// ─── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const time   = msg.timestamp instanceof Date
    ? msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={cn('flex gap-3 group', isUser ? 'justify-end' : 'justify-start')}>
      {/* Avatar Isa */}
      {!isUser && (
        <img
          src={isaAvatar}
          alt="Isa"
          className="h-8 w-8 rounded-full object-cover object-top shrink-0 mt-0.5 shadow-sm"
        />
      )}

      <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start', 'max-w-[78%]')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 shadow-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-card border border-border/50 text-foreground rounded-bl-sm'
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="space-y-1">{renderMarkdown(msg.content)}</div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground/50 px-1">{time}</span>
      </div>

      {/* Avatar User */}
      {isUser && (
        <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-primary" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

// ─── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <img src={isaAvatar} alt="Isa" className="h-8 w-8 rounded-full object-cover object-top shrink-0 mt-0.5" />
      <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay, i) => (
            <span
              key={i}
              className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Welcome Screen ────────────────────────────────────────────────────────────

function WelcomeScreen({
  suggestions,
  loadingSuggestions,
  onSuggestion,
}: {
  suggestions: DynamicSuggestion[];
  loadingSuggestions: boolean;
  onSuggestion: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
      {/* Avatar */}
      <div className="relative mb-6">
        <img
          src={isaAvatar}
          alt="Isa"
          className="h-20 w-20 rounded-full object-cover object-top border-2 border-primary/20 shadow-lg"
        />
        <span className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 rounded-full border-2 border-card flex items-center justify-center">
          <span className="h-2 w-2 bg-white rounded-full" />
        </span>
      </div>

      <h2 className="text-xl font-bold text-foreground mb-1">Olá! Sou a Isa 👋</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-8">
        Sua assistente jurídica. Posso ajudar com leads, processos, agenda, tarefas e muito mais.
      </p>

      {/* Sugestões dinâmicas */}
      <div className="w-full max-w-lg space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {loadingSuggestions ? 'Carregando contexto...' : 'O que posso fazer por você agora'}
        </p>

        {loadingSuggestions ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestions.map((s, i) => {
              const Icon = s.icon;
              return (
                <button
                  key={i}
                  onClick={() => onSuggestion(s.prompt)}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:bg-accent/30 transition-all text-left group shadow-sm"
                >
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-tight">{s.label}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function IsaChat() {
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID());
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState('');
  const [isLoading,      setIsLoading]      = useState(false);
  const [threadId,       setThreadId]       = useState<string | null>(null);
  const [conversations,  setConversations]  = useState<SavedConversation[]>([]);

  // Dynamic suggestions
  const [suggestions,        setSuggestions]        = useState<DynamicSuggestion[]>(defaultSuggestions());
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [systemContext,      setSystemContext]       = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const { toast }      = useToast();

  // Load history
  useEffect(() => {
    setConversations(getConversations(STORAGE_KEY));
  }, []);

  // Load context + build dynamic suggestions on mount
  useEffect(() => {
    const loadContext = async () => {
      setLoadingSuggestions(true);
      try {
        const { data } = await supabase.functions.invoke('isa-system-data');
        if (data && !data.error) {
          setSystemContext(formatSystemContext(data));
          setSuggestions(buildDynamicSuggestions(data));
        }
      } catch { /* keep defaults */ }
      finally { setLoadingSuggestions(false); }
    };
    loadContext();
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, isLoading, scrollToBottom]);
  useEffect(() => { if (!isLoading) inputRef.current?.focus(); }, [isLoading]);

  // Auto-save
  useEffect(() => {
    if (messages.length > 0) {
      const conv: SavedConversation = {
        id: conversationId,
        title: generateConversationTitle(messages),
        messages,
        threadId,
        createdAt: new Date(),
        updatedAt: new Date(),
        preview: generatePreview(messages),
      };
      saveConversation(STORAGE_KEY, conv);
      setConversations(getConversations(STORAGE_KEY));
    }
  }, [messages, threadId, conversationId]);

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setTimeout(scrollToBottom, 50);

    try {
      // Refresh context if empty
      let ctx = systemContext;
      if (!ctx) {
        try {
          const { data } = await supabase.functions.invoke('isa-system-data');
          if (data && !data.error) ctx = formatSystemContext(data);
        } catch { /* ignore */ }
      }

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: text + ctx,
          threadId,
          assistantId: ASSISTANT_ID,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.threadId && !threadId) setThreadId(data.threadId);

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      }]);
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro ao enviar mensagem',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const startNewChat = () => {
    setConversationId(crypto.randomUUID());
    setMessages([]);
    setThreadId(null);
    inputRef.current?.focus();
  };

  const loadConversation = (conv: SavedConversation) => {
    setConversationId(conv.id);
    setMessages(conv.messages);
    setThreadId(conv.threadId);
  };

  const handleDelete = (id: string) => {
    deleteConversation(STORAGE_KEY, id);
    setConversations(getConversations(STORAGE_KEY));
    if (id === conversationId) startNewChat();
    toast({ title: 'Conversa excluída' });
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-180px)] px-6 pb-6 pt-4">
      <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-background shadow-sm">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={isaAvatar} alt="Isa" className="h-9 w-9 rounded-full object-cover object-top border border-border" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 rounded-full border-2 border-card" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-tight">Isa</p>
              <p className="text-[11px] text-muted-foreground">
                {isLoading ? (
                  <span className="flex items-center gap-1 text-primary">
                    <span className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse" />
                    Digitando...
                  </span>
                ) : 'Assistente do escritório'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <ChatHistory
              storageKey={STORAGE_KEY}
              currentConversationId={conversationId}
              onLoadConversation={loadConversation}
              onDeleteConversation={handleDelete}
              conversations={conversations}
            />
            {messages.length > 0 && (
              <Button
                variant="ghost" size="sm"
                onClick={startNewChat}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8 rounded-xl"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova
              </Button>
            )}
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <WelcomeScreen
              suggestions={suggestions}
              loadingSuggestions={loadingSuggestions}
              onSuggestion={text => sendMessage(text)}
            />
          ) : (
            <div className="px-5 py-5 space-y-5">
              {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input ── */}
        <div className="border-t border-border/50 p-4 bg-card shrink-0">
          {/* Sugestões rápidas durante conversa */}
          {messages.length > 0 && !isLoading && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
              {quickReplies.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-all whitespace-nowrap"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte algo para a Isa..."
                disabled={isLoading}
                className="w-full h-11 px-4 rounded-2xl bg-muted/40 border border-border/50 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all disabled:opacity-50"
              />
            </div>
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-11 w-11 rounded-2xl shrink-0 shadow-sm"
            >
              {isLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              }
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 text-center mt-2">
            Pressione Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>

      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const quickReplies = [
  'Resumir o dia',
  'Tarefas urgentes',
  'Próximos compromissos',
  'Leads sem follow-up',
  'Processos atualizados hoje',
];

function defaultSuggestions(): DynamicSuggestion[] {
  return [
    { icon: Sparkles,    label: 'Resumir o dia de hoje',          prompt: 'Faça um resumo do dia: tarefas, compromissos e pendências mais importantes.',  color: 'bg-primary/10 text-primary'         },
    { icon: Clock,       label: 'Ver tarefas urgentes',           prompt: 'Quais são as tarefas urgentes e de alta prioridade pendentes?',                 color: 'bg-red-500/10 text-red-600'         },
    { icon: Calendar,    label: 'Agenda dos próximos dias',       prompt: 'Quais são os compromissos e audiências dos próximos 7 dias?',                   color: 'bg-blue-500/10 text-blue-600'       },
    { icon: FileText,    label: 'Processos com novidade',         prompt: 'Quais processos tiveram movimentação recente ou precisam de atenção?',          color: 'bg-amber-500/10 text-amber-600'     },
    { icon: AlertCircle, label: 'Follow-ups pendentes',           prompt: 'Quais leads precisam de follow-up hoje ou estão atrasados?',                   color: 'bg-purple-500/10 text-purple-600'   },
    { icon: User,        label: 'Ajuda com cadastro de cliente',  prompt: 'Como faço para cadastrar um novo cliente/lead no sistema?',                    color: 'bg-emerald-500/10 text-emerald-600' },
  ];
}

function buildDynamicSuggestions(data: any): DynamicSuggestion[] {
  const suggestions: DynamicSuggestion[] = [];

  // Tarefas urgentes
  const urgentes = data.tarefas?.filter((t: any) => t.prioridade === 'Urgente' || t.prioridade === 'Alta') || [];
  if (urgentes.length > 0) {
    suggestions.push({
      icon: AlertCircle,
      label: `${urgentes.length} tarefa${urgentes.length > 1 ? 's' : ''} urgente${urgentes.length > 1 ? 's' : ''} pendente${urgentes.length > 1 ? 's' : ''}`,
      prompt: `Quais são as ${urgentes.length} tarefas urgentes/alta prioridade pendentes? Me dê detalhes de cada uma.`,
      color: 'bg-red-500/10 text-red-600',
    });
  }

  // Compromissos hoje
  const hoje = new Date().toLocaleDateString('pt-BR');
  const compHoje = data.compromissos?.filter((c: any) => c.data?.includes(hoje.split('/').reverse().join('-')) || c.data === hoje) || [];
  if (compHoje.length > 0) {
    suggestions.push({
      icon: Calendar,
      label: `${compHoje.length} compromisso${compHoje.length > 1 ? 's' : ''} hoje`,
      prompt: `Quais são os compromissos de hoje? Me dê os detalhes completos.`,
      color: 'bg-blue-500/10 text-blue-600',
    });
  }

  // Follow-ups pendentes
  if (data.resumo?.totalFollowupsPendentes > 0) {
    suggestions.push({
      icon: Clock,
      label: `${data.resumo.totalFollowupsPendentes} follow-up${data.resumo.totalFollowupsPendentes > 1 ? 's' : ''} pendente${data.resumo.totalFollowupsPendentes > 1 ? 's' : ''}`,
      prompt: 'Quais leads precisam de follow-up? Liste em ordem de prioridade.',
      color: 'bg-amber-500/10 text-amber-600',
    });
  }

  // Resumo do dia sempre presente
  suggestions.push({
    icon: Sparkles,
    label: 'Resumo completo do dia',
    prompt: 'Faça um resumo executivo do dia: tarefas urgentes, compromissos, follow-ups e eventos recentes.',
    color: 'bg-primary/10 text-primary',
  });

  // Processos ativos
  if (data.resumo?.totalProcessosAtivos > 0) {
    suggestions.push({
      icon: FileText,
      label: `${data.resumo.totalProcessosAtivos} processos ativos`,
      prompt: 'Quais processos tiveram movimentação recente ou precisam de atenção?',
      color: 'bg-purple-500/10 text-purple-600',
    });
  }

  // Leads
  if (data.resumo?.totalLeads > 0) {
    suggestions.push({
      icon: User,
      label: `${data.resumo.totalLeads} leads no sistema`,
      prompt: 'Quais leads estão sem contato há mais tempo ou precisam de atenção imediata?',
      color: 'bg-emerald-500/10 text-emerald-600',
    });
  }

  // Fallback se poucas sugestões
  if (suggestions.length < 4) {
    const defaults = defaultSuggestions();
    for (const d of defaults) {
      if (suggestions.length >= 6) break;
      if (!suggestions.find(s => s.label === d.label)) suggestions.push(d);
    }
  }

  return suggestions.slice(0, 6);
}

function formatSystemContext(data: any): string {
  if (!data || data.error) return '';
  const parts: string[] = [];
  parts.push(`📅 DATA/HORA ATUAL: ${data.dataConsulta} (${data.fusoHorario})`);
  parts.push(`\n📊 RESUMO DO SISTEMA:`);
  parts.push(`- ${data.resumo.totalLeads} leads (${Object.entries(data.resumo.leadsPorStatus || {}).map(([k, v]) => `${k}: ${v}`).join(', ')})`);
  parts.push(`- ${data.resumo.totalProcessosAtivos} processos ativos`);
  parts.push(`- ${data.resumo.totalTarefasPendentes} tarefas pendentes`);
  parts.push(`- ${data.resumo.totalCompromissosProximos7Dias} compromissos nos próximos 7 dias`);
  parts.push(`- ${data.resumo.totalParcelasPendentes} parcelas pendentes`);
  parts.push(`- ${data.resumo.totalFollowupsPendentes} follow-ups pendentes`);
  parts.push(`- ${data.resumo.totalEventosUltimas24h} eventos nas últimas 24h`);
  if (data.compromissos?.length > 0) {
    parts.push(`\n📅 AGENDA (próximos 7 dias):`);
    data.compromissos.slice(0, 10).forEach((c: any) => {
      parts.push(`- ${c.data} ${c.horarioInicio}: ${c.titulo}${c.cliente ? ` (${c.cliente})` : ''} [${c.tipo}]`);
    });
  }
  const urgentes = data.tarefas?.filter((t: any) => t.prioridade === 'Urgente' || t.prioridade === 'Alta') || [];
  if (urgentes.length > 0) {
    parts.push(`\n🔴 TAREFAS URGENTES/ALTA PRIORIDADE:`);
    urgentes.slice(0, 5).forEach((t: any) => {
      parts.push(`- [${t.prioridade}] ${t.titulo}${t.dataLimite ? ` (prazo: ${t.dataLimite})` : ''}${t.cliente ? ` - ${t.cliente}` : ''}`);
    });
  }
  if (data.followupsPendentes?.length > 0) {
    parts.push(`\n📞 FOLLOW-UPS PENDENTES:`);
    data.followupsPendentes.slice(0, 5).forEach((f: any) => {
      parts.push(`- ${f.cliente}: ${f.tipo} tentativa ${f.tentativa} (próximo: ${f.proximoFollowup})`);
    });
  }
  const eventosImp = data.eventosRecentes?.filter((e: any) => ['contrato','lead_status','agendamento','tarefa'].includes(e.tipo)) || [];
  if (eventosImp.length > 0) {
    parts.push(`\n🔔 EVENTOS RECENTES (últimas 24h):`);
    eventosImp.slice(0, 8).forEach((e: any) => {
      parts.push(`- [${e.fonte}] ${e.acao}${e.cliente ? ` - ${e.cliente}` : ''} (${e.data})`);
    });
  }
  if (data.acoesPendentesIsa?.length > 0) {
    parts.push(`\n🤖 AÇÕES PENDENTES (aguardando aprovação):`);
    data.acoesPendentesIsa.forEach((a: any) => {
      parts.push(`- [${a.tipo}] ${a.titulo}${a.cliente ? ` - ${a.cliente}` : ''}`);
    });
  }
  parts.push(`\n⚙️ REGRAS DE AGENDAMENTO:`);
  parts.push(`- Dias: ${data.regrasAgendamento?.diasPermitidos?.join(', ')}`);
  parts.push(`- Horários: ${data.regrasAgendamento?.horariosPermitidos}`);
  parts.push(`- Duração padrão: ${data.regrasAgendamento?.duracao}`);
  return `\n\n[CONTEXTO DO SISTEMA - DADOS EM TEMPO REAL]\n${parts.join('\n')}\n[FIM DO CONTEXTO]`;
}
