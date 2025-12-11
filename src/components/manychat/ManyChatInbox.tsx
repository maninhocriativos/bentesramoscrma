import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, 
  Search, 
  MessageSquare, 
  Phone, 
  Mail, 
  RefreshCw,
  Instagram,
  Facebook,
  MessageCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Subscriber {
  id: string;
  nome: string;
  foto?: string;
  canal: string;
  ultimaMensagem?: string;
  telefone?: string;
  email?: string;
}

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  isFromUser: boolean;
}

const ManyChatInbox = () => {
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadSubscribers();
  }, []);

  const loadSubscribers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manychat', {
        body: { action: 'buscar_conversas' },
      });

      if (error) throw error;

      if (data.status === 'success' && data.data) {
        setSubscribers(data.data);
      } else if (data.status === 'error') {
        throw new Error(data.error || 'Erro ao carregar contatos');
      }
    } catch (error) {
      console.error('Erro ao carregar subscribers:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os contatos do ManyChat',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedSubscriber) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('manychat', {
        body: {
          action: 'enviar_mensagem',
          subscriberId: selectedSubscriber.id,
          message: newMessage,
        },
      });

      if (error) throw error;

      if (data.status === 'success') {
        // Adiciona mensagem localmente
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            content: newMessage,
            timestamp: new Date(),
            isFromUser: false,
          },
        ]);
        setNewMessage('');
        toast({
          title: 'Mensagem enviada',
          description: `Mensagem enviada para ${selectedSubscriber.nome}`,
        });
      } else {
        throw new Error(data.error || 'Erro ao enviar mensagem');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a mensagem',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const getChannelIcon = (canal: string) => {
    switch (canal?.toLowerCase()) {
      case 'instagram':
        return <Instagram className="h-4 w-4 text-pink-500" />;
      case 'whatsapp':
        return <MessageCircle className="h-4 w-4 text-green-500" />;
      case 'messenger':
      case 'facebook':
      default:
        return <Facebook className="h-4 w-4 text-blue-500" />;
    }
  };

  const getChannelColor = (canal: string) => {
    switch (canal?.toLowerCase()) {
      case 'instagram':
        return 'bg-pink-500/10 text-pink-500';
      case 'whatsapp':
        return 'bg-green-500/10 text-green-500';
      case 'messenger':
      case 'facebook':
      default:
        return 'bg-blue-500/10 text-blue-500';
    }
  };

  const filteredSubscribers = subscribers.filter(sub =>
    sub.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.telefone?.includes(searchTerm) ||
    sub.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* Lista de Contatos */}
      <Card className="w-80 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversas
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadSubscribers}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contatos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            {filteredSubscribers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {isLoading ? 'Carregando...' : 'Nenhum contato encontrado'}
              </div>
            ) : (
              <div className="divide-y">
                {filteredSubscribers.map((subscriber) => (
                  <div
                    key={subscriber.id}
                    onClick={() => setSelectedSubscriber(subscriber)}
                    className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedSubscriber?.id === subscriber.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={subscriber.foto} />
                        <AvatarFallback>
                          {subscriber.nome?.substring(0, 2).toUpperCase() || '??'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{subscriber.nome}</p>
                          {getChannelIcon(subscriber.canal)}
                        </div>
                        {subscriber.ultimaMensagem && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(subscriber.ultimaMensagem), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Área de Chat */}
      <Card className="flex-1 flex flex-col">
        {selectedSubscriber ? (
          <>
            {/* Header do Chat */}
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedSubscriber.foto} />
                    <AvatarFallback>
                      {selectedSubscriber.nome?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedSubscriber.nome}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary" className={getChannelColor(selectedSubscriber.canal)}>
                        {selectedSubscriber.canal || 'Facebook'}
                      </Badge>
                      {selectedSubscriber.telefone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedSubscriber.telefone}
                        </span>
                      )}
                      {selectedSubscriber.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {selectedSubscriber.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* Mensagens */}
            <CardContent className="flex-1 p-4 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Inicie uma conversa com {selectedSubscriber.nome}</p>
                      <p className="text-sm">As mensagens enviadas aparecerão aqui</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.isFromUser ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            message.isFromUser
                              ? 'bg-muted'
                              : 'bg-primary text-primary-foreground'
                          }`}
                        >
                          <p>{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            message.isFromUser ? 'text-muted-foreground' : 'text-primary-foreground/70'
                          }`}>
                            {format(message.timestamp, "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>
            </CardContent>

            {/* Input de Mensagem */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={isSending}
                />
                <Button onClick={sendMessage} disabled={isSending || !newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Selecione uma conversa</p>
              <p className="text-sm">Escolha um contato para visualizar e responder mensagens</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ManyChatInbox;
