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
  subscriber_id: string;
  nome: string;
  foto?: string;
  canal: string;
  ultima_interacao?: string;
  telefone?: string;
  email?: string;
  lead_id?: string;
}

interface Message {
  id: string;
  conteudo: string;
  created_at: string;
  direcao: 'entrada' | 'saida';
  tipo: string;
}

const ManyChatInbox = () => {
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Carregar subscribers inicialmente
  useEffect(() => {
    loadSubscribers();
  }, []);

  // Realtime para novas mensagens
  useEffect(() => {
    const messagesChannel = supabase
      .channel('manychat-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'manychat_mensagens',
        },
        (payload) => {
          console.log('🔔 Nova mensagem recebida em tempo real:', payload);
          const newMsg = payload.new as Message & { subscriber_id: string };
          
          // Se for do subscriber selecionado, adicionar à lista imediatamente
          if (selectedSubscriber && newMsg.subscriber_id === selectedSubscriber.subscriber_id) {
            setMessages(prev => {
              // Evitar duplicatas
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
          
          // Atualizar lista de subscribers para mostrar última mensagem
          loadSubscribers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'manychat_mensagens',
        },
        (payload) => {
          console.log('🔄 Mensagem atualizada:', payload);
          const updatedMsg = payload.new as Message & { subscriber_id: string };
          
          if (selectedSubscriber && updatedMsg.subscriber_id === selectedSubscriber.subscriber_id) {
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime mensagens status:', status);
      });

    // Realtime para subscribers (última interação, etc)
    const subscribersChannel = supabase
      .channel('manychat-subscribers-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'manychat_subscribers',
        },
        (payload) => {
          console.log('👤 Subscriber atualizado:', payload);
          loadSubscribers();
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscribers status:', status);
      });

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(subscribersChannel);
    };
  }, [selectedSubscriber?.subscriber_id]);

  // Carregar mensagens quando selecionar subscriber
  useEffect(() => {
    if (selectedSubscriber) {
      loadMessages(selectedSubscriber.subscriber_id);
    } else {
      setMessages([]);
    }
  }, [selectedSubscriber?.subscriber_id]);

  const loadSubscribers = async () => {
    setIsLoading(true);
    try {
      // Buscar do banco de dados local
      const { data, error } = await supabase
        .from('manychat_subscribers' as any)
        .select('*')
        .order('ultima_interacao', { ascending: false });

      if (error) {
        console.error('Erro ao buscar subscribers:', error);
        throw error;
      }
      setSubscribers((data as Subscriber[]) || []);
    } catch (error) {
      console.error('Erro ao carregar subscribers:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os contatos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (subscriberId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('manychat_mensagens' as any)
        .select('*')
        .eq('subscriber_id', subscriberId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar mensagens:', error);
        throw error;
      }
      setMessages((data as Message[]) || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as mensagens',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedSubscriber) return;

    setIsSending(true);
    try {
      // Enviar via ManyChat API
      const { data, error } = await supabase.functions.invoke('manychat', {
        body: {
          action: 'enviar_mensagem',
          subscriberId: selectedSubscriber.subscriber_id,
          message: newMessage,
        },
      });

      if (error) throw error;

      // Salvar mensagem localmente
      const { error: insertError } = await supabase
        .from('manychat_mensagens' as any)
        .insert({
          subscriber_id: selectedSubscriber.subscriber_id,
          subscriber_nome: selectedSubscriber.nome,
          subscriber_foto: selectedSubscriber.foto,
          canal: selectedSubscriber.canal,
          conteudo: newMessage,
          tipo: 'text',
          direcao: 'saida',
          lead_id: selectedSubscriber.lead_id,
        } as any);

      if (insertError) {
        console.error('Erro ao salvar mensagem localmente:', insertError);
      }

      // Atualizar última interação do subscriber
      await supabase
        .from('manychat_subscribers' as any)
        .update({ 
          ultima_interacao: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('subscriber_id', selectedSubscriber.subscriber_id);

      setNewMessage('');
      
      // Recarregar mensagens
      await loadMessages(selectedSubscriber.subscriber_id);
      
      toast({
        title: 'Mensagem enviada',
        description: `Mensagem enviada para ${selectedSubscriber.nome}`,
      });
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

  const searchInManyChat = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: 'Busca',
        description: 'Digite um nome para buscar no ManyChat',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manychat', {
        body: { action: 'buscar_por_nome', searchTerm: searchTerm.trim() },
      });

      if (error) throw error;

      if (data.status === 'success' && data.data && data.data.length > 0) {
        // Salvar subscribers encontrados no banco local
        for (const sub of data.data) {
          await supabase
            .from('manychat_subscribers' as any)
            .upsert({
              subscriber_id: sub.id,
              nome: sub.nome,
              foto: sub.foto,
              telefone: sub.telefone,
              email: sub.email,
              canal: sub.canal,
              ultima_interacao: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as any, {
              onConflict: 'subscriber_id',
            });
        }
        
        // Recarregar lista
        await loadSubscribers();
        
        toast({
          title: 'Encontrados',
          description: `${data.data.length} contato(s) encontrado(s)`,
        });
      } else {
        toast({
          title: 'Busca',
          description: 'Nenhum contato encontrado com esse nome',
        });
      }
    } catch (error) {
      console.error('Erro ao buscar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível buscar no ManyChat',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
              title="Atualizar lista"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchInManyChat()}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={searchInManyChat}
              disabled={isLoading}
              title="Buscar no ManyChat"
            >
              <Search className="h-4 w-4" />
            </Button>
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
                        {subscriber.ultima_interacao && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(subscriber.ultima_interacao), "dd/MM HH:mm", { locale: ptBR })}
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
                {isLoadingMessages ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Inicie uma conversa com {selectedSubscriber.nome}</p>
                      <p className="text-sm">As mensagens enviadas aparecerão aqui</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      // Detectar tipo de mídia pela URL
                      const content = message.conteudo || '';
                      const isAudio = content.match(/\.(ogg|mp3|wav|m4a|aac)(\?|$)/i) || message.tipo === 'audio';
                      const isImage = content.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) || message.tipo === 'image';
                      const isVideo = content.match(/\.(mp4|webm|mov)(\?|$)/i) || message.tipo === 'video';
                      const isMediaUrl = content.match(/^https?:\/\/.+\.(ogg|mp3|wav|jpg|jpeg|png|gif|webp|mp4|webm)/i);
                      
                      // Limpar colchetes de URLs malformadas
                      const cleanUrl = content.replace(/^\[|\]$/g, '');
                      
                      return (
                        <div
                          key={message.id}
                          className={`flex ${message.direcao === 'entrada' ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              message.direcao === 'entrada'
                                ? 'bg-muted'
                                : 'bg-primary text-primary-foreground'
                            }`}
                          >
                            {isAudio ? (
                              <audio controls className="max-w-full" preload="metadata">
                                <source src={cleanUrl} type="audio/ogg" />
                                <source src={cleanUrl} type="audio/mpeg" />
                                Seu navegador não suporta áudio.
                              </audio>
                            ) : isImage ? (
                              <img 
                                src={cleanUrl} 
                                alt="Imagem enviada" 
                                className="max-w-full rounded cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(cleanUrl, '_blank');
                                }}
                              />
                            ) : isVideo ? (
                              <video controls className="max-w-full rounded" preload="metadata">
                                <source src={cleanUrl} type="video/mp4" />
                                Seu navegador não suporta vídeo.
                              </video>
                            ) : (
                              <p>{content}</p>
                            )}
                            <p className={`text-xs mt-1 ${
                              message.direcao === 'entrada' ? 'text-muted-foreground' : 'text-primary-foreground/70'
                            }`}>
                              {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
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
