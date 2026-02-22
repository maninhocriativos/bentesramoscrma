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
import { useChatTags } from '@/hooks/useChatTags';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { ChatThemeProvider, useChatTheme } from './ChatThemeProvider';
import { TeamPresencePanel } from './TeamPresencePanel';
import { ConversationAssignmentMenu } from './ConversationAssignmentMenu';
import LeadContextPanel from './LeadContextPanel';
import { InstanceBadge } from '@/components/chat/InstanceBadge';
import { TagBadge } from '@/components/chat/TagBadge';
import { TagSelector } from '@/components/chat/TagSelector';
import { TagFilter } from '@/components/chat/TagFilter';
import { WhatsAppAudioPlayer } from '@/components/chat/WhatsAppAudioPlayer';
import { formatWhatsAppText as formatWhatsAppTextHelper } from '@/lib/whatsappTextFormatter';
import { InstanceInfo, getInstanceFromPhone } from '@/lib/instanceUtils';

// Map connectedPhone (stored in instance_name) to Z-API instance_id for outgoing routing
const PHONE_TO_INSTANCE_ID: Record<string, string> = {
  // Bentes Ramos-2 (Tráfego) - 92 98588-8190
  '85888190': '3EDDF959BC2B81F86B410203B614D70E',
  // Bentes Ramos (Escritório) - 92 99160-4348
  '91604348': '3EDB5B4FF93662A609ADFAF4F663B13A',
};

function resolveInstanceId(subscriber: { instance_name?: string | null }): string | undefined {
  const phone = subscriber.instance_name?.replace(/\D/g, '');
  if (!phone) return undefined;
  for (const [suffix, instanceId] of Object.entries(PHONE_TO_INSTANCE_ID)) {
    if (phone.endsWith(suffix)) return instanceId;
  }
  return undefined;
}
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
  History,
  FileText,
  Square
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
  // Dados do lead associado (para filtragem por origem)
  lead_tipo_origem?: string;
  // Instance info from messages metadata
  instance_name?: string;
}

// Map connected phone from DB to InstanceInfo
// The instance_name in DB is unreliable - we use connectedPhone instead
function getInstanceInfoFromConnectedPhone(connectedPhone?: string): InstanceInfo | null {
  if (!connectedPhone) return null;
  
  const phone = connectedPhone.replace(/\D/g, '');
  
  // Tráfego instance: 92 98588-8190 (stored as 559285888190)
  if (phone.includes('559285888190') || phone.includes('5592985888190') || phone.endsWith('85888190')) {
    return { name: 'Bentes Ramos-2', label: 'Tráfego', color: 'orange' };
  }
  
  // Bentes Ramos antigo: 92 99160-4348 (stored as 559291604348)
  if (phone.includes('559291604348') || phone.includes('5592991604348') || phone.endsWith('91604348')) {
    return { name: 'Bentes Ramos', label: 'Bentes Ramos antigo', color: 'blue' };
  }
  
  return null;
}

interface Message {
  id: string;
  conteudo: string;
  created_at: string;
  direcao: 'entrada' | 'saida';
  tipo: string;
  subscriber_id?: string;
  lead_id?: string;
  subscriber_nome?: string;
  metadata?: any;
}

