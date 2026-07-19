import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, UserRound, Send, Users } from 'lucide-react';
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
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <UserRound className="h-4 w-4 text-primary" />
            </div>
            Enviar contato
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-full bg-muted/40 border-transparent focus-visible:border-primary focus-visible:bg-background transition-colors"
            />
          </div>
          {filtered.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2.5 px-1">
              {filtered.length} {filtered.length === 1 ? 'contato encontrado' : 'contatos encontrados'}
            </p>
          )}
        </div>

        <ScrollArea className="max-h-[360px]">
          <div className="px-2 pb-3 space-y-0.5">
            {filtered.map(contact => (
              <button
                key={contact.id}
                onClick={() => handleSend(contact)}
                disabled={sending}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none group"
              >
                <Avatar className="h-11 w-11 shrink-0 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                  <AvatarImage src={contact.foto} />
                  <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                    {(contact.nome || '?').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">{contact.nome || 'Sem nome'}</p>
                  <p className="text-xs text-muted-foreground truncate">{contact.telefone}</p>
                </div>
                <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Send className="h-3.5 w-3.5" />
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 px-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-1">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Nenhum contato encontrado</p>
                <p className="text-xs text-muted-foreground text-center">
                  Tente pesquisar por outro nome ou número
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
