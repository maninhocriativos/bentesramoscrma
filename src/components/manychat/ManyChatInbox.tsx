import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useChatPresence } from '@/hooks/useChatPresence';
import { useAuth } from '@/hooks/useAuth';
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
  X,
  User,
  Check,
  CheckCheck,
  ArrowLeft,
  Circle,
  MoreVertical
} from 'lucide-react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
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
  const { user } = useAuth();
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
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Presence hook for online/typing status
  const { isOnline, isTyping, setTyping, getLastSeen } = useChatPresence(
    user?.id,
    user?.email?.split('@')[0]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadSubscribers();
  }, []);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    setTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 2000);
  }, [setTyping]);

  // Realtime subscriptions
  useEffect(() => {
    console.log('🔌 Conectando realtime...');
    
    const messagesChannel = supabase
      .channel('manychat-messages-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'manychat_mensagens' },
        (payload) => {
          console.log('🔔 Nova mensagem:', payload.new);
          const newMsg = payload.new as Message & { subscriber_id: string };
          
          if (selectedSubscriber && newMsg.subscriber_id === selectedSubscriber.subscriber_id) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
          
          setSubscribers(prev => {
            const idx = prev.findIndex(s => s.subscriber_id === newMsg.subscriber_id);
            if (idx === -1) {
              loadSubscribers();
              return prev;
            }
            const updated = [...prev];
            const [subscriber] = updated.splice(idx, 1);
            return [{ ...subscriber, ultima_interacao: new Date().toISOString() }, ...updated];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'manychat_mensagens' },
        (payload) => {
          const updatedMsg = payload.new as Message & { subscriber_id: string };
          if (selectedSubscriber && updatedMsg.subscriber_id === selectedSubscriber.subscriber_id) {
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          }
        }
      )
      .subscribe();

    const subscribersChannel = supabase
      .channel('manychat-subscribers-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'manychat_subscribers' },
        (payload) => {
          const newSub = payload.new as Subscriber;
          setSubscribers(prev => {
            if (prev.some(s => s.subscriber_id === newSub.subscriber_id)) return prev;
            return [newSub, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'manychat_subscribers' },
        (payload) => {
          const updatedSub = payload.new as Subscriber;
          setSubscribers(prev => 
            prev.map(s => s.subscriber_id === updatedSub.subscriber_id ? { ...s, ...updatedSub } : s)
          );
          if (selectedSubscriber?.subscriber_id === updatedSub.subscriber_id) {
            setSelectedSubscriber(prev => prev ? { ...prev, ...updatedSub } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(subscribersChannel);
    };
  }, [selectedSubscriber?.subscriber_id]);

  useEffect(() => {
    if (selectedSubscriber) {
      loadMessages(selectedSubscriber.subscriber_id);
      setShowMobileChat(true);
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
      
      // Try to update names from ManyChat for subscribers without names
      const subscribersData = (data as Subscriber[]) || [];
      const needsNameUpdate = subscribersData.filter(s => !s.nome || s.nome === 'Sem nome');
      
      if (needsNameUpdate.length > 0) {
        // Update names in background
        needsNameUpdate.slice(0, 5).forEach(async (sub) => {
          try {
            const { data: mcData } = await supabase.functions.invoke('manychat', {
              body: { action: 'buscar_subscriber', subscriberId: sub.subscriber_id }
            });
            
            if (mcData?.status === 'success' && mcData?.data) {
              const nome = mcData.data.name || 
                `${mcData.data.first_name || ''} ${mcData.data.last_name || ''}`.trim();
              
              if (nome) {
                await supabase
                  .from('manychat_subscribers' as any)
                  .update({ nome, updated_at: new Date().toISOString() } as any)
                  .eq('subscriber_id', sub.subscriber_id);
              }
            }
          } catch (e) {
            console.log('Erro ao buscar nome:', e);
          }
        });
      }
      
      setSubscribers(subscribersData);
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
      const { error } = await supabase.functions.invoke('manychat', {
        body: {
          action: 'enviar_mensagem',
          subscriberId: selectedSubscriber.subscriber_id,
          message: content,
          type: mediaType || 'text',
        },
      });

      if (error) throw error;

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
      setTyping(false);
      
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
      setPreviewUrl(URL.createObjectURL(file));
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

  const syncSubscriberName = async (subscriber: Subscriber) => {
    try {
      const { data } = await supabase.functions.invoke('manychat', {
        body: { action: 'buscar_subscriber', subscriberId: subscriber.subscriber_id }
      });
      
      if (data?.status === 'success' && data?.data) {
        const nome = data.data.name || 
          `${data.data.first_name || ''} ${data.data.last_name || ''}`.trim();
        
        if (nome) {
          await supabase
            .from('manychat_subscribers' as any)
            .update({ 
              nome, 
              foto: data.data.profile_pic || subscriber.foto,
              telefone: data.data.phone || subscriber.telefone,
              email: data.data.email || subscriber.email,
              updated_at: new Date().toISOString() 
            } as any)
            .eq('subscriber_id', subscriber.subscriber_id);
          
          toast({ title: 'Contato atualizado!', description: `Nome: ${nome}` });
        }
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível sincronizar', variant: 'destructive' });
    }
  };

  const getChannelIcon = (canal: string) => {
    switch (canal?.toLowerCase()) {
      case 'instagram': return <Instagram className="h-3 w-3" />;
      case 'whatsapp': return <MessageCircle className="h-3 w-3" />;
      default: return <Facebook className="h-3 w-3" />;
    }
  };

  const getChannelStyle = (canal: string) => {
    switch (canal?.toLowerCase()) {
      case 'instagram': return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
      case 'whatsapp': return 'bg-emerald-500 text-white';
      default: return 'bg-blue-500 text-white';
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

  const getOnlineStatus = (subscriber: Subscriber) => {
    const online = isOnline(subscriber.subscriber_id);
    const typing = isTyping(subscriber.subscriber_id);
    const lastSeen = getLastSeen(subscriber.subscriber_id);
    
    if (typing) return { text: 'digitando...', color: 'text-emerald-500', animate: true };
    if (online) return { text: 'online', color: 'text-emerald-500', animate: false };
    if (lastSeen) {
      return { 
        text: `visto ${formatDistanceToNow(new Date(lastSeen), { locale: ptBR, addSuffix: true })}`,
        color: 'text-muted-foreground',
        animate: false
      };
    }
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
          <audio controls className="max-w-[180px] md:max-w-[200px] h-8" preload="metadata">
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
          className="max-w-[200px] md:max-w-[280px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            window.open(cleanUrl, '_blank');
          }}
        />
      );
    }

    if (isVideo) {
      return (
        <video controls className="max-w-[200px] md:max-w-[280px] rounded-lg shadow-sm" preload="metadata">
          <source src={cleanUrl} type="video/mp4" />
        </video>
      );
    }

    return <p className="whitespace-pre-wrap break-words text-sm md:text-base">{content}</p>;
  };

  const handleBackToList = () => {
    setSelectedSubscriber(null);
    setShowMobileChat(false);
  };

  return (
    <div className="flex h-[calc(100vh-140px)] md:h-[calc(100vh-180px)] gap-0 bg-background rounded-xl overflow-hidden border shadow-lg">
      {/* Lista de Contatos - Hidden on mobile when chat is open */}
      <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] flex-col border-r bg-card`}>
        {/* Header */}
        <div className="p-3 md:p-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 md:h-5 md:w-5 text-primary" />
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
              className="pl-9 bg-background/50 border-muted focus:border-primary transition-colors h-10"
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
              {filteredSubscribers.map((subscriber) => {
                const status = getOnlineStatus(subscriber);
                return (
                  <div
                    key={subscriber.id}
                    onClick={() => setSelectedSubscriber(subscriber)}
                    className={`p-3 cursor-pointer transition-all duration-200 hover:bg-accent/50 active:scale-[0.98] ${
                      selectedSubscriber?.id === subscriber.id 
                        ? 'bg-primary/10 border-l-2 border-l-primary' 
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-11 w-11 md:h-12 md:w-12 ring-2 ring-background shadow-sm">
                          <AvatarImage src={subscriber.foto} />
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-medium text-sm">
                            {subscriber.nome?.substring(0, 2).toUpperCase() || '??'}
                          </AvatarFallback>
                        </Avatar>
                        {/* Online indicator */}
                        {isOnline(subscriber.subscriber_id) && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-background" />
                        )}
                        <div className={`absolute -bottom-0.5 -left-0.5 p-0.5 rounded-full shadow-sm ${getChannelStyle(subscriber.canal)}`}>
                          {getChannelIcon(subscriber.canal)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium truncate text-sm md:text-base">{subscriber.nome || 'Sem nome'}</p>
                          {subscriber.lead_id && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-200 shrink-0">
                              Lead
                            </Badge>
                          )}
                        </div>
                        {status && (
                          <p className={`text-xs ${status.color} ${status.animate ? 'animate-pulse' : ''}`}>
                            {status.animate && <Circle className="inline h-1.5 w-1.5 mr-1 fill-current" />}
                            {status.text}
                          </p>
                        )}
                        {!status && subscriber.ultima_interacao && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(subscriber.ultima_interacao), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Área de Chat */}
      <div className={`${!showMobileChat ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-gradient-to-b from-muted/30 to-muted/10`}>
        {selectedSubscriber ? (
          <>
            {/* Header do Chat */}
            <div className="p-3 md:p-4 border-b bg-card/80 backdrop-blur-sm safe-area-top">
              <div className="flex items-center gap-3 md:gap-4">
                {/* Back button for mobile */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToList}
                  className="md:hidden h-9 w-9 -ml-1"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                
                <div className="relative">
                  <Avatar className="h-10 w-10 md:h-11 md:w-11 ring-2 ring-background shadow-md">
                    <AvatarImage src={selectedSubscriber.foto} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-medium">
                      {selectedSubscriber.nome?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isOnline(selectedSubscriber.subscriber_id) && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base md:text-lg truncate">{selectedSubscriber.nome || 'Sem nome'}</h3>
                  <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                    {(() => {
                      const status = getOnlineStatus(selectedSubscriber);
                      if (status) {
                        return (
                          <span className={`${status.color} ${status.animate ? 'animate-pulse' : ''}`}>
                            {status.text}
                          </span>
                        );
                      }
                      return selectedSubscriber.telefone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedSubscriber.telefone}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => syncSubscriberName(selectedSubscriber)}
                  className="h-9 w-9"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 p-3 md:p-4">
              {isLoadingMessages ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary/50" />
                    <p className="text-sm text-muted-foreground mt-2">Carregando...</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center p-6 rounded-2xl bg-card/50 backdrop-blur-sm">
                    <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-7 w-7 text-primary/50" />
                    </div>
                    <p className="font-medium">Inicie uma conversa</p>
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
                          <div className="flex justify-center my-3">
                            <span className="px-3 py-1 rounded-full bg-card text-[11px] text-muted-foreground shadow-sm">
                              {dateLabel}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-1.5`}>
                          <div
                            className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-3 py-2 md:px-4 md:py-2.5 shadow-sm ${
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
                  
                  {/* Typing indicator */}
                  {isTyping(selectedSubscriber.subscriber_id) && (
                    <div className="flex justify-start mb-1.5">
                      <div className="bg-card border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Preview de arquivo */}
            {selectedFile && (
              <div className="px-3 md:px-4 py-2 border-t bg-card/80">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  {selectedFile.type.startsWith('image/') ? (
                    <img 
                      src={previewUrl || ''} 
                      alt="Preview" 
                      className="h-14 w-14 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Mic className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{selectedFile.name}</p>
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
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Input de Mensagem */}
            <div className="p-3 md:p-4 border-t bg-card/80 backdrop-blur-sm safe-area-bottom">
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
                  className="h-10 w-10 rounded-full hover:bg-primary/10 shrink-0"
                >
                  <Image className="h-5 w-5 text-muted-foreground" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isSending}
                  className={`h-10 w-10 rounded-full shrink-0 ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'hover:bg-primary/10'}`}
                >
                  <Mic className={`h-5 w-5 ${isRecording ? '' : 'text-muted-foreground'}`} />
                </Button>

                <div className="flex-1 relative">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (selectedFile ? uploadAndSendFile() : sendMessage())}
                    disabled={isSending || isRecording}
                    className="pr-4 py-5 rounded-full bg-background/80 border-muted focus:border-primary transition-colors text-base"
                  />
                </div>

                <Button 
                  onClick={selectedFile ? uploadAndSendFile : () => sendMessage()} 
                  disabled={isSending || (!newMessage.trim() && !selectedFile) || isRecording}
                  className="h-10 w-10 rounded-full shrink-0"
                  size="icon"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center">
              <div className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <MessageSquare className="h-10 w-10 md:h-12 md:w-12 text-primary/40" />
              </div>
              <h3 className="text-lg md:text-xl font-semibold mb-2">Selecione uma conversa</h3>
              <p className="text-muted-foreground text-sm md:text-base max-w-sm">
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
