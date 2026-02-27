import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Star, StarOff, Trash2, Forward, Copy, Reply } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MessageContextMenuProps {
  messageId: string;
  messageContent: string;
  isOutgoing: boolean;
  isStarred: boolean;
  isDark: boolean;
  onStar: (messageId: string) => void;
  onUnstar: (messageId: string) => void;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForAll: (messageId: string) => void;
  onForward: (messageId: string) => void;
  onReply?: (messageId: string) => void;
}

export function MessageContextMenu({
  messageId,
  messageContent,
  isOutgoing,
  isStarred,
  isDark,
  onStar,
  onUnstar,
  onDeleteForMe,
  onDeleteForAll,
  onForward,
  onReply,
}: MessageContextMenuProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(messageContent);
    toast({ title: '📋 Texto copiado!' });
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={`absolute top-1 ${isOutgoing ? 'left-1' : 'right-1'} opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md ${
            isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/5 text-black/40'
          }`}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isOutgoing ? 'start' : 'end'} className="w-48">
        {onReply && (
          <DropdownMenuItem onClick={() => { onReply(messageId); setOpen(false); }}>
            <Reply className="h-4 w-4 mr-2" />
            Responder
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => { onForward(messageId); setOpen(false); }}>
          <Forward className="h-4 w-4 mr-2" />
          Encaminhar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy}>
          <Copy className="h-4 w-4 mr-2" />
          Copiar
        </DropdownMenuItem>
        {isStarred ? (
          <DropdownMenuItem onClick={() => { onUnstar(messageId); setOpen(false); }}>
            <StarOff className="h-4 w-4 mr-2" />
            Desmarcar favorita
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => { onStar(messageId); setOpen(false); }}>
            <Star className="h-4 w-4 mr-2 text-yellow-500" />
            Marcar como favorita
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => { onDeleteForMe(messageId); setOpen(false); }}
          className="text-red-500 focus:text-red-500"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Apagar para mim
        </DropdownMenuItem>
        {isOutgoing && (
          <DropdownMenuItem 
            onClick={() => { onDeleteForAll(messageId); setOpen(false); }}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Apagar para todos
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