type ConversationFilter = 'all' | 'unread' | 'human' | 'bot' | 'mine';
type OrigemFilter = 'all' | 'trafego' | 'whatsapp_direto';

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
  const [origemFilter, setOrigemFilter] = useState<OrigemFilter>('all');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [isLoadingFullHistory, setIsLoadingFullHistory] = useState(false);
  
  // Tags hook
  const {
    tags: availableTags,
    loadSubscriberTags,
    getSubscriberTags,
    addTagToSubscriber,
    removeTagFromSubscriber,
    createTag,
  } = useChatTags();
  
  // Cache de mensagens por subscriber (evita recarregar ao trocar de conversa)
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map());
  // Rastrear mensagens não lidas por subscriber
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  
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

  // Chave de deduplicação ROBUSTA - múltiplas camadas para evitar duplicatas
  const getMessageDedupeKey = (msg: any) => {
    // 1. Provider message_id do metadata (mais confiável)
    const mid = msg?.metadata?.message_id || msg?.metadata?.original?.messageId || msg?.metadata?.original?.id?.id || msg?.metadata?.original?.id;
    if (mid && typeof mid === 'string' && mid.length > 5) return `mid_${mid}`;
    
    // 2. Fallback: hash do conteúdo + direção + timestamp (primeiros 16 chars do ISO)
    const contentHash = (msg?.conteudo || '').substring(0, 100);
    const timePrefix = (msg?.created_at || '').substring(0, 16); // yyyy-mm-ddTHH:MM
    const direcao = msg?.direcao || 'unknown';
    if (contentHash && timePrefix) return `hash_${direcao}_${timePrefix}_${contentHash}`;
    
    // 3. Último recurso: ID do banco
    return `db_${msg?.id}`;
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

  // Buscar subscriber pelo lead_id - com fallback para criar subscriber se não existir
  useEffect(() => {
    const findOrCreateSubscriberForLead = async () => {
      if (!pendingLeadId || subscribers.length === 0) return;
      
      // 1. Primeiro tentar encontrar pelo lead_id direto
      let subscriber = subscribers.find(s => s.lead_id === pendingLeadId);
      
      if (subscriber) {
        console.log('[ChatInbox] Subscriber encontrado pelo lead_id:', pendingLeadId);
        setSelectedSubscriber(subscriber);
        setPendingLeadId(null);
        return;
      }
      
      // 2. Buscar dados do lead
      console.log('[ChatInbox] Subscriber não encontrado pelo lead_id, buscando pelo telefone...');
      
      try {
        const { data: lead } = await supabase
          .from('leads_juridicos')
          .select('telefone, nome, email')
          .eq('id', pendingLeadId)
          .single();
        
        if (!lead) {
          console.error('[ChatInbox] Lead não encontrado:', pendingLeadId);
          toast({
            title: 'Lead não encontrado',
            description: 'Não foi possível encontrar os dados do lead.',
            variant: 'destructive'
          });
          setPendingLeadId(null);
          return;
        }
        
        const phoneClean = lead.telefone?.replace(/\D/g, '') || '';
        const phoneSuffix = phoneClean.slice(-9);
        
        // 3. Tentar encontrar subscriber existente pelo telefone
        if (phoneClean) {
          subscriber = subscribers.find(s => {
            if (!s.telefone) return false;
            const subPhone = s.telefone.replace(/\D/g, '');
            return subPhone === phoneClean || 
                   subPhone.endsWith(phoneSuffix) || 
                   phoneClean.endsWith(subPhone.slice(-9));
          });
          
          // Também tentar pelo subscriber_id (formato zapi_55...)
          if (!subscriber) {
            const normalizedPhone = phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean;
            const zapiId = `zapi_${normalizedPhone}`;
            subscriber = subscribers.find(s => 
              s.subscriber_id === zapiId || 
              s.subscriber_id.includes(phoneSuffix)
            );
          }
        }
        
        if (subscriber) {
          console.log('[ChatInbox] Subscriber encontrado pelo telefone:', lead.telefone);
          // Atualizar o subscriber com o lead_id para futuras buscas
          await supabase
            .from('manychat_subscribers')
            .update({ lead_id: pendingLeadId })
            .eq('subscriber_id', subscriber.subscriber_id);
          
          setSelectedSubscriber({ ...subscriber, lead_id: pendingLeadId });
          setPendingLeadId(null);
          return;
        }
        
        // 4. NÃO EXISTE SUBSCRIBER - CRIAR UM NOVO PARA PERMITIR INICIAR CONVERSA
        console.log('[ChatInbox] Criando novo subscriber para o lead:', pendingLeadId);
        
        if (!phoneClean) {
          toast({
            title: 'Telefone não cadastrado',
            description: `O lead "${lead.nome || 'sem nome'}" não possui telefone cadastrado. Adicione o telefone para iniciar uma conversa.`,
            variant: 'destructive'
          });
          setPendingLeadId(null);
          return;
        }
        
        const normalizedPhone = phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean;
        const newSubscriberId = `zapi_${normalizedPhone}`;
        
        // Criar o subscriber no banco
        const { data: newSubscriber, error: createError } = await supabase
          .from('manychat_subscribers')
          .insert({
            subscriber_id: newSubscriberId,
            nome: lead.nome || 'Contato',
            telefone: normalizedPhone,
            telefone_normalizado: normalizedPhone,
            email: lead.email,
            lead_id: pendingLeadId,
            canal: 'whatsapp',
            ultima_interacao: new Date().toISOString()
          })
          .select()
          .single();
        
        if (createError) {
          console.error('[ChatInbox] Erro ao criar subscriber:', createError);
          toast({
            title: 'Erro ao iniciar conversa',
            description: 'Não foi possível criar a conversa. Tente novamente.',
            variant: 'destructive'
          });
          setPendingLeadId(null);
          return;
        }
        
        console.log('[ChatInbox] ✅ Subscriber criado:', newSubscriber);
        
        // Adicionar à lista de subscribers e selecionar
        const newSub: Subscriber = {
          id: newSubscriber.id,
          subscriber_id: newSubscriber.subscriber_id,
          nome: newSubscriber.nome || 'Contato',
          telefone: newSubscriber.telefone,
          email: newSubscriber.email,
          canal: 'whatsapp',
          lead_id: pendingLeadId,
          ultima_interacao: newSubscriber.ultima_interacao
        };
        
        setSubscribers(prev => [newSub, ...prev]);
        setSelectedSubscriber(newSub);
        setMessages([]); // Conversa vazia - pronta para primeira mensagem
        
        toast({
          title: 'Conversa iniciada',
          description: `Você pode enviar a primeira mensagem para ${lead.nome || 'o contato'}.`,
        });
        
        setPendingLeadId(null);
        
      } catch (err) {
        console.error('[ChatInbox] Erro ao buscar lead:', err);
        setPendingLeadId(null);
      }
    };
    
    findOrCreateSubscriberForLead();
  }, [pendingLeadId, subscribers, toast]);

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

  // Ref para o subscriber selecionado (evita re-render do useEffect)
  const selectedSubscriberRef = useRef<Subscriber | null>(null);
  useEffect(() => {
    selectedSubscriberRef.current = selectedSubscriber;
  }, [selectedSubscriber]);

  // Realtime subscriptions - stable, no dependency on selectedSubscriber
  useEffect(() => {
    console.log('[ManyChatInbox] Configurando canais realtime...');
    
    let isSubscribed = true;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    
    const setupMessagesChannel = () => {
      const channel = supabase
        .channel(`manychat-msgs-${user?.id || 'anon'}`)
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'manychat_mensagens' },
          (payload) => {
            if (!isSubscribed) return;
            
            const newMsg = payload.new as Message & { subscriber_id: string; subscriber_nome?: string };
            console.log('[Realtime] Nova mensagem:', newMsg.id, newMsg.subscriber_id);
            
            // Prevent duplicate notification for same message
            if (lastMessageIdRef.current === newMsg.id) return;
            lastMessageIdRef.current = newMsg.id;
            
            // Check if message belongs to currently selected conversation using ref
            const currentSub = selectedSubscriberRef.current;
            const currentSubId = currentSub?.subscriber_id;
            const currentPhone = currentSub?.telefone?.replace(/\D/g, '') || '';
            const normalizedPhone = currentPhone.startsWith('55') ? currentPhone : '55' + currentPhone;
            const currentZapiId = currentPhone ? `zapi_${normalizedPhone}` : null;
            
            const isCurrentChat = currentSub && (
              newMsg.subscriber_id === currentSubId ||
              newMsg.subscriber_id === currentZapiId ||
              (currentZapiId && currentSubId && newMsg.subscriber_id.includes(currentPhone.slice(-9)))
            );
            
            // Update messages if current chat
            if (isCurrentChat) {
              console.log('[Realtime] Adicionando mensagem ao chat atual');
              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                const updated = [...prev, newMsg];
                // Atualizar cache também
                if (currentSubId) {
                  messagesCacheRef.current.set(currentSubId, updated);
                }
                return updated;
              });
              scrollToBottom();
            } else {
              // Mensagem para outro chat - atualizar cache e contador de não lidas
              const msgSubId = newMsg.subscriber_id;
              const cachedMsgs = messagesCacheRef.current.get(msgSubId) || [];
              if (!cachedMsgs.some(m => m.id === newMsg.id)) {
                messagesCacheRef.current.set(msgSubId, [...cachedMsgs, newMsg]);
              }
              
              // Incrementar contador de não lidas (só para mensagens de entrada)
              if (newMsg.direcao === 'entrada') {
                setUnreadCounts(prev => {
                  const newMap = new Map(prev);
                  const current = newMap.get(msgSubId) || 0;
                  newMap.set(msgSubId, current + 1);
                  return newMap;
                });
              }
            }
            
            // Play notification for ALL incoming messages
            if (newMsg.direcao === 'entrada') {
              playNotificationSound();
              if (!isCurrentChat) {
                notifyNewMessage(newMsg.subscriber_nome || 'Novo contato', newMsg.conteudo?.substring(0, 100) || '');
              }
            }
            
            // Update subscriber order
            setSubscribers(prev => {
              let idx = prev.findIndex(s => s.subscriber_id === newMsg.subscriber_id);
              
              if (idx === -1 && newMsg.subscriber_id.startsWith('zapi_')) {
                const phoneFromZapi = newMsg.subscriber_id.replace('zapi_', '');
                const phoneSuffix = phoneFromZapi.slice(-9);
                idx = prev.findIndex(s => s.telefone?.includes(phoneSuffix));
              }
              
              if (idx === -1) { 
                console.log('[Realtime] Novo subscriber detectado, recarregando lista...');
                loadSubscribers(); 
                return prev; 
              }
              const updated = [...prev];
              const [subscriber] = updated.splice(idx, 1);
              return [{ ...subscriber, ultima_interacao: new Date().toISOString() }, ...updated];
            });
          }
        )
        .subscribe((status) => {
          console.log('[Realtime] Messages channel status:', status);
          if (status === 'CHANNEL_ERROR' && isSubscribed) {
            console.error('[Realtime] Messages channel error, reconnecting in 3s...');
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(() => {
              if (isSubscribed) {
                supabase.removeChannel(channel);
                setupMessagesChannel();
              }
            }, 3000);
          }
        });
      
      return channel;
    };
    
    const setupSubscribersChannel = () => {
      const channel = supabase
        .channel(`manychat-subs-${user?.id || 'anon'}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'manychat_subscribers' },
          (payload) => {
            if (!isSubscribed) return;
            console.log('[Realtime] Subscriber evento:', payload.eventType);
            
            if (payload.eventType === 'INSERT') {
              const newSub = payload.new as Subscriber;
              setSubscribers(prev => {
                if (prev.some(s => s.subscriber_id === newSub.subscriber_id)) return prev;
                return [newSub, ...prev];
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedSub = payload.new as Subscriber;
              const oldSub = payload.old as Subscriber;
              
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
              if (selectedSubscriberRef.current?.subscriber_id === updatedSub.subscriber_id) {
                setSelectedSubscriber(prev => prev ? { ...prev, ...updatedSub } : null);
              }
            }
          }
        )
        .subscribe((status) => {
          console.log('[Realtime] Subscribers channel status:', status);
        });
      
      return channel;
    };

    const messagesChannel = setupMessagesChannel();
    const subscribersChannel = setupSubscribersChannel();

    return () => {
      isSubscribed = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      console.log('[ManyChatInbox] Removendo canais realtime...');
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(subscribersChannel);
    };
  }, [user?.id, playNotificationSound, notifyNewMessage, notifyAssignment]);

  // Update team presence and load messages when selecting a NEW chat
  useEffect(() => {
    const newSubscriberId = selectedSubscriber?.subscriber_id || null;
    
    // Only load if subscriber actually changed (not on every render)
    if (newSubscriberId !== selectedSubscriberIdRef.current) {
      selectedSubscriberIdRef.current = newSubscriberId;
      
      if (selectedSubscriber) {
        // Verificar se já temos mensagens em cache
        const cachedMessages = messagesCacheRef.current.get(selectedSubscriber.subscriber_id);
        if (cachedMessages && cachedMessages.length > 0) {
          // Usar cache instantaneamente (sem loading)
          console.log('[Cache] Usando mensagens em cache para:', selectedSubscriber.subscriber_id);
          setMessages(cachedMessages);
          setIsLoadingMessages(false);
        } else {
          // Carregar do banco apenas se não houver cache
          loadMessages(selectedSubscriber.subscriber_id);
        }
        
        // Limpar contador de não lidas ao abrir conversa
        setUnreadCounts(prev => {
          const newMap = new Map(prev);
          newMap.delete(selectedSubscriber.subscriber_id);
          return newMap;
        });
        
        setCurrentChat(selectedSubscriber.subscriber_id);
        setShowMobileChat(true);
      } else {
        setMessages([]);
        setCurrentChat(null);
      }
    }
  }, [selectedSubscriber?.subscriber_id, setCurrentChat]);

  // Polling fallback desativado - realtime é primário
  // Se realtime falhar, reconexão automática é feita no useEffect acima

  const loadSubscribers = async () => {
    setIsLoading(true);
    try {
      // Buscar subscribers
      const { data: subsData, error: subsError } = await supabase
        .from('manychat_subscribers' as any)
        .select('*')
        .order('ultima_interacao', { ascending: false });

      if (subsError) throw subsError;
      
      const rawSubscribers = (subsData as Subscriber[]) || [];
      
      // Buscar leads para obter tipo_origem
      const leadIds = [...new Set(rawSubscribers.map(s => s.lead_id).filter(Boolean))];
      let leadsMap = new Map<string, string>();
      
      if (leadIds.length > 0) {
        const { data: leadsData } = await supabase
          .from('leads_juridicos')
          .select('id, tipo_origem')
          .in('id', leadIds);
        
        if (leadsData) {
          leadsData.forEach((lead: any) => {
            leadsMap.set(lead.id, lead.tipo_origem || 'indefinido');
          });
        }
      }
      
      // Detectar instância a partir do metadata da mensagem mais recente.
      // Preferir `lead_id` (histórico unificado), pois `subscriber_id` pode variar (zapi_/sem 55 etc).
      const subscriberIds = rawSubscribers.map(s => s.subscriber_id);
      const instanceByLeadId = new Map<string, string>();
      const instanceBySubscriberId = new Map<string, string>();

      // 1) Por lead_id
      if (leadIds.length > 0) {
        const { data: messagesByLead } = await supabase
          .from('manychat_mensagens')
          .select('lead_id, metadata, created_at')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false })
          .limit(2000);

        if (messagesByLead) {
          for (const msg of messagesByLead as any[]) {
            const lid = msg.lead_id as string | null;
            if (!lid || instanceByLeadId.has(lid)) continue;

            // Usar connectedPhone diretamente - é mais confiável que instance_name
            const connectedPhone = (msg.metadata as any)?.original?.connectedPhone;
            if (connectedPhone) instanceByLeadId.set(lid, connectedPhone);
          }
        }
      }

      // 2) Fallback por subscriber_id
      if (subscriberIds.length > 0) {
        const { data: messagesBySubscriber } = await supabase
          .from('manychat_mensagens')
          .select('subscriber_id, metadata, created_at')
          .in('subscriber_id', subscriberIds)
          .order('created_at', { ascending: false })
          .limit(2000);

        if (messagesBySubscriber) {
          for (const msg of messagesBySubscriber as any[]) {
            const sid = msg.subscriber_id as string;
            if (!sid || instanceBySubscriberId.has(sid)) continue;

            // Usar connectedPhone diretamente - é mais confiável que instance_name
            const connectedPhone = (msg.metadata as any)?.original?.connectedPhone;
            if (connectedPhone) instanceBySubscriberId.set(sid, connectedPhone);
          }
        }
      }
      
      // Deduplicate subscribers by normalized phone or lead_id
      const deduplicatedMap = new Map<string, Subscriber>();
      
      for (const sub of rawSubscribers) {
        // Skip invalid phone placeholders
        if (sub.telefone === '{{wa_id}}') continue;
        
        // Adicionar tipo_origem do lead e instance_name
          const subWithOrigem = {
          ...sub,
          lead_tipo_origem: sub.lead_id ? leadsMap.get(sub.lead_id) : undefined,
            instance_name: (sub.lead_id ? instanceByLeadId.get(sub.lead_id) : undefined) || instanceBySubscriberId.get(sub.subscriber_id) || undefined
        };
        
        // Normalize phone for deduplication key
        const phoneClean = sub.telefone?.replace(/\D/g, '') || '';
        const normalizedPhone = phoneClean.startsWith('55') ? phoneClean : (phoneClean.length >= 8 ? '55' + phoneClean : phoneClean);
        const phoneSuffix = normalizedPhone.slice(-9);
        
        // Use lead_id as primary key if available, else phone suffix
        const dedupeKey = sub.lead_id || (phoneSuffix.length >= 9 ? `phone_${phoneSuffix}` : sub.subscriber_id);
        
        const existing = deduplicatedMap.get(dedupeKey);
        
        if (!existing) {
          deduplicatedMap.set(dedupeKey, subWithOrigem);
        } else {
          // Keep the one with more recent interaction or better data
          const existingTime = new Date(existing.ultima_interacao || 0).getTime();
          const currentTime = new Date(sub.ultima_interacao || 0).getTime();
          
          // Prefer subscriber with valid name over "Desconhecido"
          const existingHasName = existing.nome && !existing.nome.includes('Desconhecido') && !existing.nome.includes('Contato');
          const currentHasName = sub.nome && !sub.nome.includes('Desconhecido') && !sub.nome.includes('Contato');
          
          if (currentHasName && !existingHasName) {
            // Current has better name
            deduplicatedMap.set(dedupeKey, { ...subWithOrigem, lead_id: existing.lead_id || sub.lead_id });
          } else if (currentTime > existingTime) {
            // Current is more recent
            deduplicatedMap.set(dedupeKey, { ...subWithOrigem, lead_id: existing.lead_id || sub.lead_id });
          }
        }
      }
      
      const uniqueSubscribers = Array.from(deduplicatedMap.values())
        .sort((a, b) => new Date(b.ultima_interacao || 0).getTime() - new Date(a.ultima_interacao || 0).getTime());
      
      console.log('[loadSubscribers] Original:', rawSubscribers.length, 'Deduplicated:', uniqueSubscribers.length);
      setSubscribers(uniqueSubscribers);
      
      // Carregar tags para os subscribers
      const allSubscriberIds = uniqueSubscribers.map(s => s.subscriber_id);
      if (allSubscriberIds.length > 0) {
        loadSubscriberTags(allSubscriberIds);
      }

      // Se a conversa atual já está aberta, re-hidratar com os campos enriquecidos (ex: instance_name)
      if (selectedSubscriber) {
        const refreshedSelected = uniqueSubscribers.find(s => s.id === selectedSubscriber.id || s.subscriber_id === selectedSubscriber.subscriber_id);
        if (refreshedSelected) setSelectedSubscriber(refreshedSelected);
      }
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
      // Get subscriber for phone and lead_id
      const currentSub = subscribers.find(s => s.subscriber_id === subscriberId);
      const phoneClean = currentSub?.telefone?.replace(/\D/g, '') || '';
      const leadId = currentSub?.lead_id;
      
      // Build comprehensive list of possible subscriber_ids
      const possibleIds = new Set<string>([subscriberId]);
      
      // If subscriber_id already is zapi_ format, also try the phone directly
      if (subscriberId.startsWith('zapi_')) {
        const phoneFromZapi = subscriberId.replace('zapi_', '');
        possibleIds.add(phoneFromZapi);
        // Try with/without country code
        if (phoneFromZapi.startsWith('55') && phoneFromZapi.length > 10) {
          possibleIds.add(`zapi_${phoneFromZapi.slice(2)}`);
        } else if (!phoneFromZapi.startsWith('55')) {
          possibleIds.add(`zapi_55${phoneFromZapi}`);
        }
      }
      
      // Add zapi_ format with phone variations
      if (phoneClean && phoneClean.length >= 8) {
        const normalizedPhone = phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean;
        possibleIds.add(`zapi_${normalizedPhone}`);
        possibleIds.add(`zapi_${phoneClean}`);
        possibleIds.add(phoneClean);
        possibleIds.add(normalizedPhone);
      }
      
      const idsArray = Array.from(possibleIds);
      console.log('[loadMessages] Buscando mensagens para:', { subscriberId, possibleIds: idsArray, leadId });
      
      // Build OR filter for subscriber_id
      const idsFilter = idsArray.map(id => `subscriber_id.eq.${id}`).join(',');
      
      // Build query
      let query = supabase
        .from('manychat_mensagens' as any)
        .select('*')
        .order('created_at', { ascending: true });

      // Match subscriber_id OR lead_id (lead_id is most reliable for unified history)
      if (leadId) {
        query = query.or(`${idsFilter},lead_id.eq.${leadId}`);
      } else {
        query = query.or(idsFilter);
      }

      if (!loadAll) {
        query = query.limit(200);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Deduplicate by provider message_id (when available) and sort by created_at
      const messagesMap = new Map<string, Message>();
      (data as any[])?.forEach((msg) => {
        const key = getMessageDedupeKey(msg);
        if (!messagesMap.has(key)) {
          messagesMap.set(key, msg as Message);
        }
      });
      
      const uniqueMessages = Array.from(messagesMap.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      console.log('[loadMessages] Mensagens carregadas:', uniqueMessages.length, 'entrada:', uniqueMessages.filter(m => m.direcao === 'entrada').length, 'saída:', uniqueMessages.filter(m => m.direcao === 'saida').length);
      
      // Salvar no cache para acesso instantâneo
      messagesCacheRef.current.set(subscriberId, uniqueMessages);
      
      setMessages(uniqueMessages);
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
      // Use the same logic as loadMessages but with loadAll=true
      await loadMessages(selectedSubscriber.subscriber_id, true);
      toast({ 
        title: '📜 Histórico Completo', 
        description: 'Todas as mensagens foram carregadas' 
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

  const sendMessage = async (mediaUrl?: string, mediaType?: string, fileName?: string) => {
    const content = mediaUrl || newMessage.trim();
    if (!content || !selectedSubscriber) return;

    // Capturar subscriber_id ANTES de qualquer mudança de estado
    const currentSubId = selectedSubscriber.subscriber_id;

    // Optimistic update - show message immediately
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conteudo: content,
      created_at: new Date().toISOString(),
      direcao: 'saida',
      tipo: mediaType || 'text',
      subscriber_id: currentSubId,
    };
    
    // Atualizar estado E cache ao mesmo tempo
    setMessages(prev => {
      const updated = [...prev, optimisticMessage];
      // Atualizar cache para que a mensagem persista ao trocar de conversa
      messagesCacheRef.current.set(currentSubId, updated);
      return updated;
    });
    setNewMessage(''); // Limpa input IMEDIATAMENTE para permitir nova digitação
    setTyping(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    scrollToBottom();

    // Capturar valores do subscriber atual para uso no async
    const subscriberSnapshot = { ...selectedSubscriber };

    // Enviar em background SEM bloquear o input (não usar setIsSending(true))
    (async () => {
      try {
        // Enviar via Z-API com tipo correto
        const outboundInstanceId = resolveInstanceId(subscriberSnapshot);
        const { data: zapiResult, error: zapiError } = await supabase.functions.invoke('zapi-send', {
          body: {
            to_phone: subscriberSnapshot.telefone,
            message: content,
            type: mediaType || 'text',
            lead_id: subscriberSnapshot.lead_id,
            file_name: fileName,
            ...(outboundInstanceId && { instance_id: outboundInstanceId }),
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
        // Usa message_id retornado pelo Z-API para evitar duplicatas
        // Se o índice único rejeitar, ignoramos silenciosamente
        const msgId = zapiResult?.messageId;
        
        if (msgId) {
          const { data: savedMsg, error: insertErr } = await supabase.from('manychat_mensagens' as any).insert({
            subscriber_id: subscriberSnapshot.subscriber_id,
            subscriber_nome: subscriberSnapshot.nome,
            canal: 'whatsapp',
            conteudo: content,
            tipo: mediaType || 'text',
            direcao: 'saida',
            lead_id: subscriberSnapshot.lead_id,
            metadata: { 
              sent_via: 'chat_interface', 
              zapi_status: zapiResult?.success ? 'success' : 'error', 
              message_id: msgId,
              file_name: fileName 
            }
          } as any).select().single();

          // Se houve erro de duplicata (unique_violation), ignorar silenciosamente
          if (insertErr) {
            if (insertErr.message?.includes('duplicate') || insertErr.code === '23505') {
              console.log('[Chat] Mensagem já existe, ignorando duplicata:', msgId);
            } else {
              console.error('[Chat] Erro ao salvar mensagem:', insertErr);
            }
          }

          // Replace optimistic message with real one
          if (savedMsg) {
            setMessages(prev => {
              // Se o realtime já inseriu a mensagem real, removemos o temp e não duplicamos
              const withoutTemp = prev.filter(m => m.id !== tempId);
              const savedKey = getMessageDedupeKey(savedMsg);
              const alreadyExists = withoutTemp.some(m => getMessageDedupeKey(m) === savedKey || m.id === (savedMsg as any).id);
              const updated = alreadyExists ? withoutTemp : [...withoutTemp, savedMsg as Message];
              // Atualizar cache
              messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
              return updated;
            });
          } else {
            // Mesmo sem savedMsg, remover o temp pois pode já existir via realtime
            setMessages(prev => {
              const updated = prev.filter(m => m.id !== tempId);
              messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
              return updated;
            });
          }
        } else {
          // Sem messageId do Z-API, salvar sem deduplicação (fallback)
          const { data: savedMsg } = await supabase.from('manychat_mensagens' as any).insert({
            subscriber_id: subscriberSnapshot.subscriber_id,
            subscriber_nome: subscriberSnapshot.nome,
            canal: 'whatsapp',
            conteudo: content,
            tipo: mediaType || 'text',
            direcao: 'saida',
            lead_id: subscriberSnapshot.lead_id,
            metadata: { 
              sent_via: 'chat_interface', 
              zapi_status: zapiResult?.success ? 'success' : 'error',
              file_name: fileName 
            }
          } as any).select().single();
          
          if (savedMsg) {
            setMessages(prev => {
              const withoutTemp = prev.filter(m => m.id !== tempId);
              const savedKey = getMessageDedupeKey(savedMsg);
              const alreadyExists = withoutTemp.some(m => getMessageDedupeKey(m) === savedKey || m.id === (savedMsg as any).id);
              const updated = alreadyExists ? withoutTemp : [...withoutTemp, savedMsg as Message];
              // Atualizar cache
              messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
              return updated;
            });
          }
        }

        // Registrar interação se houver lead vinculado
        if (subscriberSnapshot.lead_id) {
          await supabase.from('interacoes').insert({
            cliente_id: subscriberSnapshot.lead_id,
            tipo: 'Chat',
            resumo: `Mensagem via WhatsApp: ${content.substring(0, 100)}...`,
            detalhes: content,
            direcao: 'saida',
            data_interacao: new Date().toISOString(),
          });
        }

      } catch (error: any) {
        console.error('[Chat] Erro ao enviar:', error);
        // Update optimistic message to show error state and update cache
        setMessages(prev => {
          const updated = prev.map(m => 
            m.id === tempId 
              ? { ...m, metadata: { ...((m as any).metadata || {}), send_error: true } } 
              : m
          );
          messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
          return updated;
        });
        toast({ 
          title: 'Erro no envio', 
          description: error.message || 'Não foi possível enviar a mensagem', 
          variant: 'destructive' 
        });
      }
    })();
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
    
    // Capturar nome do arquivo original ANTES de qualquer operação
    const originalFileName = selectedFile.name;
    
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `manychat/${selectedSubscriber.subscriber_id}/${fileName}`;
      await supabase.storage.from('documentos').upload(filePath, selectedFile);

      // Bucket "documentos" é privado: usar signed URL para permitir envio/exibição
      const { data: signed, error: signError } = await supabase.storage
        .from('documentos')
        .createSignedUrl(filePath, 60 * 60 * 24 * 30); // 30 dias
      if (signError || !signed?.signedUrl) throw signError;

      const mediaType = selectedFile.type.startsWith('image/')
        ? 'image'
        : selectedFile.type.startsWith('audio/')
          ? 'audio'
          : selectedFile.type.startsWith('video/')
            ? 'video'
            : 'document';

      // Passar o nome original do arquivo para Z-API enviar como documento real
      await sendMessage(signed.signedUrl, mediaType, originalFileName);
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha no upload', variant: 'destructive' });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length === 0) return;
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg' });
        const audioFile = new File([audioBlob], `audio_${Date.now()}.ogg`, { type: 'audio/ogg' });
        
        // Mostrar preview do áudio ao invés de enviar direto
        setSelectedFile(audioFile);
        setPreviewUrl(URL.createObjectURL(audioBlob));
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

  const sendAudioFromPreview = async () => {
    if (!selectedFile || !selectedSubscriber || !selectedFile.type.startsWith('audio/')) return;
    
    const audioFile = selectedFile;
    const subscriberSnapshot = { ...selectedSubscriber };
    
    // Limpar preview imediatamente
    setSelectedFile(null);
    setPreviewUrl(null);
    
    // Mostrar mensagem otimista
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conteudo: '🎤 Enviando áudio...',
      created_at: new Date().toISOString(),
      direcao: 'saida',
      tipo: 'audio',
      subscriber_id: subscriberSnapshot.subscriber_id,
    };
    
    setMessages(prev => {
      const updated = [...prev, optimisticMessage];
      messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
      return updated;
    });
    scrollToBottom();
    
    try {
      const filePath = `manychat/${subscriberSnapshot.subscriber_id}/audio_${Date.now()}.ogg`;
      
      // Upload em background
      const uploadPromise = supabase.storage.from('documentos').upload(filePath, audioFile);
      
      const { error: uploadError } = await uploadPromise;
      if (uploadError) throw uploadError;
      
      const { data: signed, error: signError } = await supabase.storage
        .from('documentos')
        .createSignedUrl(filePath, 60 * 60 * 24 * 30);
      
      if (signError || !signed?.signedUrl) throw signError;
      
      // Enviar via Z-API
      const outboundInstanceId = resolveInstanceId(subscriberSnapshot);
      const { data: zapiResult, error: zapiError } = await supabase.functions.invoke('zapi-send', {
        body: {
          to_phone: subscriberSnapshot.telefone,
          message: signed.signedUrl,
          type: 'audio',
          lead_id: subscriberSnapshot.lead_id,
          file_name: audioFile.name,
          ...(outboundInstanceId && { instance_id: outboundInstanceId }),
        },
      });
      
      if (zapiError) throw new Error(zapiError.message);
      
      // Salvar no banco
      const msgId = zapiResult?.messageId;
      const { data: savedMsg } = await supabase.from('manychat_mensagens' as any).insert({
        subscriber_id: subscriberSnapshot.subscriber_id,
        subscriber_nome: subscriberSnapshot.nome,
        canal: 'whatsapp',
        conteudo: signed.signedUrl,
        tipo: 'audio',
        direcao: 'saida',
        lead_id: subscriberSnapshot.lead_id,
        metadata: { 
          sent_via: 'chat_interface', 
          zapi_status: zapiResult?.success ? 'success' : 'error', 
          message_id: msgId,
          file_name: audioFile.name 
        }
      } as any).select().single();
      
      // Atualizar com mensagem real
      if (savedMsg) {
        setMessages(prev => {
          const withoutTemp = prev.filter(m => m.id !== tempId);
          const savedKey = getMessageDedupeKey(savedMsg);
          const alreadyExists = withoutTemp.some(m => getMessageDedupeKey(m) === savedKey || m.id === (savedMsg as any).id);
          const updated = alreadyExists ? withoutTemp : [...withoutTemp, savedMsg as Message];
          messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
          return updated;
        });
      }
      
    } catch (error: any) {
      console.error('[Audio] Erro ao enviar áudio:', error);
      setMessages(prev => {
        const updated = prev.map(m => 
          m.id === tempId 
            ? { ...m, conteudo: '❌ Erro no envio do áudio', metadata: { send_error: true } } 
            : m
        );
        messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
        return updated;
      });
      toast({ title: 'Erro', description: 'Falha ao enviar áudio', variant: 'destructive' });
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

  // Format phone for display - melhor formatação
  const formatPhone = (phone?: string) => {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, '');
    
    // Se for número muito longo (possível ID de grupo), retornar null
    if (clean.length > 15) return null;
    
    // Format Brazilian phone: (92) 99999-9999
    if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
      const ddd = clean.slice(2, 4);
      const rest = clean.slice(4);
      if (rest.length === 9) {
        return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
      } else if (rest.length === 8) {
        return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
      }
    }
    
    // Without country code
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    }
    if (clean.length === 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
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
    
    // Se o telefone é muito longo (grupo), mostrar indicador
    if (sub.telefone && sub.telefone.replace(/\D/g, '').length > 15) {
      return `Grupo #${sub.subscriber_id?.slice(-4) || '????'}`;
    }
    
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

  // Indicador de atividade (baseado na última interação, não em presença real-time)
  const getActivityStatus = (subscriber: Subscriber) => {
    if (!subscriber.ultima_interacao) return { status: 'unknown', text: '' };
    
    const lastInteraction = new Date(subscriber.ultima_interacao);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastInteraction.getTime()) / (1000 * 60));
    
    if (diffMinutes < 5) return { status: 'active', text: 'Ativo agora' };
    if (diffMinutes < 60) return { status: 'recent', text: `há ${diffMinutes} min` };
    if (diffMinutes < 1440) return { status: 'today', text: `há ${Math.floor(diffMinutes / 60)}h` };
    return { status: 'inactive', text: '' };
  };

  const ActivityIndicator = ({ subscriber, showText = false }: { subscriber: Subscriber; showText?: boolean }) => {
    const activity = getActivityStatus(subscriber);
    const isActive = activity.status === 'active' || activity.status === 'recent';
    
    return (
      <div className="flex items-center gap-1.5">
        <span className={`relative flex h-2.5 w-2.5 ${isActive ? '' : 'opacity-50'}`}>
          {activity.status === 'active' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            activity.status === 'active' ? 'bg-emerald-500' : 
            activity.status === 'recent' ? 'bg-yellow-500' : 'bg-gray-400'
          }`} />
        </span>
        {showText && (
          <span className={`text-xs font-medium ${
            activity.status === 'active' ? 'text-emerald-500' : 
            activity.status === 'recent' ? 'text-yellow-500' : themeClasses.secondaryText
          }`}>
            {activity.status === 'active' ? 'Ativo agora' : 
             activity.status === 'recent' ? activity.text :
             activity.status === 'today' ? activity.text : 'Offline'}
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
    })
    .filter(sub => {
      // Filtro por origem do lead
      if (origemFilter === 'all') return true;
      if (origemFilter === 'trafego') return sub.lead_tipo_origem === 'trafego';
      if (origemFilter === 'whatsapp_direto') return sub.lead_tipo_origem === 'whatsapp_direto';
      return true;
    })
    .filter(sub => {
      // Filtro por tags
      if (selectedTagIds.length === 0) return true;
      const subTags = getSubscriberTags(sub.subscriber_id);
      return selectedTagIds.every(tagId => subTags.some(st => st.tag_id === tagId));
    });

  const renderMessage = (message: Message) => {
    const content = message.conteudo || '';
    const type = (message.tipo || 'text').toLowerCase();
    const metadata: any = (message as any).metadata || {};
    const original: any = metadata.original || {};

    // Extrair URL de mídia do payload original da Z-API (ou campos normalizados)
    const mediaUrl =
      metadata.media_url ||
      original?.audio?.audioUrl || original?.audio?.link || original?.audio?.url ||
      original?.image?.imageUrl || original?.image?.link || original?.image?.url ||
      original?.video?.videoUrl || original?.video?.link || original?.video?.url ||
      original?.document?.documentUrl || original?.document?.link || original?.document?.url;

    const caption = metadata.caption || original?.image?.caption || null;
    const fileName = metadata.file_name || original?.document?.fileName || original?.document?.filename || null;

    const urlCandidate = (mediaUrl || content).replace(/^\[|\]$/g, '').trim();

    const isAudio = type === 'audio' || urlCandidate.match(/\.(ogg|mp3|wav|m4a|opus|aac|webm)(\?|$)/i);
    const isImage = type === 'image' || urlCandidate.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
    const isVideo = type === 'video' || urlCandidate.match(/\.(mp4|webm|mov)(\?|$)/i);
    const isDocument =
      type === 'document' ||
      urlCandidate.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)(\?|$)/i);

    if (isAudio) {
      // Use o novo WhatsAppAudioPlayer com waveform e velocidade
      const isSent = message.direcao === 'saida';
      const chatMessage = {
        ...message,
        conteudo: urlCandidate,
        metadata: metadata
      };
      return <WhatsAppAudioPlayer message={chatMessage as any} isSent={isSent} />;
    }
    if (isImage) {
      return (
        <div className="space-y-1">
          <img 
            src={urlCandidate} 
            alt="Imagem" 
            className="max-w-[280px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(urlCandidate, '_blank')}
          />
          {caption && (
            <p className="whitespace-pre-wrap break-words text-[13px] leading-[18px] text-inherit opacity-90 select-text cursor-text">
              {formatWhatsAppTextHelper(caption)}
            </p>
          )}
        </div>
      );
    }
    if (isVideo) {
      return (
        <video controls className="max-w-[280px] rounded-lg" preload="metadata">
          <source src={urlCandidate} />
        </video>
      );
    }
    if (isDocument) {
      const display = fileName || urlCandidate.split('/').pop()?.split('?')[0] || 'Documento';
      const isPdf = urlCandidate.toLowerCase().includes('.pdf') || display.toLowerCase().endsWith('.pdf');
      
      if (isPdf) {
        // PDF com preview embutido
        return (
          <div className={`flex flex-col rounded-lg overflow-hidden ${isDark ? 'bg-[#1F2C33]' : 'bg-[#F0F2F5]'} max-w-[320px]`}>
            {/* Preview do PDF */}
            <div className="relative w-full h-[200px] bg-gray-100 dark:bg-gray-800">
              <iframe
                src={`${urlCandidate}#toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full border-0"
                title={display}
              />
              {/* Overlay para abrir em tela cheia */}
              <div 
                className="absolute inset-0 cursor-pointer opacity-0 hover:opacity-100 transition-opacity bg-black/30 flex items-center justify-center"
                onClick={() => window.open(urlCandidate, '_blank')}
              >
                <div className="bg-white/90 dark:bg-gray-800/90 rounded-lg px-4 py-2 flex items-center gap-2">
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M10.92,12.31C10.68,11.54 10.15,9.08 11.55,9.04C12.95,9 12.03,12.16 12.03,12.16C12.42,13.65 14.05,14.72 14.05,14.72C14.55,14.57 17.4,14.24 17,15.72C16.57,17.2 13.5,15.81 13.5,15.81C11.55,15.95 10.09,16.47 10.09,16.47C8.96,18.58 7.64,19.5 7.1,18.61C6.43,17.5 9.23,16.07 9.23,16.07C10.68,13.72 10.9,12.35 10.92,12.31Z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Abrir PDF</span>
                </div>
              </div>
            </div>
            {/* Footer com nome e download */}
            <div className={`flex items-center gap-3 p-3`}>
              <div className={`p-2 rounded-lg bg-red-500/20`}>
                <svg className="h-6 w-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M10.92,12.31C10.68,11.54 10.15,9.08 11.55,9.04C12.95,9 12.03,12.16 12.03,12.16C12.42,13.65 14.05,14.72 14.05,14.72C14.55,14.57 17.4,14.24 17,15.72C16.57,17.2 13.5,15.81 13.5,15.81C11.55,15.95 10.09,16.47 10.09,16.47C8.96,18.58 7.64,19.5 7.1,18.61C6.43,17.5 9.23,16.07 9.23,16.07C10.68,13.72 10.9,12.35 10.92,12.31Z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${themeClasses.headerText}`}>{display}</p>
                <p className={`text-xs ${themeClasses.secondaryText}`}>Documento PDF</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(urlCandidate, '_blank')}
                className={`shrink-0 h-8 w-8 p-0 ${themeClasses.hoverBtn}`}
                title="Baixar PDF"
              >
                <svg className={`h-5 w-5 ${themeClasses.iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </Button>
            </div>
          </div>
        );
      }
      
      // Outros documentos (não-PDF)
      return (
        <div className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-[#1F2C33]' : 'bg-[#F0F2F5]'} min-w-[200px] max-w-[300px]`}>
          <div className={`p-2 rounded-lg bg-blue-500/20`}>
            <Paperclip className="h-8 w-8 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${themeClasses.headerText}`}>{display}</p>
            <p className={`text-xs ${themeClasses.secondaryText}`}>Documento</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(urlCandidate, '_blank')}
            className={`shrink-0 h-8 w-8 p-0 ${themeClasses.hoverBtn}`}
            title="Baixar documento"
          >
            <svg className={`h-5 w-5 ${themeClasses.iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </Button>
        </div>
      );
    }
    // Texto com formatação WhatsApp (*negrito*, _itálico_, ~riscado~, ```mono```)
    return (
      <div className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px] text-inherit select-text cursor-text">
        {formatWhatsAppTextHelper(content)}
      </div>
    );
  };

  return (
    <div className={`flex h-dvh w-full overflow-hidden ${themeClasses.bg}`}>
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

        {/* Filtros por Origem (Tráfego vs Direto) */}
        <div className={`px-3 py-2 ${themeClasses.sidebar} border-b ${themeClasses.border}`}>
          <div className="flex items-center gap-2 overflow-x-auto">
            {(['all', 'trafego', 'whatsapp_direto'] as OrigemFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setOrigemFilter(filter)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-all whitespace-nowrap ${
                  origemFilter === filter
                    ? filter === 'trafego' 
                      ? 'bg-blue-500 text-white shadow-md'
                      : filter === 'whatsapp_direto'
                      ? 'bg-gray-600 text-white shadow-md'
                      : 'bg-[#00A884] text-white shadow-md'
                    : `${themeClasses.inputSearch} ${themeClasses.secondaryText} ${themeClasses.hoverBtn}`
                }`}
              >
                {filter === 'all' ? '📋 Todos' : filter === 'trafego' ? '🎯 Tráfego' : '💬 Direto'}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros por Atendimento + Tags */}
        <div className={`px-3 py-2 ${themeClasses.sidebar} border-b ${themeClasses.border}`}>
          <div className="flex items-center gap-2 flex-wrap">
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
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-1" />
            <TagFilter
              availableTags={availableTags}
              selectedTagIds={selectedTagIds}
              onTagsChange={setSelectedTagIds}
            />
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
                const hasUnread = unreadCounts.get(subscriber.subscriber_id);
                const instanceInfo = getInstanceInfoFromConnectedPhone(subscriber.instance_name);
                const subscriberTags = getSubscriberTags(subscriber.subscriber_id);
                
                return (
                  <div
                    key={subscriber.id}
                    onClick={() => setSelectedSubscriber(subscriber)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-all border-b ${themeClasses.border} ${themeClasses.hover} ${
                      isActive ? themeClasses.active : ''
                    } ${online ? 'border-l-2 border-l-emerald-500' : ''}`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0 mt-0.5">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={subscriber.foto} />
                        <AvatarFallback className="bg-gradient-to-br from-[#00A884] to-[#008069] text-white text-base font-medium">
                          {getInitials(subscriber)}
                        </AvatarFallback>
                      </Avatar>
                      {/* Online indicator */}
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
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Linha 1: Nome + Timestamp */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ChannelIcon canal={subscriber.canal} size="sm" />
                          <span className={`font-medium text-[15px] truncate ${hasUnread ? 'text-white' : themeClasses.headerText}`}>
                            {getDisplayName(subscriber)}
                          </span>
                        </div>
                        <span className={`text-[11px] shrink-0 ${hasUnread ? 'text-[#25D366] font-semibold' : themeClasses.secondaryText}`}>
                          {subscriber.ultima_interacao && formatLastMessageTime(subscriber.ultima_interacao)}
                        </span>
                      </div>
                      
                      {/* Linha 2: Badges + Unread count */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {/* Instance badge */}
                          {instanceInfo && <InstanceBadge instance={instanceInfo} size="sm" />}
                          {/* Subscriber tags */}
                          {subscriberTags.slice(0, 2).map((st) => (
                            st.tag && <TagBadge key={st.id} tag={st.tag} size="sm" />
                          ))}
                          {subscriberTags.length > 2 && (
                            <span className={`text-[10px] ${themeClasses.secondaryText}`}>
                              +{subscriberTags.length - 2}
                            </span>
                          )}
                          {online && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                              online
                            </span>
                          )}
                        </div>
                        {/* Unread badge */}
                        {hasUnread ? (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#25D366] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                            {hasUnread}
                          </span>
                        ) : (
                          <CheckCheck className="h-4 w-4 text-[#53BDEB] shrink-0" />
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
      <div className={`${!showMobileChat ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0`}>
        {selectedSubscriber ? (
          <>
            {/* Header do Chat */}
            <div className={`h-[50px] md:min-h-[62px] px-1.5 md:px-4 flex items-center gap-1.5 md:gap-3 ${themeClasses.header} border-b ${themeClasses.border}`}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setSelectedSubscriber(null); setShowMobileChat(false); }}
                className={`md:hidden h-8 w-8 shrink-0 ${themeClasses.iconColor}`}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              
              <div className="relative shrink-0">
                <Avatar className="h-9 w-9 md:h-11 md:w-11 cursor-pointer">
                  <AvatarImage src={selectedSubscriber.foto} />
                  <AvatarFallback className="bg-gradient-to-br from-[#00A884] to-[#008069] text-white text-sm">
                    {getInitials(selectedSubscriber)}
                  </AvatarFallback>
                </Avatar>
                {isOnline(selectedSubscriber.subscriber_id) && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 md:h-3.5 md:w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ChannelIcon canal={selectedSubscriber.canal} size="sm" />
                  <h3 className={`font-semibold text-[14px] md:text-[16px] ${themeClasses.headerText} truncate`}>
                    {getDisplayName(selectedSubscriber)}
                  </h3>
                  {/* Instance badge */}
                  {(() => {
                    const instanceInfo = getInstanceInfoFromConnectedPhone(selectedSubscriber.instance_name);
                    return instanceInfo ? <InstanceBadge instance={instanceInfo} size="sm" /> : null;
                  })()}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden max-h-[16px] md:max-h-none">
                  <ActivityIndicator subscriber={selectedSubscriber} showText />
                  {isTyping(selectedSubscriber.subscriber_id) && (
                    <span className="text-[11px] md:text-xs text-[#00A884] font-medium animate-pulse">digitando...</span>
                  )}
                  {/* Tags do contato - hidden on mobile to save space */}
                  <div className="hidden md:contents">
                    {getSubscriberTags(selectedSubscriber.subscriber_id).slice(0, 3).map((st) => (
                      st.tag && (
                        <TagBadge 
                          key={st.id} 
                          tag={st.tag} 
                          reason={st.reason}
                          size="sm" 
                          showRemove 
                          onRemove={() => removeTagFromSubscriber(selectedSubscriber.subscriber_id, st.tag_id)}
                        />
                      )
                    ))}
                    <TagSelector
                      subscriberId={selectedSubscriber.subscriber_id}
                      availableTags={availableTags}
                      currentTags={getSubscriberTags(selectedSubscriber.subscriber_id)}
                      onAddTag={(tagId, reason) => addTagToSubscriber(selectedSubscriber.subscriber_id, tagId, reason)}
                      onRemoveTag={(tagId) => removeTagFromSubscriber(selectedSubscriber.subscriber_id, tagId)}
                      onCreateTag={createTag}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
                {selectedSubscriber.telefone && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://wa.me/${selectedSubscriber.telefone?.replace(/\D/g, '')}`, '_blank');
                      }}
                      className={`h-8 w-8 md:h-10 md:w-10 rounded-full text-[#00A884] ${themeClasses.hoverBtn}`}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 md:h-5 md:w-5 fill-current">
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
                  className={`h-8 w-8 md:h-10 md:w-10 rounded-full transition-all ${
                    selectedSubscriber.atendimento_humano 
                      ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20' 
                      : `${themeClasses.iconColor} ${themeClasses.hoverBtn}`
                  }`}
                >
                  {selectedSubscriber.atendimento_humano ? <UserRound className="h-4 w-4 md:h-5 md:w-5" /> : <Bot className="h-4 w-4 md:h-5 md:w-5" />}
                </Button>
                
                {/* Desktop-only buttons */}
                <div className="hidden md:flex items-center gap-1">
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
                      className={`h-10 w-10 rounded-full transition-all ${
                        showContextPanel 
                          ? 'text-[#00A884] bg-[#00A884]/10 hover:bg-[#00A884]/20' 
                          : `${themeClasses.iconColor} ${themeClasses.hoverBtn}`
                      }`}
                    >
                      {showContextPanel ? <PanelRightClose className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                    </Button>
                  )}
                </div>
                
                {/* Mobile: dropdown for extra actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className={`h-8 w-8 md:h-10 md:w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}>
                      <MoreVertical className="h-4 w-4 md:h-5 md:w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem className="md:hidden" onClick={async () => {
                      const novoStatus = !selectedSubscriber.atendimento_humano;
                      const { error } = await supabase.from('manychat_subscribers').update({ 
                        atendimento_humano: novoStatus,
                        atendimento_humano_desde: novoStatus ? new Date().toISOString() : null
                      }).eq('subscriber_id', selectedSubscriber.subscriber_id);
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
                    }}>
                      {selectedSubscriber.atendimento_humano ? '🤖 Ativar Isa' : '🙋 Atendimento Humano'}
                    </DropdownMenuItem>
                    {selectedSubscriber.telefone && (
                      <>
                        <DropdownMenuItem className="md:hidden" onClick={() => window.open(`https://wa.me/${selectedSubscriber.telefone?.replace(/\D/g, '')}`, '_blank')}>
                          💬 Abrir no WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem className="md:hidden" onClick={() => window.open(`tel:${selectedSubscriber.telefone}`, '_self')}>
                          📞 Ligar
                        </DropdownMenuItem>
                      </>
                    )}
                    {selectedSubscriber.lead_id && (
                      <DropdownMenuItem onClick={() => navigate(`/leads/${selectedSubscriber.lead_id}`)}>
                        📋 Ver Lead no CRM
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Área de Mensagens */}
            <div 
              className={`flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-16 lg:px-[63px] py-4 ${themeClasses.bg}`}
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
                        <div className={`flex ${isOutgoing ? 'justify-end pr-2' : 'justify-start pl-2'} mb-[3px]`}>
                          <div
                            className={`relative max-w-[75%] md:max-w-[65%] rounded-xl px-2.5 md:px-3 pt-2 pb-2 shadow-md transition-all hover:shadow-lg select-text ${
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
                  ) : selectedFile.type.startsWith('audio/') ? (
                    <audio controls src={previewUrl || ''} className="h-10 flex-1 max-w-[200px]" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-red-500 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {!selectedFile.type.startsWith('audio/') && (
                      <>
                        <p className={`font-medium text-sm truncate ${themeClasses.headerText}`}>{selectedFile.name}</p>
                        <p className={`text-xs ${themeClasses.secondaryText}`}>{(selectedFile.size / 1024).toFixed(1)} KB</p>
                      </>
                    )}
                    {selectedFile.type.startsWith('audio/') && (
                      <p className={`text-xs ${themeClasses.secondaryText}`}>
                        🎧 Ouça antes de enviar
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                  {/* Botão de envio direto para áudio */}
                  {selectedFile.type.startsWith('audio/') && (
                    <Button
                      onClick={sendAudioFromPreview}
                      disabled={isSending}
                      size="icon"
                      className="h-10 w-10 rounded-full bg-[#00A884] hover:bg-[#008069] text-white shadow-lg"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Input de Mensagem */}
            <div className={`min-h-[52px] md:h-[66px] px-2 md:px-4 py-1.5 md:py-2 flex items-center gap-1 md:gap-2 ${themeClasses.header}`}>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,audio/*,video/*" className="hidden" />
              
              <Button variant="ghost" size="icon" className={`hidden md:flex h-10 w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}>
                <Smile className="h-6 w-6" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
                className={`h-8 w-8 md:h-10 md:w-10 rounded-full shrink-0 ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}
              >
                <Paperclip className="h-5 w-5 md:h-6 md:w-6" />
              </Button>

              <div className="flex-1">
                <Input
                  placeholder="Digite uma mensagem"
                  value={newMessage}
                  onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (selectedFile) {
                        if (selectedFile.type.startsWith('audio/')) {
                          sendAudioFromPreview();
                        } else {
                          uploadAndSendFile();
                        }
                      } else {
                        sendMessage();
                      }
                    }
                  }}
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    
                    // Check for images first
                    for (const item of Array.from(items)) {
                      if (item.type.startsWith('image/')) {
                        e.preventDefault();
                        const file = item.getAsFile();
                        if (file) {
                          const namedFile = new File([file], `screenshot_${Date.now()}.png`, { type: file.type });
                          setSelectedFile(namedFile);
                          setPreviewUrl(URL.createObjectURL(namedFile));
                          toast({ title: '📷 Imagem colada!', description: 'Pressione Enter para enviar' });
                        }
                        return;
                      }
                    }
                    
                    // For text, let the default paste behavior work
                    // The Input component handles Ctrl+V for text natively
                  }}
                  disabled={isSending || isRecording}
                  className={`h-[44px] rounded-xl ${themeClasses.input} border-0 text-[15px] focus-visible:ring-0 shadow-sm`}
                />
              </div>

              {newMessage.trim() || (selectedFile && !selectedFile.type.startsWith('audio/')) ? (
                <Button 
                  onClick={selectedFile ? uploadAndSendFile : () => sendMessage()} 
                  disabled={isSending}
                  size="icon"
                  className="h-11 w-11 rounded-full bg-[#00A884] hover:bg-[#008069] text-white shadow-lg transition-all hover:scale-105"
                >
                  <Send className="h-5 w-5" />
                </Button>
              ) : selectedFile?.type.startsWith('audio/') ? null : isRecording ? (
                <Button
                  size="icon"
                  onClick={stopRecording}
                  className="h-11 w-11 rounded-full bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-lg transition-all"
                >
                  <Square className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={startRecording}
                  disabled={isSending}
                  className={`h-11 w-11 rounded-full transition-all ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}
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
