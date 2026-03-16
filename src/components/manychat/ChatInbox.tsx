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
import { MessageContextMenu } from '@/components/chat/MessageContextMenu';
import { ForwardMessageModal } from '@/components/chat/ForwardMessageModal';
import { ConversationSearch } from '@/components/chat/ConversationSearch';
import { SendContactModal } from '@/components/chat/SendContactModal';
import { formatWhatsAppText as formatWhatsAppTextHelper } from '@/lib/whatsappTextFormatter';
import { InstanceInfo, getInstanceFromPhone } from '@/lib/instanceUtils';
import { invokeZapiSend } from '@/lib/zapiSendClient';

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
  Square,
  LayoutGrid,
  Megaphone,
  Star,
  Contact,
  Pin
} from 'lucide-react';
import CalWidget from './CalWidget';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
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
    return { name: 'Bentes Ramos-2', label: 'Tráfego', color: 'red' };
  }
  
  // Bentes Ramos: 92 99160-4348 (stored as 559291604348)
  if (phone.includes('559291604348') || phone.includes('5592991604348') || phone.endsWith('91604348')) {
    return { name: 'Bentes Ramos', label: 'Bentes Ramos', color: 'blue' };
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
  
  // New features state
  const [starredMessageIds, setStarredMessageIds] = useState<Set<string>>(new Set());
  const [deletedForMeIds, setDeletedForMeIds] = useState<Set<string>>(new Set());
  const [showConversationSearch, setShowConversationSearch] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwardMessageContent, setForwardMessageContent] = useState('');
  const [sendContactModalOpen, setSendContactModalOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [pinnedMessagesBySubscriber, setPinnedMessagesBySubscriber] = useState<Record<string, string>>({});
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  
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
  const messageCacheTimestampRef = useRef<Map<string, number>>(new Map());
  // Set-based dedup keys for O(1) lookup
  const dedupKeysRef = useRef<Set<string>>(new Set());
  // Guard anti-disparo duplo (Enter/click rápido)
  const outboundSendGuardRef = useRef<Map<string, number>>(new Map());
  // Guard anti-race para carregamento de mensagens
  const loadMessagesRequestRef = useRef(0);
  // Debounce subscriber reorder
  const pendingBumpsRef = useRef<Map<string, string>>(new Map()); // subscriberId -> ISO timestamp
  const bumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Rastrear mensagens não lidas por subscriber
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  // Rastrear preview da última mensagem por subscriber_id
  const [lastMessagePreviews, setLastMessagePreviews] = useState<Map<string, string>>(new Map());
  const lastReadRef = useRef<Record<string, string>>({});

  // Load preferences from localStorage on mount
  const LAST_READ_KEY = 'chat_last_read_v3';
  const PINNED_MESSAGES_KEY = 'chat_pinned_messages_v1';
  useEffect(() => {
    try {
      // Clean up old keys
      localStorage.removeItem('chat_last_read');
      localStorage.removeItem('chat_last_read_v2');
      const stored = localStorage.getItem(LAST_READ_KEY);
      if (stored) lastReadRef.current = JSON.parse(stored);

      const pinnedStored = localStorage.getItem(PINNED_MESSAGES_KEY);
      if (pinnedStored) {
        setPinnedMessagesBySubscriber(JSON.parse(pinnedStored));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PINNED_MESSAGES_KEY, JSON.stringify(pinnedMessagesBySubscriber));
    } catch {
      /* ignore */
    }
  }, [pinnedMessagesBySubscriber]);

  const getPhoneDigits = (value?: string | null) => (value || '').replace(/\D/g, '');

  const addBrazilPhoneVariants = (digits: string, out: Set<string>) => {
    if (!/^\d+$/.test(digits)) return;

    const withCountry = digits.startsWith('55')
      ? digits
      : (digits.length >= 10 ? `55${digits}` : digits);

    if (!withCountry || withCountry.length < 10) return;

    const local = withCountry.startsWith('55') ? withCountry.slice(2) : withCountry;

    // As-is
    out.add(withCountry);
    out.add(local);

    // BR mobile: support with and without 9th digit to unify legacy history
    if (local.length === 11 && local[2] === '9') {
      const withoutNine = `${local.slice(0, 2)}${local.slice(3)}`;
      out.add(withoutNine);
      out.add(`55${withoutNine}`);
    }

    if (local.length === 10 && /^[1-9]{2}[6-9]/.test(local)) {
      const withNine = `${local.slice(0, 2)}9${local.slice(2)}`;
      out.add(withNine);
      out.add(`55${withNine}`);
    }
  };

  const buildPossibleSubscriberIds = (subscriberId: string, phone?: string | null) => {
    const ids = new Set<string>();
    ids.add(subscriberId);

    const rawId = subscriberId.startsWith('zapi_')
      ? subscriberId.replace('zapi_', '')
      : subscriberId;

    if (/^\d+$/.test(rawId)) {
      addBrazilPhoneVariants(rawId, ids);
    }

    const phoneDigits = getPhoneDigits(phone);
    if (phoneDigits) {
      addBrazilPhoneVariants(phoneDigits, ids);
    }

    const phoneLikeIds = Array.from(ids).filter((v) => /^\d{8,14}$/.test(v));
    phoneLikeIds.forEach((v) => ids.add(`zapi_${v}`));

    return Array.from(ids);
  };

  const getSubscriberPhoneSuffix = (sub: Subscriber) => {
    const fromPhone = getPhoneDigits(sub.telefone);
    const rawId = sub.subscriber_id.startsWith('zapi_') ? sub.subscriber_id.replace('zapi_', '') : sub.subscriber_id;
    const fromId = getPhoneDigits(rawId);
    const candidate = fromPhone || fromId;
    const normalized = candidate.startsWith('55') ? candidate.slice(2) : candidate;
    return normalized.length >= 9 ? normalized.slice(-9) : '';
  };

  const getConversationUnreadKey = (sub: Subscriber) => {
    if (sub.lead_id) return `lead:${sub.lead_id}`;
    const suffix = getSubscriberPhoneSuffix(sub);
    if (suffix) return `phone:${suffix}`;
    return `sid:${sub.subscriber_id}`;
  };

  const getConversationUnreadKeyFromMessage = (msgSubId: string, msgLeadId?: string | null) => {
    if (msgLeadId) return `lead:${msgLeadId}`;
    const rawId = msgSubId.startsWith('zapi_') ? msgSubId.replace('zapi_', '') : msgSubId;
    const digits = rawId.replace(/\D/g, '');
    const normalized = digits.startsWith('55') ? digits.slice(2) : digits;
    if (normalized.length >= 9) return `phone:${normalized.slice(-9)}`;
    return `sid:${msgSubId}`;
  };

  const getLastReadForSubscriber = (sub: Subscriber, lastRead: Record<string, string>) => {
    const unreadKey = getConversationUnreadKey(sub);
    return lastRead[unreadKey] || lastRead[sub.subscriber_id] || '';
  };

  const hasUnreadHintForSubscriber = (sub: Subscriber) => {
    const lr = getLastReadForSubscriber(sub, lastReadRef.current);
    return !!(lr && sub.ultima_interacao && sub.ultima_interacao > lr);
  };

  // Helper to save lastRead
  const saveLastRead = useCallback((subscriber: Subscriber | null) => {
    if (!subscriber) return;
    const now = new Date().toISOString();
    const unreadKey = getConversationUnreadKey(subscriber);
    lastReadRef.current[unreadKey] = now;
    lastReadRef.current[subscriber.subscriber_id] = now; // compat legada
    try {
      localStorage.setItem(LAST_READ_KEY, JSON.stringify(lastReadRef.current));
    } catch { /* ignore */ }
  }, []);

  // Calculate unread counts from DB after subscribers load
  const computeInitialUnreads = useCallback(async (subs: typeof subscribers) => {
    if (subs.length === 0) return;
    const lastRead = { ...lastReadRef.current };

    // Check all subscribers for unread messages
    const toCheck: Array<{ subscriber: Subscriber; unreadKey: string; since: string }> = [];
    for (const sub of subs) {
      const unreadKey = getConversationUnreadKey(sub);
      const lr = getLastReadForSubscriber(sub, lastRead);

      // Migração silenciosa para chave canônica
      if (lr && !lastRead[unreadKey]) {
        lastRead[unreadKey] = lr;
      }

      if (!lr) {
        // First time seeing this subscriber - check unreads from last 7 days
        if (sub.ultima_interacao) {
          const diff = Date.now() - new Date(sub.ultima_interacao).getTime();
          if (diff < 7 * 86400000) { // 7 days
            toCheck.push({ subscriber: sub, unreadKey, since: new Date(Date.now() - 7 * 86400000).toISOString() });
          }
          // Don't auto-mark old subscribers as read - they simply won't have unreads
        }
        continue;
      }

      // If ultima_interacao is after lastRead, there might be unreads
      if (sub.ultima_interacao && sub.ultima_interacao > lr) {
        toCheck.push({ subscriber: sub, unreadKey, since: lr });
      }
    }

    if (toCheck.length === 0) {
      lastReadRef.current = lastRead;
      try { localStorage.setItem(LAST_READ_KEY, JSON.stringify(lastReadRef.current)); } catch {}
      return;
    }

    console.log('[Unreads] Checking', toCheck.length, 'subscribers for unread messages');

    // Query unread counts in batches
    const newUnreads = new Map<string, number>();
    const batchSize = 50;
    for (let i = 0; i < toCheck.length; i += batchSize) {
      const batch = toCheck.slice(i, i + batchSize);
      const promises = batch.map(async ({ subscriber, unreadKey, since }) => {
        const subscriber_id = subscriber.subscriber_id;
        const possibleIds = buildPossibleSubscriberIds(subscriber_id, subscriber.telefone);

        const leadId = subscriber.lead_id;

        try {
          let query = supabase
            .from('manychat_mensagens')
            .select('id', { count: 'exact', head: true })
            .eq('direcao', 'entrada')
            .gt('created_at', since);

          if (leadId) {
            query = query.or(`subscriber_id.in.(${possibleIds.join(',')}),lead_id.eq.${leadId}`);
          } else {
            query = query.in('subscriber_id', possibleIds);
          }

          const { count, error } = await query;
          if (error) {
            console.error('[Unreads] Error querying for', subscriber_id, error);
            return;
          }
          if (count && count > 0) {
            newUnreads.set(unreadKey, count);
          }
        } catch (err) {
          console.error('[Unreads] Exception querying for', subscriber_id, err);
        }
      });
      await Promise.all(promises);
    }

    console.log('[Unreads] Found', newUnreads.size, 'subscribers with unread messages');

    if (newUnreads.size > 0) {
      setUnreadCounts(prev => {
        const merged = new Map(prev);
        for (const [k, v] of newUnreads) {
          merged.set(k, Math.max(merged.get(k) || 0, v));
        }
        return merged;
      });
    }

    lastReadRef.current = lastRead;
    try { localStorage.setItem(LAST_READ_KEY, JSON.stringify(lastReadRef.current)); } catch {}
  }, []);

  // Load last message previews for all subscribers
  const loadMessagePreviews = useCallback(async (subs: typeof subscribers) => {
    if (subs.length === 0) return;
    
    // Get the most recent message for each subscriber using lead_id or subscriber_id
    const subscriberIds = subs.map(s => s.subscriber_id);
    const leadIds = subs.map(s => s.lead_id).filter(Boolean) as string[];
    
    // Fetch last messages by lead_id (most reliable)
    const previewMap = new Map<string, string>();
    
    if (leadIds.length > 0) {
      // We need to get the most recent message per lead
      const { data: messages } = await supabase
        .from('manychat_mensagens')
        .select('lead_id, subscriber_id, conteudo, tipo, direcao, created_at')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (messages) {
        const seenLeads = new Set<string>();
        for (const msg of messages as any[]) {
          const leadId = msg.lead_id as string;
          if (seenLeads.has(leadId)) continue;
          seenLeads.add(leadId);
          
          // Find subscriber with this lead_id
          const sub = subs.find(s => s.lead_id === leadId);
          if (sub) {
            const prefix = msg.direcao === 'saida' ? 'Você: ' : '';
            let text = msg.conteudo || '';
            if (msg.tipo === 'audio') text = '🎤 Áudio';
            else if (msg.tipo === 'image') text = '📷 Imagem';
            else if (msg.tipo === 'video') text = '🎥 Vídeo';
            else if (msg.tipo === 'document') text = '📄 Documento';
            else if (msg.tipo === 'sticker') text = '🏷️ Figurinha';
            else if (msg.tipo === 'location') text = '📍 Localização';
            previewMap.set(sub.subscriber_id, prefix + text);
          }
        }
      }
    }
    
    // Fallback: fetch by subscriber_id for those without lead_id
    const missingSubs = subs.filter(s => !previewMap.has(s.subscriber_id));
    if (missingSubs.length > 0) {
      const variantToCanonical = new Map<string, string>();
      missingSubs.forEach((sub) => {
        const variants = buildPossibleSubscriberIds(sub.subscriber_id, sub.telefone);
        variants.forEach((variant) => variantToCanonical.set(variant, sub.subscriber_id));
      });

      const fallbackIds = Array.from(variantToCanonical.keys());

      const { data: messages } = await supabase
        .from('manychat_mensagens')
        .select('subscriber_id, conteudo, tipo, direcao, created_at')
        .in('subscriber_id', fallbackIds)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (messages) {
        const seen = new Set<string>();
        for (const msg of messages as any[]) {
          const sid = msg.subscriber_id as string;
          const canonicalSid = variantToCanonical.get(sid) || sid;
          if (seen.has(canonicalSid)) continue;
          seen.add(canonicalSid);
          
          const sub = subs.find(s => s.subscriber_id === canonicalSid);
          if (sub && !previewMap.has(sub.subscriber_id)) {
            const prefix = msg.direcao === 'saida' ? 'Você: ' : '';
            let text = msg.conteudo || '';
            if (msg.tipo === 'audio') text = '🎤 Áudio';
            else if (msg.tipo === 'image') text = '📷 Imagem';
            else if (msg.tipo === 'video') text = '🎥 Vídeo';
            else if (msg.tipo === 'document') text = '📄 Documento';
            else if (msg.tipo === 'sticker') text = '🏷️ Figurinha';
            else if (msg.tipo === 'location') text = '📍 Localização';
            previewMap.set(sub.subscriber_id, prefix + text);
          }
        }
      }
    }
    
    setLastMessagePreviews(previewMap);
  }, []);

  // Trigger unread computation and message previews when subscribers load
  const subscribersLoadedRef = useRef(false);
  useEffect(() => {
    if (subscribers.length > 0 && !subscribersLoadedRef.current) {
      subscribersLoadedRef.current = true;
      computeInitialUnreads(subscribers);
      loadMessagePreviews(subscribers);
    }
  }, [subscribers, computeInitialUnreads, loadMessagePreviews]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const scrollToBottom = (instant = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
  };

  // Extrator robusto de message_id do provedor (Z-API)
  const getProviderMessageId = (msg: any): string | undefined => {
    const mid = msg?.metadata?.message_id || msg?.metadata?.original?.messageId || msg?.metadata?.original?.id?.id || msg?.metadata?.original?.id;
    return typeof mid === 'string' && mid.length > 5 ? mid : undefined;
  };

  // Chave de deduplicação ROBUSTA - múltiplas camadas para evitar duplicatas
  const getMessageDedupeKey = (msg: any) => {
    // 1. Provider message_id do metadata (mais confiável)
    const mid = getProviderMessageId(msg);
    if (mid) return `mid_${mid}`;
    
    // 2. Fallback: hash do conteúdo + direção + timestamp (primeiros 16 chars do ISO)
    const contentHash = (msg?.conteudo || '').substring(0, 100);
    const timePrefix = (msg?.created_at || '').substring(0, 16); // yyyy-mm-ddTHH:MM
    const direcao = msg?.direcao || 'unknown';
    if (contentHash && timePrefix) return `hash_${direcao}_${timePrefix}_${contentHash}`;
    
    // 3. Último recurso: ID do banco
    return `db_${msg?.id}`;
  };

  const shouldSkipRapidDuplicateSend = useCallback((sendKey: string, windowMs = 1200) => {
    const now = Date.now();
    const lastSentAt = outboundSendGuardRef.current.get(sendKey) || 0;
    if (now - lastSentAt < windowMs) return true;
    outboundSendGuardRef.current.set(sendKey, now);

    // Limpeza simples para evitar crescimento indefinido
    if (outboundSendGuardRef.current.size > 200) {
      const cutoff = now - 60_000;
      for (const [key, ts] of outboundSendGuardRef.current.entries()) {
        if (ts < cutoff) outboundSendGuardRef.current.delete(key);
      }
    }

    return false;
  }, []);

  const isLikelyDuplicateOutbound = (a: Message, b: Message) => {
    if (a.direcao !== 'saida' || b.direcao !== 'saida') return false;
    if ((a.tipo || 'text') !== (b.tipo || 'text')) return false;
    if ((a.subscriber_id || '') !== (b.subscriber_id || '')) return false;
    if ((a.conteudo || '').trim() !== (b.conteudo || '').trim()) return false;

    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
    return Math.abs(ta - tb) <= 8000;
  };

  const compareMessagesChronological = (a: Message, b: Message) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb; // ascending: oldest first
    return String(a.id).localeCompare(String(b.id));
  };

  const mergeMessageDedup = (current: Message[], incoming: Message) => {
    const incomingKey = getMessageDedupeKey(incoming);
    return [...current.filter(msg => (
      msg.id !== incoming.id &&
      getMessageDedupeKey(msg) !== incomingKey &&
      !isLikelyDuplicateOutbound(msg, incoming)
    )), incoming].sort(compareMessagesChronological);
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

  // Track current conversation identity (subscriber + lead + phone) to avoid stale history
  const getConversationHistoryKey = (subscriber: Subscriber | null) => {
    if (!subscriber) return null;
    const phone = (subscriber.telefone || '').replace(/\D/g, '');
    return `${subscriber.subscriber_id}|${subscriber.lead_id || ''}|${phone}`;
  };
  const selectedConversationHistoryKeyRef = useRef<string | null>(null);

  // Initial load only — realtime is primary, polling is a light fallback
  useEffect(() => {
    loadSubscribers();
    
    // Remove duplicate polling — useChatSubscribers already handles this
    // Only keep a very light visibility handler here for tab switches
    let lastLoad = Date.now();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad > 60000) {
        lastLoad = Date.now();
        loadSubscribers();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

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

  // Ref para subscribers list (para acesso em callbacks realtime sem re-render)
  const subscribersRef = useRef<Subscriber[]>([]);
  useEffect(() => {
    subscribersRef.current = subscribers;
  }, [subscribers]);

  // Helper to find matching subscriber by message subscriber_id or lead_id
  const findMatchingSubscriber = (msgSubId: string, msgLeadId?: string): Subscriber | undefined => {
    const subs = subscribersRef.current;
    // Exact match
    let match = subs.find(s => s.subscriber_id === msgSubId);
    if (match) return match;
    // By lead_id
    if (msgLeadId) {
      match = subs.find(s => s.lead_id === msgLeadId);
      if (match) return match;
    }
    // By phone suffix
    if (msgSubId.startsWith('zapi_')) {
      const phone = msgSubId.replace('zapi_', '');
      const suffix = phone.slice(-9);
      match = subs.find(s => {
        const subPhone = s.telefone?.replace(/\D/g, '') || '';
        return subPhone.endsWith(suffix) || s.subscriber_id.includes(suffix);
      });
    }
    return match;
  };

  // Realtime subscriptions - stable, no dependency on selectedSubscriber
  useEffect(() => {
    console.log('[ManyChatInbox] Configurando canais realtime...');
    
    let isSubscribed = true;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    
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
            const currentLeadId = currentSub?.lead_id;
            const currentConversationIds = currentSubId
              ? new Set(buildPossibleSubscriberIds(currentSubId, currentSub?.telefone))
              : null;
            
            const isCurrentChat = !!(currentSub && (
              (currentConversationIds?.has(newMsg.subscriber_id) ?? false) ||
              (currentLeadId && (newMsg as any).lead_id === currentLeadId)
            ));
            
            // Update messages if current chat
            if (isCurrentChat) {
              console.log('[Realtime] Adicionando mensagem ao chat atual');
              const newMsgDedupeKey = getMessageDedupeKey(newMsg);
              // O(1) dedup check using Set
              if (dedupKeysRef.current.has(newMsgDedupeKey) || dedupKeysRef.current.has(`db_${newMsg.id}`)) return;
              dedupKeysRef.current.add(newMsgDedupeKey);
              dedupKeysRef.current.add(`db_${newMsg.id}`);
              setMessages(prev => {
                const updated = mergeMessageDedup(prev, newMsg as Message);
                if (currentSubId) {
                  messagesCacheRef.current.set(currentSubId, updated);
                  messageCacheTimestampRef.current.set(currentSubId, Date.now());
                }
                return updated;
              });
              scrollToBottom();
            } else {
              // Mensagem para outro chat - NÃO popular cache parcial (causa histórico incompleto)
              // Apenas invalidar o cache para forçar recarga completa quando abrir
              const msgSubId = newMsg.subscriber_id;
              messagesCacheRef.current.delete(msgSubId);
              
              // Incrementar contador de não lidas (só para mensagens de entrada)
              // Find the matching subscriber to use their subscriber_id as the key
              if (newMsg.direcao === 'entrada') {
                setUnreadCounts(prev => {
                  const newMap = new Map(prev);
                  // Find matching subscriber by subscriber_id, lead_id, or phone
                  const matchingSub = findMatchingSubscriber(newMsg.subscriber_id, (newMsg as any).lead_id);
                  const key = matchingSub
                    ? getConversationUnreadKey(matchingSub)
                    : getConversationUnreadKeyFromMessage(msgSubId, (newMsg as any).lead_id);
                  const current = newMap.get(key) || 0;
                  newMap.set(key, current + 1);
                  return newMap;
                });
              }
            }
            
            // Update last message preview
            {
              const matchingSub = findMatchingSubscriber(newMsg.subscriber_id, (newMsg as any).lead_id);
              const key = matchingSub?.subscriber_id || newMsg.subscriber_id;
              const prefix = newMsg.direcao === 'saida' ? 'Você: ' : '';
              let text = newMsg.conteudo || '';
              const tipo = (newMsg as any).tipo;
              if (tipo === 'audio') text = '🎤 Áudio';
              else if (tipo === 'image') text = '📷 Imagem';
              else if (tipo === 'video') text = '🎥 Vídeo';
              else if (tipo === 'document') text = '📄 Documento';
              else if (tipo === 'sticker') text = '🏷️ Figurinha';
              else if (tipo === 'location') text = '📍 Localização';
              setLastMessagePreviews(prev => {
                const newMap = new Map(prev);
                newMap.set(key, prefix + text);
                return newMap;
              });
            }
            
            // Play notification for ALL incoming messages
            if (newMsg.direcao === 'entrada') {
              playNotificationSound();
              if (!isCurrentChat) {
                notifyNewMessage(newMsg.subscriber_nome || 'Novo contato', newMsg.conteudo?.substring(0, 100) || '');
              }
            }
            
            // Debounced subscriber reorder - batch updates every 500ms
            pendingBumpsRef.current.set(newMsg.subscriber_id, new Date().toISOString());
            if (!bumpTimerRef.current) {
              bumpTimerRef.current = setTimeout(() => {
                const bumps = new Map(pendingBumpsRef.current);
                pendingBumpsRef.current.clear();
                bumpTimerRef.current = null;
                
                setSubscribers(prev => {
                  let updated = [...prev];
                  for (const [bumpSubId, bumpTime] of bumps) {
                    let idx = updated.findIndex(s => s.subscriber_id === bumpSubId);
                    if (idx === -1) {
                      // Try by phone suffix
                      if (bumpSubId.startsWith('zapi_')) {
                        const phoneSuffix = bumpSubId.replace('zapi_', '').slice(-9);
                        idx = updated.findIndex(s => {
                          const subPhone = s.telefone?.replace(/\D/g, '') || '';
                          return subPhone.endsWith(phoneSuffix) || s.subscriber_id.includes(phoneSuffix);
                        });
                      }
                    }
                    if (idx === -1) {
                      loadSubscribers();
                      continue;
                    }
                    const [subscriber] = updated.splice(idx, 1);
                    updated = [{ ...subscriber, ultima_interacao: bumpTime }, ...updated];
                  }
                  return updated;
                });
              }, 500);
            }
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
              
              // Update selected subscriber - only auxiliary fields, preserve identity
              if (selectedSubscriberRef.current?.subscriber_id === updatedSub.subscriber_id) {
                setSelectedSubscriber(prev => prev ? { 
                  ...prev, 
                  nome: updatedSub.nome || prev.nome, 
                  atendimento_humano: updatedSub.atendimento_humano,
                  atendimento_humano_desde: updatedSub.atendimento_humano_desde,
                  lead_id: updatedSub.lead_id || prev.lead_id,
                } : null);
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

  // Update team presence and load messages when conversation identity changes
  // ONLY subscriber_id drives conversation switching - lead_id/telefone changes do NOT trigger reload
  const prevSelectedSubIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentSubId = selectedSubscriber?.subscriber_id || null;
    
    // Only reload when subscriber_id actually changes (user clicked a different contact)
    if (currentSubId === prevSelectedSubIdRef.current) return;
    prevSelectedSubIdRef.current = currentSubId;

    if (selectedSubscriber) {
      // ALWAYS clear messages immediately to prevent cross-conversation leakage
      setMessages([]);
      dedupKeysRef.current = new Set();
      setSelectedMessageIds(new Set());
      setReplyToMessage(null);
      
      // Cache-first: show cached messages immediately if fresh (< 30s)
      const cachedMessages = messagesCacheRef.current.get(selectedSubscriber.subscriber_id);
      const cacheAge = Date.now() - (messageCacheTimestampRef.current.get(selectedSubscriber.subscriber_id) || 0);
      const isCacheFresh = cacheAge < 30000; // 30 seconds
      
      if (cachedMessages && cachedMessages.length > 0) {
        const sortedCache = [...cachedMessages].sort(compareMessagesChronological);
        setMessages(sortedCache);
        // Rebuild dedup set from cache
        dedupKeysRef.current = new Set(sortedCache.map(m => getMessageDedupeKey(m)));
        sortedCache.forEach(m => dedupKeysRef.current.add(`db_${m.id}`));
        setIsLoadingMessages(false);
        
        if (isCacheFresh) {
          // Cache is fresh - skip DB fetch entirely
        } else {
          // Cache is stale - refresh silently in background (no loading spinner)
          loadMessages(selectedSubscriber.subscriber_id, false, selectedSubscriber);
        }
      } else {
        // No cache - must load from DB
        loadMessages(selectedSubscriber.subscriber_id, false, selectedSubscriber);
      }

      // Limpar contador de não lidas ao abrir conversa e salvar lastRead
      setUnreadCounts(prev => {
        const newMap = new Map(prev);
        const unreadKey = getConversationUnreadKey(selectedSubscriber);
        newMap.delete(unreadKey);
        newMap.delete(selectedSubscriber.subscriber_id); // compat legada
        return newMap;
      });
      saveLastRead(selectedSubscriber);

      setCurrentChat(selectedSubscriber.subscriber_id);
      setShowMobileChat(true);
    } else {
      setMessages([]);
      setCurrentChat(null);
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
      
      // Detectar instância: SKIP queries for subscribers that already have instance_name in DB
      const subsWithoutInstance = rawSubscribers.filter(s => !s.instance_name);
      const instanceByLeadId = new Map<string, string>();
      const instanceBySubscriberId = new Map<string, string>();

      if (subsWithoutInstance.length > 0) {
        const missingLeadIds = [...new Set(subsWithoutInstance.map(s => s.lead_id).filter(Boolean))] as string[];
        const missingSubIds = subsWithoutInstance.map(s => s.subscriber_id);

        // 1) Por lead_id - only for subs missing instance_name
        if (missingLeadIds.length > 0) {
          const { data: messagesByLead } = await supabase
            .from('manychat_mensagens')
            .select('lead_id, metadata, created_at')
            .in('lead_id', missingLeadIds)
            .order('created_at', { ascending: false })
            .limit(500);

          if (messagesByLead) {
            for (const msg of messagesByLead as any[]) {
              const lid = msg.lead_id as string | null;
              if (!lid || instanceByLeadId.has(lid)) continue;
              const connectedPhone = (msg.metadata as any)?.original?.connectedPhone;
              if (connectedPhone) instanceByLeadId.set(lid, connectedPhone);
            }
          }
        }

        // 2) Fallback por subscriber_id - only for subs missing instance_name
        if (missingSubIds.length > 0) {
          const { data: messagesBySubscriber } = await supabase
            .from('manychat_mensagens')
            .select('subscriber_id, metadata, created_at')
            .in('subscriber_id', missingSubIds)
            .order('created_at', { ascending: false })
            .limit(500);

          if (messagesBySubscriber) {
            for (const msg of messagesBySubscriber as any[]) {
              const sid = msg.subscriber_id as string;
              if (!sid || instanceBySubscriberId.has(sid)) continue;
              const connectedPhone = (msg.metadata as any)?.original?.connectedPhone;
              if (connectedPhone) instanceBySubscriberId.set(sid, connectedPhone);
            }
          }
        }
        
        console.log('[loadSubscribers] Instance lookup: skipped', rawSubscribers.length - subsWithoutInstance.length, 'subs (already have instance_name), queried for', subsWithoutInstance.length);
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
            instance_name: sub.instance_name || (sub.lead_id ? instanceByLeadId.get(sub.lead_id) : undefined) || instanceBySubscriberId.get(sub.subscriber_id) || undefined
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

      // Se a conversa atual já está aberta, re-hidratar campos enriquecidos (ex: instance_name)
      // MAS preservar a identidade (subscriber_id) para evitar troca involuntária de conversa
      if (selectedSubscriberRef.current) {
        const currentSubId = selectedSubscriberRef.current.subscriber_id;
        const refreshedSelected = uniqueSubscribers.find(s => s.subscriber_id === currentSubId);
        if (refreshedSelected) {
          // Apenas atualizar campos auxiliares sem disparar re-render de identidade
          setSelectedSubscriber(prev => prev ? { ...prev, instance_name: refreshedSelected.instance_name, lead_tipo_origem: refreshedSelected.lead_tipo_origem, nome: refreshedSelected.nome || prev.nome, lead_id: refreshedSelected.lead_id || prev.lead_id } : null);
        }
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

  const loadMessages = async (subscriberId: string, loadAll = false, subscriberOverride?: Subscriber | null) => {
    const requestId = ++loadMessagesRequestRef.current;
    setIsLoadingMessages(true);
    try {
      // Get subscriber for phone and lead_id - prefer override to avoid stale state
      const currentSub = subscriberOverride || subscribers.find(s => s.subscriber_id === subscriberId) || selectedSubscriberRef.current;
      const phoneClean = currentSub?.telefone?.replace(/\D/g, '') || '';
      const leadId = currentSub?.lead_id;
      
      // Build comprehensive list of possible subscriber_ids (with/without 9th digit)
      const idsArray = buildPossibleSubscriberIds(subscriberId, phoneClean);
      console.log('[loadMessages] Buscando mensagens para:', { subscriberId, possibleIds: idsArray, leadId, phoneClean });
      
      // Build OR filter for subscriber_id
      const idsFilter = idsArray.map(id => `subscriber_id.eq.${id}`).join(',');
      
      // Build query
      let query = supabase
        .from('manychat_mensagens' as any)
        .select('*')
        .order('created_at', { ascending: false });

      // Match subscriber_id OR lead_id (lead_id is most reliable for unified history)
      if (leadId) {
        query = query.or(`${idsFilter},lead_id.eq.${leadId}`);
      } else {
        query = query.or(idsFilter);
      }

      if (!loadAll) {
        query = query.limit(1000);
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
      
      const uniqueMessages = Array.from(messagesMap.values()).sort(compareMessagesChronological);
      
      console.log('[loadMessages] Mensagens carregadas:', uniqueMessages.length, 'entrada:', uniqueMessages.filter(m => m.direcao === 'entrada').length, 'saída:', uniqueMessages.filter(m => m.direcao === 'saida').length);
      
      // Salvar no cache para acesso instantâneo
      messagesCacheRef.current.set(subscriberId, uniqueMessages);
      messageCacheTimestampRef.current.set(subscriberId, Date.now());
      // Rebuild dedup Set
      dedupKeysRef.current = new Set(uniqueMessages.map(m => getMessageDedupeKey(m)));
      uniqueMessages.forEach(m => dedupKeysRef.current.add(`db_${m.id}`));
      
      // Race condition guard: if another loadMessages was called since, discard this result
      if (loadMessagesRequestRef.current !== requestId) {
        console.log('[loadMessages] Resultado descartado - subscriber mudou durante fetch');
        return;
      }
      
      // Extra safety: verify we're still on the same conversation
      if (selectedSubscriberRef.current?.subscriber_id !== subscriberId) {
        console.log('[loadMessages] Resultado descartado - conversa mudou:', subscriberId, '→', selectedSubscriberRef.current?.subscriber_id);
        return;
      }
      
      // Merge com mensagens realtime que chegaram durante o fetch (evita perder msgs)
      setMessages(prev => {
        // Pegar mensagens temporárias (optimistic) que PERTENCEM a esta conversa
        const tempMessages = prev.filter(m => 
          m.id.startsWith('temp_') && 
          (!m.subscriber_id || m.subscriber_id === subscriberId)
        );
        // Pegar mensagens realtime que podem ter chegado durante o fetch
        // ONLY keep messages that belong to this subscriber (prevent cross-conversation leakage)
        const realtimeOnly = prev.filter(m => {
          if (m.id.startsWith('temp_')) return false;
          // Verify the message belongs to this conversation
          const msgSubId = m.subscriber_id || '';
          const belongsToConversation = msgSubId === subscriberId || 
            (leadId && (m as any).lead_id === leadId) ||
            idsArray.includes(msgSubId);
          if (!belongsToConversation) return false;
          const key = getMessageDedupeKey(m);
          return !messagesMap.has(key) && !uniqueMessages.some(um => um.id === m.id);
        });
        
        if (tempMessages.length === 0 && realtimeOnly.length === 0) {
          return uniqueMessages;
        }
        
        const merged = [...uniqueMessages, ...realtimeOnly, ...tempMessages].sort(compareMessagesChronological);
        messagesCacheRef.current.set(subscriberId, merged);
        return merged;
      });
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
      await loadMessages(selectedSubscriber.subscriber_id, true, selectedSubscriber);
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
    const rapidSendKey = `${currentSubId}|${mediaType || 'text'}|${content.trim().slice(0, 180)}`;
    if (shouldSkipRapidDuplicateSend(rapidSendKey, 1200)) {
      console.log('[SendGuard] Envio duplicado bloqueado:', rapidSendKey);
      return;
    }

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
    setReplyToMessage(null); // Clear reply context
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
              // Duplicata = webhook já salvou. Buscar a mensagem real para substituir o temp
              const { data: existingMsg } = await supabase
                .from('manychat_mensagens' as any)
                .select('*')
                .eq('metadata->>message_id', msgId)
                .maybeSingle();
              if (existingMsg) {
                const realMsg = existingMsg as Message;
                dedupKeysRef.current.add(getMessageDedupeKey(realMsg));
                dedupKeysRef.current.add(`db_${realMsg.id}`);
                setMessages(prev => {
                  const withoutTemp = prev.filter(m => m.id !== tempId);
                  const updated = mergeMessageDedup(withoutTemp, realMsg);
                  messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
                  return updated;
                });
              }
              // Se não encontrou, manter o temp - realtime ou polling vão resolver
            } else {
              console.error('[Chat] Erro ao salvar mensagem:', insertErr);
            }
          }

          // Replace optimistic message with real one
          if (savedMsg) {
            const savedAsMessage = savedMsg as Message;
            dedupKeysRef.current.add(getMessageDedupeKey(savedAsMessage));
            dedupKeysRef.current.add(`db_${savedAsMessage.id}`);

            setMessages(prev => {
              const withoutTemp = prev.filter(m => m.id !== tempId);
              const updated = mergeMessageDedup(withoutTemp, savedAsMessage);
              messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
              return updated;
            });
          }
          // NÃO remover temp se savedMsg é null - realtime/polling vão substituir
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
            const savedAsMessage = savedMsg as Message;
            dedupKeysRef.current.add(getMessageDedupeKey(savedAsMessage));
            dedupKeysRef.current.add(`db_${savedAsMessage.id}`);

            setMessages(prev => {
              const withoutTemp = prev.filter(m => m.id !== tempId);
              const updated = mergeMessageDedup(withoutTemp, savedAsMessage);
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
    
    const originalFileName = selectedFile.name;
    const fileToUpload = selectedFile;
    const subscriberSnapshot = { ...selectedSubscriber };
    
    // Determinar tipo de mídia ANTES de limpar estado
    const mediaType = fileToUpload.type.startsWith('image/')
      ? 'image'
      : fileToUpload.type.startsWith('audio/')
        ? 'audio'
        : fileToUpload.type.startsWith('video/')
          ? 'video'
          : 'document';

    const fileSendKey = `${subscriberSnapshot.subscriber_id}|${mediaType}|${originalFileName}|${fileToUpload.size}`;
    if (shouldSkipRapidDuplicateSend(fileSendKey, 1800)) {
      console.log('[SendGuard] Upload duplicado bloqueado:', fileSendKey);
      return;
    }
    
    // Limpar preview imediatamente para liberar UI
    setSelectedFile(null);
    setPreviewUrl(null);
    
    // Optimistic message
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conteudo: mediaType === 'image' ? '📷 Enviando imagem...' : mediaType === 'video' ? '🎥 Enviando vídeo...' : `📄 Enviando ${originalFileName}...`,
      created_at: new Date().toISOString(),
      direcao: 'saida',
      tipo: mediaType,
      subscriber_id: subscriberSnapshot.subscriber_id,
    };
    
    setMessages(prev => {
      const updated = [...prev, optimisticMessage];
      messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
      return updated;
    });
    scrollToBottom();
    
    try {
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `manychat/${subscriberSnapshot.subscriber_id}/${fileName}`;
      
      // Upload file
      const { error: uploadErr } = await supabase.storage.from('documentos').upload(filePath, fileToUpload);
      if (uploadErr) throw uploadErr;
      
      // Sign URL
      const { data: signed, error: signError } = await supabase.storage
        .from('documentos')
        .createSignedUrl(filePath, 60 * 60 * 24 * 30);
      if (signError || !signed?.signedUrl) throw signError;

      // Send via Z-API (non-blocking DB save)
      const outboundInstanceId = resolveInstanceId(subscriberSnapshot);
      const { data: zapiResult, error: zapiError } = await supabase.functions.invoke('zapi-send', {
        body: {
          to_phone: subscriberSnapshot.telefone,
          message: signed.signedUrl,
          type: mediaType,
          lead_id: subscriberSnapshot.lead_id,
          file_name: originalFileName,
          ...(outboundInstanceId && { instance_id: outboundInstanceId }),
        },
      });

      if (zapiError) throw new Error(zapiError.message);

      // Non-blocking DB persistence
      const msgId = zapiResult?.messageId;
      supabase.from('manychat_mensagens' as any).insert({
        subscriber_id: subscriberSnapshot.subscriber_id,
        subscriber_nome: subscriberSnapshot.nome,
        canal: 'whatsapp',
        conteudo: signed.signedUrl,
        tipo: mediaType,
        direcao: 'saida',
        lead_id: subscriberSnapshot.lead_id,
        metadata: { 
          sent_via: 'chat_interface', 
          zapi_status: zapiResult?.success ? 'success' : 'error', 
          message_id: msgId,
          file_name: originalFileName 
        }
      } as any).select().single().then(({ data: savedMsg }) => {
        if (savedMsg) {
          const savedAsMessage = savedMsg as Message;
          dedupKeysRef.current.add(getMessageDedupeKey(savedAsMessage));
          dedupKeysRef.current.add(`db_${savedAsMessage.id}`);

          setMessages(prev => {
            const withoutTemp = prev.filter(m => m.id !== tempId);
            const updated = mergeMessageDedup(withoutTemp, savedAsMessage);
            messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
            return updated;
          });
        } else {
          // NÃO remover temp - realtime/polling vão substituir
          console.log('[File] savedMsg null, mantendo temp até realtime resolver');
        }
      });

    } catch (error: any) {
      console.error('[File] Erro ao enviar arquivo:', error);
      setMessages(prev => {
        const updated = prev.map(m => 
          m.id === tempId 
            ? { ...m, conteudo: `❌ Erro no envio de ${originalFileName}`, metadata: { send_error: true } } 
            : m
        );
        messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
        return updated;
      });
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
    const audioSendKey = `${subscriberSnapshot.subscriber_id}|audio|${audioFile.name}|${audioFile.size}`;
    if (shouldSkipRapidDuplicateSend(audioSendKey, 1800)) {
      console.log('[SendGuard] Áudio duplicado bloqueado:', audioSendKey);
      return;
    }
    
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
      
      // Upload and sign URL in parallel
      const { error: uploadError } = await supabase.storage.from('documentos').upload(filePath, audioFile);
      if (uploadError) throw uploadError;
      
      // Sign URL and send via Z-API in parallel
      const outboundInstanceId = resolveInstanceId(subscriberSnapshot);
      const [signResult, _] = await Promise.all([
        supabase.storage.from('documentos').createSignedUrl(filePath, 60 * 60 * 24 * 30),
        Promise.resolve(), // placeholder for parallel structure
      ]);
      
      if (signResult.error || !signResult.data?.signedUrl) throw signResult.error;
      const signedUrl = signResult.data.signedUrl;
      
      // Enviar via Z-API
      const { data: zapiResult, error: zapiError } = await supabase.functions.invoke('zapi-send', {
        body: {
          to_phone: subscriberSnapshot.telefone,
          message: signedUrl,
          type: 'audio',
          lead_id: subscriberSnapshot.lead_id,
          file_name: audioFile.name,
          ...(outboundInstanceId && { instance_id: outboundInstanceId }),
        },
      });
      
      if (zapiError) throw new Error(zapiError.message);
      
      // Salvar no banco (não bloquear UI)
      const msgId = zapiResult?.messageId;
      supabase.from('manychat_mensagens' as any).insert({
        subscriber_id: subscriberSnapshot.subscriber_id,
        subscriber_nome: subscriberSnapshot.nome,
        canal: 'whatsapp',
        conteudo: signedUrl,
        tipo: 'audio',
        direcao: 'saida',
        lead_id: subscriberSnapshot.lead_id,
        metadata: { 
          sent_via: 'chat_interface', 
          zapi_status: zapiResult?.success ? 'success' : 'error', 
          message_id: msgId,
          file_name: audioFile.name 
        }
      } as any).select().single().then(({ data: savedMsg }) => {
        // Atualizar com mensagem real
        if (savedMsg) {
          const savedAsMessage = savedMsg as Message;
          dedupKeysRef.current.add(getMessageDedupeKey(savedAsMessage));
          dedupKeysRef.current.add(`db_${savedAsMessage.id}`);

          setMessages(prev => {
            const withoutTemp = prev.filter(m => m.id !== tempId);
            const updated = mergeMessageDedup(withoutTemp, savedAsMessage);
            messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
            return updated;
          });
        } else {
          setMessages(prev => {
            const updated = prev.filter(m => m.id !== tempId);
            messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated);
            return updated;
          });
        }
      });
      
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

  const CHAT_TIMEZONE = 'America/Manaus';

  const parseMessageDate = (dateStr: string) => {
    const parsed = new Date(dateStr);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getDateKeyInChatTimezone = (date: Date) =>
    formatInTimeZone(date, CHAT_TIMEZONE, 'yyyy-MM-dd');

  const isTodayInChatTimezone = (date: Date) =>
    getDateKeyInChatTimezone(date) === getDateKeyInChatTimezone(new Date());

  const isYesterdayInChatTimezone = (date: Date) =>
    getDateKeyInChatTimezone(date) === getDateKeyInChatTimezone(subDays(new Date(), 1));

  const formatMessageTime = (dateStr: string) => {
    const date = parseMessageDate(dateStr);
    if (!date) return '--:--';
    return formatInTimeZone(date, CHAT_TIMEZONE, 'HH:mm');
  };

  const formatLastMessageTime = (dateStr: string) => {
    const date = parseMessageDate(dateStr);
    if (!date) return '';
    if (isTodayInChatTimezone(date)) return formatInTimeZone(date, CHAT_TIMEZONE, 'HH:mm');
    if (isYesterdayInChatTimezone(date)) return 'Ontem';
    return formatInTimeZone(date, CHAT_TIMEZONE, 'dd/MM/yyyy');
  };

  const getDateLabel = (msgs: Message[], index: number) => {
    const currentDate = parseMessageDate(msgs[index]?.created_at);
    if (!currentDate) return null;

    const buildLabel = (date: Date) => {
      if (isTodayInChatTimezone(date)) return 'HOJE';
      if (isYesterdayInChatTimezone(date)) return 'ONTEM';
      return formatInTimeZone(date, CHAT_TIMEZONE, 'dd/MM/yyyy');
    };

    if (index === 0) {
      return buildLabel(currentDate);
    }

    const prevDate = parseMessageDate(msgs[index - 1]?.created_at);
    if (!prevDate) return buildLabel(currentDate);

    const currentKey = getDateKeyInChatTimezone(currentDate);
    const previousKey = getDateKeyInChatTimezone(prevDate);

    if (currentKey !== previousKey) {
      return buildLabel(currentDate);
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

  // Resolver de não lidas resiliente a variações de subscriber_id (zapi_, com/sem 55, deduplicação por lead/telefone)
  const getUnreadCountForSubscriber = (sub: Subscriber): number => {
    const unreadKey = getConversationUnreadKey(sub);
    const direct = unreadCounts.get(unreadKey) || 0;
    if (direct > 0) return direct;

    const phone = sub.telefone?.replace(/\D/g, '') || '';
    const normalizedPhone = phone && !phone.startsWith('55') ? `55${phone}` : phone;
    const suffix = getSubscriberPhoneSuffix(sub);

    const legacyAliases = [
      sub.subscriber_id,
      phone,
      normalizedPhone,
      phone ? `zapi_${phone}` : '',
      normalizedPhone ? `zapi_${normalizedPhone}` : '',
    ].filter(Boolean);

    for (const alias of legacyAliases) {
      const value = unreadCounts.get(alias) || 0;
      if (value > 0) return value;
    }

    if (sub.lead_id) {
      const leadValue = unreadCounts.get(`lead:${sub.lead_id}`) || 0;
      if (leadValue > 0) return leadValue;
    }

    if (suffix) {
      const phoneValue = unreadCounts.get(`phone:${suffix}`) || 0;
      if (phoneValue > 0) return phoneValue;

      for (const [key, value] of unreadCounts.entries()) {
        if (value > 0 && (key.includes(suffix) || key === `phone:${suffix}`)) return value;
      }
    }

    return 0;
  };

  const hasUnreadForSubscriber = (sub: Subscriber) => {
    return getUnreadCountForSubscriber(sub) > 0 || hasUnreadHintForSubscriber(sub);
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
      if (activeFilter === 'unread') return hasUnreadForSubscriber(sub);
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
    })
    // Ordenar por última interação (mais recente primeiro) — mensagens novas sobem automaticamente
    .sort((a, b) => {
      const aTime = new Date(a.ultima_interacao || 0).getTime();
      const bTime = new Date(b.ultima_interacao || 0).getTime();
      return bTime - aTime;
    });

  // === NEW FEATURES HANDLERS ===
  
  // Load starred & deleted messages for current conversation
  const loadMessageFlags = useCallback(async (subscriberId: string) => {
    if (!user?.id) return;
    
    // Load starred
    const { data: starredData } = await supabase
      .from('starred_messages' as any)
      .select('message_id')
      .eq('user_id', user.id);
    
    if (starredData) {
      setStarredMessageIds(new Set(starredData.map((s: any) => s.message_id)));
    }
    
    // Load deleted for me
    const { data: deletedData } = await supabase
      .from('deleted_messages' as any)
      .select('message_id')
      .eq('user_id', user.id);
    
    if (deletedData) {
      setDeletedForMeIds(new Set(deletedData.map((d: any) => d.message_id)));
    }
  }, [user?.id]);

  // Star message
  const handleStarMessage = useCallback(async (messageId: string) => {
    if (!user?.id) return;
    await supabase.from('starred_messages' as any).insert({
      user_id: user.id,
      message_id: messageId,
    } as any);
    setStarredMessageIds(prev => new Set([...prev, messageId]));
    toast({ title: '⭐ Mensagem favoritada!' });
  }, [user?.id, toast]);

  // Unstar message
  const handleUnstarMessage = useCallback(async (messageId: string) => {
    if (!user?.id) return;
    await supabase.from('starred_messages' as any)
      .delete()
      .eq('user_id', user.id)
      .eq('message_id', messageId);
    setStarredMessageIds(prev => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
    toast({ title: 'Favorito removido' });
  }, [user?.id, toast]);

  // Delete message for me
  const handleDeleteForMe = useCallback(async (messageId: string) => {
    if (!user?.id) return;
    await supabase.from('deleted_messages' as any).insert({
      user_id: user.id,
      message_id: messageId,
    } as any);
    setDeletedForMeIds(prev => new Set([...prev, messageId]));
    toast({ title: '🗑️ Mensagem apagada para você' });
  }, [user?.id, toast]);

  // Delete message for all (local + WhatsApp via Z-API)
  const handleDeleteForAll = useCallback(async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    
    // Update local DB
    await supabase.from('manychat_mensagens')
      .update({ deleted_for_all: true } as any)
      .eq('id', messageId);
    
    // Optimistic UI update
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, conteudo: '🚫 Mensagem apagada', tipo: 'text', metadata: { deleted: true } } : m
    ));
    
    // Delete on WhatsApp via Z-API if we have a provider message_id
    const providerMessageId = getProviderMessageId(msg);
    if (providerMessageId && selectedSubscriber?.telefone) {
      const outboundInstanceId = resolveInstanceId(selectedSubscriber);
      const { data, error } = await supabase.functions.invoke('zapi-send', {
        body: {
          to_phone: selectedSubscriber.telefone,
          type: 'delete',
          message_id: providerMessageId,
          instance_id: outboundInstanceId,
        },
      });

      if (error || !data?.success) {
        console.error('[DeleteForAll] Erro ao apagar no WhatsApp:', error || data?.error);
        toast({ title: '⚠️ Apagada localmente', description: 'Não foi possível apagar no WhatsApp', variant: 'destructive' });
      } else {
        toast({ title: '🗑️ Mensagem apagada no WhatsApp' });
      }
      return;
    }

    toast({ title: '🗑️ Mensagem apagada localmente' });
  }, [messages, selectedSubscriber, toast]);

  // Edit message
  const handleStartEdit = useCallback((messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || msg.direcao !== 'saida') return;
    setEditingMessageId(messageId);
    setEditingText(msg.conteudo);
  }, [messages]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingText('');
  }, []);

  const handleConfirmEdit = useCallback(async () => {
    if (!editingMessageId || !editingText.trim()) return;
    
    const originalMsg = messages.find(m => m.id === editingMessageId);
    if (!originalMsg || editingText.trim() === originalMsg.conteudo) {
      handleCancelEdit();
      return;
    }

    // Optimistic update
    setMessages(prev => prev.map(m => 
      m.id === editingMessageId 
        ? { ...m, conteudo: editingText.trim(), metadata: { ...((m as any).metadata || {}), edited: true, edited_at: new Date().toISOString(), original_content: originalMsg.conteudo } }
        : m
    ));

    // Persist to DB
    await supabase.from('manychat_mensagens')
      .update({ 
        conteudo: editingText.trim(),
        metadata: { 
          ...((originalMsg as any).metadata || {}),
          edited: true, 
          edited_at: new Date().toISOString(),
          original_content: originalMsg.conteudo 
        }
      } as any)
      .eq('id', editingMessageId);

    // Edit on WhatsApp via Z-API if we have a provider message_id
    const providerMessageId = getProviderMessageId(originalMsg);
    if (providerMessageId && selectedSubscriber?.telefone) {
      const outboundInstanceId = resolveInstanceId(selectedSubscriber);
      const { data, error } = await supabase.functions.invoke('zapi-send', {
        body: {
          to_phone: selectedSubscriber.telefone,
          message: editingText.trim(),
          type: 'edit',
          message_id: providerMessageId,
          instance_id: outboundInstanceId,
        },
      });

      if (error || !data?.success) {
        console.error('[EditMessage] Erro ao editar no WhatsApp:', error || data?.error);
        toast({ title: '⚠️ Editada localmente', description: 'Não foi possível editar no WhatsApp', variant: 'destructive' });
      } else {
        toast({ title: '✏️ Mensagem editada no WhatsApp' });
      }
    } else {
      toast({ title: '✏️ Mensagem editada localmente' });
    }
    
    handleCancelEdit();
  }, [editingMessageId, editingText, messages, toast, handleCancelEdit, selectedSubscriber]);

  // Reply to message
  const handleReplyMessage = useCallback((messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    setReplyToMessage(msg);
  }, [messages]);

  // Pin/Unpin message
  const handlePinMessage = useCallback((messageId: string) => {
    if (!selectedSubscriber) return;
    setPinnedMessagesBySubscriber(prev => ({
      ...prev,
      [selectedSubscriber.subscriber_id]: messageId,
    }));
    toast({ title: '📌 Mensagem fixada' });
  }, [selectedSubscriber, toast]);

  const handleUnpinMessage = useCallback((messageId: string) => {
    if (!selectedSubscriber) return;
    setPinnedMessagesBySubscriber(prev => {
      const next = { ...prev };
      if (next[selectedSubscriber.subscriber_id] === messageId) {
        delete next[selectedSubscriber.subscriber_id];
      }
      return next;
    });
    toast({ title: 'Mensagem desfixada' });
  }, [selectedSubscriber, toast]);

  // Select/deselect message
  const handleSelectMessage = useCallback((messageId: string) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  // Report message
  const handleReportMessage = useCallback((messageId: string) => {
    toast({ title: '🚩 Mensagem denunciada', description: 'A denúncia foi registrada.' });
  }, [toast]);

  // Forward message
  const handleOpenForward = useCallback((messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    setForwardMessageContent(msg.conteudo);
    setForwardModalOpen(true);
  }, [messages]);

  const handleForwardToSubscribers = useCallback(async (subscriberIds: string[]) => {
    if (!selectedSubscriber) return;
    
    for (const targetSubId of subscriberIds) {
      const targetSub = subscribers.find(s => s.subscriber_id === targetSubId);
      if (!targetSub?.telefone) continue;
      
      const outboundInstanceId = resolveInstanceId(targetSub);
      const forwarded = `⤵️ *Mensagem encaminhada*\n\n${forwardMessageContent}`;
      
      await supabase.functions.invoke('zapi-send', {
        body: {
          to_phone: targetSub.telefone,
          message: forwarded,
          type: 'text',
          lead_id: targetSub.lead_id,
          ...(outboundInstanceId && { instance_id: outboundInstanceId }),
        },
      });
      
      await supabase.from('manychat_mensagens' as any).insert({
        subscriber_id: targetSubId,
        subscriber_nome: targetSub.nome,
        canal: 'whatsapp',
        conteudo: forwarded,
        tipo: 'text',
        direcao: 'saida',
        lead_id: targetSub.lead_id,
        metadata: { sent_via: 'chat_forward' },
      } as any);
    }
    
    toast({ title: '↪️ Mensagem encaminhada!', description: `Enviada para ${subscriberIds.length} contato(s)` });
  }, [selectedSubscriber, subscribers, forwardMessageContent, toast]);

  // Send contact (vCard)
  const handleSendContact = useCallback(async (contact: { nome: string; telefone?: string; subscriber_id: string }) => {
    if (!selectedSubscriber?.telefone || !contact.telefone) return;
    
    const outboundInstanceId = resolveInstanceId(selectedSubscriber);
    const contactMsg = `👤 *Contato compartilhado*\n📛 ${contact.nome}\n📱 ${contact.telefone}`;
    
    await supabase.functions.invoke('zapi-send', {
      body: {
        to_phone: selectedSubscriber.telefone,
        message: contactMsg,
        type: 'text',
        lead_id: selectedSubscriber.lead_id,
        ...(outboundInstanceId && { instance_id: outboundInstanceId }),
      },
    });
    
    await supabase.from('manychat_mensagens' as any).insert({
      subscriber_id: selectedSubscriber.subscriber_id,
      subscriber_nome: selectedSubscriber.nome,
      canal: 'whatsapp',
      conteudo: contactMsg,
      tipo: 'text',
      direcao: 'saida',
      lead_id: selectedSubscriber.lead_id,
      metadata: { sent_via: 'chat_contact_share', shared_contact: { name: contact.nome, phone: contact.telefone } },
    } as any);
    
    toast({ title: '👤 Contato enviado!' });
  }, [selectedSubscriber, toast]);

  // Conversation search highlight handler
  const handleSearchHighlight = useCallback((messageId: string | null, _matchIndex: number, _total: number) => {
    setHighlightedMessageId(messageId);
    if (messageId) {
      const el = document.getElementById(`msg-${messageId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Load flags when conversation changes
  useEffect(() => {
    if (selectedSubscriber) {
      loadMessageFlags(selectedSubscriber.subscriber_id);
    }
  }, [selectedSubscriber?.subscriber_id, loadMessageFlags]);

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
    // Texto: preserva formatação original se enviado pela interface, senão aplica formatação WhatsApp
    const sentFromInterface = metadata?.sent_via === 'chat_interface';
    return (
      <div className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px] text-inherit select-text cursor-text">
        {sentFromInterface ? content : formatWhatsAppTextHelper(content)}
      </div>
    );
  };

  return (
    <div className={`flex h-dvh w-full overflow-hidden ${themeClasses.bg}`}>
      {/* Sidebar - Lista de Conversas */}
      <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} w-full md:w-[440px] lg:w-[500px] xl:w-[540px] flex-col ${themeClasses.sidebar} border-r ${themeClasses.border}`}>
        {/* Header */}
        <div className={`h-[60px] px-4 flex items-center justify-between backdrop-blur-md ${isDark ? 'bg-gradient-to-r from-[#202C33] to-[#1A252C]' : 'bg-gradient-to-r from-[#F0F2F5] to-[#E8EBEE]'}`}>
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
              className={`pl-12 h-[35px] ${themeClasses.inputSearch} border-0 rounded-xl text-[13px] focus-visible:ring-0 transition-shadow duration-200 focus-visible:shadow-md`}
            />
          </div>
        </div>

        {/* Filtros unificados */}
        <div className={`px-3 py-2 ${themeClasses.sidebar} border-b ${themeClasses.border}`}>
          <div className="flex items-center gap-1 flex-wrap">
            {/* Origem filters */}
            {([
              { key: 'all', label: 'Todos', icon: 'LayoutGrid', color: '#00A884' },
              { key: 'trafego', label: 'Tráfego', icon: 'Megaphone', color: '#ef4444' },
              { key: 'whatsapp_direto', label: 'Direto', icon: 'MessageCircle', color: '#3b82f6' },
            ] as const).map(({ key, label, icon, color }) => {
              const isActive = origemFilter === key;
              const IconComp = icon === 'LayoutGrid' ? LayoutGrid : icon === 'Megaphone' ? Megaphone : MessageCircle;
              return (
                <button
                  key={`o-${key}`}
                  onClick={() => setOrigemFilter(key as OrigemFilter)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'text-white shadow-sm'
                      : `${themeClasses.inputSearch} ${themeClasses.secondaryText} hover:brightness-110`
                  }`}
                  style={isActive ? { backgroundColor: color } : undefined}
                >
                  <IconComp className="h-3 w-3" />
                  {label}
                </button>
              );
            })}

            <div className="h-3.5 w-px bg-gray-500/20 mx-0.5" />

            {/* Atendimento filters */}
            {([
              { key: 'all', label: 'Todos', icon: 'Users' },
              { key: 'human', label: 'Humano', icon: 'UserRound' },
              { key: 'bot', label: 'Isa', icon: 'Bot' },
            ] as const).map(({ key, label, icon }) => {
              const isActive = activeFilter === key;
              const IconComp = icon === 'Users' ? Users : icon === 'UserRound' ? UserRound : Bot;
              return (
                <button
                  key={`a-${key}`}
                  onClick={() => setActiveFilter(key as ConversationFilter)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    isActive
                      ? 'bg-[#00A884] text-white shadow-sm'
                      : `${themeClasses.inputSearch} ${themeClasses.secondaryText} hover:brightness-110`
                  }`}
                >
                  <IconComp className="h-3 w-3" />
                  {label}
                </button>
              );
            })}

            <div className="h-3.5 w-px bg-gray-500/20 mx-0.5" />

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
                const unreadCount = getUnreadCountForSubscriber(subscriber);
                const hasUnread = unreadCount > 0;
                const hasUnreadHint = hasUnreadHintForSubscriber(subscriber);
                const isUnreadVisual = hasUnread || hasUnreadHint;
                const msgPreview = lastMessagePreviews.get(subscriber.subscriber_id);
                const instanceInfo = getInstanceInfoFromConnectedPhone(subscriber.instance_name);
                const subscriberTags = getSubscriberTags(subscriber.subscriber_id);
                
                return (
                  <div
                    key={subscriber.id}
                    onClick={() => {
                      const isSameConversation = selectedSubscriber?.subscriber_id === subscriber.subscriber_id;
                      setSelectedSubscriber(subscriber);
                      if (isSameConversation) {
                        loadMessages(subscriber.subscriber_id, true, subscriber);
                      }
                    }}
                    className={`flex items-center gap-3 px-3 py-[10px] cursor-pointer transition-all duration-200 border-b border-opacity-50 ${themeClasses.border} ${themeClasses.hover} hover:translate-x-0.5 ${
                      isActive ? themeClasses.active : ''
                    }`}
                  >
                    {/* Avatar - 49px like WhatsApp */}
                    <div className="relative shrink-0">
                      <Avatar className="h-[49px] w-[49px]">
                        <AvatarImage src={subscriber.foto} />
                        <AvatarFallback className="bg-gradient-to-br from-[#00A884] to-[#008069] text-white text-base font-medium">
                          {getInitials(subscriber)}
                        </AvatarFallback>
                      </Avatar>
                      {/* Atendimento humano indicator */}
                      {subscriber.atendimento_humano && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center text-[9px]">
                          🙋
                        </span>
                      )}
                      {/* Online indicator */}
                      {online && (
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-[#111B21] animate-pulse-subtle" />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 pr-1">
                      <div className="min-w-0">
                        {/* Row 1: Name + Instance badge */}
                        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                          <span className={`text-[15px] truncate leading-tight font-medium ${isUnreadVisual ? 'text-[#E9EDEF] font-semibold' : themeClasses.headerText}`}>
                            {getDisplayName(subscriber)}
                          </span>
                          {instanceInfo ? (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 leading-none ${
                              instanceInfo.color === 'red' 
                                ? 'bg-red-500/15 text-red-400' 
                                : 'bg-blue-500/15 text-blue-400'
                            }`}>
                              {formatPhone(subscriber.telefone) ? `${formatPhone(subscriber.telefone)} · ` : ''}{instanceInfo.label}
                            </span>
                          ) : (
                            formatPhone(subscriber.telefone) && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 leading-none ${themeClasses.secondaryText}`}>
                                {formatPhone(subscriber.telefone)}
                              </span>
                            )
                          )}
                        </div>

                        {/* Row 2: Message preview */}
                        <div className="flex items-center gap-1 min-w-0 mt-[3px] overflow-hidden">
                          {msgPreview?.startsWith('Você:') && (
                            <CheckCheck className="h-3.5 w-3.5 shrink-0 text-[#53BDEB]" />
                          )}
                          <p className={`text-[13px] truncate leading-tight ${isUnreadVisual ? 'text-[#D1D7DB] font-medium' : themeClasses.secondaryText}`}>
                            {msgPreview ? (msgPreview.startsWith('Você: ') ? msgPreview.slice(6) : msgPreview) : 'Nenhuma mensagem'}
                          </p>
                        </div>
                      </div>

                      {/* Right column: time + badges (always visible) */}
                      <div className="w-[76px] min-w-[76px] shrink-0 flex flex-col items-end justify-between gap-1">
                        <span className={`text-[12px] leading-tight whitespace-nowrap text-right ${isUnreadVisual ? 'text-[#25D366] font-semibold' : themeClasses.secondaryText}`}>
                          {subscriber.ultima_interacao ? formatLastMessageTime(subscriber.ultima_interacao) : ''}
                        </span>
                        <div className="flex items-center justify-end gap-1.5 min-h-[20px] w-full">
                          {hasUnread ? (
                            <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#25D366] text-white text-[11px] font-bold flex items-center justify-center shadow-sm">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          ) : hasUnreadHint ? (
                            <span className="h-[9px] w-[9px] rounded-full bg-[#25D366]" />
                          ) : null}
                        </div>
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
            <div className={`h-[50px] md:min-h-[62px] px-1.5 md:px-4 flex items-center gap-1.5 md:gap-3 backdrop-blur-md border-b ${themeClasses.border} ${isDark ? 'bg-gradient-to-r from-[#202C33] to-[#1A252C]' : 'bg-gradient-to-r from-[#F0F2F5] to-[#E8EBEE]'}`}>
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
                    <DropdownMenuItem onClick={() => setShowConversationSearch(true)}>
                      🔍 Buscar na conversa
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSendContactModalOpen(true)}>
                      👤 Enviar contato
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Search button in header */}
              <div className="hidden md:flex items-center gap-1 ml-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowConversationSearch(!showConversationSearch)}
                  className={`h-10 w-10 rounded-full ${showConversationSearch ? 'text-[#00A884] bg-[#00A884]/10' : `${themeClasses.iconColor} ${themeClasses.hoverBtn}`}`}
                >
                  <Search className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Conversation Search Bar */}
            <ConversationSearch
              open={showConversationSearch}
              onClose={() => setShowConversationSearch(false)}
              messages={messages}
              onHighlight={handleSearchHighlight}
              isDark={isDark}
              themeClasses={themeClasses}
            />

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
                  {messages
                    .filter(m => !deletedForMeIds.has(m.id) && !(m as any).deleted_for_all)
                    .sort(compareMessagesChronological)
                    .map((message, index, filteredMsgs) => {
                    const dateLabel = getDateLabel(filteredMsgs, index);
                    const isOutgoing = message.direcao === 'saida';
                    const isStarred = starredMessageIds.has(message.id);
                    const isHighlighted = highlightedMessageId === message.id;
                    
                    return (
                        <div key={message.id} id={`msg-${message.id}`} className={`transition-colors duration-700 rounded-lg ${isHighlighted ? (isDark ? 'bg-[#00A884]/10' : 'bg-[#00A884]/08') : ''}`}>
                        {dateLabel && (
                          <div className="flex justify-center my-4">
                            <span className={`px-4 py-1.5 rounded-lg ${isDark ? 'bg-[#1F2C34]' : 'bg-white'} text-[12px] ${themeClasses.secondaryText} shadow-sm font-medium`}>
                              {dateLabel}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isOutgoing ? 'justify-end pr-2' : 'justify-start pl-2'} mb-[3px]`}>
                          <div
                            className={`group relative max-w-[75%] md:max-w-[65%] rounded-xl px-2.5 md:px-3 pt-2 pb-2 shadow-sm transition-all hover:shadow-md select-text animate-fade-in ${
                              isOutgoing ? themeClasses.messageSent : themeClasses.messageReceived
                            } ${isHighlighted ? 'ring-2 ring-[#00A884]/60 shadow-[0_0_12px_rgba(0,168,132,0.25)]' : ''}`}
                            style={{
                              borderTopLeftRadius: !isOutgoing ? '4px' : undefined,
                              borderTopRightRadius: isOutgoing ? '4px' : undefined,
                            }}
                          >
                            {/* Context menu dropdown */}
                            <MessageContextMenu
                              messageId={message.id}
                              messageContent={message.conteudo}
                              messageType={(message as any).tipo || 'text'}
                              isOutgoing={isOutgoing}
                              isStarred={isStarred}
                              isPinned={selectedSubscriber ? pinnedMessagesBySubscriber[selectedSubscriber.subscriber_id] === message.id : false}
                              isSelected={selectedMessageIds.has(message.id)}
                              isDark={isDark}
                              isEdited={!!(message as any).metadata?.edited}
                              onStar={handleStarMessage}
                              onUnstar={handleUnstarMessage}
                              onPin={handlePinMessage}
                              onUnpin={handleUnpinMessage}
                              onSelect={handleSelectMessage}
                              onReport={handleReportMessage}
                              onDeleteForMe={handleDeleteForMe}
                              onDeleteForAll={handleDeleteForAll}
                              onForward={handleOpenForward}
                              onReply={handleReplyMessage}
                              onEdit={handleStartEdit}
                            />
                            
                            <span className={`absolute top-0 w-2 h-3 pointer-events-none ${isOutgoing ? '-right-2' : '-left-2'}`}>
                              {isOutgoing ? (
                                <svg viewBox="0 0 8 13" className={isDark ? 'fill-[#005C4B]' : 'fill-[#D9FDD3]'}><path d="M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z"/></svg>
                              ) : (
                                <svg viewBox="0 0 8 13" className={isDark ? 'fill-[#202C33]' : 'fill-white'}><path d="M1.533 3.568L8 12.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z"/></svg>
                              )}
                            </span>
                            
                            {/* Inline edit mode */}
                            {editingMessageId === message.id ? (
                              <div className="flex flex-col min-w-[260px] max-w-[420px]">
                                {/* Edit header bar */}
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[11px] font-medium ${
                                  isDark ? 'bg-[#00A884]/15 text-[#00A884]' : 'bg-[#00A884]/10 text-[#00A884]'
                                }`}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                  Editando mensagem
                                </div>
                                {/* Textarea */}
                                <textarea
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className={`w-full px-3 py-2 text-[14.2px] resize-none border-0 outline-none leading-[1.45] ${
                                    isDark ? 'bg-[#2A3942] text-[#E9EDEF]' : 'bg-[#F0F2F5] text-[#111B21]'
                                  }`}
                                  rows={Math.min(Math.max(editingText.split('\n').length, 2), 8)}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') handleCancelEdit();
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConfirmEdit(); }
                                  }}
                                />
                                {/* Action buttons */}
                                <div className={`flex items-center justify-between px-3 py-1.5 rounded-b-lg ${
                                  isDark ? 'bg-[#2A3942]' : 'bg-[#F0F2F5]'
                                }`}>
                                  <span className={`text-[10px] ${isDark ? 'text-[#8696A0]' : 'text-gray-400'}`}>
                                    Esc para cancelar · Enter para salvar
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={handleCancelEdit}
                                      className={`text-[12px] px-3 py-1 rounded-full font-medium transition-colors ${
                                        isDark ? 'text-[#E9EDEF] hover:bg-white/10' : 'text-[#3B4A54] hover:bg-black/5'
                                      }`}
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      onClick={handleConfirmEdit}
                                      className="text-[12px] px-4 py-1 rounded-full bg-[#00A884] text-white font-medium hover:bg-[#00976F] transition-colors"
                                    >
                                      Salvar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              renderMessage(message)
                            )}
                            
                            <div className="flex items-center justify-end gap-1 mt-1">
                              {isStarred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                              {(message as any).metadata?.edited && (
                                <span className={`text-[11px] italic ${isOutgoing ? themeClasses.messageTime : themeClasses.secondaryText}`}>
                                  editada
                                </span>
                              )}
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

            {/* Reply bar */}
            {replyToMessage && (
              <div className={`px-4 py-2 flex items-center gap-3 border-t ${isDark ? 'bg-[#1F2C34] border-[#313D45]' : 'bg-[#F0F2F5] border-[#E9EDEF]'}`}>
                <div className={`flex-1 rounded-lg px-3 py-2 border-l-4 ${replyToMessage.direcao === 'saida' ? 'border-l-[#00A884]' : 'border-l-[#6B7B8D]'} ${isDark ? 'bg-[#111B21]' : 'bg-white'}`}>
                  <p className={`text-xs font-medium ${replyToMessage.direcao === 'saida' ? 'text-[#00A884]' : (isDark ? 'text-[#E9EDEF]' : 'text-[#111B21]')}`}>
                    {replyToMessage.direcao === 'saida' ? 'Você' : (selectedSubscriber?.nome || 'Contato')}
                  </p>
                  <p className={`text-[13px] truncate ${isDark ? 'text-[#8696A0]' : 'text-[#667781]'}`}>
                    {replyToMessage.conteudo.substring(0, 100)}
                  </p>
                </div>
                <button onClick={() => setReplyToMessage(null)} className={`p-1 rounded-full ${isDark ? 'hover:bg-white/10 text-[#8696A0]' : 'hover:bg-black/5 text-[#667781]'}`}>
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Input de Mensagem */}
            <div className={`min-h-[52px] md:h-[66px] px-2 md:px-4 py-1.5 md:py-2 flex items-center gap-1 md:gap-2 ${themeClasses.header} border-t ${isDark ? 'border-[#222D34]/50' : 'border-[#E9EDEF]/50'}`}>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden" />
              
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

              {/* Send Contact button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSendContactModalOpen(true)}
                disabled={isSending}
                className={`hidden md:flex h-10 w-10 rounded-full shrink-0 ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}
              >
                <Contact className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <textarea
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
                    
                    // For text, let the default paste behavior work - textarea preserves line breaks
                  }}
                  disabled={isSending || isRecording}
                  rows={1}
                  style={{ minHeight: '44px', maxHeight: '120px', resize: 'none' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = '44px';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                  className={`w-full rounded-2xl ${themeClasses.input} border-0 text-[15px] focus-visible:ring-0 focus-visible:outline-none shadow-sm py-[10px] px-4 overflow-y-auto transition-shadow duration-200 focus:shadow-md`}
                />
              </div>

              {newMessage.trim() || (selectedFile && !selectedFile.type.startsWith('audio/')) ? (
                <Button 
                    onClick={selectedFile ? uploadAndSendFile : () => sendMessage()} 
                    disabled={isSending}
                    size="icon"
                    className={`h-11 w-11 rounded-full bg-[#00A884] hover:bg-[#008069] text-white shadow-lg transition-all hover:scale-105 ${isSending ? 'animate-pulse' : ''}`}
                  >
                    <Send className={`h-5 w-5 transition-transform duration-200 ${isSending ? 'rotate-45' : ''}`} />
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
              <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#00A884] to-[#008069] flex items-center justify-center shadow-xl animate-float">
                <MessageCircle className="h-16 w-16 text-white" />
              </div>
              <h2 className={`text-2xl font-semibold mb-3 bg-gradient-to-r from-[#00A884] to-[#008069] bg-clip-text text-transparent`}>
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
      {/* Forward Message Modal */}
      <ForwardMessageModal
        open={forwardModalOpen}
        onClose={() => setForwardModalOpen(false)}
        subscribers={subscribers}
        messageContent={forwardMessageContent}
        onForward={handleForwardToSubscribers}
      />

      {/* Send Contact Modal */}
      <SendContactModal
        open={sendContactModalOpen}
        onClose={() => setSendContactModalOpen(false)}
        contacts={subscribers}
        onSend={handleSendContact}
      />
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
