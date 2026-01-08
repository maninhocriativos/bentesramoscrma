import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Loader2, RotateCcw, User, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ASSISTANT_ID = 'asst_rGFHqXnOLL6JA7UyRUdXQmaQ';
const STORAGE_KEY_ISA = 'isa-chat';

export function IsaChat() {
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Carregar histórico de conversas
  useEffect(() => {
    setConversations(getConversations(STORAGE_KEY_ISA));
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Foco inicial no input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-scroll quando mensagens mudam
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Foco no input quando termina de carregar
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  // Salvar conversa quando há mensagens
  useEffect(() => {
    if (messages.length > 0) {
      const conversation: SavedConversation = {
        id: conversationId,
        title: generateConversationTitle(messages),
        messages,
        threadId,
        createdAt: new Date(),
        updatedAt: new Date(),
        preview: generatePreview(messages),
      };
      saveConversation(STORAGE_KEY_ISA, conversation);
      setConversations(getConversations(STORAGE_KEY_ISA));
    }
  }, [messages, threadId, conversationId]);

  // Formata o contexto do sistema para enviar ao GPT
  const formatSystemContext = (data: any): string => {
    if (!data || data.error) return '';

    const parts: string[] = [];
    
    parts.push(`📅 DATA/HORA ATUAL: ${data.dataConsulta} (${data.fusoHorario})`);
    
    // Resumo geral
    parts.push(`\n📊 RESUMO DO SISTEMA:`);
    parts.push(`- ${data.resumo.totalLeads} leads (${Object.entries(data.resumo.leadsPorStatus).map(([k, v]) => `${k}: ${v}`).join(', ')})`);
    parts.push(`- ${data.resumo.totalProcessosAtivos} processos ativos`);
    parts.push(`- ${data.resumo.totalTarefasPendentes} tarefas pendentes`);
    parts.push(`- ${data.resumo.totalCompromissosProximos7Dias} compromissos nos próximos 7 dias`);
    parts.push(`- ${data.resumo.totalParcelasPendentes} parcelas pendentes`);
    parts.push(`- ${data.resumo.totalFollowupsPendentes} follow-ups pendentes`);
    parts.push(`- ${data.resumo.totalEventosUltimas24h} eventos nas últimas 24h`);

    // Compromissos próximos
    if (data.compromissos?.length > 0) {
      parts.push(`\n📅 AGENDA (próximos 7 dias):`);
      data.compromissos.slice(0, 10).forEach((c: any) => {
        parts.push(`- ${c.data} ${c.horarioInicio}: ${c.titulo}${c.cliente ? ` (${c.cliente})` : ''} [${c.tipo}]`);
      });
    }

    // Tarefas urgentes
    const tarefasUrgentes = data.tarefas?.filter((t: any) => t.prioridade === 'Urgente' || t.prioridade === 'Alta') || [];
    if (tarefasUrgentes.length > 0) {
      parts.push(`\n🔴 TAREFAS URGENTES/ALTA PRIORIDADE:`);
      tarefasUrgentes.slice(0, 5).forEach((t: any) => {
        parts.push(`- [${t.prioridade}] ${t.titulo}${t.dataLimite ? ` (prazo: ${t.dataLimite})` : ''}${t.cliente ? ` - ${t.cliente}` : ''}`);
      });
    }

    // Follow-ups pendentes
    if (data.followupsPendentes?.length > 0) {
      parts.push(`\n📞 FOLLOW-UPS PENDENTES:`);
      data.followupsPendentes.slice(0, 5).forEach((f: any) => {
        parts.push(`- ${f.cliente}: ${f.tipo} tentativa ${f.tentativa} (próximo: ${f.proximoFollowup})`);
      });
    }

    // Eventos recentes importantes
    const eventosImportantes = data.eventosRecentes?.filter((e: any) => 
      ['contrato', 'lead_status', 'agendamento', 'tarefa'].includes(e.tipo)
    ) || [];
    if (eventosImportantes.length > 0) {
      parts.push(`\n🔔 EVENTOS RECENTES (últimas 24h):`);
      eventosImportantes.slice(0, 8).forEach((e: any) => {
        parts.push(`- [${e.fonte}] ${e.acao}${e.cliente ? ` - ${e.cliente}` : ''} (${e.data})`);
      });
    }

    // Interações recentes
    if (data.interacoesRecentes?.length > 0) {
      parts.push(`\n💬 INTERAÇÕES RECENTES:`);
      data.interacoesRecentes.slice(0, 5).forEach((i: any) => {
        parts.push(`- ${i.data}: ${i.tipo} ${i.direcao === 'Entrada' ? '⬅️' : '➡️'} ${i.cliente}: ${i.resumo}`);
      });
    }

    // Ações pendentes da Isa
    if (data.acoesPendentesIsa?.length > 0) {
      parts.push(`\n🤖 AÇÕES PENDENTES (aguardando aprovação):`);
      data.acoesPendentesIsa.forEach((a: any) => {
        parts.push(`- [${a.tipo}] ${a.titulo}${a.cliente ? ` - ${a.cliente}` : ''}`);
      });
    }

    // Regras de agendamento
    parts.push(`\n⚙️ REGRAS DE AGENDAMENTO:`);
    parts.push(`- Dias: ${data.regrasAgendamento.diasPermitidos.join(', ')}`);
    parts.push(`- Horários: ${data.regrasAgendamento.horariosPermitidos}`);
    parts.push(`- Duração padrão: ${data.regrasAgendamento.duracao}`);

    return `\n\n[CONTEXTO DO SISTEMA - DADOS EM TEMPO REAL]\n${parts.join('\n')}\n[FIM DO CONTEXTO]`;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    setTimeout(scrollToBottom, 50);

    try {
      // Buscar contexto completo do sistema
      let systemContext = '';
      try {
        const { data: systemData } = await supabase.functions.invoke('isa-system-data');
        if (systemData && !systemData.error) {
          systemContext = formatSystemContext(systemData);
        }
      } catch (e) {
        console.log('Não foi possível buscar contexto do sistema:', e);
      }

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: userMessage.content + systemContext,
          threadId,
          assistantId: ASSISTANT_ID,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.threadId && !threadId) {
        setThreadId(data.threadId);
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao enviar mensagem',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    setConversationId(crypto.randomUUID());
    setMessages([]);
    setThreadId(null);
    inputRef.current?.focus();
  };

  const loadConversation = (conversation: SavedConversation) => {
    setConversationId(conversation.id);
    setMessages(conversation.messages);
    setThreadId(conversation.threadId);
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(STORAGE_KEY_ISA, id);
    setConversations(getConversations(STORAGE_KEY_ISA));
    
    if (id === conversationId) {
      startNewChat();
    }
    
    toast({
      title: 'Conversa excluída',
      description: 'A conversa foi removida do histórico.',
    });
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-180px)]">
      <Card className="flex-1 flex flex-col overflow-hidden mx-6 mb-6 mt-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <img 
              src={isaAvatar} 
              alt="Isa"
              className="h-10 w-10 rounded-full object-cover object-top border border-border"
            />
            <div>
              <h3 className="font-medium text-foreground">Isa</h3>
              <p className="text-xs text-muted-foreground">
                {isLoading ? 'Digitando...' : 'Assistente do escritório'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ChatHistory
              storageKey={STORAGE_KEY_ISA}
              currentConversationId={conversationId}
              onLoadConversation={loadConversation}
              onDeleteConversation={handleDeleteConversation}
              conversations={conversations}
            />
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={startNewChat} className="gap-2 text-muted-foreground hover:text-foreground">
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Nova conversa
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <CardContent className="flex-1 p-0 overflow-hidden">
          <div className="h-full overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <img 
                  src={isaAvatar} 
                  alt="Isa"
                  className="h-20 w-20 rounded-full object-cover object-top border-2 border-border shadow-lg mb-5"
                />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Olá! Sou a Isa
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  Estou aqui para ajudar com dúvidas sobre leads, processos, tarefas, agenda e muito mais.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    'Como cadastrar um lead?',
                    'Como funciona o financeiro?',
                    'Ajuda com a agenda',
                  ].map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setInput(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="text-xs rounded-full"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex gap-3',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <img 
                        src={isaAvatar} 
                        alt="Isa"
                        className="h-8 w-8 rounded-full object-cover object-top shrink-0"
                      />
                    )}
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-3 text-sm',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <span className={cn(
                        "text-[10px] mt-1 block",
                        msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}>
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {msg.role === 'user' && (
                      <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-secondary-foreground" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <img 
                      src={isaAvatar} 
                      alt="Isa"
                      className="h-8 w-8 rounded-full object-cover object-top shrink-0"
                    />
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </CardContent>

        {/* Input */}
        <div className="border-t p-4 bg-background shrink-0">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              disabled={isLoading}
              className="flex-1 h-12 rounded-xl"
              autoFocus
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-10 w-10 rounded-full"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2} />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
