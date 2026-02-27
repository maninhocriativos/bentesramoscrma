import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronDown, Star, StarOff, Trash2, Forward, Copy, Reply, Pencil, Pin, PinOff, CheckSquare, Flag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MessageContextMenuProps {
  messageId: string;
  messageContent: string;
  messageType?: string;
  isOutgoing: boolean;
  isStarred: boolean;
  isPinned?: boolean;
  isSelected?: boolean;
  isDark: boolean;
  isEdited?: boolean;
  onStar: (messageId: string) => void;
  onUnstar: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
  onSelect?: (messageId: string) => void;
  onReport?: (messageId: string) => void;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForAll: (messageId: string) => void;
  onForward: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
}

export function MessageContextMenu({
  messageId,
  messageContent,
  messageType = 'text',
  isOutgoing,
  isStarred,
  isPinned = false,
  isSelected = false,
  isDark,
  onStar,
  onUnstar,
  onPin,
  onUnpin,
  onSelect,
  onReport,
  onDeleteForMe,
  onDeleteForAll,
  onForward,
  onReply,
  onEdit,
}: MessageContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<'forMe' | 'forAll' | null>(null);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(messageContent);
    toast({ title: '📋 Texto copiado!' });
    setOpen(false);
  };

  const canEdit = isOutgoing && messageType === 'text' && !messageContent.startsWith('🚫');

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Abrir opções da mensagem"
            className={`absolute top-1 z-20 ${isOutgoing ? 'right-1' : 'left-1'} opacity-90 transition-all p-1.5 rounded-md shadow-sm ${
              isDark ? 'bg-black/25 hover:bg-black/40 text-white/90' : 'bg-white/75 hover:bg-white text-black/60'
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
          {canEdit && onEdit && (
            <DropdownMenuItem onClick={() => { onEdit(messageId); setOpen(false); }}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
          )}
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
          {isPinned ? (
            <DropdownMenuItem onClick={() => { onUnpin?.(messageId); setOpen(false); }}>
              <PinOff className="h-4 w-4 mr-2" />
              Desfixar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => { onPin?.(messageId); setOpen(false); }}>
              <Pin className="h-4 w-4 mr-2" />
              Fixar
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => { onSelect?.(messageId); setOpen(false); }}>
            <CheckSquare className="h-4 w-4 mr-2" />
            {isSelected ? 'Desselecionar' : 'Selecionar'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { onReport?.(messageId); setOpen(false); }}>
            <Flag className="h-4 w-4 mr-2" />
            Denunciar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => { setOpen(false); setDeleteDialog('forMe'); }}
            className="text-red-500 focus:text-red-500"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Apagar para mim
          </DropdownMenuItem>
          {isOutgoing && (
            <DropdownMenuItem 
              onClick={() => { setOpen(false); setDeleteDialog('forAll'); }}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Apagar para todos
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialog !== null} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog === 'forAll' ? 'Apagar para todos?' : 'Apagar para você?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog === 'forAll'
                ? 'Esta mensagem será apagada para todos os participantes da conversa. Essa ação não pode ser desfeita.'
                : 'A mensagem será removida apenas da sua visualização. Os outros participantes ainda poderão vê-la.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteDialog === 'forAll') {
                  onDeleteForAll(messageId);
                } else {
                  onDeleteForMe(messageId);
                }
                setDeleteDialog(null);
              }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
