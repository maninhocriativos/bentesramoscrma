import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  MessageCircle,
  Mic,
  Image,
  Paperclip,
  X,
  User,
  Check,
  CheckCheck
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
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
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadSubscribers();
  }, []);

  // Realtime para novas mensagens - otimizado para updates instantâneos
  useEffect(() => {
    console.log('🔌 Conectando realtime...');
    
    const messagesChannel = supabase
      .channel('manychat-messages-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'manychat_mensagens',
        },
        (payload) => {
          console.log('🔔 Nova mensagem instantânea:', payload.new);
          const newMsg = payload.new as Message & { subscriber_id: string; subscriber_nome: string };
          
          // Atualizar mensagens se é do subscriber selecionado
          if (selectedSubscriber && newMsg.subscriber_id === selectedSubscriber.subscriber_id) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
          
          // Atualizar lista de subscribers sem recarregar tudo
          setSubscribers(prev => {
            const idx = prev.findIndex(s => s.subscriber_id === newMsg.subscriber_id);
            if (idx === -1) {
              // Novo subscriber - recarregar lista
              loadSubscribers();
              return prev;
            }
            // Mover para o topo e atualizar última interação
            const updated = [...prev];
            const [subscriber] = updated.splice(idx, 1);
            return [{ ...subscriber, ultima_interacao: new Date().toISOString() }, ...updated];
          });
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
          const updatedMsg = payload.new as Message & { subscriber_id: string };
          
          if (selectedSubscriber && updatedMsg.subscriber_id === selectedSubscriber.subscriber_id) {
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status mensagens realtime:', status);
      });

    const subscribersChannel = supabase
      .channel('manychat-subscribers-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'manychat_subscribers',
        },
        (payload) => {
          console.log('👤 Novo subscriber:', payload.new);
          const newSub = payload.new as Subscriber;
          setSubscribers(prev => {
            if (prev.some(s => s.subscriber_id === newSub.subscriber_id)) return prev;
            return [newSub, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'manychat_subscribers',
        },
        (payload) => {
          console.log('👤 Subscriber atualizado:', payload.new);
          const updatedSub = payload.new as Subscriber;
          setSubscribers(prev => 
            prev.map(s => s.subscriber_id === updatedSub.subscriber_id ? { ...s, ...updatedSub } : s)
          );
          
          // Atualizar subscriber selecionado se for o mesmo
          if (selectedSubscriber?.subscriber_id === updatedSub.subscriber_id) {
            setSelectedSubscriber(prev => prev ? { ...prev, ...updatedSub } : null);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status subscribers realtime:', status);
      });

    return () => {
      console.log('🔌 Desconectando realtime...');
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(subscribersChannel);
    };
  }, [selectedSubscriber?.subscriber_id]);

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
      const { data, error } = await supabase
        .from('manychat_subscribers' as any)
        .select('*')
        .order('ultima_interacao', { ascending: false });

      if (error) throw error;
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

      if (error) throw error;
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

  const sendMessage = async (mediaUrl?: string, mediaType?: string) => {
    const content = mediaUrl || newMessage.trim();
    if (!content || !selectedSubscriber) return;

    setIsSending(true);
    try {
      // Enviar via ManyChat API
      const { error } = await supabase.functions.invoke('manychat', {
        body: {
          action: 'enviar_mensagem',
          subscriberId: selectedSubscriber.subscriber_id,
          message: content,
          type: mediaType || 'text',
        },
      });

      if (error) throw error;

      // Salvar mensagem localmente
      await supabase
        .from('manychat_mensagens' as any)
        .insert({
          subscriber_id: selectedSubscriber.subscriber_id,
          subscriber_nome: selectedSubscriber.nome,
          subscriber_foto: selectedSubscriber.foto,
          canal: selectedSubscriber.canal,
          conteudo: content,
          tipo: mediaType || 'text',
          direcao: 'saida',
          lead_id: selectedSubscriber.lead_id,
        } as any);

      await supabase
        .from('manychat_subscribers' as any)
        .update({ 
          ultima_interacao: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('subscriber_id', selectedSubscriber.subscriber_id);

      setNewMessage('');
      setSelectedFile(null);
      setPreviewUrl(null);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const uploadAndSendFile = async () => {
    if (!selectedFile || !selectedSubscriber) return;

    setIsSending(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `manychat/${selectedSubscriber.subscriber_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(filePath);

      const mediaType = selectedFile.type.startsWith('image/') ? 'image' : 
                       selectedFile.type.startsWith('audio/') ? 'audio' : 
                       selectedFile.type.startsWith('video/') ? 'video' : 'document';

      await sendMessage(urlData.publicUrl, mediaType);
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar o arquivo',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg' });
        const file = new File([audioBlob], `audio_${Date.now()}.ogg`, { type: 'audio/ogg' });
        setSelectedFile(file);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível acessar o microfone',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const searchInManyChat = async () => {
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manychat', {
        body: { action: 'buscar_por_nome', searchTerm: searchTerm.trim() },
      });

      if (error) throw error;

      if (data.status === 'success' && data.data?.length > 0) {
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
        
        await loadSubscribers();
        toast({
          title: 'Encontrados',
          description: `${data.data.length} contato(s) encontrado(s)`,
        });
      } else {
        toast({
          title: 'Busca',
          description: 'Nenhum contato encontrado',
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
        return <Instagram className="h-3.5 w-3.5" />;
      case 'whatsapp':
        return <MessageCircle className="h-3.5 w-3.5" />;
      case 'messenger':
      case 'facebook':
      default:
        return <Facebook className="h-3.5 w-3.5" />;
    }
  };

  const getChannelStyle = (canal: string) => {
    switch (canal?.toLowerCase()) {
      case 'instagram':
        return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
      case 'whatsapp':
        return 'bg-emerald-500 text-white';
      case 'messenger':
      case 'facebook':
      default:
        return 'bg-blue-500 text-white';
    }
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Hoje';
    if (isYesterday(date)) return 'Ontem';
    return format(date, "dd 'de' MMMM", { locale: ptBR });
  };

  const getDateLabel = (messages: Message[], index: number) => {
    if (index === 0) return formatMessageDate(messages[0].created_at);
    const currentDate = new Date(messages[index].created_at).toDateString();
    const prevDate = new Date(messages[index - 1].created_at).toDateString();
    if (currentDate !== prevDate) return formatMessageDate(messages[index].created_at);
    return null;
  };

  const filteredSubscribers = subscribers.filter(sub =>
    sub.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.telefone?.includes(searchTerm) ||
    sub.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderMessage = (message: Message) => {
    const content = message.conteudo || '';
    const isAudio = content.match(/\.(ogg|mp3|wav|m4a|aac)(\?|$)/i) || message.tipo === 'audio';
    const isImage = content.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) || message.tipo === 'image';
    const isVideo = content.match(/\.(mp4|webm|mov)(\?|$)/i) || message.tipo === 'video';
    const cleanUrl = content.replace(/^\[|\]$/g, '');
    const isOutgoing = message.direcao === 'saida';

    if (isAudio) {
      return (
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-full ${isOutgoing ? 'bg-white/20' : 'bg-primary/10'}`}>
            <Mic className={`h-4 w-4 ${isOutgoing ? 'text-white' : 'text-primary'}`} />
          </div>
          <audio controls className="max-w-[200px] h-8" preload="metadata">
            <source src={cleanUrl} type="audio/ogg" />
            <source src={cleanUrl} type="audio/mpeg" />
          </audio>
        </div>
      );
    }

    if (isImage) {
      return (
        <img 
          src={cleanUrl} 
          alt="Imagem" 
          className="max-w-[280px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            window.open(cleanUrl, '_blank');
          }}
        />
      );
    }

    if (isVideo) {
      return (
        <video controls className="max-w-[280px] rounded-lg shadow-sm" preload="metadata">
          <source src={cleanUrl} type="video/mp4" />
        </video>
      );
    }

    return <p className="whitespace-pre-wrap break-words">{content}</p>;
  };

  return (
    <div className="flex h-[calc(100vh-180px)] gap-0 bg-background rounded-xl overflow-hidden border shadow-lg">
      {/* Lista de Contatos - Design elegante */}
      <div className="w-[340px] flex flex-col border-r bg-card">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Conversas
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadSubscribers}
              disabled={isLoading}
              className="h-8 w-8 hover:bg-primary/10"
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
              onKeyPress={(e) => e.key === 'Enter' && searchInManyChat()}
              className="pl-9 bg-background/50 border-muted focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Lista */}
        <ScrollArea className="flex-1">
          {filteredSubscribers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{isLoading ? 'Carregando...' : 'Nenhum contato'}</p>
              <p className="text-sm">Os contatos aparecerão aqui</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredSubscribers.map((subscriber) => (
                <div
                  key={subscriber.id}
                  onClick={() => setSelectedSubscriber(subscriber)}
                  className={`p-3 cursor-pointer transition-all duration-200 hover:bg-accent/50 ${
                    selectedSubscriber?.id === subscriber.id 
                      ? 'bg-primary/10 border-l-2 border-l-primary' 
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12 ring-2 ring-background shadow-sm">
                        <AvatarImage src={subscriber.foto} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-medium">
                          {subscriber.nome?.substring(0, 2).toUpperCase() || '??'}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 p-1 rounded-full shadow-sm ${getChannelStyle(subscriber.canal)}`}>
                        {getChannelIcon(subscriber.canal)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">{subscriber.nome || 'Sem nome'}</p>
                        {subscriber.lead_id && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-200">
                            Lead
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {subscriber.ultima_interacao && (
                          <span>{format(new Date(subscriber.ultima_interacao), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                        )}
                      </div>
                      {subscriber.telefone && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" />
                          {subscriber.telefone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Área de Chat - Design moderno */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-muted/30 to-muted/10">
        {selectedSubscriber ? (
          <>
            {/* Header do Chat */}
            <div className="p-4 border-b bg-card/80 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-11 w-11 ring-2 ring-background shadow-md">
                    <AvatarImage src={selectedSubscriber.foto} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-medium">
                      {selectedSubscriber.nome?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`absolute -bottom-0.5 -right-0.5 p-1 rounded-full shadow ${getChannelStyle(selectedSubscriber.canal)}`}>
                    {getChannelIcon(selectedSubscriber.canal)}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{selectedSubscriber.nome}</h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {selectedSubscriber.telefone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {selectedSubscriber.telefone}
                      </span>
                    )}
                    {selectedSubscriber.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {selectedSubscriber.email}
                      </span>
                    )}
                  </div>
                </div>
                {selectedSubscriber.lead_id && (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    <Check className="h-3 w-3 mr-1" />
                    Lead Vinculado
                  </Badge>
                )}
              </div>
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 p-4">
              {isLoadingMessages ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary/50" />
                    <p className="text-sm text-muted-foreground mt-2">Carregando mensagens...</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center p-8 rounded-2xl bg-card/50 backdrop-blur-sm">
                    <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-8 w-8 text-primary/50" />
                    </div>
                    <p className="font-medium text-lg">Inicie uma conversa</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Envie uma mensagem para {selectedSubscriber.nome}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 max-w-3xl mx-auto">
                  {messages.map((message, index) => {
                    const dateLabel = getDateLabel(messages, index);
                    const isOutgoing = message.direcao === 'saida';
                    
                    return (
                      <div key={message.id}>
                        {dateLabel && (
                          <div className="flex justify-center my-4">
                            <span className="px-3 py-1 rounded-full bg-card text-xs text-muted-foreground shadow-sm">
                              {dateLabel}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-2`}>
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                              isOutgoing
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-card border rounded-bl-md'
                            }`}
                          >
                            {renderMessage(message)}
                            <div className={`flex items-center justify-end gap-1 mt-1 ${
                              isOutgoing ? 'text-primary-foreground/60' : 'text-muted-foreground'
                            }`}>
                              <span className="text-[10px]">
                                {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
                              </span>
                              {isOutgoing && <CheckCheck className="h-3 w-3" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Preview de arquivo selecionado */}
            {selectedFile && (
              <div className="px-4 py-2 border-t bg-card/80">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  {selectedFile.type.startsWith('image/') ? (
                    <img 
                      src={previewUrl || ''} 
                      alt="Preview" 
                      className="h-16 w-16 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
                      {selectedFile.type.startsWith('audio/') ? (
                        <Mic className="h-6 w-6 text-primary" />
                      ) : (
                        <Paperclip className="h-6 w-6 text-primary" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Input de Mensagem */}
            <div className="p-4 border-t bg-card/80 backdrop-blur-sm">
              <div className="flex items-end gap-2 max-w-3xl mx-auto">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,audio/*,video/*"
                  className="hidden"
                />
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending}
                  className="h-10 w-10 rounded-full hover:bg-primary/10"
                >
                  <Image className="h-5 w-5 text-muted-foreground" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isSending}
                  className={`h-10 w-10 rounded-full ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white' : 'hover:bg-primary/10'}`}
                >
                  <Mic className={`h-5 w-5 ${isRecording ? '' : 'text-muted-foreground'}`} />
                </Button>

                <div className="flex-1 relative">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (selectedFile ? uploadAndSendFile() : sendMessage())}
                    disabled={isSending || isRecording}
                    className="pr-12 py-5 rounded-full bg-background/80 border-muted focus:border-primary transition-colors"
                  />
                </div>

                <Button 
                  onClick={selectedFile ? uploadAndSendFile : () => sendMessage()} 
                  disabled={isSending || (!newMessage.trim() && !selectedFile) || isRecording}
                  className="h-10 w-10 rounded-full"
                  size="icon"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center p-8">
              <div className="h-24 w-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <MessageSquare className="h-12 w-12 text-primary/40" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Selecione uma conversa</h3>
              <p className="text-muted-foreground max-w-sm">
                Escolha um contato da lista para visualizar e responder mensagens
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManyChatInbox;
