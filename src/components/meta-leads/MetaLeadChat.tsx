import { useState, useRef, useEffect } from 'react';
import { CrmMessage } from '@/types/metaFormLeads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, ArrowLeft, User, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MetaLeadChatProps {
  leadName: string;
  messages: CrmMessage[];
  loading: boolean;
  sending: boolean;
  onSend: (text: string) => void;
  onBack: () => void;
}

export function MetaLeadChat({ leadName, messages, loading, sending, onSend, onBack }: MetaLeadChatProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !sending) {
      onSend(inputValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-3 border-b bg-card flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{leadName || 'Chat'}</h3>
          <p className="text-xs text-muted-foreground">Central de Atendimento CRM</p>
        </div>
        <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700">
          FORM META
        </Badge>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>Inicie a conversa com o lead</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isAgent = msg.sender_type === 'agent';
              const isSystem = msg.sender_name === 'Sistema';
              
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    isAgent ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2 relative",
                      isAgent 
                        ? isSystem 
                          ? "bg-muted text-muted-foreground" 
                          : "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {!isAgent && (
                      <div className="flex items-center gap-1 mb-1">
                        <User className="h-3 w-3" />
                        <span className="text-[10px] font-medium">
                          {msg.sender_name || 'Cliente'}
                        </span>
                      </div>
                    )}
                    {isAgent && !isSystem && (
                      <div className="flex items-center gap-1 mb-1 opacity-80">
                        <Bot className="h-3 w-3" />
                        <span className="text-[10px]">
                          {msg.sender_name || 'Atendente'}
                        </span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <p className={cn(
                      "text-[10px] mt-1 text-right",
                      isAgent && !isSystem ? "opacity-70" : "text-muted-foreground"
                    )}>
                      {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3 border-t bg-card">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !inputValue.trim()}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          💡 Mensagens ficam registradas no CRM. Envio externo (WhatsApp/Email) em breve.
        </p>
      </div>
    </div>
  );
}
