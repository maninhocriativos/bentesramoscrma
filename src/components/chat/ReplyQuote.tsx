import { X } from 'lucide-react';
import { ChatMessage } from '@/hooks/useChatMessages';
import { cn } from '@/lib/utils';

interface ReplyQuoteProps {
  message: ChatMessage;
  onClear: () => void;
  variant?: 'input' | 'bubble';
}

export function ReplyQuote({ message, onClear, variant = 'input' }: ReplyQuoteProps) {
  const isSent = message.direcao === 'saida';
  const senderName = isSent ? 'Você' : (message.subscriber_nome || 'Cliente');
  
  // Truncate content
  const maxLength = variant === 'bubble' ? 80 : 120;
  const truncatedContent = message.conteudo.length > maxLength 
    ? message.conteudo.slice(0, maxLength) + '...'
    : message.conteudo;

  if (variant === 'bubble') {
    return (
      <div 
        className={cn(
          "mb-1 px-2 py-1.5 rounded-md text-xs border-l-4",
          isSent 
            ? "bg-white/10 border-[#53BDEB]" 
            : "bg-black/5 border-[#00A884]"
        )}
      >
        <p className={cn(
          "font-medium text-[11px] mb-0.5",
          isSent ? "text-[#53BDEB]" : "text-[#00A884]"
        )}>
          {senderName}
        </p>
        <p className="opacity-70 line-clamp-2 whitespace-pre-wrap">
          {truncatedContent}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 p-2 mb-2 rounded-lg bg-black/5 dark:bg-white/5 border-l-4 border-[#00A884]">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#00A884] mb-0.5">
          Respondendo a {senderName}
        </p>
        <p className="text-sm opacity-70 truncate">
          {truncatedContent}
        </p>
      </div>
      <button
        onClick={onClear}
        className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
