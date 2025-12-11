import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Loader2, RotateCcw, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import isaAvatar from '@/assets/isa-avatar.png';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ASSISTANT_ID = 'asst_rGFHqXnOLL6JA7UyRUdXQmaQ';
const STORAGE_KEY_ISA = 'isa-chat-state';

export function IsaChat() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ISA);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.messages?.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })) || [];
      } catch { return []; }
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ISA);
    if (saved) {
      try {
        return JSON.parse(saved).threadId || null;
      } catch { return null; }
    }
    return null;
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Persistir estado
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ISA, JSON.stringify({ messages, threadId }));
  }, [messages, threadId]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

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
    
    // Manter foco no input
    setTimeout(() => inputRef.current?.focus(), 0);

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: userMessage.content,
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

  const clearChat = () => {
    setMessages([]);
    setThreadId(null);
    localStorage.removeItem(STORAGE_KEY_ISA);
  };

  return (
    <div className="flex-1 flex flex-col max-h-[calc(100vh-180px)]">
      <Card className="flex-1 flex flex-col overflow-hidden mx-6 mb-6 mt-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
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
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="gap-2 text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
              Nova conversa
            </Button>
          )}
        </div>

        {/* Messages */}
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full p-6" ref={scrollRef}>
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
              </div>
            )}
          </ScrollArea>
        </CardContent>

        {/* Input */}
        <div className="border-t p-4 bg-background">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              disabled={isLoading}
              className="flex-1 h-12 rounded-xl"
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
