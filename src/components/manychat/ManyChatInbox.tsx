import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useChatPresence } from '@/hooks/useChatPresence';
import { useAuth } from '@/hooks/useAuth';
import { 
  Send, 
  Search, 
  Phone, 
  Video,
  RefreshCw,
  Mic,
  Paperclip,
  X,
  Check,
  CheckCheck,
  ArrowLeft,
  MoreVertical,
  Smile,
  Sun,
  Moon,
  Menu,
  Bot,
  UserRound
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  atendimento_humano?: boolean;
  atendimento_humano_desde?: string;
}

interface Message {
  id: string;
  conteudo: string;
  created_at: string;
  direcao: 'entrada' | 'saida';
  tipo: string;
}

// Filtros de conversa
type ConversationFilter = 'all' | 'unread' | 'favorites' | 'groups';

// Cores do WhatsApp Desktop (Dark Mode)
const WHATSAPP_COLORS = {
  headerBg: '#008069',
  headerDark: '#202C33',
  chatBg: '#E4DDD6',
  chatBgDark: '#0B141A',
  sidebarBg: '#FFFFFF',
  sidebarBgDark: '#111B21',
  messageSent: '#D9FDD3',
  messageSentDark: '#005C4B',
  messageReceived: '#FFFFFF',
  messageReceivedDark: '#202C33',
  inputBg: '#F0F2F5',
  inputBgDark: '#2A3942',
  iconColor: '#54656F',
  iconColorDark: '#AEBAC1',
  textPrimary: '#111B21',
  textSecondary: '#667781',
  activeBg: '#F0F2F5',
  activeBgDark: '#2A3942',
  unreadBadge: '#25D366',
};

