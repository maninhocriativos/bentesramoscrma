import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, MessageSquare, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface SavedConversation {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  threadId: string | null;
  createdAt: Date;
  updatedAt: Date;
  preview: string;
}

interface ChatHistoryProps {
  storageKey: string;
  currentConversationId: string | null;
  onLoadConversation: (conversation: SavedConversation) => void;
  onDeleteConversation: (id: string) => void;
  conversations: SavedConversation[];
}

export function ChatHistory({
  storageKey,
  currentConversationId,
  onLoadConversation,
  onDeleteConversation,
  conversations,
}: ChatHistoryProps) {
  const [open, setOpen] = useState(false);

  const handleLoad = (conversation: SavedConversation) => {
    onLoadConversation(conversation);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <History className="h-4 w-4" strokeWidth={1.5} />
          Histórico
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[350px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Conversas
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-4">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">
                Nenhuma conversa salva ainda
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    "group relative p-3 rounded-lg border cursor-pointer transition-colors",
                    currentConversationId === conversation.id
                      ? "bg-primary/5 border-primary/20"
                      : "hover:bg-muted/50 border-transparent hover:border-border"
                  )}
                  onClick={() => handleLoad(conversation)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">
                        {conversation.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {conversation.preview}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-2">
                        {format(new Date(conversation.updatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conversation.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// Helper functions for managing conversation history
export function getConversations(storageKey: string): SavedConversation[] {
  const saved = localStorage.getItem(`${storageKey}-history`);
  if (saved) {
    try {
      return JSON.parse(saved).map((c: any) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        messages: c.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      }));
    } catch {
      return [];
    }
  }
  return [];
}

export function saveConversation(
  storageKey: string,
  conversation: SavedConversation
): void {
  const conversations = getConversations(storageKey);
  const existingIndex = conversations.findIndex((c) => c.id === conversation.id);
  
  if (existingIndex >= 0) {
    conversations[existingIndex] = conversation;
  } else {
    conversations.unshift(conversation);
  }
  
  // Manter apenas as últimas 20 conversas
  const trimmed = conversations.slice(0, 20);
  localStorage.setItem(`${storageKey}-history`, JSON.stringify(trimmed));
}

export function deleteConversation(storageKey: string, id: string): void {
  const conversations = getConversations(storageKey);
  const filtered = conversations.filter((c) => c.id !== id);
  localStorage.setItem(`${storageKey}-history`, JSON.stringify(filtered));
}

export function generateConversationTitle(messages: Array<{ content: string; role: string }>): string {
  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (firstUserMessage) {
    const content = firstUserMessage.content;
    return content.length > 40 ? content.substring(0, 40) + '...' : content;
  }
  return 'Nova conversa';
}

export function generatePreview(messages: Array<{ content: string; role: string }>): string {
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  if (lastAssistantMessage) {
    const content = lastAssistantMessage.content;
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }
  return 'Sem resposta ainda';
}
