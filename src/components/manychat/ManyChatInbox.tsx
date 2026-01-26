import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useChatPresence } from '@/hooks/useChatPresence';
import { useTeamPresence } from '@/hooks/useTeamPresence';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { ChatThemeProvider, useChatTheme } from './ChatThemeProvider';
import { TeamPresencePanel } from './TeamPresencePanel';
import { ConversationAssignmentMenu } from './ConversationAssignmentMenu';
import LeadContextPanel from './LeadContextPanel';
import { 
  Send, 
  Search, 
  Phone, 
  RefreshCw,
  Mic,
  Paperclip,
  X,
  CheckCheck,
  ArrowLeft,
  MoreVertical,
  Smile,
  Sun,
  Moon,
  Menu,
  Bot,
  UserRound,
  Instagram,
  Facebook,
  MessageCircle,
  Sparkles,
  PanelRightClose,
  Users,
  History
} from 'lucide-react';
import CalWidget from './CalWidget';
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
  assigned_to?: string;
}

interface Message {
  id: string;
  conteudo: string;
  created_at: string;
  direcao: 'entrada' | 'saida';
  tipo: string;
}

type ConversationFilter = 'all' | 'unread' | 'human' | 'bot' | 'mine';

// Componente interno que usa o tema
const ManyChatInboxContent = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { fullName } = usePerfil();
  const { theme, toggleTheme } = useChatTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [isLoadingFullHistory, setIsLoadingFullHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  const { isOnline, isTyping, setTyping } = useChatPresence(
    user?.id,
    fullName || user?.email?.split('@')[0]
  );

  const { 
    getTeamWithStatus, 
    setCurrentChat, 
    getOnlineCount 
  } = useTeamPresence(
    user?.id,
    fullName || user?.email?.split('@')[0]
  );

  const {
    playNotificationSound,
    notifyAssignment,
    notifyNewMessage,
    requestNotificationPermission,
  } = useChatNotifications();

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  // Tema - classes dinâmicas
  const isDark = theme === 'dark';
  
  const themeClasses = {
    bg: isDark ? 'bg-[#0B141A]' : 'bg-[#EFEAE2]',
    sidebar: isDark ? 'bg-[#111B21]' : 'bg-white',
    header: isDark ? 'bg-[#202C33]' : 'bg-[#F0F2F5]',
    headerText: isDark ? 'text-[#E9EDEF]' : 'text-[#111B21]',
    secondaryText: isDark ? 'text-[#8696A0]' : 'text-[#667781]',
    iconColor: isDark ? 'text-[#AEBAC1]' : 'text-[#54656F]',
    border: isDark ? 'border-[#222D34]' : 'border-[#E9EDEF]',
    hover: isDark ? 'hover:bg-[#202C33]' : 'hover:bg-[#F5F6F6]',
    hoverBtn: isDark ? 'hover:bg-[#374248]' : 'hover:bg-[#E9EDEF]',
    active: isDark ? 'bg-[#2A3942]' : 'bg-[#F0F2F5]',
    input: isDark ? 'bg-[#2A3942] text-[#E9EDEF] placeholder:text-[#8696A0]' : 'bg-white text-[#111B21]',
    inputSearch: isDark ? 'bg-[#202C33] text-[#E9EDEF] placeholder:text-[#8696A0]' : 'bg-[#F0F2F5]',
    messageSent: isDark ? 'bg-[#005C4B] text-[#E9EDEF]' : 'bg-[#D9FDD3] text-[#111B21]',
    messageReceived: isDark ? 'bg-[#202C33] text-[#E9EDEF]' : 'bg-white text-[#111B21]',
    emptyState: isDark ? 'bg-[#222E35]' : 'bg-[#F0F2F5]',
    // Text colors for messages
    messageSentText: isDark ? 'text-[#E9EDEF]' : 'text-[#111B21]',
    messageReceivedText: isDark ? 'text-[#E9EDEF]' : 'text-[#111B21]',
    messageTime: isDark ? 'text-[#8FBFB1]' : 'text-[#667781]',
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const leadId = searchParams.get('lead_id');
    if (leadId) {
      setPendingLeadId(leadId);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (pendingLeadId && subscribers.length > 0) {
      const subscriber = subscribers.find(s => s.lead_id === pendingLeadId);
      if (subscriber) {
        setSelectedSubscriber(subscriber);
        setPendingLeadId(null);
      } else {
        setPendingLeadId(null);
      }
    }
  }, [pendingLeadId, subscribers]);

  // Track current subscriber ID to prevent unnecessary reloads
  const selectedSubscriberIdRef = useRef<string | null>(null);

  // Initial load only - no aggressive polling (realtime handles updates)
  useEffect(() => {
    loadSubscribers();
    
    // Polling fallback every 30 seconds (reduced from 10s - realtime is primary)
    const pollInterval = setInterval(() => {
      console.log('[ManyChatInbox] Polling - atualizando lista...');
      loadSubscribers();
    }, 30000);

    // Refetch on window focus (but not messages - only subscriber list)
    const handleFocus = () => {
      console.log('[ManyChatInbox] Window focus - recarregando lista...');
      loadSubscribers();
    };
    window.addEventListener('focus', handleFocus);

    // Visibility change handler for mobile/tab switching
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('[ManyChatInbox] Tab visible - recarregando lista...');
        loadSubscribers();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []); // Empty dependency - only run once on mount

  const handleTyping = useCallback(() => {
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
  }, [setTyping]);

  // Realtime subscriptions - more robust with reconnection
  useEffect(() => {
    console.log('[ManyChatInbox] Configurando canais realtime...');
    
    let isSubscribed = true;
    
    const setupChannels = () => {
      // Messages channel with unique name to avoid conflicts
      const messagesChannel = supabase
        .channel(`manychat-msgs-${Date.now()}`, {
          config: {
            broadcast: { self: true },
            presence: { key: user?.id || 'anonymous' },
          }
        })
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'manychat_mensagens' },
          (payload) => {
            console.log('[Realtime] Mensagem evento:', payload.eventType, payload);
            
            if (payload.eventType === 'INSERT') {
              const newMsg = payload.new as Message & { subscriber_id: string; subscriber_nome?: string };
              
              // Prevent duplicate notification for same message
              if (lastMessageIdRef.current === newMsg.id) return;
              lastMessageIdRef.current = newMsg.id;
              
              // Check if message belongs to currently selected conversation
              // Match both exact subscriber_id AND phone-based zapi_ format
              const currentSubId = selectedSubscriber?.subscriber_id;
              const currentPhone = selectedSubscriber?.telefone?.replace(/\D/g, '') || '';
              const normalizedPhone = currentPhone.startsWith('55') ? currentPhone : '55' + currentPhone;
              const currentZapiId = currentPhone ? `zapi_${normalizedPhone}` : null;
              
              const isCurrentChat = selectedSubscriber && (
                newMsg.subscriber_id === currentSubId ||
                newMsg.subscriber_id === currentZapiId ||
                (currentZapiId && currentSubId && newMsg.subscriber_id.includes(currentPhone.slice(-9)))
              );
              
              // Update messages if current chat
              if (isCurrentChat) {
                console.log('[Realtime] Adicionando mensagem ao chat atual');
                setMessages(prev => {
                  if (prev.some(m => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
                });
                scrollToBottom();
              }
              
              // Play notification for incoming messages from other chats
              if (newMsg.direcao === 'entrada' && !isCurrentChat) {
                playNotificationSound();
                notifyNewMessage(newMsg.subscriber_nome || 'Novo contato', newMsg.conteudo?.substring(0, 100) || '');
              }
              
              // Update subscriber order - find by subscriber_id OR by matching phone in zapi_ format
              setSubscribers(prev => {
                let idx = prev.findIndex(s => s.subscriber_id === newMsg.subscriber_id);
                
                // If not found, try to find by phone number pattern
                if (idx === -1 && newMsg.subscriber_id.startsWith('zapi_')) {
                  const phoneFromZapi = newMsg.subscriber_id.replace('zapi_', '');
                  const phoneSuffix = phoneFromZapi.slice(-9);
                  idx = prev.findIndex(s => s.telefone?.includes(phoneSuffix));
                }
                
                if (idx === -1) { 
                  // New subscriber - reload list
                  console.log('[Realtime] Novo subscriber detectado, recarregando lista...');
                  loadSubscribers(); 
                  return prev; 
                }
                const updated = [...prev];
                const [subscriber] = updated.splice(idx, 1);
                return [{ ...subscriber, ultima_interacao: new Date().toISOString() }, ...updated];
              });
            }
          }
        )
        .subscribe((status) => {
          console.log('[Realtime] Messages channel status:', status);
          if (status === 'CHANNEL_ERROR') {
            console.error('[Realtime] Messages channel error, will retry...');
          }
        });

      // Subscribers channel
      const subscribersChannel = supabase
        .channel(`manychat-subs-${Date.now()}`, {
          config: { broadcast: { self: true } }
        })
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'manychat_subscribers' },
          (payload) => {
            console.log('[Realtime] Subscriber evento:', payload.eventType, payload);
            
            if (payload.eventType === 'INSERT') {
              const newSub = payload.new as Subscriber;
              setSubscribers(prev => {
                if (prev.some(s => s.subscriber_id === newSub.subscriber_id)) return prev;
                return [newSub, ...prev];
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedSub = payload.new as Subscriber;
              const oldSub = payload.old as Subscriber;
              
              // Check if conversation was assigned to current user
              if (updatedSub.assigned_to === user?.id && oldSub?.assigned_to !== user?.id) {
                notifyAssignment(updatedSub.nome || 'Contato', 'Um colega');
              }
              
              setSubscribers(prev => {
                const idx = prev.findIndex(s => s.subscriber_id === updatedSub.subscriber_id);
                if (idx === -1) return prev;
                const updated = [...prev];
                updated[idx] = { ...updated[idx], ...updatedSub };
                return updated;
              });
              
              // Update selected subscriber if it's the current one
              if (selectedSubscriber?.subscriber_id === updatedSub.subscriber_id) {
                setSelectedSubscriber(prev => prev ? { ...prev, ...updatedSub } : null);
              }
            }
          }
        )
        .subscribe((status) => {
          console.log('[Realtime] Subscribers channel status:', status);
        });

      return { messagesChannel, subscribersChannel };
    };

    const { messagesChannel, subscribersChannel } = setupChannels();

    return () => {
      isSubscribed = false;
      console.log('[ManyChatInbox] Removendo canais realtime...');
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(subscribersChannel);
    };
  }, [selectedSubscriber?.subscriber_id, user?.id, playNotificationSound, notifyNewMessage, notifyAssignment]);

  // Update team presence and load messages when selecting a NEW chat
  useEffect(() => {
    const newSubscriberId = selectedSubscriber?.subscriber_id || null;
    
    // Only load if subscriber actually changed (not on every render)
    if (newSubscriberId !== selectedSubscriberIdRef.current) {
      selectedSubscriberIdRef.current = newSubscriberId;
      
      if (selectedSubscriber) {
        loadMessages(selectedSubscriber.subscriber_id);
        setCurrentChat(selectedSubscriber.subscriber_id);
        setShowMobileChat(true);
      } else {
        setMessages([]);
        setCurrentChat(null);
      }
    }
  }, [selectedSubscriber?.subscriber_id, setCurrentChat]);

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

  const syncAllContacts = async () => {
    setIsSyncing(true);
    try {
      toast({ title: 'Sincronização iniciada', description: 'Atualizando contatos via Z-API...' });
      
      // Sync subscriber names for contacts with "Desconhecido"
      toast({ title: 'Atualizando nomes...', description: 'Buscando nomes dos contatos...' });
      await supabase.functions.invoke('sync-subscriber-names');
      
      await loadSubscribers();
      toast({
        title: 'Sincronização concluída!',
        description: 'Lista de contatos atualizada'
      });
    } catch (error: any) {
      toast({ title: 'Erro na sincronização', description: error.message, variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  const loadMessages = async (subscriberId: string, loadAll = false) => {
    setIsLoadingMessages(true);
    try {
      // Get subscriber phone for Z-API format lookup
      const currentSub = subscribers.find(s => s.subscriber_id === subscriberId);
      const phoneClean = currentSub?.telefone?.replace(/\D/g, '') || '';
      const zapiId = phoneClean ? `zapi_${phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean}` : null;
      
      // Build query to match both old subscriber_id AND new zapi_ format
      let query = supabase
        .from('manychat_mensagens' as any)
        .select('*')
        .order('created_at', { ascending: true });

      // Match subscriber_id OR zapi_phone format
      if (zapiId) {
        query = query.or(`subscriber_id.eq.${subscriberId},subscriber_id.eq.${zapiId}`);
      } else {
        query = query.eq('subscriber_id', subscriberId);
      }

      // Only limit if not loading all history
      if (!loadAll) {
        query = query.limit(100);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMessages((data as Message[]) || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadFullHistory = async () => {
    if (!selectedSubscriber) return;
    setIsLoadingFullHistory(true);
    try {
      // Load ALL messages for this subscriber
      const { data, error } = await supabase
        .from('manychat_mensagens' as any)
        .select('*')
        .eq('subscriber_id', selectedSubscriber.subscriber_id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as Message[]) || []);
      toast({ 
        title: '📜 Histórico Completo', 
        description: `${(data as Message[])?.length || 0} mensagens carregadas` 
      });
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar o histórico', variant: 'destructive' });
    } finally {
      setIsLoadingFullHistory(false);
    }
  };

  const assignConversation = async (memberId: string) => {
    if (!selectedSubscriber) return;
    
    try {
      const { error } = await supabase
        .from('manychat_subscribers')
        .update({ assigned_to: memberId })
        .eq('subscriber_id', selectedSubscriber.subscriber_id);

      if (error) throw error;

      // Get assigned member name
      const teamMembers = getTeamWithStatus();
      const member = teamMembers.find(m => m.id === memberId);
      
      toast({
        title: '✅ Conversa direcionada',
        description: `Direcionado para ${member?.fullName || 'membro da equipe'}`,
      });

      // Update local state
      setSelectedSubscriber(prev => prev ? { ...prev, assigned_to: memberId } : null);
      setSubscribers(prev => prev.map(s => 
        s.subscriber_id === selectedSubscriber.subscriber_id 
          ? { ...s, assigned_to: memberId }
          : s
      ));
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível direcionar a conversa', variant: 'destructive' });
    }
  };

  const sendMessage = async (mediaUrl?: string, mediaType?: string) => {
    const content = mediaUrl || newMessage.trim();
    if (!content || !selectedSubscriber) return;

    // Optimistic update - show message immediately
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conteudo: content,
      created_at: new Date().toISOString(),
      direcao: 'saida',
      tipo: mediaType || 'text',
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setTyping(false);
    scrollToBottom();

    setIsSending(true);
    try {
      // Enviar via Z-API
      const { data: zapiResult, error: zapiError } = await supabase.functions.invoke('zapi-send', {
        body: {
          to_phone: selectedSubscriber.telefone,
          message: content,
          type: mediaType || 'text',
          lead_id: selectedSubscriber.lead_id,
        },
      });

      console.log('[Chat] Z-API response:', zapiResult, zapiError);

      // Verificar se houve erro no envio
      if (zapiError) {
        throw new Error(zapiError.message || 'Erro ao enviar via Z-API');
      }

      if (!zapiResult?.success) {
        console.warn('[Chat] Z-API retornou erro:', zapiResult);
        toast({ 
          title: '⚠️ Atenção', 
          description: zapiResult?.error || 'Mensagem pode não ter chegado ao destinatário.',
          variant: 'destructive'
        });
      }

      // Salvar mensagem localmente (sempre, para histórico)
      const { data: savedMsg } = await supabase.from('manychat_mensagens' as any).insert({
        subscriber_id: selectedSubscriber.subscriber_id,
        subscriber_nome: selectedSubscriber.nome,
        canal: 'whatsapp',
        conteudo: content,
        tipo: mediaType || 'text',
        direcao: 'saida',
        lead_id: selectedSubscriber.lead_id,
        metadata: { sent_via: 'chat_interface', zapi_status: zapiResult?.success ? 'success' : 'error', message_id: zapiResult?.messageId }
      } as any).select().single();

      // Replace optimistic message with real one
      if (savedMsg) {
        setMessages(prev => prev.map(m => m.id === tempId ? savedMsg as Message : m));
      }

      // Registrar interação se houver lead vinculado
      if (selectedSubscriber.lead_id) {
        await supabase.from('interacoes').insert({
          cliente_id: selectedSubscriber.lead_id,
          tipo: 'Chat',
          resumo: `Mensagem via WhatsApp: ${content.substring(0, 100)}...`,
          detalhes: content,
          direcao: 'saida',
          data_interacao: new Date().toISOString(),
        });
      }

      setSelectedFile(null);
      setPreviewUrl(null);

      // Toast de sucesso apenas se Z-API confirmou
      if (zapiResult?.success) {
        toast({ title: '✅ Enviado', description: 'Mensagem entregue via WhatsApp' });
      }
    } catch (error: any) {
      console.error('[Chat] Erro ao enviar:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(content); // Restore message
      toast({ 
        title: 'Erro no envio', 
        description: error.message || 'Não foi possível enviar a mensagem', 
        variant: 'destructive' 
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

  const getDateLabel = (msgs: Message[], index: number) => {
    if (index === 0) {
      const date = new Date(msgs[0].created_at);
      if (isToday(date)) return 'HOJE';
      if (isYesterday(date)) return 'ONTEM';
      return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }).toUpperCase();
    }
    const currentDate = new Date(msgs[index].created_at).toDateString();
    const prevDate = new Date(msgs[index - 1].created_at).toDateString();
    if (currentDate !== prevDate) {
      const date = new Date(msgs[index].created_at);
      if (isToday(date)) return 'HOJE';
      if (isYesterday(date)) return 'ONTEM';
      return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }).toUpperCase();
    }
    return null;
  };

  // Format phone for display
  const formatPhone = (phone?: string) => {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, '');
    // Format Brazilian phone: +55 (92) 99999-9999
    if (clean.startsWith('55') && clean.length >= 12) {
      const ddd = clean.slice(2, 4);
      const part1 = clean.slice(4, 9);
      const part2 = clean.slice(9);
      return `(${ddd}) ${part1}-${part2}`;
    }
    // Just format with spaces
    if (clean.length >= 10) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  const getDisplayName = (sub: Subscriber) => {
    // Check for valid name (not placeholder)
    const invalidNames = ['Desconhecido', 'Sem nome', 'desconhecido', 'null', '', '{{wa_id}}'];
    const hasValidName = sub.nome && !invalidNames.includes(sub.nome) && !sub.nome.startsWith('{{') && !sub.nome.startsWith('[');
    
    if (hasValidName) return sub.nome;
    
    // Try formatted phone
    const formattedPhone = formatPhone(sub.telefone);
    if (formattedPhone) return formattedPhone;
    
    // Fallback to raw phone or subscriber_id
    if (sub.telefone && sub.telefone !== '{{wa_id}}') return sub.telefone;
    
    return `Contato #${sub.subscriber_id?.slice(-4) || '????'}`;
  };

  const getInitials = (sub: Subscriber) => {
    const invalidNames = ['Desconhecido', 'Sem nome', 'desconhecido', 'null', '', '{{wa_id}}'];
    const hasValidName = sub.nome && !invalidNames.includes(sub.nome) && !sub.nome.startsWith('{{') && !sub.nome.startsWith('[');
    
    if (hasValidName) {
      const parts = sub.nome.split(' ').filter(p => p.length > 0);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return sub.nome.substring(0, 2).toUpperCase();
    }
    
    // Use last 2 digits of phone or subscriber_id
    const phone = sub.telefone?.replace(/\D/g, '');
    if (phone && phone.length >= 2) return phone.slice(-2);
    if (sub.subscriber_id) return sub.subscriber_id.slice(-2);
    return '??';
  };

  // Ícone do canal
  const ChannelIcon = ({ canal, size = 'sm' }: { canal?: string; size?: 'sm' | 'md' }) => {
    const normalizedCanal = canal?.toLowerCase() || '';
    const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
    
    if (normalizedCanal.includes('instagram') || normalizedCanal === 'ig') {
      return (
        <div className={`${size === 'sm' ? 'p-0.5' : 'p-1'} rounded bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600`}>
          <Instagram className={`${iconSize} text-white`} />
        </div>
      );
    }
    if (normalizedCanal.includes('facebook') || normalizedCanal === 'fb' || normalizedCanal.includes('messenger')) {
      return (
        <div className={`${size === 'sm' ? 'p-0.5' : 'p-1'} rounded bg-[#1877F2]`}>
          <Facebook className={`${iconSize} text-white`} />
        </div>
      );
    }
    if (normalizedCanal.includes('whatsapp') || normalizedCanal === 'wa') {
      return (
        <div className={`${size === 'sm' ? 'p-0.5' : 'p-1'} rounded bg-[#25D366]`}>
          <MessageCircle className={`${iconSize} text-white`} />
        </div>
      );
    }
    if (normalizedCanal.includes('telegram')) {
      return (
        <div className={`${size === 'sm' ? 'p-0.5' : 'p-1'} rounded bg-[#0088cc]`}>
          <Send className={`${iconSize} text-white`} />
        </div>
      );
    }
    return null;
  };

  // Indicador Online Premium
  const OnlineIndicator = ({ subscriberId, showText = false }: { subscriberId: string; showText?: boolean }) => {
    const online = isOnline(subscriberId);
    if (!online && !showText) return null;
    
    return (
      <div className="flex items-center gap-1.5">
        <span className={`relative flex h-2.5 w-2.5 ${online ? '' : 'opacity-50'}`}>
          {online && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${online ? 'bg-emerald-500' : 'bg-gray-400'}`} />
        </span>
        {showText && (
          <span className={`text-xs font-medium ${online ? 'text-emerald-500' : themeClasses.secondaryText}`}>
            {online ? 'Online' : 'Offline'}
          </span>
        )}
      </div>
    );
  };

  // Filtros aplicados - busca melhorada
  const filteredSubscribers = subscribers
    .filter(sub => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const displayName = getDisplayName(sub).toLowerCase();
      return (
        displayName.includes(term) ||
        sub.nome?.toLowerCase().includes(term) ||
        sub.telefone?.includes(searchTerm) ||
        sub.subscriber_id?.includes(searchTerm) ||
        sub.email?.toLowerCase().includes(term)
      );
    })
    .filter(sub => {
      if (activeFilter === 'human') return sub.atendimento_humano;
      if (activeFilter === 'bot') return !sub.atendimento_humano;
      return true;
    });

  const renderMessage = (message: Message) => {
    const content = message.conteudo || '';
    const isAudio = content.match(/\.(ogg|mp3|wav|m4a)(\?|$)/i) || message.tipo === 'audio';
    const isImage = content.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) || message.tipo === 'image';
    const isVideo = content.match(/\.(mp4|webm)(\?|$)/i) || message.tipo === 'video';
    const cleanUrl = content.replace(/^\[|\]$/g, '');

    if (isAudio) {
      return <audio controls className="max-w-[220px] h-10" preload="metadata"><source src={cleanUrl} type="audio/ogg" /></audio>;
    }
    if (isImage) {
      return (
        <img 
          src={cleanUrl} 
          alt="Imagem" 
          className="max-w-[280px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(cleanUrl, '_blank')}
        />
      );
    }
    if (isVideo) {
      return <video controls className="max-w-[280px] rounded-lg" preload="metadata"><source src={cleanUrl} /></video>;
    }
    return <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px] text-inherit">{content}</p>;
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${themeClasses.bg}`}>
      {/* Sidebar - Lista de Conversas */}
      <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] lg:w-[420px] flex-col ${themeClasses.sidebar} border-r ${themeClasses.border}`}>
        {/* Header */}
        <div className={`h-[60px] px-4 flex items-center justify-between ${themeClasses.header}`}>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={`h-10 w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}>
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/dashboard')}>Dashboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/leads')}>Leads</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/processos')}>Processos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/tarefas')}>Tarefas</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/agenda')}>Agenda</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/financeiro')}>Financeiro</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/documentos')}>Documentos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/contratos')}>Contratos</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/assistente')}>Isa Assistente</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/configuracoes')}>Configurações</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <h1 className={`text-xl font-semibold ${themeClasses.headerText}`}>Conversas</h1>
          </div>
          <div className="flex items-center gap-1">
            {/* Team panel button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTeamPanel(!showTeamPanel)}
              className={`h-10 w-10 rounded-full relative ${showTeamPanel ? 'text-[#00A884] bg-[#00A884]/10' : themeClasses.iconColor} ${themeClasses.hoverBtn}`}
              title="Equipe online"
            >
              <Users className="h-5 w-5" />
              {getOnlineCount() > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 text-[10px] text-white flex items-center justify-center font-medium">
                  {getOnlineCount()}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className={`h-10 w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}
              title={isDark ? 'Modo claro' : 'Modo escuro'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={syncAllContacts}
              disabled={isSyncing}
              className={`h-10 w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}
            >
              <RefreshCw className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className={`px-3 py-2 ${themeClasses.sidebar}`}>
          <div className="relative">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${themeClasses.secondaryText}`} />
            <Input
              placeholder="Pesquisar conversa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-12 h-[35px] ${themeClasses.inputSearch} border-0 rounded-lg text-[13px] focus-visible:ring-0`}
            />
          </div>
        </div>

        {/* Filtros */}
        <div className={`px-3 py-2 ${themeClasses.sidebar} border-b ${themeClasses.border}`}>
          <div className="flex items-center gap-2">
            {(['all', 'human', 'bot'] as ConversationFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                  activeFilter === filter
                    ? 'bg-[#00A884] text-white shadow-md'
                    : `${themeClasses.inputSearch} ${themeClasses.secondaryText} ${themeClasses.hoverBtn}`
                }`}
              >
                {filter === 'all' ? 'Todos' : filter === 'human' ? '🙋 Humano' : '🤖 Isa'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Conversas */}
        <ScrollArea className="flex-1">
          {filteredSubscribers.length === 0 ? (
            <div className={`p-8 text-center ${themeClasses.secondaryText}`}>
              <p className="text-sm">{isLoading ? 'Carregando...' : 'Nenhuma conversa'}</p>
            </div>
          ) : (
            <div>
              {filteredSubscribers.map((subscriber) => {
                const isActive = selectedSubscriber?.id === subscriber.id;
                const online = isOnline(subscriber.subscriber_id);
                
                return (
                  <div
                    key={subscriber.id}
                    onClick={() => setSelectedSubscriber(subscriber)}
                    className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-all ${themeClasses.hover} ${
                      isActive ? themeClasses.active : ''
                    } ${online ? 'border-l-2 border-l-emerald-500' : ''}`}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12 shrink-0 ring-2 ring-offset-2 ring-offset-transparent ring-transparent">
                        <AvatarImage src={subscriber.foto} />
                        <AvatarFallback className="bg-gradient-to-br from-[#00A884] to-[#008069] text-white text-base font-medium">
                          {getInitials(subscriber)}
                        </AvatarFallback>
                      </Avatar>
                      {/* Online indicator overlay */}
                      {online && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white dark:border-[#111B21] flex items-center justify-center">
                          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                        </span>
                      )}
                      {/* Atendimento humano indicator */}
                      {subscriber.atendimento_humano && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px]">
                          🙋
                        </span>
                      )}
                    </div>
                    
                    <div className={`flex-1 min-w-0 border-b ${themeClasses.border} pb-3`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ChannelIcon canal={subscriber.canal} size="sm" />
                          <span className={`font-medium text-[15px] ${themeClasses.headerText} truncate`}>
                            {getDisplayName(subscriber)}
                          </span>
                          {online && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                              online
                            </span>
                          )}
                        </div>
                        <span className={`text-[11px] ${themeClasses.secondaryText} shrink-0 ml-2`}>
                          {subscriber.ultima_interacao && formatLastMessageTime(subscriber.ultima_interacao)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCheck className="h-4 w-4 text-[#53BDEB] shrink-0" />
                        <span className={`text-[13px] ${themeClasses.secondaryText} truncate`}>
                          {subscriber.telefone || subscriber.canal}
                        </span>
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
      <div className={`${!showMobileChat ? 'hidden md:flex' : 'flex'} flex-1 flex-col`}>
        {selectedSubscriber ? (
          <>
            {/* Header do Chat */}
            <div className={`h-[62px] px-4 flex items-center gap-3 ${themeClasses.header} border-b ${themeClasses.border}`}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setSelectedSubscriber(null); setShowMobileChat(false); }}
                className={`md:hidden h-10 w-10 -ml-2 ${themeClasses.iconColor}`}
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
              
              <div className="relative">
                <Avatar className="h-11 w-11 cursor-pointer ring-2 ring-offset-1 ring-transparent hover:ring-[#00A884] transition-all">
                  <AvatarImage src={selectedSubscriber.foto} />
                  <AvatarFallback className="bg-gradient-to-br from-[#00A884] to-[#008069] text-white">
                    {getInitials(selectedSubscriber)}
                  </AvatarFallback>
                </Avatar>
                {isOnline(selectedSubscriber.subscriber_id) && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <ChannelIcon canal={selectedSubscriber.canal} size="md" />
                  <h3 className={`font-semibold text-[16px] ${themeClasses.headerText} truncate`}>
                    {getDisplayName(selectedSubscriber)}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <OnlineIndicator subscriberId={selectedSubscriber.subscriber_id} showText />
                  {isTyping(selectedSubscriber.subscriber_id) && (
                    <span className="text-xs text-[#00A884] font-medium animate-pulse">digitando...</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1 shrink-0">
                {selectedSubscriber.telefone && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://wa.me/${selectedSubscriber.telefone?.replace(/\D/g, '')}`, '_blank');
                      }}
                      className={`h-10 w-10 rounded-full text-[#00A884] ${themeClasses.hoverBtn}`}
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => { e.stopPropagation(); window.open(`tel:${selectedSubscriber.telefone}`, '_self'); }}
                      className={`hidden md:flex h-10 w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}
                    >
                      <Phone className="h-5 w-5" />
                    </Button>
                  </>
                )}
                {/* Toggle Atendimento Humano */}
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
                        title: novoStatus ? '🙋 Atendimento Humano' : '🤖 Isa Ativada',
                        description: novoStatus ? 'Você assumiu a conversa' : 'Isa voltou a responder',
                      });
                    }
                  }}
                  className={`h-10 w-10 rounded-full transition-all ${
                    selectedSubscriber.atendimento_humano 
                      ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20' 
                      : `${themeClasses.iconColor} ${themeClasses.hoverBtn}`
                  }`}
                >
                  {selectedSubscriber.atendimento_humano ? <UserRound className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </Button>
                
                {/* Botão de direcionar conversa */}
                <ConversationAssignmentMenu
                  teamMembers={getTeamWithStatus()}
                  currentUserId={user?.id}
                  currentAssignee={selectedSubscriber.assigned_to}
                  onAssign={assignConversation}
                />
                
                <CalWidget
                  subscriberId={selectedSubscriber.subscriber_id}
                  subscriberName={getDisplayName(selectedSubscriber)}
                  subscriberEmail={selectedSubscriber.email}
                  subscriberPhone={selectedSubscriber.telefone}
                  leadId={selectedSubscriber.lead_id}
                  onScheduled={() => toast({ title: '📅 Agendado!', description: 'Consulta marcada com sucesso' })}
                />
                {selectedSubscriber.lead_id && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowContextPanel(!showContextPanel)}
                    className={`hidden md:flex h-10 w-10 rounded-full transition-all ${
                      showContextPanel 
                        ? 'text-[#00A884] bg-[#00A884]/10 hover:bg-[#00A884]/20' 
                        : `${themeClasses.iconColor} ${themeClasses.hoverBtn}`
                    }`}
                  >
                    {showContextPanel ? <PanelRightClose className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                  </Button>
                )}
                <Button variant="ghost" size="icon" className={`h-10 w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}>
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Área de Mensagens */}
            <div 
              className={`flex-1 overflow-y-auto px-4 md:px-16 lg:px-[63px] py-4 ${themeClasses.bg}`}
              style={{
                backgroundImage: isDark 
                  ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cdefs%3E%3Cpattern id='p' width='80' height='80' patternUnits='userSpaceOnUse'%3E%3Ccircle cx='40' cy='40' r='1.5' fill='%23ffffff08'/%3E%3C/pattern%3E%3C/defs%3E%3Crect fill='url(%23p)' width='100%25' height='100%25'/%3E%3C/svg%3E")`
                  : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cdefs%3E%3Cpattern id='p' width='80' height='80' patternUnits='userSpaceOnUse'%3E%3Ccircle cx='40' cy='40' r='1.5' fill='%2300000008'/%3E%3C/pattern%3E%3C/defs%3E%3Crect fill='url(%23p)' width='100%25' height='100%25'/%3E%3C/svg%3E")`,
              }}
            >
              {isLoadingMessages ? (
                <div className="h-full flex items-center justify-center">
                  <RefreshCw className={`h-8 w-8 animate-spin ${themeClasses.secondaryText}`} />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className={`${isDark ? 'bg-[#332F24]' : 'bg-[#FCF4CB]'} rounded-xl px-6 py-4 max-w-md shadow-lg`}>
                    <p className={`text-[13px] ${themeClasses.secondaryText} text-center`}>
                      🔒 As mensagens são protegidas com criptografia de ponta a ponta.
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
                          <div className="flex justify-center my-4">
                            <span className={`px-4 py-1.5 rounded-lg ${isDark ? 'bg-[#1F2C34]' : 'bg-white'} text-[12px] ${themeClasses.secondaryText} shadow-sm font-medium`}>
                              {dateLabel}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-[3px]`}>
                          <div
                            className={`relative max-w-[85%] md:max-w-[65%] rounded-xl px-3 pt-2 pb-2 shadow-md transition-all hover:shadow-lg ${
                              isOutgoing ? themeClasses.messageSent : themeClasses.messageReceived
                            }`}
                            style={{
                              borderTopLeftRadius: !isOutgoing ? '4px' : undefined,
                              borderTopRightRadius: isOutgoing ? '4px' : undefined,
                            }}
                          >
                            <span className={`absolute top-0 w-2 h-3 ${isOutgoing ? '-right-2' : '-left-2'}`}>
                              {isOutgoing ? (
                                <svg viewBox="0 0 8 13" className={isDark ? 'fill-[#005C4B]' : 'fill-[#D9FDD3]'}><path d="M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z"/></svg>
                              ) : (
                                <svg viewBox="0 0 8 13" className={isDark ? 'fill-[#202C33]' : 'fill-white'}><path d="M1.533 3.568L8 12.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z"/></svg>
                              )}
                            </span>
                            
                            {renderMessage(message)}
                            
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className={`text-[11px] ${isOutgoing ? themeClasses.messageTime : themeClasses.secondaryText}`}>
                                {formatMessageTime(message.created_at)}
                              </span>
                              {isOutgoing && <CheckCheck className="h-4 w-4 text-[#53BDEB]" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {isTyping(selectedSubscriber.subscriber_id) && (
                    <div className="flex justify-start mb-1">
                      <div className={`${themeClasses.messageReceived} rounded-xl px-4 py-3 shadow-md`}>
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
              <div className={`px-4 py-2 ${themeClasses.header} border-t ${themeClasses.border}`}>
                <div className={`flex items-center gap-3 p-2 rounded-lg ${themeClasses.sidebar}`}>
                  {selectedFile.type.startsWith('image/') ? (
                    <img src={previewUrl || ''} alt="Preview" className="h-12 w-12 object-cover rounded" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-[#00A884] flex items-center justify-center">
                      <Mic className="h-5 w-5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${themeClasses.headerText}`}>{selectedFile.name}</p>
                    <p className={`text-xs ${themeClasses.secondaryText}`}>{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Input de Mensagem */}
            <div className={`h-[66px] px-4 flex items-center gap-2 ${themeClasses.header}`}>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,audio/*,video/*" className="hidden" />
              
              <Button variant="ghost" size="icon" className={`h-10 w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}>
                <Smile className="h-6 w-6" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
                className={`h-10 w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}
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
                  className={`h-[44px] rounded-xl ${themeClasses.input} border-0 text-[15px] focus-visible:ring-0 shadow-sm`}
                />
              </div>

              {newMessage.trim() || selectedFile ? (
                <Button 
                  onClick={selectedFile ? uploadAndSendFile : () => sendMessage()} 
                  disabled={isSending}
                  size="icon"
                  className="h-11 w-11 rounded-full bg-[#00A884] hover:bg-[#008069] text-white shadow-lg transition-all hover:scale-105"
                >
                  <Send className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isSending}
                  className={`h-11 w-11 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg' : `${themeClasses.iconColor} ${themeClasses.hoverBtn}`}`}
                >
                  <Mic className="h-6 w-6" />
                </Button>
              )}
            </div>
          </>
        ) : (
          /* Tela vazia */
          <div className={`h-full flex flex-col items-center justify-center ${themeClasses.emptyState} border-b-[6px] border-[#00A884]`}>
            <div className="text-center max-w-md px-4">
              <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#00A884] to-[#008069] flex items-center justify-center shadow-xl">
                <MessageCircle className="h-16 w-16 text-white" />
              </div>
              <h2 className={`text-2xl font-semibold ${themeClasses.headerText} mb-3`}>
                Central de Mensagens
              </h2>
              <p className={`text-[14px] ${themeClasses.secondaryText} leading-6 mb-6`}>
                Selecione uma conversa para começar a atender seus leads.
                <br/>As mensagens são atualizadas em tempo real.
              </p>
              <div className={`flex items-center justify-center gap-2 text-[13px] ${themeClasses.secondaryText}`}>
                <span className="text-[#00A884]">🔒</span>
                Suas mensagens são protegidas com criptografia.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Painel de Contexto do Lead */}
      {showContextPanel && selectedSubscriber?.lead_id && (
        <LeadContextPanel 
          leadId={selectedSubscriber.lead_id}
          onClose={() => setShowContextPanel(false)}
          onNavigateToLead={() => navigate(`/leads/${selectedSubscriber.lead_id}`)}
        />
      )}

      {/* Painel de Equipe Online */}
      {showTeamPanel && (
        <TeamPresencePanel
          teamMembers={getTeamWithStatus()}
          currentUserId={user?.id}
          onClose={() => setShowTeamPanel(false)}
          onAssignToMember={assignConversation}
          subscriberName={selectedSubscriber ? (selectedSubscriber.nome || 'Contato') : undefined}
          isAssigning={!!selectedSubscriber}
        />
      )}
    </div>
  );
};

// Componente wrapper com provider de tema isolado
const ManyChatInbox = () => {
  return (
    <ChatThemeProvider>
      <ManyChatInboxContent />
    </ChatThemeProvider>
  );
};

export default ManyChatInbox;