const ManyChatInbox = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ConversationFilter>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { isOnline, isTyping, setTyping } = useChatPresence(
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

  const handleTyping = useCallback(() => {
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
  }, [setTyping]);

  // Realtime subscriptions
  useEffect(() => {
    const messagesChannel = supabase
      .channel('manychat-messages-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'manychat_mensagens' },
        (payload) => {
          const newMsg = payload.new as Message & { subscriber_id: string };
          if (selectedSubscriber && newMsg.subscriber_id === selectedSubscriber.subscriber_id) {
            setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
          }
          setSubscribers(prev => {
            const idx = prev.findIndex(s => s.subscriber_id === newMsg.subscriber_id);
            if (idx === -1) { loadSubscribers(); return prev; }
            const updated = [...prev];
            const [subscriber] = updated.splice(idx, 1);
            return [{ ...subscriber, ultima_interacao: new Date().toISOString() }, ...updated];
          });
        }
      )
      .subscribe();

    const subscribersChannel = supabase
      .channel('manychat-subscribers-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manychat_subscribers' },
        () => loadSubscribers()
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
      setSubscribers((data as Subscriber[]) || []);
    } catch (error) {
      console.error('Erro ao carregar subscribers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Sincronizar TODOS os contatos com nome "Desconhecido"
  const syncAllContacts = async () => {
    setIsSyncing(true);
    const unknownContacts = subscribers.filter(s => !s.nome || s.nome === 'Desconhecido' || s.nome === 'Sem nome');
    
    let updated = 0;
    for (const sub of unknownContacts) {
      try {
        const { data } = await supabase.functions.invoke('manychat', {
          body: { action: 'buscar_subscriber', subscriberId: sub.subscriber_id }
        });
        
        if (data?.status === 'success' && data?.data) {
          const nome = data.data.name || `${data.data.first_name || ''} ${data.data.last_name || ''}`.trim();
          const telefone = data.data.phone || sub.telefone;
          
          if (nome && nome !== '') {
            await supabase
              .from('manychat_subscribers' as any)
              .update({ 
                nome, 
                foto: data.data.profile_pic || sub.foto,
                telefone,
                updated_at: new Date().toISOString() 
              } as any)
              .eq('subscriber_id', sub.subscriber_id);
            updated++;
          }
        }
      } catch (e) {
        console.log('Erro ao sincronizar:', sub.subscriber_id, e);
      }
    }
    
    await loadSubscribers();
    setIsSyncing(false);
    
    toast({
      title: 'Sincronização concluída',
      description: `${updated} contatos atualizados`
    });
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
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const sendMessage = async (mediaUrl?: string, mediaType?: string) => {
    const content = mediaUrl || newMessage.trim();
    if (!content || !selectedSubscriber) return;

    setIsSending(true);
    try {
      await supabase.functions.invoke('manychat', {
        body: {
          action: 'enviar_mensagem',
          subscriberId: selectedSubscriber.subscriber_id,
          message: content,
          type: mediaType || 'text',
        },
      });

      await supabase.from('manychat_mensagens' as any).insert({
        subscriber_id: selectedSubscriber.subscriber_id,
        subscriber_nome: selectedSubscriber.nome,
        canal: selectedSubscriber.canal,
        conteudo: content,
        tipo: mediaType || 'text',
        direcao: 'saida',
        lead_id: selectedSubscriber.lead_id,
      } as any);

      setNewMessage('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setTyping(false);
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível enviar', variant: 'destructive' });
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
      
      await supabase.storage.from('documentos').upload(filePath, selectedFile);
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(filePath);
      
      const mediaType = selectedFile.type.startsWith('image/') ? 'image' : 
                       selectedFile.type.startsWith('audio/') ? 'audio' : 'document';
      await sendMessage(urlData.publicUrl, mediaType);
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha no upload', variant: 'destructive' });
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
      
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg' });
        setSelectedFile(new File([audioBlob], `audio_${Date.now()}.ogg`, { type: 'audio/ogg' }));
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast({ title: 'Erro', description: 'Microfone não disponível', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatMessageTime = (dateStr: string) => format(new Date(dateStr), "HH:mm");

  const formatLastMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, "HH:mm");
    if (isYesterday(date)) return "Ontem";
    return format(date, "dd/MM/yyyy");
  };

  const getDateLabel = (messages: Message[], index: number) => {
    if (index === 0) {
      const date = new Date(messages[0].created_at);
      if (isToday(date)) return 'HOJE';
      if (isYesterday(date)) return 'ONTEM';
      return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }).toUpperCase();
    }
    const currentDate = new Date(messages[index].created_at).toDateString();
    const prevDate = new Date(messages[index - 1].created_at).toDateString();
    if (currentDate !== prevDate) {
      const date = new Date(messages[index].created_at);
      if (isToday(date)) return 'HOJE';
      if (isYesterday(date)) return 'ONTEM';
      return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }).toUpperCase();
    }
    return null;
  };

  const getDisplayName = (sub: Subscriber) => {
    if (sub.nome && sub.nome !== 'Desconhecido' && sub.nome !== 'Sem nome') return sub.nome;
    if (sub.telefone) return sub.telefone;
    return 'Contato';
  };

  const getInitials = (sub: Subscriber) => {
    const name = getDisplayName(sub);
    if (name.startsWith('+') || /^\d/.test(name)) return name.slice(-2);
    return name.substring(0, 2).toUpperCase();
  };

  // Aplicar filtro de busca
  const searchFilteredSubscribers = subscribers.filter(sub =>
    sub.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.telefone?.includes(searchTerm)
  );

  // Aplicar filtro de categoria (por enquanto só "Tudo" funciona)
  const filteredSubscribers = searchFilteredSubscribers;

  const renderMessage = (message: Message) => {
    const content = message.conteudo || '';
    const isAudio = content.match(/\.(ogg|mp3|wav|m4a)(\?|$)/i) || message.tipo === 'audio';
    const isImage = content.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) || message.tipo === 'image';
    const isVideo = content.match(/\.(mp4|webm)(\?|$)/i) || message.tipo === 'video';
    const cleanUrl = content.replace(/^\[|\]$/g, '');

    if (isAudio) {
      return (
        <audio controls className="max-w-[220px] h-10" preload="metadata">
          <source src={cleanUrl} type="audio/ogg" />
        </audio>
      );
    }
    if (isImage) {
      return (
        <img 
          src={cleanUrl} 
          alt="Imagem" 
          className="max-w-[280px] rounded-lg cursor-pointer"
          onClick={() => window.open(cleanUrl, '_blank')}
        />
      );
    }
    if (isVideo) {
      return <video controls className="max-w-[280px] rounded-lg" preload="metadata"><source src={cleanUrl} /></video>;
    }
    return <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">{content}</p>;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#EFEAE2] dark:bg-[#0B141A]">
      {/* Sidebar - Lista de Conversas (WhatsApp Desktop Style) */}
      <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} w-full md:w-[400px] lg:w-[420px] flex-col bg-white dark:bg-[#111B21] border-r border-[#E9EDEF] dark:border-[#222D34]`}>
        {/* Header com título "Conversas" */}
        <div className="h-[60px] px-4 flex items-center justify-between bg-[#F0F2F5] dark:bg-[#202C33]">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#E9EDEF] dark:hover:bg-[#374248]"
                  title="Menu do CRM"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/leads')}>
                  Leads
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/processos')}>
                  Processos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/tarefas')}>
                  Tarefas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/agenda')}>
                  Agenda
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/financeiro')}>
                  Financeiro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/documentos')}>
                  Documentos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/contratos')}>
                  Contratos
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/assistente')}>
                  Isa Assistente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                  Configurações
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <h1 className="text-[22px] font-semibold text-[#111B21] dark:text-[#E9EDEF]">
              Conversas
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-10 w-10 rounded-full text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#E9EDEF] dark:hover:bg-[#374248]"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={syncAllContacts}
              disabled={isSyncing}
              className="h-10 w-10 rounded-full text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#E9EDEF] dark:hover:bg-[#374248]"
              title="Sincronizar contatos"
            >
              <RefreshCw className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-white dark:bg-[#111B21]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#54656F] dark:text-[#8696A0]" />
            <Input
              placeholder="Pesquisar ou começar uma nova conversa"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-[35px] bg-[#F0F2F5] dark:bg-[#202C33] border-0 rounded-lg text-[13px] placeholder:text-[#667781] dark:placeholder:text-[#8696A0] focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Filtros de conversa */}
        <div className="px-3 py-2 bg-white dark:bg-[#111B21] border-b border-[#E9EDEF] dark:border-[#2A3942]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'bg-[#00A884] text-white'
                  : 'bg-[#F0F2F5] dark:bg-[#202C33] text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#E0E4E7] dark:hover:bg-[#374248]'
              }`}
            >
              Tudo
            </button>
            <button
              onClick={() => setActiveFilter('unread')}
              className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                activeFilter === 'unread'
                  ? 'bg-[#00A884] text-white'
                  : 'bg-[#F0F2F5] dark:bg-[#202C33] text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#E0E4E7] dark:hover:bg-[#374248]'
              }`}
            >
              Não lidas
            </button>
            <button
              onClick={() => setActiveFilter('favorites')}
              className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                activeFilter === 'favorites'
                  ? 'bg-[#00A884] text-white'
                  : 'bg-[#F0F2F5] dark:bg-[#202C33] text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#E0E4E7] dark:hover:bg-[#374248]'
              }`}
            >
              Favoritas
            </button>
            <button
              onClick={() => setActiveFilter('groups')}
              className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                activeFilter === 'groups'
                  ? 'bg-[#00A884] text-white'
                  : 'bg-[#F0F2F5] dark:bg-[#202C33] text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#E0E4E7] dark:hover:bg-[#374248]'
              }`}
            >
              Grupos
            </button>
          </div>
        </div>

        {/* Lista de Conversas */}
        <ScrollArea className="flex-1">
          {filteredSubscribers.length === 0 ? (
            <div className="p-8 text-center text-[#667781]">
              <p className="text-sm">{isLoading ? 'Carregando...' : 'Nenhuma conversa'}</p>
            </div>
          ) : (
            <div>
              {filteredSubscribers.map((subscriber) => (
                <div
                  key={subscriber.id}
                  onClick={() => setSelectedSubscriber(subscriber)}
                  className={`flex items-center gap-3 px-3 py-[10px] cursor-pointer transition-colors hover:bg-[#F5F6F6] dark:hover:bg-[#202C33] ${
                    selectedSubscriber?.id === subscriber.id ? 'bg-[#F0F2F5] dark:bg-[#2A3942]' : ''
                  }`}
                >
                  <div className="relative">
                    <Avatar className="h-[49px] w-[49px] shrink-0">
                      <AvatarImage src={subscriber.foto} />
                      <AvatarFallback className="bg-[#00A884] text-white text-base font-normal">
                        {getInitials(subscriber)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Indicador online */}
                    {isOnline(subscriber.subscriber_id) && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#25D366] border-2 border-white dark:border-[#111B21]" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 border-b border-[#E9EDEF] dark:border-[#222D34] pb-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="font-normal text-[17px] text-[#111B21] dark:text-[#E9EDEF] truncate">
                        {getDisplayName(subscriber)}
                      </span>
                      <span className="text-[12px] text-[#667781] dark:text-[#8696A0] shrink-0 ml-2">
                        {subscriber.ultima_interacao && formatLastMessageTime(subscriber.ultima_interacao)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-[2px]">
                      <CheckCheck className="h-[16px] w-[16px] text-[#53BDEB] shrink-0" />
                      <span className="text-[14px] text-[#667781] dark:text-[#8696A0] truncate">
                        {subscriber.telefone || subscriber.canal}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Área de Chat (WhatsApp Style) */}
      <div className={`${!showMobileChat ? 'hidden md:flex' : 'flex'} flex-1 flex-col`}>
        {selectedSubscriber ? (
          <>
            {/* Header do Chat */}
            <div className="h-[60px] px-4 flex items-center gap-3 bg-[#F0F2F5] dark:bg-[#202C33] border-b border-[#E9EDEF] dark:border-[#222D34]">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setSelectedSubscriber(null); setShowMobileChat(false); }}
                className="md:hidden h-10 w-10 -ml-2 text-[#54656F] dark:text-[#AEBAC1]"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
              
              <Avatar className="h-10 w-10 cursor-pointer">
                <AvatarImage src={selectedSubscriber.foto} />
                <AvatarFallback className="bg-[#00A884] text-white">
                  {getInitials(selectedSubscriber)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-normal text-[16px] text-[#111B21] dark:text-[#E9EDEF] truncate">
                  {getDisplayName(selectedSubscriber)}
                </h3>
                <p className="text-[13px] text-[#667781] dark:text-[#8696A0] truncate">
                  {isTyping(selectedSubscriber.subscriber_id) 
                    ? 'digitando...' 
                    : isOnline(selectedSubscriber.subscriber_id) 
                      ? 'online'
                      : selectedSubscriber.telefone || 'clique aqui para info'}
                </p>
              </div>
              
              <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
                {selectedSubscriber.telefone && (
                  <>
                    {/* Botão Ligar via WhatsApp */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        const phone = selectedSubscriber.telefone?.replace(/\D/g, '');
                        window.open(`https://wa.me/${phone}`, '_blank');
                      }}
                      className="h-9 w-9 md:h-10 md:w-10 rounded-full text-[#00A884] hover:bg-[#E9EDEF] dark:hover:bg-[#374248]"
                      title="Abrir conversa no WhatsApp"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </Button>
                    {/* Botão Ligar Telefone - Visível apenas desktop */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`tel:${selectedSubscriber.telefone}`, '_self');
                      }}
                      className="hidden md:flex h-10 w-10 rounded-full text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#E9EDEF] dark:hover:bg-[#374248]"
                      title="Ligar"
                    >
                      <Phone className="h-5 w-5" />
                    </Button>
                  </>
                )}
                {/* Botão Toggle Atendimento Humano */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={async (e) => {
                    e.stopPropagation();
                    const novoStatus = !selectedSubscriber.atendimento_humano;
                    const { error } = await supabase
                      .from('manychat_subscribers')
                      .update({ 
                        atendimento_humano: novoStatus,
                        atendimento_humano_desde: novoStatus ? new Date().toISOString() : null
                      })
                      .eq('subscriber_id', selectedSubscriber.subscriber_id);
                    
                    if (!error) {
                      setSelectedSubscriber(prev => prev ? { ...prev, atendimento_humano: novoStatus } : null);
                      setSubscribers(prev => prev.map(s => 
                        s.subscriber_id === selectedSubscriber.subscriber_id 
                          ? { ...s, atendimento_humano: novoStatus }
                          : s
                      ));
                      toast({
                        title: novoStatus ? '🙋 Atendimento Humano Ativado' : '🤖 Isa Reativada',
                        description: novoStatus ? 'Isa parou de responder nesta conversa' : 'Isa voltou a responder automaticamente',
                      });
                    }
                  }}
                  className={`h-9 w-9 md:h-10 md:w-10 rounded-full transition-colors ${
                    selectedSubscriber.atendimento_humano 
                      ? 'text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20' 
                      : 'text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#E9EDEF] dark:hover:bg-[#374248]'
                  }`}
                  title={selectedSubscriber.atendimento_humano ? 'Reativar Isa' : 'Assumir Atendimento (pausar Isa)'}
                >
                  {selectedSubscriber.atendimento_humano ? <UserRound className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </Button>
                <Button variant="ghost" size="icon" className="hidden md:flex h-10 w-10 rounded-full text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#E9EDEF] dark:hover:bg-[#374248]">
                  <Search className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 rounded-full text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#E9EDEF] dark:hover:bg-[#374248]">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Área de Mensagens - WhatsApp Desktop Dark Pattern */}
            <div 
              className="flex-1 overflow-y-auto px-4 md:px-16 lg:px-[63px] py-4 bg-[#EFEAE2] dark:bg-[#0B141A]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cg fill='%2300000008'%3E%3Ccircle cx='25' cy='25' r='3'/%3E%3Ccircle cx='75' cy='75' r='3'/%3E%3Ccircle cx='125' cy='25' r='3'/%3E%3Ccircle cx='175' cy='75' r='3'/%3E%3Ccircle cx='225' cy='25' r='3'/%3E%3Ccircle cx='275' cy='75' r='3'/%3E%3C/g%3E%3C/svg%3E")`,
              }}
            >
              {isLoadingMessages ? (
                <div className="h-full flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-[#667781]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="bg-[#FCF4CB] dark:bg-[#332F24] rounded-lg px-4 py-3 max-w-md shadow-sm">
                    <p className="text-[12.5px] text-[#54656F] dark:text-[#D1D7DB] text-center">
                      As mensagens são protegidas com a criptografia de ponta a ponta. 
                      Ninguém fora desta conversa pode ler.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 max-w-[750px] mx-auto">
                  {messages.map((message, index) => {
                    const dateLabel = getDateLabel(messages, index);
                    const isOutgoing = message.direcao === 'saida';
                    
                    return (
                      <div key={message.id}>
                        {dateLabel && (
                          <div className="flex justify-center my-3">
                            <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1F2C34] text-[12.5px] text-[#54656F] dark:text-[#8696A0] shadow-sm font-medium">
                              {dateLabel}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-[2px]`}>
                          <div
                            className={`relative max-w-[85%] md:max-w-[65%] rounded-lg px-[9px] pt-[6px] pb-[8px] shadow-sm ${
                              isOutgoing
                                ? 'bg-[#D9FDD3] dark:bg-[#005C4B]'
                                : 'bg-white dark:bg-[#202C33]'
                            }`}
                            style={{
                              borderTopLeftRadius: !isOutgoing ? '0' : undefined,
                              borderTopRightRadius: isOutgoing ? '0' : undefined,
                            }}
                          >
                            {/* Tail SVG */}
                            <span 
                              className={`absolute top-0 w-2 h-3 ${isOutgoing ? '-right-2' : '-left-2'}`}
                            >
                              {isOutgoing ? (
                                <svg viewBox="0 0 8 13" className="fill-[#D9FDD3] dark:fill-[#005C4B]"><path d="M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z"/></svg>
                              ) : (
                                <svg viewBox="0 0 8 13" className="fill-white dark:fill-[#202C33]"><path d="M1.533 3.568L8 12.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z"/></svg>
                              )}
                            </span>
                            
                            {renderMessage(message)}
                            
                            <div className="flex items-center justify-end gap-1 mt-1 -mb-1">
                              <span className={`text-[11px] ${isOutgoing ? 'text-[#667781] dark:text-[#8FBFB1]' : 'text-[#667781] dark:text-[#8696A0]'}`}>
                                {formatMessageTime(message.created_at)}
                              </span>
                              {isOutgoing && <CheckCheck className="h-[18px] w-[18px] text-[#53BDEB]" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {isTyping(selectedSubscriber.subscriber_id) && (
                    <div className="flex justify-start mb-1">
                      <div className="bg-white dark:bg-[#202C33] rounded-lg px-4 py-3 shadow-sm">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-[#8696A0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-[#8696A0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-[#8696A0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Preview de arquivo */}
            {selectedFile && (
              <div className="px-4 py-2 bg-[#F0F2F5] dark:bg-[#202C33] border-t border-[#E9EDEF] dark:border-[#222D34]">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-white dark:bg-[#111B21]">
                  {selectedFile.type.startsWith('image/') ? (
                    <img src={previewUrl || ''} alt="Preview" className="h-12 w-12 object-cover rounded" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-[#00A884] flex items-center justify-center">
                      <Mic className="h-5 w-5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-[#111B21] dark:text-[#E9EDEF]">{selectedFile.name}</p>
                    <p className="text-xs text-[#667781]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Input de Mensagem */}
            <div className="h-[62px] px-4 flex items-center gap-2 bg-[#F0F2F5] dark:bg-[#202C33]">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,audio/*,video/*" className="hidden" />
              
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full text-[#54656F] dark:text-[#8696A0] hover:bg-[#E9EDEF] dark:hover:bg-[#374248]"
              >
                <Smile className="h-6 w-6" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
                className="h-10 w-10 rounded-full text-[#54656F] dark:text-[#8696A0] hover:bg-[#E9EDEF] dark:hover:bg-[#374248]"
              >
                <Paperclip className="h-6 w-6" />
              </Button>

              <div className="flex-1">
                <Input
                  placeholder="Digite uma mensagem"
                  value={newMessage}
                  onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (selectedFile ? uploadAndSendFile() : sendMessage())}
                  disabled={isSending || isRecording}
                  className="h-[42px] rounded-lg bg-white dark:bg-[#2A3942] border-0 text-[15px] placeholder:text-[#667781] dark:placeholder:text-[#8696A0] focus-visible:ring-0"
                />
              </div>

              {newMessage.trim() || selectedFile ? (
                <Button 
                  onClick={selectedFile ? uploadAndSendFile : () => sendMessage()} 
                  disabled={isSending}
                  size="icon"
                  className="h-10 w-10 rounded-full bg-[#00A884] hover:bg-[#008069] text-white"
                >
                  <Send className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isSending}
                  className={`h-10 w-10 rounded-full ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-[#54656F] dark:text-[#8696A0] hover:bg-[#E9EDEF] dark:hover:bg-[#374248]'}`}
                >
                  <Mic className="h-6 w-6" />
                </Button>
              )}
            </div>
          </>
        ) : (
          /* Tela vazia - WhatsApp Style */
          <div className="h-full flex flex-col items-center justify-center bg-[#F0F2F5] dark:bg-[#222E35] border-b-[6px] border-[#00A884]">
            <div className="text-center max-w-md">
              <div className="w-[320px] h-[188px] mx-auto mb-6 opacity-40">
                <svg viewBox="0 0 303 172" className="w-full h-full">
                  <path fill="#DAF7F3" d="M229.565 1c4.418 0 8 3.582 8 8v155c0 4.419-3.582 8-8 8H8c-4.418 0-8-3.581-8-8V9c0-4.418 3.582-8 8-8h221.565z"/>
                  <path fill="#00A884" d="M54.5 65a21.5 21.5 0 1 0 0 43 21.5 21.5 0 0 0 0-43zm0 7.5a14 14 0 1 1-.001 28.001A14 14 0 0 1 54.5 72.5z"/>
                  <path fill="#00A884" d="M37.125 123h34.75c3.59 0 6.5 2.91 6.5 6.5s-2.91 6.5-6.5 6.5h-34.75c-3.59 0-6.5-2.91-6.5-6.5s2.91-6.5 6.5-6.5z"/>
                </svg>
              </div>
              <h2 className="text-[32px] font-light text-[#41525D] dark:text-[#E9EDEF] mb-4">
                WhatsApp Web
              </h2>
              <p className="text-[14px] text-[#667781] dark:text-[#8696A0] leading-5 mb-8">
                Envie e receba mensagens sem manter seu telefone conectado.<br/>
                Use o WhatsApp em até 4 aparelhos conectados ao mesmo tempo.
              </p>
              <div className="flex items-center justify-center gap-2 text-[14px] text-[#667781] dark:text-[#8696A0]">
                <span className="text-[#00A884]">🔒</span>
                Suas mensagens pessoais são protegidas com a criptografia de ponta a ponta.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManyChatInbox;