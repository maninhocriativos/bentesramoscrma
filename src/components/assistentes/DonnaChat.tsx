import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Loader2, User, Plus, BarChart2, DollarSign, Users, FileText, TrendingUp, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import donnaAvatar from '@/assets/donna-avatar.png';
import {
  ChatHistory,
  SavedConversation,
  getConversations,
  saveConversation,
  deleteConversation,
  generateConversationTitle,
  generatePreview,
} from './ChatHistory';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const STORAGE_KEY = 'donna-chat';

const SUGGESTIONS = [
  { icon: BarChart2,   label: 'Relatório geral do escritório',   prompt: 'Gere um relatório completo do escritório: leads, processos, tarefas e financeiro.',        color: 'bg-blue-500/10 text-blue-600' },
  { icon: DollarSign,  label: 'Parcelas em atraso',               prompt: 'Quais clientes têm parcelas de honorários em atraso? Liste com valores e dias de atraso.',   color: 'bg-red-500/10 text-red-600' },
  { icon: Users,       label: 'Leads aguardando contrato',        prompt: 'Liste todos os leads que estão aguardando envio de contrato com tempo de espera.',            color: 'bg-amber-500/10 text-amber-600' },
  { icon: ListTodo,    label: 'Tarefas atrasadas',                prompt: 'Quais tarefas estão com prazo vencido e ainda não foram concluídas?',                        color: 'bg-orange-500/10 text-orange-600' },
  { icon: TrendingUp,  label: 'Indicadores de conversão',         prompt: 'Qual é a taxa de conversão de leads? Analise o funil completo.',                            color: 'bg-emerald-500/10 text-emerald-600' },
  { icon: FileText,    label: 'Processos sem atualização',        prompt: 'Quais processos não tiveram movimentação nos últimos 30 dias?',                              color: 'bg-purple-500/10 text-purple-600' },
];

const quickReplies = ['Detalhar por cliente', 'Resumo executivo', 'Criar tarefa', 'Exportar relatório'];

// ─── Markdown renderer (same logic as IsaChat) ─────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      result.push(<ul key={`ul-${key++}`} className="my-1.5 space-y-0.5 pl-1">{listItems}</ul>);
      listItems = [];
    }
  };

  const renderInline = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*)|(__(.+?)__)|(\*(.+?)\*)|(_(.+?)_)|(`(.+?)`)/g;
    let last = 0; let match;
    while ((match = regex.exec(str)) !== null) {
      if (match.index > last) parts.push(str.slice(last, match.index));
      if (match[1])      parts.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
      else if (match[3]) parts.push(<strong key={key++} className="font-semibold">{match[4]}</strong>);
      else if (match[5]) parts.push(<em key={key++} className="italic">{match[6]}</em>);
      else if (match[7]) parts.push(<em key={key++} className="italic">{match[8]}</em>);
      else if (match[9]) parts.push(<code key={key++} className="bg-muted/60 text-foreground px-1.5 py-0.5 rounded-md text-[11px] font-mono">{match[10]}</code>);
      last = match.index + match[0].length;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts;
  };

  lines.forEach(line => {
    if (/^# (.+)/.test(line))        { flushList(); result.push(<p key={key++} className="font-bold text-base mt-3 mb-1">{renderInline(line.replace(/^# /, ''))}</p>); }
    else if (/^#{2,3} (.+)/.test(line)) { flushList(); result.push(<p key={key++} className="font-semibold text-sm mt-2.5 mb-0.5">{renderInline(line.replace(/^#{2,3} /, ''))}</p>); }
    else if (/^---+$/.test(line.trim()))  { flushList(); result.push(<hr key={key++} className="border-border/50 my-2" />); }
    else if (/^[\-\*\•] (.+)/.test(line)) { listItems.push(<li key={key++} className="flex gap-2 text-sm leading-relaxed"><span className="text-muted-foreground mt-1.5 shrink-0">•</span><span>{renderInline(line.replace(/^[\-\*\•] /, ''))}</span></li>); }
    else if (/^\d+\. (.+)/.test(line)) {
      const m = line.match(/^(\d+)\. (.+)/);
      listItems.push(<li key={key++} className="flex gap-2 text-sm leading-relaxed"><span className="text-muted-foreground shrink-0 font-medium w-4">{m?.[1]}.</span><span>{renderInline(m?.[2] || '')}</span></li>);
    } else if (line.trim() === '') { flushList(); if (result.length > 0) result.push(<div key={key++} className="h-1" />); }
    else { flushList(); result.push(<p key={key++} className="text-sm leading-relaxed">{renderInline(line)}</p>); }
  });

  flushList();
  return result;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const time = (msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp))
    .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={cn('flex gap-3 group', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && <img src={donnaAvatar} alt="Donn@" className="h-8 w-8 rounded-full object-cover object-top shrink-0 mt-0.5 shadow-sm" />}
      <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start', 'max-w-[78%]')}>
        <div className={cn('rounded-2xl px-4 py-3 shadow-sm', isUser ? 'bg-[#0f1528] text-white rounded-br-sm' : 'bg-card border border-border/50 text-foreground rounded-bl-sm')}>
          {isUser ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p> : <div className="space-y-1">{renderMarkdown(msg.content)}</div>}
        </div>
        <span className="text-[10px] text-muted-foreground/50 px-1">{time}</span>
      </div>
      {isUser && (
        <div className="h-8 w-8 rounded-full bg-[#0f1528]/10 border border-[#0f1528]/20 flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-[#0f1528]" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <img src={donnaAvatar} alt="Donn@" className="h-8 w-8 rounded-full object-cover object-top shrink-0 mt-0.5" />
      <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay, i) => (
            <span key={i} className="h-2 w-2 bg-[#5b8dd9]/40 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ onSuggestion }: { onSuggestion: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
      <div className="relative mb-6">
        <img src={donnaAvatar} alt="Donn@" className="h-20 w-20 rounded-full object-cover object-top border-2 border-[#5b8dd9]/30 shadow-lg" />
        <span className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 rounded-full border-2 border-card flex items-center justify-center">
          <span className="h-2 w-2 bg-white rounded-full" />
        </span>
      </div>
      <h2 className="text-xl font-bold text-foreground mb-1">Olá! Sou a Donn@ 📊</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-8">
        Especialista em análise e dados do escritório. Transformo informações em decisões estratégicas.
      </p>
      <div className="w-full max-w-lg">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">O que posso analisar para você</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUGGESTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button key={i} onClick={() => onSuggestion(s.prompt)}
                className="flex items-start gap-3 p-3.5 rounded-2xl bg-card border border-border/50 hover:border-[#5b8dd9]/30 hover:bg-accent/30 transition-all text-left shadow-sm">
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-xs font-semibold text-foreground leading-tight pt-1.5">{s.label}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function DonnaChat() {
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID());
  const [messages,      setMessages]       = useState<Message[]>([]);
  const [input,         setInput]          = useState('');
  const [isLoading,     setIsLoading]      = useState(false);
  const [threadId,      setThreadId]       = useState<string | null>(null);
  const [conversations, setConversations]  = useState<SavedConversation[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const { toast }      = useToast();

  useEffect(() => { setConversations(getConversations(STORAGE_KEY)); }, []);

  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, isLoading, scrollToBottom]);
  useEffect(() => { if (!isLoading) inputRef.current?.focus(); }, [isLoading]);

  useEffect(() => {
    if (messages.length > 0) {
      const conv: SavedConversation = {
        id: conversationId, title: generateConversationTitle(messages), messages,
        threadId, createdAt: new Date(), updatedAt: new Date(), preview: generatePreview(messages),
      };
      saveConversation(STORAGE_KEY, conv);
      setConversations(getConversations(STORAGE_KEY));
    }
  }, [messages, threadId, conversationId]);

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() }]);
    setInput('');
    setIsLoading(true);
    setTimeout(scrollToBottom, 50);

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { message: text, threadId, persona: 'donna' },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      if (data.threadId && !threadId) setThreadId(data.threadId);
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: data.response, timestamp: new Date() }]);
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao enviar mensagem', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const startNewChat = () => { setConversationId(crypto.randomUUID()); setMessages([]); setThreadId(null); inputRef.current?.focus(); };

  const loadConversation = (conv: SavedConversation) => { setConversationId(conv.id); setMessages(conv.messages); setThreadId(conv.threadId); };

  const handleDelete = (id: string) => {
    deleteConversation(STORAGE_KEY, id);
    setConversations(getConversations(STORAGE_KEY));
    if (id === conversationId) startNewChat();
    toast({ title: 'Conversa excluída' });
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-180px)] px-6 pb-6 pt-4">
      <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-background shadow-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={donnaAvatar} alt="Donn@" className="h-9 w-9 rounded-full object-cover object-top border border-border" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 rounded-full border-2 border-card" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-tight">Donn@</p>
              <p className="text-[11px] text-muted-foreground">
                {isLoading
                  ? <span className="flex items-center gap-1 text-[#5b8dd9]"><span className="h-1.5 w-1.5 bg-[#5b8dd9] rounded-full animate-pulse" />Analisando...</span>
                  : 'Análise e dados do escritório'}
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
              <Button variant="ghost" size="sm" onClick={startNewChat}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8 rounded-xl">
                <Plus className="h-3.5 w-3.5" /> Nova
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0
            ? <WelcomeScreen onSuggestion={text => sendMessage(text)} />
            : (
              <div className="px-5 py-5 space-y-5">
                {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
                {isLoading && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            )}
        </div>

        {/* Input */}
        <div className="border-t border-border/50 p-4 bg-card shrink-0">
          {messages.length > 0 && !isLoading && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
              {quickReplies.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)}
                  className="shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-all whitespace-nowrap">
                  {q}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Peça uma análise, relatório ou insights..."
                disabled={isLoading}
                className="w-full h-11 px-4 rounded-2xl bg-muted/40 border border-border/50 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#5b8dd9]/30 focus:border-[#5b8dd9]/30 transition-all disabled:opacity-50"
              />
            </div>
            <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading} size="icon"
              className="h-11 w-11 rounded-2xl shrink-0 shadow-sm bg-[#0f1528] hover:bg-[#1a2540]">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
