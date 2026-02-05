import { CrmMessage } from '@/types/metaFormLeads';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, User, Bot, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MetaLeadMessageHistoryProps {
  messages: CrmMessage[];
  loading: boolean;
}

export function MetaLeadMessageHistory({ messages, loading }: MetaLeadMessageHistoryProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma mensagem registrada</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px] pr-2">
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
                  "max-w-[85%] rounded-2xl px-3 py-2",
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
                  {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
