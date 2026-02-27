import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, UserRound, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Contact {
  id: string;
  subscriber_id: string;
  nome: string;
  foto?: string;
  telefone?: string;
}

interface SendContactModalProps {
  open: boolean;
  onClose: () => void;
  contacts: Contact[];
  onSend: (contact: Contact) => Promise<void>;
}

export function SendContactModal({ open, onClose, contacts, onSend }: SendContactModalProps) {
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return contacts.filter(c => c.telefone);
    const term = search.toLowerCase();
    return contacts.filter(c =>
      c.telefone &&
      (c.nome?.toLowerCase().includes(term) || c.telefone?.includes(search))
    );
  }, [contacts, search]);

  const handleSend = async (contact: Contact) => {
    setSending(true);
    try {
      await onSend(contact);
      onClose();
      setSearch('');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5" />
            Enviar contato
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="max-h-[350px]">
          <div className="space-y-1">
            {filtered.map(contact => (
              <button
                key={contact.id}
                onClick={() => handleSend(contact)}
                disabled={sending}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={contact.foto} />
                  <AvatarFallback className="text-xs bg-primary/20">
                    {(contact.nome || '?').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">{contact.nome || 'Sem nome'}</p>
                  <p className="text-xs text-muted-foreground">{contact.telefone}</p>
                </div>
                <Send className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Nenhum contato encontrado
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
