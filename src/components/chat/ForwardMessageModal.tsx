import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Forward, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Subscriber {
  id: string;
  subscriber_id: string;
  nome: string;
  foto?: string;
  telefone?: string;
}

interface ForwardMessageModalProps {
  open: boolean;
  onClose: () => void;
  subscribers: Subscriber[];
  messageContent: string;
  onForward: (subscriberIds: string[]) => Promise<void>;
}

export function ForwardMessageModal({
  open,
  onClose,
  subscribers,
  messageContent,
  onForward,
}: ForwardMessageModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return subscribers;
    const term = search.toLowerCase();
    return subscribers.filter(s =>
      s.nome?.toLowerCase().includes(term) ||
      s.telefone?.includes(search)
    );
  }, [subscribers, search]);

  const toggleSelect = (subscriberId: string) => {
    setSelected(prev =>
      prev.includes(subscriberId)
        ? prev.filter(id => id !== subscriberId)
        : [...prev, subscriberId]
    );
  };

  const handleForward = async () => {
    if (selected.length === 0) return;
    setSending(true);
    try {
      await onForward(selected);
      onClose();
      setSelected([]);
      setSearch('');
    } finally {
      setSending(false);
    }
  };

  const preview = messageContent.length > 120
    ? messageContent.slice(0, 120) + '...'
    : messageContent;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="h-5 w-5" />
            Encaminhar mensagem
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground border">
          <p className="line-clamp-3">{preview}</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Contacts list */}
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-1">
            {filtered.map(sub => {
              const isSelected = selected.includes(sub.subscriber_id);
              return (
                <button
                  key={sub.id}
                  onClick={() => toggleSelect(sub.subscriber_id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={sub.foto} />
                    <AvatarFallback className="text-xs bg-primary/20">
                      {(sub.nome || '?').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium truncate">{sub.nome || sub.telefone}</p>
                    {sub.telefone && (
                      <p className="text-xs text-muted-foreground">{sub.telefone}</p>
                    )}
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Send button */}
        <Button
          onClick={handleForward}
          disabled={selected.length === 0 || sending}
          className="w-full bg-[#00A884] hover:bg-[#008069] text-white"
        >
          <Forward className="h-4 w-4 mr-2" />
          {sending
            ? 'Enviando...'
            : `Encaminhar${selected.length > 0 ? ` (${selected.length})` : ''}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
