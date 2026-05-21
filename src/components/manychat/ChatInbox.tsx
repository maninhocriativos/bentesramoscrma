import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useChatPresence } from "@/hooks/useChatPresence";
import { useTeamPresence } from "@/hooks/useTeamPresence";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { useChatTags } from "@/hooks/useChatTags";
import { useLeadNames } from "@/hooks/useLeadNames";
import { useAuth } from "@/hooks/useAuth";
import { usePerfil } from "@/hooks/usePerfil";
import { ChatThemeProvider, useChatTheme } from "./ChatThemeProvider";
import { TeamPresencePanel } from "./TeamPresencePanel";
import { ConversationAssignmentMenu } from "./ConversationAssignmentMenu";
import LeadContextPanel from "./LeadContextPanel";
import { InstanceBadge } from "@/components/chat/InstanceBadge";
import { TagBadge } from "@/components/chat/TagBadge";
import { TagSelector } from "@/components/chat/TagSelector";
import { WhatsAppAudioPlayer } from "@/components/chat/WhatsAppAudioPlayer";
import { MessageContextMenu } from "@/components/chat/MessageContextMenu";
import { ForwardMessageModal } from "@/components/chat/ForwardMessageModal";
import { ConversationSearch } from "@/components/chat/ConversationSearch";
import { SendContactModal } from "@/components/chat/SendContactModal";
import { ContratoFechadoModal } from "@/components/chat/ContratoFechadoModal";
import { useMetaCapi } from "@/hooks/useMetaCapi";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChatFiltersBar, type ConversationFilter, type OrigemFilter } from "@/components/chat/ChatFiltersBar";
import { formatWhatsAppText as formatWhatsAppTextHelper } from "@/lib/whatsappTextFormatter";
import { InstanceInfo } from "@/lib/instanceUtils";
import { invokeZapiSend } from "@/lib/zapiSendClient";
import {
  Send, Search, Phone, RefreshCw, Mic, Paperclip, X, CheckCheck,
  ArrowLeft, MoreVertical, Smile, Sun, Moon, Menu, Bot, UserRound,
  Instagram, Facebook, MessageCircle, Sparkles, PanelRightClose, Users,
  FileText, Square, Star, Contact, XCircle, BadgeCheck,
} from "lucide-react";
import CalWidget from "./CalWidget";
import { subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Z-API instance routing ───────────────────────────────────────────────────

// REGRA ABSOLUTA: Tráfego → (92) 98588-8190 | Escritório → (92) 99160-4348
const PHONE_TO_INSTANCE_ID: Record<string, string> = {
  "85888190":  "3EDDF959BC2B81F86B410203B614D70E", // "Bentes Ramos Trafego" (92) 98588-8190
  "91604348":  "3EDB5B4FF93662A609ADFAF4F663B13A", // "Bentes Ramos"         (92) 99160-4348 (suffix match)
  "991604348": "3EDB5B4FF93662A609ADFAF4F663B13A", // "Bentes Ramos"         (92) 99160-4348 (full local)
};

function resolveInstanceId(subscriber: { instance_name?: string | null }): string | undefined {
  const phone = subscriber.instance_name?.replace(/\D/g, "");
  if (!phone) return undefined;
  for (const [suffix, instanceId] of Object.entries(PHONE_TO_INSTANCE_ID)) {
    if (phone.endsWith(suffix)) return instanceId;
  }
  return undefined;
}

function getInstanceInfoFromConnectedPhone(connectedPhone?: string): InstanceInfo | null {
  if (!connectedPhone) return null;
  const phone = connectedPhone.replace(/\D/g, "");
  if (phone.includes("559285888190") || phone.includes("5592985888190") || phone.endsWith("85888190")) {
    return { name: "Bentes Ramos Trafego", label: "Tráfego", color: "trafego" };
  }
  if (phone.includes("5592991604348") || phone.endsWith("991604348") || phone.endsWith("91604348")) {
    return { name: "Bentes Ramos", label: "Bentes Ramos", color: "escritorio" };
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

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
  lead_tipo_origem?: string;
  instance_name?: string;
}

interface Message {
  id: string;
  conteudo: string;
  created_at: string;
  direcao: "entrada" | "saida";
  tipo: string;
  subscriber_id?: string;
  lead_id?: string;
  subscriber_nome?: string;
  metadata?: any;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const LAST_READ_KEY        = "chat_last_read_v3";
const PINNED_MESSAGES_KEY  = "chat_pinned_messages_v1";

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const ManyChatInboxContent = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { fullName } = usePerfil();
  const { theme, toggleTheme } = useChatTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ─── State ──────────────────────────────────────────────────────────────────

  const [subscribers, setSubscribers]         = useState<Subscriber[]>([]);
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [messages, setMessages]               = useState<Message[]>([]);
  const [newMessage, setNewMessage]           = useState("");
  const [searchTerm, setSearchTerm]           = useState("");
  const [isLoading, setIsLoading]             = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending]                           = useState(false);
  const [isRecording, setIsRecording]         = useState(false);
  const [selectedFile, setSelectedFile]       = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]           = useState<string | null>(null);
  const [showMobileChat, setShowMobileChat]   = useState(false);
  const [isSyncing, setIsSyncing]             = useState(false);
  const [activeFilter, setActiveFilter]       = useState<ConversationFilter>("all");
  const [origemFilter, setOrigemFilter]       = useState<OrigemFilter>("all");
  const [selectedTagIds, setSelectedTagIds]   = useState<string[]>([]);
  const [pendingLeadId, setPendingLeadId]     = useState<string | null>(null);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [showTeamPanel, setShowTeamPanel]     = useState(false);

  const [starredMessageIds, setStarredMessageIds]       = useState<Set<string>>(new Set());
  const [deletedForMeIds, setDeletedForMeIds]           = useState<Set<string>>(new Set());
  const [showConversationSearch, setShowConversationSearch] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [forwardModalOpen, setForwardModalOpen]         = useState(false);
  const [forwardMessageContent, setForwardMessageContent] = useState("");
  const [sendContactModalOpen, setSendContactModalOpen] = useState(false);
  const [editingMessageId, setEditingMessageId]         = useState<string | null>(null);
  const [editingText, setEditingText]                   = useState("");
  const [replyToMessage, setReplyToMessage]             = useState<Message | null>(null);
  const [pinnedMessagesBySubscriber, setPinnedMessagesBySubscriber] = useState<Record<string, string>>({});
  const [selectedMessageIds, setSelectedMessageIds]     = useState<Set<string>>(new Set());

  // ✅ Modal de contrato fechado
  const [contratoModalOpen, setContratoModalOpen]       = useState(false);
  const [leadPerdidoOpen, setLeadPerdidoOpen]           = useState(false);
  const [leadPerdidoLoading, setLeadPerdidoLoading]     = useState(false);
  const [editingLeadName, setEditingLeadName]           = useState(false);
  const [editingLeadNameValue, setEditingLeadNameValue] = useState("");
  const [hasMoreMessages, setHasMoreMessages]           = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);

  // ─── Hooks ──────────────────────────────────────────────────────────────────

  const {
    tags: availableTags, loadSubscriberTags, getSubscriberTags,
    addTagToSubscriber, removeTagFromSubscriber, createTag,
  } = useChatTags();

  const { leadNames } = useLeadNames();
  const { sendMetaEvent } = useMetaCapi();

  // ─── Refs ───────────────────────────────────────────────────────────────────

  const messagesCacheRef         = useRef<Map<string, Message[]>>(new Map());
  const messageCacheTimestampRef = useRef<Map<string, number>>(new Map());
  const dedupKeysRef             = useRef<Set<string>>(new Set());
  const outboundSendGuardRef     = useRef<Map<string, number>>(new Map());
  const loadMessagesRequestRef   = useRef(0);
  const pendingBumpsRef          = useRef<Map<string, string>>(new Map());
  const bumpTimerRef             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReadRef              = useRef<Record<string, string>>({});
  const messagesEndRef           = useRef<HTMLDivElement>(null);
  const messagesContainerRef     = useRef<HTMLDivElement>(null);
  const oldestMsgCursorRef       = useRef<string | null>(null);
  const isPrependingRef          = useRef(false);
  const beforePrependScrollRef   = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const isLoadingMoreRef         = useRef(false);
  const fileInputRef             = useRef<HTMLInputElement>(null);
  const nameInputRef             = useRef<HTMLInputElement>(null);
  const nameSavingRef            = useRef(false);
  const mediaRecorderRef         = useRef<MediaRecorder | null>(null);
  const audioChunksRef           = useRef<Blob[]>([]);
  const typingTimeoutRef         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentMsgIdsRef          = useRef<Set<string>>(new Set());
  const readReceiptsChannelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribersLoadedRef     = useRef(false);
  const selectedSubscriberRef    = useRef<Subscriber | null>(null);
  const subscribersRef           = useRef<Subscriber[]>([]);
  const prevSelectedSubIdRef     = useRef<string | null>(null);

  const [unreadCounts, setUnreadCounts]             = useState<Map<string, number>>(new Map());
  const [lastMessagePreviews, setLastMessagePreviews] = useState<Map<string, string>>(new Map());

  // ─── Presence + notifications ────────────────────────────────────────────────

  const { isOnline, isTyping, setTyping } = useChatPresence(user?.id, fullName || user?.email?.split("@")[0]);
  const { getTeamWithStatus, setCurrentChat, getOnlineCount } = useTeamPresence(user?.id, fullName || user?.email?.split("@")[0]);
  const { playNotificationSound, notifyAssignment, notifyNewMessage, requestNotificationPermission } = useChatNotifications();

  useEffect(() => { requestNotificationPermission(); }, [requestNotificationPermission]);

  // ─── Theme classes ──────────────────────────────────────────────────────────

  const isDark = theme === "dark";
  const themeClasses = {
    bg:               isDark ? "bg-[#0B141A]"   : "bg-[#EFEAE2]",
    sidebar:          isDark ? "bg-[#111B21]"   : "bg-white",
    header:           isDark ? "bg-[#202C33]"   : "bg-[#F0F2F5]",
    headerText:       isDark ? "text-[#E9EDEF]" : "text-[#111B21]",
    secondaryText:    isDark ? "text-[#8696A0]" : "text-[#667781]",
    iconColor:        isDark ? "text-[#AEBAC1]" : "text-[#54656F]",
    border:           isDark ? "border-[#222D34]" : "border-[#E9EDEF]",
    hover:            isDark ? "hover:bg-[#202C33]" : "hover:bg-[#F5F6F6]",
    hoverBtn:         isDark ? "hover:bg-[#374248]" : "hover:bg-[#E9EDEF]",
    active:           isDark ? "bg-[#2A3942]"   : "bg-[#F0F2F5]",
    input:            isDark ? "bg-[#2A3942] text-[#E9EDEF] placeholder:text-[#8696A0]" : "bg-white text-[#111B21]",
    inputSearch:      isDark ? "bg-[#202C33] text-[#E9EDEF] placeholder:text-[#8696A0]" : "bg-[#F0F2F5]",
    messageSent:      isDark ? "bg-[#005C4B] text-[#E9EDEF]" : "bg-[#D9FDD3] text-[#111B21]",
    messageReceived:  isDark ? "bg-[#202C33] text-[#E9EDEF]" : "bg-white text-[#111B21]",
    emptyState:       isDark ? "bg-[#222E35]"   : "bg-[#F0F2F5]",
    messageTime:      isDark ? "text-[#8FBFB1]" : "text-[#667781]",
  };

  // ─── localStorage init ──────────────────────────────────────────────────────

  useEffect(() => {
    try {
      localStorage.removeItem("chat_last_read");
      localStorage.removeItem("chat_last_read_v2");
      const stored = localStorage.getItem(LAST_READ_KEY);
      if (stored) lastReadRef.current = JSON.parse(stored);
      const pinnedStored = localStorage.getItem(PINNED_MESSAGES_KEY);
      if (pinnedStored) setPinnedMessagesBySubscriber(JSON.parse(pinnedStored));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PINNED_MESSAGES_KEY, JSON.stringify(pinnedMessagesBySubscriber)); } catch { /* ignore */ }
  }, [pinnedMessagesBySubscriber]);

  // ─── Phone normalization helpers ────────────────────────────────────────────

  const getPhoneDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

  const addBrazilPhoneVariants = (digits: string, out: Set<string>) => {
    if (!/^\d+$/.test(digits)) return;
    const withCountry = digits.startsWith("55") ? digits : digits.length >= 10 ? `55${digits}` : digits;
    if (!withCountry || withCountry.length < 10) return;
    const local = withCountry.startsWith("55") ? withCountry.slice(2) : withCountry;
    out.add(withCountry); out.add(local);
    if (local.length === 11 && local[2] === "9") {
      const withoutNine = `${local.slice(0, 2)}${local.slice(3)}`;
      out.add(withoutNine); out.add(`55${withoutNine}`);
    }
    if (local.length === 10 && /^[1-9]{2}[6-9]/.test(local)) {
      const withNine = `${local.slice(0, 2)}9${local.slice(2)}`;
      out.add(withNine); out.add(`55${withNine}`);
    }
  };

  const buildPossibleSubscriberIds = (subscriberId: string, phone?: string | null) => {
    const ids = new Set<string>();
    ids.add(subscriberId);
    const rawId = subscriberId.startsWith("zapi_") ? subscriberId.replace("zapi_", "") : subscriberId;
    if (/^\d+$/.test(rawId)) addBrazilPhoneVariants(rawId, ids);
    const phoneDigits = getPhoneDigits(phone);
    if (phoneDigits) addBrazilPhoneVariants(phoneDigits, ids);
    const phoneLikeIds = Array.from(ids).filter(v => /^\d{8,14}$/.test(v));
    phoneLikeIds.forEach(v => ids.add(`zapi_${v}`));
    return Array.from(ids);
  };

  const getSubscriberPhoneSuffix = (sub: Subscriber) => {
    const fromPhone = getPhoneDigits(sub.telefone);
    const rawId = sub.subscriber_id.startsWith("zapi_") ? sub.subscriber_id.replace("zapi_", "") : sub.subscriber_id;
    const fromId = /^\d{10,13}$/.test(rawId) ? getPhoneDigits(rawId) : "";
    const candidate = fromPhone || fromId;
    const normalized = candidate.startsWith("55") ? candidate.slice(2) : candidate;
    return normalized.length >= 9 ? normalized.slice(-9) : "";
  };

  // ─── Unread key system ──────────────────────────────────────────────────────

  const getConversationUnreadKey = (sub: Subscriber) => {
    if (sub.lead_id) return `lead:${sub.lead_id}`;
    const suffix = getSubscriberPhoneSuffix(sub);
    if (suffix) return `phone:${suffix}`;
    return `sid:${sub.subscriber_id}`;
  };

  const getConversationUnreadKeyFromMessage = (msgSubId: string, msgLeadId?: string | null) => {
    if (msgLeadId) return `lead:${msgLeadId}`;
    const rawId = msgSubId.startsWith("zapi_") ? msgSubId.replace("zapi_", "") : msgSubId;
    const digits = rawId.replace(/\D/g, "");
    const normalized = digits.startsWith("55") ? digits.slice(2) : digits;
    if (normalized.length >= 9) return `phone:${normalized.slice(-9)}`;
    return `sid:${msgSubId}`;
  };

  const getLastReadForSubscriber = (sub: Subscriber, lastRead: Record<string, string>) => {
    const unreadKey = getConversationUnreadKey(sub);
    return lastRead[unreadKey] || lastRead[sub.subscriber_id] || "";
  };

  const hasUnreadHintForSubscriber = (sub: Subscriber) => {
    // Conversa aberta no momento nunca mostra badge de não lida
    if (selectedSubscriberRef.current?.subscriber_id === sub.subscriber_id) return false;
    const lr = getLastReadForSubscriber(sub, lastReadRef.current);
    return !!(lr && sub.ultima_interacao && sub.ultima_interacao > lr);
  };

  const saveLastRead = useCallback((subscriber: Subscriber | null) => {
    if (!subscriber) return;
    const clientNow = new Date().toISOString();
    // Usa o maior valor entre "agora" e ultima_interacao do subscriber
    // Isso evita falsos "não lidos" quando o servidor está alguns ms à frente do cliente
    const ts = subscriber.ultima_interacao && subscriber.ultima_interacao > clientNow
      ? subscriber.ultima_interacao
      : clientNow;
    const unreadKey = getConversationUnreadKey(subscriber);
    lastReadRef.current[unreadKey] = ts;
    lastReadRef.current[subscriber.subscriber_id] = ts;
    try { localStorage.setItem(LAST_READ_KEY, JSON.stringify(lastReadRef.current)); } catch { /* ignore */ }
  }, []);

  // Avisa todos os agentes conectados que esta conversa foi lida
  const broadcastConversationRead = useCallback((subscriber: Subscriber) => {
    const channel = readReceiptsChannelRef.current;
    if (!channel) return;
    const unread_key = getConversationUnreadKey(subscriber);
    const phone_suffix = getSubscriberPhoneSuffix(subscriber);
    channel.send({
      type: 'broadcast',
      event: 'conversation_read',
      payload: {
        unread_key,
        subscriber_id: subscriber.subscriber_id,
        lead_id: subscriber.lead_id || null,
        phone_suffix: phone_suffix || null,
      },
    }).catch(() => {});
  }, []);

  // Altera a origem do lead (tráfego ↔ escritório) e persiste no DB
  const changeLeadOrigin = useCallback(async (subscriber: Subscriber, origin: 'trafego' | 'escritorio') => {
    const isTrafego = origin === 'trafego';
    const newTipoOrigem = isTrafego ? 'trafego' : 'whatsapp_direto';
    const newLinhaWhatsapp: string | null = isTrafego ? 'trafego' : null;
    const newInstancePhone = isTrafego ? '5592985888190' : '5592991604348';
    try {
      await supabase.from('manychat_subscribers' as any)
        .update({ linha_whatsapp: newLinhaWhatsapp, instance_name: newInstancePhone })
        .eq('subscriber_id', subscriber.subscriber_id);
      if (subscriber.lead_id) {
        await supabase.from('leads_juridicos' as any)
          .update({ tipo_origem: newTipoOrigem })
          .eq('id', subscriber.lead_id);
      }
      setSelectedSubscriber(prev => prev ? { ...prev, instance_name: newInstancePhone, lead_tipo_origem: newTipoOrigem } : null);
      setSubscribers(prev => prev.map(s =>
        s.subscriber_id === subscriber.subscriber_id
          ? { ...s, instance_name: newInstancePhone, lead_tipo_origem: newTipoOrigem }
          : s
      ));
      toast({
        title: `Origem → ${isTrafego ? 'Tráfego' : 'Escritório'}`,
        description: `Automações usarão ${isTrafego ? 'Bentes Ramos Trafego (98588-8190)' : 'Bentes Ramos (99160-4348)'}`,
      });
    } catch (error: any) {
      toast({ title: 'Erro ao alterar origem', description: error.message, variant: 'destructive' });
    }
  }, [toast]);

  // ─── Initial unreads computation ────────────────────────────────────────────

  const computeInitialUnreads = useCallback(async (subs: Subscriber[]) => {
    if (subs.length === 0) return;
    const lastRead = { ...lastReadRef.current };
    const toCheck: Array<{ subscriber: Subscriber; unreadKey: string; since: string }> = [];
    for (const sub of subs) {
      const unreadKey = getConversationUnreadKey(sub);
      const lr = getLastReadForSubscriber(sub, lastRead);
      if (lr && !lastRead[unreadKey]) lastRead[unreadKey] = lr;
      if (!lr) {
        if (sub.ultima_interacao) {
          const diff = Date.now() - new Date(sub.ultima_interacao).getTime();
          if (diff < 7 * 86400000) toCheck.push({ subscriber: sub, unreadKey, since: new Date(Date.now() - 7 * 86400000).toISOString() });
        }
        continue;
      }
      if (sub.ultima_interacao && sub.ultima_interacao > lr) toCheck.push({ subscriber: sub, unreadKey, since: lr });
    }
    if (toCheck.length === 0) {
      lastReadRef.current = lastRead;
      try { localStorage.setItem(LAST_READ_KEY, JSON.stringify(lastReadRef.current)); } catch {}
      return;
    }
    const newUnreads = new Map<string, number>();
    const batchSize = 50;
    for (let i = 0; i < toCheck.length; i += batchSize) {
      const batch = toCheck.slice(i, i + batchSize);
      const promises = batch.map(async ({ subscriber, unreadKey, since }) => {
        const possibleIds = buildPossibleSubscriberIds(subscriber.subscriber_id, subscriber.telefone);
        const leadId = subscriber.lead_id;
        try {
          let query = supabase.from("manychat_mensagens").select("id", { count: "exact", head: true }).eq("direcao", "entrada").gt("created_at", since);
          if (leadId) query = query.or(`subscriber_id.in.(${possibleIds.join(",")}),lead_id.eq.${leadId}`);
          else query = query.in("subscriber_id", possibleIds);
          const { count } = await query;
          if (count && count > 0) newUnreads.set(unreadKey, count);
        } catch {}
      });
      await Promise.all(promises);
    }
    if (newUnreads.size > 0) {
      setUnreadCounts(prev => {
        const merged = new Map(prev);
        for (const [k, v] of newUnreads) merged.set(k, Math.max(merged.get(k) || 0, v));
        return merged;
      });
    }
    lastReadRef.current = lastRead;
    try { localStorage.setItem(LAST_READ_KEY, JSON.stringify(lastReadRef.current)); } catch {}
  }, []);

  // ─── Last message previews ──────────────────────────────────────────────────

  const loadMessagePreviews = useCallback(async (subs: Subscriber[]) => {
    if (subs.length === 0) return;
    const leadIds = subs.map(s => s.lead_id).filter(Boolean) as string[];
    const previewMap = new Map<string, string>();
    if (leadIds.length > 0) {
      const { data: messages } = await supabase.from("manychat_mensagens").select("lead_id, subscriber_id, conteudo, tipo, direcao, created_at").in("lead_id", leadIds).order("created_at", { ascending: false }).limit(500);
      if (messages) {
        const seenLeads = new Set<string>();
        for (const msg of messages as any[]) {
          const leadId = msg.lead_id as string;
          if (seenLeads.has(leadId)) continue;
          seenLeads.add(leadId);
          const sub = subs.find(s => s.lead_id === leadId);
          if (sub) {
            const prefix = msg.direcao === "saida" ? "Você: " : "";
            let text = msg.conteudo || "";
            if (msg.tipo === "audio") text = "🎤 Áudio";
            else if (msg.tipo === "image") text = "📷 Imagem";
            else if (msg.tipo === "video") text = "🎥 Vídeo";
            else if (msg.tipo === "document") text = "📄 Documento";
            previewMap.set(sub.subscriber_id, prefix + text);
          }
        }
      }
    }
    setLastMessagePreviews(previewMap);
  }, []);

  useEffect(() => {
    if (subscribers.length > 0 && !subscribersLoadedRef.current) {
      subscribersLoadedRef.current = true;
      computeInitialUnreads(subscribers);
      loadMessagePreviews(subscribers);
    }
  }, [subscribers, computeInitialUnreads, loadMessagePreviews]);

  useEffect(() => { selectedSubscriberRef.current = selectedSubscriber; }, [selectedSubscriber]);
  useEffect(() => { subscribersRef.current = subscribers; }, [subscribers]);
  // Fecha edição de nome ao trocar de conversa
  useEffect(() => { setEditingLeadName(false); nameSavingRef.current = false; }, [selectedSubscriber?.subscriber_id]);

  // ─── Scroll & message helpers ───────────────────────────────────────────────

  const scrollToBottom = (instant = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "instant" : "smooth" });
  };

  const getProviderMessageId = (msg: any): string | undefined => {
    const mid = msg?.metadata?.message_id || msg?.metadata?.original?.messageId || msg?.metadata?.original?.id?.id || msg?.metadata?.original?.id;
    return typeof mid === "string" && mid.length > 5 ? mid : undefined;
  };

  const getMessageDedupeKey = (msg: any) => {
    const mid = getProviderMessageId(msg);
    if (mid) return `mid_${mid}`;
    const contentHash = (msg?.conteudo || "").substring(0, 100);
    const timePrefix = (msg?.created_at || "").substring(0, 16);
    const direcao = msg?.direcao || "unknown";
    if (contentHash && timePrefix) return `hash_${direcao}_${timePrefix}_${contentHash}`;
    return `db_${msg?.id}`;
  };

  const shouldSkipRapidDuplicateSend = useCallback((sendKey: string, windowMs = 1200) => {
    const now = Date.now();
    const lastSentAt = outboundSendGuardRef.current.get(sendKey) || 0;
    if (now - lastSentAt < windowMs) return true;
    outboundSendGuardRef.current.set(sendKey, now);
    if (outboundSendGuardRef.current.size > 200) {
      const cutoff = now - 60_000;
      for (const [key, ts] of outboundSendGuardRef.current.entries()) if (ts < cutoff) outboundSendGuardRef.current.delete(key);
    }
    return false;
  }, []);

  const isLikelyDuplicateOutbound = (a: Message, b: Message) => {
    if (a.direcao !== "saida" || b.direcao !== "saida") return false;
    if ((a.tipo || "text") !== (b.tipo || "text")) return false;
    if ((a.subscriber_id || "") !== (b.subscriber_id || "")) return false;
    if ((a.conteudo || "").trim() !== (b.conteudo || "").trim()) return false;
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
    return Math.abs(ta - tb) <= 8000;
  };

  const compareMessagesChronological = (a: Message, b: Message) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  };

  const mergeMessageDedup = (current: Message[], incoming: Message) => {
    const incomingKey = getMessageDedupeKey(incoming);
    return [
      ...current.filter(msg => msg.id !== incoming.id && getMessageDedupeKey(msg) !== incomingKey && !isLikelyDuplicateOutbound(msg, incoming)),
      incoming,
    ].sort(compareMessagesChronological);
  };

  useEffect(() => { if (!isPrependingRef.current) scrollToBottom(); }, [messages]);

  // Restaura posição do scroll ao fazer prepend de mensagens antigas
  useLayoutEffect(() => {
    if (beforePrependScrollRef.current && messagesContainerRef.current) {
      const { scrollHeight: prevH, scrollTop: prevT } = beforePrependScrollRef.current;
      messagesContainerRef.current.scrollTop = prevT + (messagesContainerRef.current.scrollHeight - prevH);
      beforePrependScrollRef.current = null;
    }
  }, [messages]);

  useEffect(() => {
    const leadId = searchParams.get("lead_id");
    if (leadId) { setPendingLeadId(leadId); setSearchParams({}); }
  }, [searchParams, setSearchParams]);

  // ─── Find or create subscriber for pending lead ─────────────────────────────

  useEffect(() => {
    const findOrCreateSubscriberForLead = async () => {
      if (!pendingLeadId || subscribers.length === 0) return;
      let subscriber = subscribers.find(s => s.lead_id === pendingLeadId);
      if (subscriber) { setSelectedSubscriber(subscriber); setPendingLeadId(null); return; }
      try {
        const { data: lead } = await supabase.from("leads_juridicos").select("telefone, nome, email").eq("id", pendingLeadId).single();
        if (!lead) { setPendingLeadId(null); return; }
        const phoneClean = lead.telefone?.replace(/\D/g, "") || "";
        const phoneSuffix = phoneClean.slice(-9);
        if (phoneClean) {
          subscriber = subscribers.find(s => {
            if (!s.telefone) return false;
            const subPhone = s.telefone.replace(/\D/g, "");
            return subPhone === phoneClean || subPhone.endsWith(phoneSuffix) || phoneClean.endsWith(subPhone.slice(-9));
          });
          if (!subscriber) {
            const normalizedPhone = phoneClean.startsWith("55") ? phoneClean : "55" + phoneClean;
            const zapiId = `zapi_${normalizedPhone}`;
            subscriber = subscribers.find(s => s.subscriber_id === zapiId || s.subscriber_id.includes(phoneSuffix));
          }
        }
        if (subscriber) {
          const invalidNames = ["Desconhecido", "Sem nome", "desconhecido", "null", "", "{{wa_id}}"];
          const subHasInvalidName = !subscriber.nome || invalidNames.includes(subscriber.nome) || subscriber.nome.startsWith("{{") || subscriber.nome.startsWith("[");
          const updatePayload: Record<string, string> = { lead_id: pendingLeadId };
          if (subHasInvalidName && lead.nome) updatePayload.nome = lead.nome;
          await supabase.from("manychat_subscribers").update(updatePayload).eq("subscriber_id", subscriber.subscriber_id);
          setSelectedSubscriber({ ...subscriber, lead_id: pendingLeadId, nome: updatePayload.nome || subscriber.nome });
          setSubscribers((prev: Subscriber[]) => prev.map((s: Subscriber) => s.subscriber_id === subscriber!.subscriber_id ? { ...s, lead_id: pendingLeadId, nome: updatePayload.nome || s.nome } : s));
          setPendingLeadId(null);
          return;
        }
        if (!phoneClean) { setPendingLeadId(null); return; }
        const normalizedPhone = phoneClean.startsWith("55") ? phoneClean : "55" + phoneClean;
        const newSubscriberId = `zapi_${normalizedPhone}`;
        const { data: newSubscriber, error: createError } = await supabase.from("manychat_subscribers").insert({ subscriber_id: newSubscriberId, nome: lead.nome || "Contato", telefone: normalizedPhone, telefone_normalizado: normalizedPhone, email: lead.email, lead_id: pendingLeadId, canal: "whatsapp", ultima_interacao: new Date().toISOString() }).select().single();
        if (createError) { setPendingLeadId(null); return; }
        const newSub: Subscriber = { id: newSubscriber.id, subscriber_id: newSubscriber.subscriber_id, nome: newSubscriber.nome || "Contato", telefone: newSubscriber.telefone, email: newSubscriber.email, canal: "whatsapp", lead_id: pendingLeadId, ultima_interacao: newSubscriber.ultima_interacao };
        setSubscribers(prev => [newSub, ...prev]);
        setSelectedSubscriber(newSub);
        setMessages([]);
        setPendingLeadId(null);
      } catch { setPendingLeadId(null); }
    };
    findOrCreateSubscriberForLead();
  }, [pendingLeadId, subscribers]);

  const findMatchingSubscriber = (msgSubId: string, msgLeadId?: string): Subscriber | undefined => {
    const subs = subscribersRef.current;
    let match = subs.find(s => s.subscriber_id === msgSubId);
    if (match) return match;
    if (msgLeadId) { match = subs.find(s => s.lead_id === msgLeadId); if (match) return match; }
    if (msgSubId.startsWith("zapi_")) {
      const phone = msgSubId.replace("zapi_", "");
      const suffix = phone.slice(-9);
      match = subs.find(s => { const subPhone = s.telefone?.replace(/\D/g, "") || ""; return subPhone.endsWith(suffix) || s.subscriber_id.includes(suffix); });
    }
    return match;
  };

  // ─── Realtime channels ──────────────────────────────────────────────────────

  // Ref para rastrear o canal ativo — garante cleanup correto mesmo após reconexões
  const activeMessagesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let isSubscribed = true;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const setupMessagesChannel = () => {
      // Remove canal anterior antes de criar novo (evita canais órfãos e conflitos)
      if (activeMessagesChannelRef.current) {
        supabase.removeChannel(activeMessagesChannelRef.current);
        activeMessagesChannelRef.current = null;
      }
      // Nome único por montagem: previne conflito se outro tab/sessão usa o mesmo user
      const channelName = `manychat-msgs-${user?.id || "anon"}-${Date.now()}`;
      const channel = supabase.channel(channelName).on("postgres_changes", { event: "INSERT", schema: "public", table: "manychat_mensagens" }, (payload) => {
        if (!isSubscribed) return;
        const newMsg = payload.new as Message & { subscriber_id: string; subscriber_nome?: string };
        if (recentMsgIdsRef.current.has(newMsg.id)) return;
        recentMsgIdsRef.current.add(newMsg.id);
        if (recentMsgIdsRef.current.size > 100) {
          const arr = Array.from(recentMsgIdsRef.current);
          recentMsgIdsRef.current = new Set(arr.slice(-50));
        }
        const currentSub = selectedSubscriberRef.current;
        const currentSubId = currentSub?.subscriber_id;
        const currentLeadId = currentSub?.lead_id;
        const currentConversationIds = currentSubId ? new Set(buildPossibleSubscriberIds(currentSubId, currentSub?.telefone)) : null;
        const isCurrentChat = !!(currentSub && ((currentConversationIds?.has(newMsg.subscriber_id) ?? false) || (currentLeadId && (newMsg as any).lead_id === currentLeadId)));
        if (isCurrentChat) {
          const newMsgDedupeKey = getMessageDedupeKey(newMsg);
          if (dedupKeysRef.current.has(newMsgDedupeKey) || dedupKeysRef.current.has(`db_${newMsg.id}`)) return;
          dedupKeysRef.current.add(newMsgDedupeKey);
          dedupKeysRef.current.add(`db_${newMsg.id}`);
          setMessages(prev => { const updated = mergeMessageDedup(prev, newMsg as Message); if (currentSubId) { messagesCacheRef.current.set(currentSubId, updated); messageCacheTimestampRef.current.set(currentSubId, Date.now()); } return updated; });
          scrollToBottom();
          // Mantém lastRead atualizado enquanto a conversa está aberta
          if (currentSub) saveLastRead(currentSub);
        } else {
          messagesCacheRef.current.delete(newMsg.subscriber_id);
          if (newMsg.direcao === "entrada") {
            setUnreadCounts(prev => {
              const newMap = new Map(prev);
              const matchingSub = findMatchingSubscriber(newMsg.subscriber_id, (newMsg as any).lead_id);
              const key = matchingSub ? getConversationUnreadKey(matchingSub) : getConversationUnreadKeyFromMessage(newMsg.subscriber_id, (newMsg as any).lead_id);
              newMap.set(key, (newMap.get(key) || 0) + 1);
              return newMap;
            });
          }
        }
        const matchingSub = findMatchingSubscriber(newMsg.subscriber_id, (newMsg as any).lead_id);
        const key = matchingSub?.subscriber_id || newMsg.subscriber_id;
        const prefix = newMsg.direcao === "saida" ? "Você: " : "";
        let text = newMsg.conteudo || "";
        const tipo = (newMsg as any).tipo;
        if (tipo === "audio") text = "🎤 Áudio";
        else if (tipo === "image") text = "📷 Imagem";
        else if (tipo === "video") text = "🎥 Vídeo";
        else if (tipo === "document") text = "📄 Documento";
        setLastMessagePreviews(prev => { const newMap = new Map(prev); newMap.set(key, prefix + text); return newMap; });
        if (newMsg.direcao === "entrada") { playNotificationSound(); if (!isCurrentChat) notifyNewMessage(newMsg.subscriber_nome || "Novo contato", newMsg.conteudo?.substring(0, 100) || ""); }
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
                if (idx === -1 && bumpSubId.startsWith("zapi_")) {
                  const phoneSuffix = bumpSubId.replace("zapi_", "").slice(-9);
                  idx = updated.findIndex(s => { const subPhone = s.telefone?.replace(/\D/g, "") || ""; return subPhone.endsWith(phoneSuffix) || s.subscriber_id.includes(phoneSuffix); });
                }
                if (idx === -1) { loadSubscribers(); continue; }
                const [subscriber] = updated.splice(idx, 1);
                updated = [{ ...subscriber, ultima_interacao: bumpTime }, ...updated];
              }
              return updated;
            });
          }, 500);
        }
      }).subscribe((status) => {
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) && isSubscribed) {
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            if (isSubscribed) setupMessagesChannel();
          }, 3000);
        } else if (status === "SUBSCRIBED" && isSubscribed) {
          // Reconectou: busca mensagens que chegaram durante o intervalo offline
          const sub = selectedSubscriberRef.current;
          if (sub) {
            const cached = messagesCacheRef.current.get(sub.subscriber_id) || [];
            const newestAt = cached.length > 0 ? cached[cached.length - 1]?.created_at : null;
            if (!newestAt) return;
            const phoneClean = sub.telefone?.replace(/\D/g, "") || "";
            const idsArray = buildPossibleSubscriberIds(sub.subscriber_id, phoneClean);
            const idsFilter = idsArray.map((id: string) => `subscriber_id.eq.${id}`).join(",");
            let q = (supabase.from("manychat_mensagens" as any) as any)
              .select("*")
              .gt("created_at", newestAt)
              .order("created_at", { ascending: true })
              .limit(100);
            if (sub.lead_id) q = q.or(`${idsFilter},lead_id.eq.${sub.lead_id}`);
            else q = q.or(idsFilter);
            q.then(({ data }: { data: any }) => {
              if (!data || !isSubscribed) return;
              setMessages((prev: Message[]) => {
                const existingIds = new Set(prev.map((m: Message) => m.id));
                const newMsgs = (data as Message[]).filter((m: Message) => !existingIds.has(m.id));
                if (newMsgs.length === 0) return prev;
                const merged = [...prev, ...newMsgs].sort(compareMessagesChronological);
                messagesCacheRef.current.set(sub.subscriber_id, merged);
                return merged;
              });
            });
          }
        }
      });
      activeMessagesChannelRef.current = channel;
      return channel;
    };

    const setupSubscribersChannel = () => {
      const channel = supabase.channel(`manychat-subs-${user?.id || "anon"}`).on("postgres_changes", { event: "*", schema: "public", table: "manychat_subscribers" }, (payload) => {
        if (!isSubscribed) return;
        if (payload.eventType === "INSERT") {
          const newSub = payload.new as Subscriber;
          setSubscribers(prev => { if (prev.some(s => s.subscriber_id === newSub.subscriber_id)) return prev; return [newSub, ...prev]; });
        } else if (payload.eventType === "UPDATE") {
          const updatedSub = payload.new as Subscriber;
          const oldSub = payload.old as Subscriber;
          if (updatedSub.assigned_to === user?.id && oldSub?.assigned_to !== user?.id) notifyAssignment(updatedSub.nome || "Contato", "Um colega");
          setSubscribers(prev => { const idx = prev.findIndex(s => s.subscriber_id === updatedSub.subscriber_id); if (idx === -1) return prev; const updated = [...prev]; updated[idx] = { ...updated[idx], ...updatedSub }; return updated; });
          if (selectedSubscriberRef.current?.subscriber_id === updatedSub.subscriber_id) {
            setSelectedSubscriber(prev => prev ? { ...prev, nome: updatedSub.nome || prev.nome, atendimento_humano: updatedSub.atendimento_humano, atendimento_humano_desde: updatedSub.atendimento_humano_desde, lead_id: updatedSub.lead_id || prev.lead_id } : null);
            // ultima_interacao atualizado pelo DB enquanto conversa está aberta → mantém lastRead atual
            // Passa o subscriber com o ultima_interacao mais recente do DB para cobrir drift de relógio
            if (updatedSub.ultima_interacao && selectedSubscriberRef.current) {
              saveLastRead({ ...selectedSubscriberRef.current, ultima_interacao: updatedSub.ultima_interacao });
            }
          }
        }
      }).subscribe();
      return channel;
    };

    setupMessagesChannel();
    const subscribersChannel = setupSubscribersChannel();

    // Broadcast channel: sincroniza leitura de mensagens entre todos os agentes conectados
    const readChannel = supabase.channel('chat-read-receipts-global')
      .on('broadcast', { event: 'conversation_read' }, ({ payload }) => {
        if (!isSubscribed || !payload) return;
        const { unread_key, subscriber_id, lead_id, phone_suffix } = payload as any;
        setUnreadCounts(prev => {
          const next = new Map(prev);
          if (unread_key) next.delete(unread_key);
          if (subscriber_id) { next.delete(subscriber_id); next.delete(`zapi_${subscriber_id}`); }
          if (lead_id) { next.delete(`lead:${lead_id}`); }
          if (phone_suffix) next.delete(`phone:${phone_suffix}`);
          return next;
        });
      })
      .subscribe();
    readReceiptsChannelRef.current = readChannel;

    return () => {
      isSubscribed = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      // Usa o ref para remover o canal ativo atual (pode ter sido trocado por reconexão)
      if (activeMessagesChannelRef.current) {
        supabase.removeChannel(activeMessagesChannelRef.current);
        activeMessagesChannelRef.current = null;
      }
      supabase.removeChannel(subscribersChannel);
      supabase.removeChannel(readChannel);
      readReceiptsChannelRef.current = null;
    };
  }, [user?.id, playNotificationSound, notifyNewMessage, notifyAssignment]);

  // ─── Fallback 1: ao voltar pra aba, busca msgs que chegaram enquanto estava offline ──
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const sub = selectedSubscriberRef.current;
      if (!sub) return;
      const cached = messagesCacheRef.current.get(sub.subscriber_id) || [];
      const newestAt = cached.length > 0 ? cached[cached.length - 1]?.created_at : null;
      if (!newestAt) return;
      const phoneClean = sub.telefone?.replace(/\D/g, '') || '';
      const idsArray = buildPossibleSubscriberIds(sub.subscriber_id, phoneClean);
      const idsFilter = idsArray.map((id: string) => `subscriber_id.eq.${id}`).join(',');
      let q = (supabase.from('manychat_mensagens' as any) as any)
        .select('*').gt('created_at', newestAt).order('created_at', { ascending: true }).limit(100);
      if (sub.lead_id) q = q.or(`${idsFilter},lead_id.eq.${sub.lead_id}`);
      else q = q.or(idsFilter);
      q.then(({ data }: { data: any }) => {
        if (!data || (data as any[]).length === 0) return;
        setMessages((prev: Message[]) => {
          const ids = new Set(prev.map((m: Message) => m.id));
          const newMsgs = (data as Message[]).filter((m: Message) => !ids.has(m.id));
          if (newMsgs.length === 0) return prev;
          const merged = [...prev, ...newMsgs].sort(compareMessagesChronological);
          messagesCacheRef.current.set(sub.subscriber_id, merged);
          return merged;
        });
      });
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fallback global: poll a cada 3s busca QUALQUER msg nova em QUALQUER conversa ──
  // Funciona mesmo sem realtime, mesmo sem conversa selecionada.
  // Usa recentMsgIdsRef para evitar processar msg que o realtime já tratou.
  const lastGlobalPollRef = useRef<string>(new Date(Date.now() - 10_000).toISOString());

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const since = lastGlobalPollRef.current;
        lastGlobalPollRef.current = new Date().toISOString();

        const { data } = await (supabase
          .from('manychat_mensagens' as any)
          .select('id,subscriber_id,lead_id,conteudo,tipo,direcao,created_at,metadata,subscriber_nome') as any)
          .gt('created_at', since)
          .order('created_at', { ascending: true })
          .limit(100);

        if (!data || (data as any[]).length === 0) return;

        // Filtra msgs que o realtime já processou — poll só age quando realtime falha
        const newMsgs = (data as Message[]).filter(
          (m: Message) => !recentMsgIdsRef.current.has(m.id)
        );
        if (newMsgs.length === 0) return;

        // Marca como processados para evitar loop
        newMsgs.forEach((m: Message) => recentMsgIdsRef.current.add(m.id));

        const sub = selectedSubscriberRef.current;

        // 1. Adiciona msgs da conversa aberta
        if (sub) {
          const convIds = new Set(buildPossibleSubscriberIds(sub.subscriber_id, sub.telefone?.replace(/\D/g, '')));
          const forConv = newMsgs.filter((m: Message) =>
            convIds.has((m as any).subscriber_id || '') ||
            (sub.lead_id && (m as any).lead_id === sub.lead_id)
          );
          if (forConv.length > 0) {
            setMessages((prev: Message[]) => {
              const ids = new Set(prev.map((x: Message) => x.id));
              const incoming = forConv.filter((m: Message) => !ids.has(m.id));
              if (incoming.length === 0) return prev;
              const merged = [...prev, ...incoming].sort(compareMessagesChronological);
              messagesCacheRef.current.set(sub.subscriber_id, merged);
              messageCacheTimestampRef.current.set(sub.subscriber_id, Date.now());
              return merged;
            });
            scrollToBottom();
          }
        }

        // 2. Atualiza lista de conversas (preview + ordem + badge)
        for (const msg of newMsgs) {
          const matchingSub = findMatchingSubscriber((msg as any).subscriber_id, (msg as any).lead_id);
          if (!matchingSub) continue;

          // Preview
          let text = (msg as any).conteudo || '';
          const tipo = (msg as any).tipo;
          if (tipo === 'audio') text = '🎤 Áudio';
          else if (tipo === 'image') text = '📷 Imagem';
          else if (tipo === 'video') text = '🎥 Vídeo';
          else if (tipo === 'document') text = '📄 Documento';
          const prefix = (msg as any).direcao === 'saida' ? 'Você: ' : '';
          setLastMessagePreviews((prev: Map<string, string>) => {
            const m = new Map(prev); m.set(matchingSub.subscriber_id, prefix + text); return m;
          });

          // Bump para o topo e badge de não lida
          if ((msg as any).direcao === 'entrada') {
            setSubscribers((prev: typeof subscribers) => {
              const idx = prev.findIndex(s => s.subscriber_id === matchingSub.subscriber_id);
              if (idx === -1) return prev;
              const bumped = { ...prev[idx], ultima_interacao: msg.created_at };
              return [bumped, ...prev.filter((_: any, i: number) => i !== idx)];
            });
            const isOpenConv = sub && (
              sub.subscriber_id === matchingSub.subscriber_id ||
              (sub.lead_id && sub.lead_id === matchingSub.lead_id)
            );
            if (!isOpenConv) {
              setUnreadCounts((prev: Map<string, number>) => {
                const key = getConversationUnreadKey(matchingSub);
                const m = new Map(prev); m.set(key, (m.get(key) || 0) + 1); return m;
              });
            }
          }
        }
      } catch { /* silencioso */ }
    }, 3_000);
    return () => clearInterval(poll);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Poll por conversa: usa mesma query do loadMessages (funciona mesmo com
  // subscriber_id em formato diferente, porque filtra por lead_id também) ────────
  useEffect(() => {
    if (!selectedSubscriber) return;
    const subId = selectedSubscriber.subscriber_id;
    const interval = setInterval(async () => {
      const sub = selectedSubscriberRef.current;
      if (!sub || sub.subscriber_id !== subId) return;
      const cached = messagesCacheRef.current.get(sub.subscriber_id) || [];
      const newestAt = cached.length > 0 ? cached[cached.length - 1]?.created_at : null;
      if (!newestAt) return;
      try {
        const phoneClean = sub.telefone?.replace(/\D/g, '') || '';
        const leadId = sub.lead_id;
        const idsArray = buildPossibleSubscriberIds(sub.subscriber_id, phoneClean);
        const idsFilter = idsArray.map((id: string) => `subscriber_id.eq.${id}`).join(',');
        let q = (supabase.from('manychat_mensagens' as any) as any)
          .select('*').gt('created_at', newestAt).order('created_at', { ascending: true }).limit(50);
        if (leadId) q = q.or(`${idsFilter},lead_id.eq.${leadId}`);
        else q = q.or(idsFilter);
        const { data } = await q;
        if (!data || (data as any[]).length === 0) return;
        setMessages((prev: Message[]) => {
          const ids = new Set(prev.map((m: Message) => m.id));
          const newMsgs = (data as Message[]).filter((m: Message) => !ids.has(m.id));
          if (newMsgs.length === 0) return prev;
          const merged = [...prev, ...newMsgs].sort(compareMessagesChronological);
          messagesCacheRef.current.set(sub.subscriber_id, merged);
          messageCacheTimestampRef.current.set(sub.subscriber_id, Date.now());
          return merged;
        });
        scrollToBottom();
      } catch { /* silencioso */ }
    }, 5_000);
    return () => clearInterval(interval);
  }, [selectedSubscriber?.subscriber_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── On select subscriber: load messages + clear unreads ────────────────────

  useEffect(() => {
    const currentSubId = selectedSubscriber?.subscriber_id || null;
    if (currentSubId === prevSelectedSubIdRef.current) return;
    prevSelectedSubIdRef.current = currentSubId;
    if (selectedSubscriber) {
      setMessages([]);
      dedupKeysRef.current = new Set();
      setSelectedMessageIds(new Set());
      setReplyToMessage(null);
      const cachedMessages = messagesCacheRef.current.get(selectedSubscriber.subscriber_id);
      const cacheAge = Date.now() - (messageCacheTimestampRef.current.get(selectedSubscriber.subscriber_id) || 0);
      const isCacheFresh = cacheAge < 30000;
      if (cachedMessages && cachedMessages.length > 0) {
        const sortedCache = [...cachedMessages].sort(compareMessagesChronological);
        setMessages(sortedCache);
        oldestMsgCursorRef.current = sortedCache.length > 0 ? sortedCache[0].created_at : null;
        setHasMoreMessages(sortedCache.length >= 80);
        dedupKeysRef.current = new Set(sortedCache.map(m => getMessageDedupeKey(m)));
        sortedCache.forEach(m => dedupKeysRef.current.add(`db_${m.id}`));
        setIsLoadingMessages(false);
        if (!isCacheFresh) loadMessages(selectedSubscriber.subscriber_id, false, selectedSubscriber);
      } else {
        loadMessages(selectedSubscriber.subscriber_id, false, selectedSubscriber);
      }

      // ✅ FIX BADGE: zera contadores E lastReadRef síncronos ao mudar de conversa
      const unreadKey = getConversationUnreadKey(selectedSubscriber);
      // saveLastRead abaixo já salva com max(now, ultima_interacao) — não duplicar aqui

      setUnreadCounts(prev => {
        const newMap = new Map(prev);
        newMap.delete(unreadKey);
        newMap.delete(selectedSubscriber.subscriber_id);
        if (selectedSubscriber.lead_id) newMap.delete(`lead:${selectedSubscriber.lead_id}`);
        const suffix = getSubscriberPhoneSuffix(selectedSubscriber);
        if (suffix) newMap.delete(`phone:${suffix}`);
        const phone = selectedSubscriber.telefone?.replace(/\D/g, '') || '';
        if (phone) {
          newMap.delete(phone);
          newMap.delete(`55${phone}`);
          newMap.delete(`zapi_${phone}`);
          newMap.delete(`zapi_55${phone}`);
        }
        return newMap;
      });
      saveLastRead(selectedSubscriber);
      broadcastConversationRead(selectedSubscriber);
      setCurrentChat(selectedSubscriber.subscriber_id);
      setShowMobileChat(true);
    } else {
      setMessages([]);
      setCurrentChat(null);
    }
  }, [selectedSubscriber?.subscriber_id, setCurrentChat, saveLastRead, broadcastConversationRead]);

  useEffect(() => { loadSubscribers(); }, []);

  const handleTyping = useCallback(() => {
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
  }, [setTyping]);

  // ─── loadSubscribers ────────────────────────────────────────────────────────

  const loadSubscribers = async () => {
    setIsLoading(true);
    try {
      // Limite de 300 para evitar sobrecarga — os mais recentes têm prioridade
      const { data: subsData, error: subsError } = await supabase.from("manychat_subscribers" as any).select("*").order("ultima_interacao", { ascending: false }).limit(300);
      if (subsError) throw subsError;
      const rawSubscribers = (subsData as Subscriber[]) || [];
      const leadIds = [...new Set(rawSubscribers.map(s => s.lead_id).filter(Boolean))];
      const leadsMap = new Map<string, string>();
      if (leadIds.length > 0) {
        const { data: leadsData } = await supabase.from("leads_juridicos").select("id, tipo_origem").in("id", leadIds);
        if (leadsData) leadsData.forEach((lead: any) => leadsMap.set(lead.id, lead.tipo_origem || "indefinido"));
      }
      const subsWithoutInstance = rawSubscribers.filter(s => !s.instance_name);
      const instanceByLeadId = new Map<string, string>();
      const instanceBySubscriberId = new Map<string, string>();
      if (subsWithoutInstance.length > 0) {
        const missingLeadIds = [...new Set(subsWithoutInstance.map(s => s.lead_id).filter(Boolean))] as string[];
        const missingSubIds = subsWithoutInstance.map(s => s.subscriber_id);
        // Executar as duas queries em paralelo para reduzir latência
        const [leadMsgsResult, subMsgsResult] = await Promise.all([
          missingLeadIds.length > 0
            ? supabase.from("manychat_mensagens").select("lead_id, metadata, created_at").in("lead_id", missingLeadIds).order("created_at", { ascending: false }).limit(500)
            : Promise.resolve({ data: null }),
          missingSubIds.length > 0
            ? supabase.from("manychat_mensagens").select("subscriber_id, metadata, created_at").in("subscriber_id", missingSubIds).order("created_at", { ascending: false }).limit(500)
            : Promise.resolve({ data: null }),
        ]);
        if (leadMsgsResult.data) {
          for (const msg of leadMsgsResult.data as any[]) {
            const lid = msg.lead_id as string | null;
            if (!lid || instanceByLeadId.has(lid)) continue;
            const connectedPhone = (msg.metadata as any)?.original?.connectedPhone;
            if (connectedPhone) instanceByLeadId.set(lid, connectedPhone);
          }
        }
        if (subMsgsResult.data) {
          for (const msg of subMsgsResult.data as any[]) {
            const sid = msg.subscriber_id as string;
            if (!sid || instanceBySubscriberId.has(sid)) continue;
            const connectedPhone = (msg.metadata as any)?.original?.connectedPhone;
            if (connectedPhone) instanceBySubscriberId.set(sid, connectedPhone);
          }
        }
      }
      const deduplicatedMap = new Map<string, Subscriber>();
      for (const sub of rawSubscribers) {
        if (sub.telefone === "{{wa_id}}") continue;
        const cleanPhone = getPhoneDigits(sub.telefone);
        const rawSubscriberId = sub.subscriber_id.startsWith("zapi_") ? sub.subscriber_id.replace("zapi_", "") : sub.subscriber_id;
        const validPhoneInId = /^\d{10,13}$/.test(rawSubscriberId);
        const hasRealPhone = cleanPhone.length >= 10 || validPhoneInId;
        const hasHistoryByLead = !!sub.lead_id && instanceByLeadId.has(sub.lead_id);
        const hasHistoryBySubscriber = instanceBySubscriberId.has(sub.subscriber_id);
        if (!hasRealPhone && !hasHistoryByLead && !hasHistoryBySubscriber) continue;
        const subWithOrigem = { ...sub, lead_tipo_origem: sub.lead_id ? leadsMap.get(sub.lead_id) : undefined, instance_name: sub.instance_name || (sub.lead_id ? instanceByLeadId.get(sub.lead_id) : undefined) || instanceBySubscriberId.get(sub.subscriber_id) || undefined };
        const phoneClean = cleanPhone || (validPhoneInId ? rawSubscriberId : "");
        const normalizedPhone = phoneClean.startsWith("55") ? phoneClean : phoneClean.length >= 8 ? "55" + phoneClean : phoneClean;
        const phoneSuffix = normalizedPhone.slice(-9);
        const dedupeKey = sub.lead_id || (phoneSuffix.length >= 9 ? `phone_${phoneSuffix}` : sub.subscriber_id);
        const existing = deduplicatedMap.get(dedupeKey);
        if (!existing) deduplicatedMap.set(dedupeKey, subWithOrigem);
        else {
          const existingTime = new Date(existing.ultima_interacao || 0).getTime();
          const currentTime = new Date(sub.ultima_interacao || 0).getTime();
          const existingHasName = existing.nome && !existing.nome.includes("Desconhecido") && !existing.nome.includes("Contato");
          const currentHasName = sub.nome && !sub.nome.includes("Desconhecido") && !sub.nome.includes("Contato");
          if (currentHasName && !existingHasName) deduplicatedMap.set(dedupeKey, { ...subWithOrigem, lead_id: existing.lead_id || sub.lead_id });
          else if (currentTime > existingTime) deduplicatedMap.set(dedupeKey, { ...subWithOrigem, lead_id: existing.lead_id || sub.lead_id });
        }
      }
      const uniqueSubscribers = Array.from(deduplicatedMap.values()).sort((a, b) => new Date(b.ultima_interacao || 0).getTime() - new Date(a.ultima_interacao || 0).getTime());
      setSubscribers(uniqueSubscribers);
      const allSubscriberIds = uniqueSubscribers.map(s => s.subscriber_id);
      if (allSubscriberIds.length > 0) loadSubscriberTags(allSubscriberIds);
      if (selectedSubscriberRef.current) {
        const currentSubId = selectedSubscriberRef.current.subscriber_id;
        const refreshedSelected = uniqueSubscribers.find(s => s.subscriber_id === currentSubId);
        if (refreshedSelected) {
          setSelectedSubscriber(prev => prev ? { ...prev, instance_name: refreshedSelected.instance_name, lead_tipo_origem: refreshedSelected.lead_tipo_origem, nome: refreshedSelected.nome || prev.nome, lead_id: refreshedSelected.lead_id || prev.lead_id } : null);
          // Ao recarregar subscribers, mantém lastRead atualizado para a conversa aberta
          saveLastRead(refreshedSelected);
        }
      }
    } catch (error) { console.error("Erro ao carregar subscribers:", error); }
    finally { setIsLoading(false); }
  };

  const syncAllContacts = async () => {
    setIsSyncing(true);
    try {
      toast({ title: "Sincronização iniciada", description: "Atualizando contatos via Z-API..." });
      await supabase.functions.invoke("sync-subscriber-names");
      await loadSubscribers();
      toast({ title: "Sincronização concluída!", description: "Lista de contatos atualizada" });
    } catch (error: any) {
      toast({ title: "Erro na sincronização", description: error.message, variant: "destructive" });
    } finally { setIsSyncing(false); }
  };

  // ─── loadMessages ───────────────────────────────────────────────────────────

  const loadMessages = async (subscriberId: string, loadAll = false, subscriberOverride?: Subscriber | null) => {
    const requestId = ++loadMessagesRequestRef.current;
    setIsLoadingMessages(true);
    try {
      const currentSub = subscriberOverride || subscribers.find(s => s.subscriber_id === subscriberId) || selectedSubscriberRef.current;
      const phoneClean = currentSub?.telefone?.replace(/\D/g, "") || "";
      const leadId = currentSub?.lead_id;
      const idsArray = buildPossibleSubscriberIds(subscriberId, phoneClean);
      const idsFilter = idsArray.map(id => `subscriber_id.eq.${id}`).join(",");
      const PAGE_SIZE = 80;
      setHasMoreMessages(false);
      oldestMsgCursorRef.current = null;
      let query = supabase.from("manychat_mensagens" as any).select("*").order("created_at", { ascending: false });
      if (leadId) query = query.or(`${idsFilter},lead_id.eq.${leadId}`);
      else query = query.or(idsFilter);
      if (!loadAll) query = query.limit(PAGE_SIZE);
      const { data, error } = await query;
      if (error) throw error;
      const messagesMap = new Map<string, Message>();
      (data as any[])?.forEach(msg => { const key = getMessageDedupeKey(msg); if (!messagesMap.has(key)) messagesMap.set(key, msg as Message); });
      const uniqueMessages = Array.from(messagesMap.values()).sort(compareMessagesChronological);
      if (!loadAll) {
        const hasMore = uniqueMessages.length >= PAGE_SIZE;
        setHasMoreMessages(hasMore);
        oldestMsgCursorRef.current = uniqueMessages.length > 0 ? uniqueMessages[0].created_at : null;
      }
      messagesCacheRef.current.set(subscriberId, uniqueMessages);
      messageCacheTimestampRef.current.set(subscriberId, Date.now());
      dedupKeysRef.current = new Set(uniqueMessages.map(m => getMessageDedupeKey(m)));
      uniqueMessages.forEach(m => dedupKeysRef.current.add(`db_${m.id}`));
      if (loadMessagesRequestRef.current !== requestId) return;
      if (selectedSubscriberRef.current?.subscriber_id !== subscriberId) return;
      setMessages(prev => {
        const tempMessages = prev.filter(m => m.id.startsWith("temp_") && (!m.subscriber_id || m.subscriber_id === subscriberId));
        const realtimeOnly = prev.filter(m => {
          if (m.id.startsWith("temp_")) return false;
          const msgSubId = m.subscriber_id || "";
          const belongsToConversation = msgSubId === subscriberId || (leadId && (m as any).lead_id === leadId) || idsArray.includes(msgSubId);
          if (!belongsToConversation) return false;
          const key = getMessageDedupeKey(m);
          return !messagesMap.has(key) && !uniqueMessages.some(um => um.id === m.id);
        });
        if (tempMessages.length === 0 && realtimeOnly.length === 0) return uniqueMessages;
        const merged = [...uniqueMessages, ...realtimeOnly, ...tempMessages].sort(compareMessagesChronological);
        messagesCacheRef.current.set(subscriberId, merged);
        return merged;
      });
    } catch (error) { console.error("Erro ao carregar mensagens:", error); }
    finally { setIsLoadingMessages(false); }
  };

  // ─── loadMoreMessages — carrega mensagens mais antigas ao subir o scroll ──────

  const loadMoreMessages = async () => {
    if (isLoadingMoreRef.current || !oldestMsgCursorRef.current) return;
    const sub = selectedSubscriberRef.current;
    if (!sub) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMoreMessages(true);
    isPrependingRef.current = true;

    if (messagesContainerRef.current) {
      beforePrependScrollRef.current = {
        scrollHeight: messagesContainerRef.current.scrollHeight,
        scrollTop:    messagesContainerRef.current.scrollTop,
      };
    }

    try {
      const PAGE_SIZE = 80;
      const phoneClean = sub.telefone?.replace(/\D/g, "") || "";
      const idsArray   = buildPossibleSubscriberIds(sub.subscriber_id, phoneClean);
      const idsFilter  = idsArray.map(id => `subscriber_id.eq.${id}`).join(",");
      let query = supabase
        .from("manychat_mensagens" as any)
        .select("*")
        .lt("created_at", oldestMsgCursorRef.current!)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (sub.lead_id) query = query.or(`${idsFilter},lead_id.eq.${sub.lead_id}`);
      else             query = query.or(idsFilter);

      const { data, error } = await query;
      if (error || !data || (data as any[]).length === 0) {
        setHasMoreMessages(false);
        return;
      }

      const olderMsgs = (data as Message[]).sort(compareMessagesChronological);
      oldestMsgCursorRef.current = olderMsgs[0].created_at;
      setHasMoreMessages((data as any[]).length >= PAGE_SIZE);

      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newOld = olderMsgs.filter(m => !existingIds.has(m.id));
        if (newOld.length === 0) return prev;
        const combined = [...newOld, ...prev];
        messagesCacheRef.current.set(sub.subscriber_id, combined);
        return combined;
      });
    } catch (err) {
      console.error("[loadMoreMessages]", err);
    } finally {
      setIsLoadingMoreMessages(false);
      isLoadingMoreRef.current = false;
      setTimeout(() => { isPrependingRef.current = false; }, 50);
    }
  };

  const assignConversation = async (memberId: string) => {
    if (!selectedSubscriber) return;
    try {
      const { error } = await supabase.from("manychat_subscribers").update({ assigned_to: memberId }).eq("subscriber_id", selectedSubscriber.subscriber_id);
      if (error) throw error;
      const teamMembers = getTeamWithStatus();
      const member = teamMembers.find(m => m.id === memberId);
      toast({ title: "✅ Conversa direcionada", description: `Direcionado para ${member?.fullName || "membro da equipe"}` });
      setSelectedSubscriber(prev => prev ? { ...prev, assigned_to: memberId } : null);
      setSubscribers(prev => prev.map(s => s.subscriber_id === selectedSubscriber.subscriber_id ? { ...s, assigned_to: memberId } : s));
    } catch { toast({ title: "Erro", description: "Não foi possível direcionar a conversa", variant: "destructive" }); }
  };

  // ─── sendMessage ────────────────────────────────────────────────────────────

  const sendMessage = async (mediaUrl?: string, mediaType?: string, fileName?: string) => {
    const content = mediaUrl || newMessage.trim();
    if (!content || !selectedSubscriber) return;
    const currentSubId = selectedSubscriber.subscriber_id;
    const rapidSendKey = `${currentSubId}|${mediaType || "text"}|${content.trim().slice(0, 180)}`;
    if (shouldSkipRapidDuplicateSend(rapidSendKey, 1200)) return;
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = { id: tempId, conteudo: content, created_at: new Date().toISOString(), direcao: "saida", tipo: mediaType || "text", subscriber_id: currentSubId };
    setMessages(prev => { const updated = [...prev, optimisticMessage]; messagesCacheRef.current.set(currentSubId, updated); return updated; });
    setNewMessage("");
    setTyping(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setReplyToMessage(null);
    scrollToBottom();
    const subscriberSnapshot = { ...selectedSubscriber };
    (async () => {
      try {
        const outboundInstanceId = resolveInstanceId(subscriberSnapshot);
        const { data: zapiResult, error: zapiError } = await invokeZapiSend({ to_phone: subscriberSnapshot.telefone, message: content, type: mediaType || "text", lead_id: subscriberSnapshot.lead_id, file_name: fileName, ...(outboundInstanceId && { instance_id: outboundInstanceId }) });
        if (zapiError) throw new Error(zapiError.message || "Erro ao enviar via Z-API");
        const msgId = zapiResult?.messageId;
        // Salva sempre no banco — independente de ter ou não messageId do Z-API
        const { data: savedMsg, error: insertErr } = await supabase.from("manychat_mensagens" as any).insert({ subscriber_id: subscriberSnapshot.subscriber_id, subscriber_nome: subscriberSnapshot.nome, canal: "whatsapp", conteudo: content, tipo: mediaType || "text", direcao: "saida", lead_id: subscriberSnapshot.lead_id, metadata: { sent_via: "chat_interface", zapi_status: zapiResult?.success ? "success" : "error", ...(msgId && { message_id: msgId }), ...(fileName && { file_name: fileName }) } } as any).select().single();
        if (insertErr?.code === "23505" && msgId) {
          const { data: existingMsg } = await supabase.from("manychat_mensagens" as any).select("*").eq("metadata->>message_id", msgId).maybeSingle();
          if (existingMsg) {
            const realMsg = existingMsg as Message;
            dedupKeysRef.current.add(getMessageDedupeKey(realMsg));
            dedupKeysRef.current.add(`db_${realMsg.id}`);
            setMessages(prev => { const withoutTemp = prev.filter(m => m.id !== tempId); const updated = mergeMessageDedup(withoutTemp, realMsg); messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated); return updated; });
          }
        }
        if (savedMsg) {
          const savedAsMessage = savedMsg as Message;
          dedupKeysRef.current.add(getMessageDedupeKey(savedAsMessage));
          dedupKeysRef.current.add(`db_${savedAsMessage.id}`);
          setMessages(prev => { const withoutTemp = prev.filter(m => m.id !== tempId); const updated = mergeMessageDedup(withoutTemp, savedAsMessage); messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated); return updated; });
        }
        if (subscriberSnapshot.lead_id) {
          await supabase.from("interacoes").insert({ cliente_id: subscriberSnapshot.lead_id, tipo: "Chat", resumo: `Mensagem via WhatsApp: ${content.substring(0, 100)}...`, detalhes: content, direcao: "saida", data_interacao: new Date().toISOString() });
          try {
            await supabase.from('manychat_subscribers').update({ atendimento_humano: true, atendimento_humano_desde: new Date().toISOString() }).eq('subscriber_id', subscriberSnapshot.subscriber_id);
            await supabase.from('leads_juridicos').update({ isa_ativa: false, owner_tipo: 'humano' } as any).eq('id', subscriberSnapshot.lead_id);
            setSelectedSubscriber(prev => prev ? { ...prev, atendimento_humano: true } : null);
            setSubscribers(prev => prev.map(s => s.subscriber_id === subscriberSnapshot.subscriber_id ? { ...s, atendimento_humano: true } : s));
          } catch {}
        }
      } catch (error: any) {
        setMessages(prev => { const updated = prev.map(m => m.id === tempId ? { ...m, metadata: { ...((m as any).metadata || {}), send_error: true } } : m); messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated); return updated; });
        toast({ title: "Erro no envio", description: error.message, variant: "destructive" });
      }
    })();
  };

  // ─── File handling ──────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
  };

  const uploadAndSendFile = async () => {
    if (!selectedFile || !selectedSubscriber) return;
    const originalFileName = selectedFile.name;
    const fileToUpload = selectedFile;
    const subscriberSnapshot = { ...selectedSubscriber };
    const mediaType = fileToUpload.type.startsWith("image/") ? "image" : fileToUpload.type.startsWith("audio/") ? "audio" : fileToUpload.type.startsWith("video/") ? "video" : "document";
    const fileSendKey = `${subscriberSnapshot.subscriber_id}|${mediaType}|${originalFileName}|${fileToUpload.size}`;
    if (shouldSkipRapidDuplicateSend(fileSendKey, 1800)) return;
    setSelectedFile(null);
    setPreviewUrl(null);
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = { id: tempId, conteudo: mediaType === "image" ? "📷 Enviando imagem..." : mediaType === "video" ? "🎥 Enviando vídeo..." : `📄 Enviando ${originalFileName}...`, created_at: new Date().toISOString(), direcao: "saida", tipo: mediaType, subscriber_id: subscriberSnapshot.subscriber_id };
    setMessages(prev => { const updated = [...prev, optimisticMessage]; messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated); return updated; });
    scrollToBottom();
    try {
      const fileExt = fileToUpload.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `manychat/${subscriberSnapshot.subscriber_id}/${fileName}`;
      const { error: uploadErr } = await supabase.storage.from("documentos").upload(filePath, fileToUpload);
      if (uploadErr) throw uploadErr;
      const { data: signed, error: signError } = await supabase.storage.from("documentos").createSignedUrl(filePath, 60 * 60 * 24 * 30);
      if (signError || !signed?.signedUrl) throw signError;
      const outboundInstanceId = resolveInstanceId(subscriberSnapshot);
      const { data: zapiResult, error: zapiError } = await invokeZapiSend({ to_phone: subscriberSnapshot.telefone, message: signed.signedUrl, type: mediaType, lead_id: subscriberSnapshot.lead_id, file_name: originalFileName, ...(outboundInstanceId && { instance_id: outboundInstanceId }) });
      if (zapiError) throw new Error(zapiError.message);
      const msgId = zapiResult?.messageId;
      supabase.from("manychat_mensagens" as any).insert({ subscriber_id: subscriberSnapshot.subscriber_id, subscriber_nome: subscriberSnapshot.nome, canal: "whatsapp", conteudo: signed.signedUrl, tipo: mediaType, direcao: "saida", lead_id: subscriberSnapshot.lead_id, metadata: { sent_via: "chat_interface", zapi_status: zapiResult?.success ? "success" : "error", message_id: msgId, file_name: originalFileName } } as any).select().single().then(({ data: savedMsg }) => {
        if (savedMsg) {
          const savedAsMessage = savedMsg as Message;
          dedupKeysRef.current.add(getMessageDedupeKey(savedAsMessage));
          dedupKeysRef.current.add(`db_${savedAsMessage.id}`);
          setMessages(prev => { const withoutTemp = prev.filter(m => m.id !== tempId); const updated = mergeMessageDedup(withoutTemp, savedAsMessage); messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated); return updated; });
        }
      });
    } catch (error: any) {
      setMessages(prev => { const updated = prev.map(m => m.id === tempId ? { ...m, conteudo: `❌ Erro no envio de ${originalFileName}`, metadata: { send_error: true } } : m); messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated); return updated; });
      toast({ title: "Erro", description: "Falha no upload", variant: "destructive" });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('webm') ? 'webm' : 'ogg';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioFile = new File([audioBlob], `audio_${Date.now()}.${ext}`, { type: mimeType });
        setSelectedFile(audioFile);
        setPreviewUrl(URL.createObjectURL(audioBlob));
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch { toast({ title: "Erro", description: "Microfone não disponível", variant: "destructive" }); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); }
  };

  const sendAudioFromPreview = async () => {
    if (!selectedFile || !selectedSubscriber || !selectedFile.type.startsWith("audio/")) return;
    const audioFile = selectedFile;
    const subscriberSnapshot = { ...selectedSubscriber };
    const audioSendKey = `${subscriberSnapshot.subscriber_id}|audio|${audioFile.name}|${audioFile.size}`;
    if (shouldSkipRapidDuplicateSend(audioSendKey, 1800)) return;
    setSelectedFile(null);
    setPreviewUrl(null);
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = { id: tempId, conteudo: "🎤 Enviando áudio...", created_at: new Date().toISOString(), direcao: "saida", tipo: "audio", subscriber_id: subscriberSnapshot.subscriber_id };
    setMessages(prev => { const updated = [...prev, optimisticMessage]; messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated); return updated; });
    scrollToBottom();
    try {
      const ext = audioFile.name.split('.').pop() || 'webm';
      const filePath = `manychat/${subscriberSnapshot.subscriber_id}/audio_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("documentos").upload(filePath, audioFile);
      if (uploadError) throw uploadError;
      const outboundInstanceId = resolveInstanceId(subscriberSnapshot);
      const signResult = await supabase.storage.from("documentos").createSignedUrl(filePath, 60 * 60 * 24 * 30);
      if (signResult.error || !signResult.data?.signedUrl) throw signResult.error;
      const signedUrl = signResult.data.signedUrl;
      const { data: zapiResult, error: zapiError } = await invokeZapiSend({ to_phone: subscriberSnapshot.telefone, message: signedUrl, type: "audio", lead_id: subscriberSnapshot.lead_id, file_name: audioFile.name, ...(outboundInstanceId && { instance_id: outboundInstanceId }) });
      if (zapiError) throw new Error(zapiError.message);
      const msgId = zapiResult?.messageId;
      supabase.from("manychat_mensagens" as any).insert({ subscriber_id: subscriberSnapshot.subscriber_id, subscriber_nome: subscriberSnapshot.nome, canal: "whatsapp", conteudo: signedUrl, tipo: "audio", direcao: "saida", lead_id: subscriberSnapshot.lead_id, metadata: { sent_via: "chat_interface", zapi_status: zapiResult?.success ? "success" : "error", message_id: msgId, file_name: audioFile.name } } as any).select().single().then(({ data: savedMsg }) => {
        if (savedMsg) {
          const savedAsMessage = savedMsg as Message;
          dedupKeysRef.current.add(getMessageDedupeKey(savedAsMessage));
          dedupKeysRef.current.add(`db_${savedAsMessage.id}`);
          setMessages(prev => { const withoutTemp = prev.filter(m => m.id !== tempId); const updated = mergeMessageDedup(withoutTemp, savedAsMessage); messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated); return updated; });
        } else {
          setMessages(prev => { const updated = prev.filter(m => m.id !== tempId); messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated); return updated; });
        }
      });
    } catch (error: any) {
      setMessages(prev => { const updated = prev.map(m => m.id === tempId ? { ...m, conteudo: "❌ Erro no envio do áudio", metadata: { send_error: true } } : m); messagesCacheRef.current.set(subscriberSnapshot.subscriber_id, updated); return updated; });
      toast({ title: "Erro", description: "Falha ao enviar áudio", variant: "destructive" });
    }
  };

  // ─── Date / time helpers ────────────────────────────────────────────────────

  const CHAT_TIMEZONE = "America/Manaus";
  const parseMessageDate = (dateStr: string) => { const parsed = new Date(dateStr); return Number.isNaN(parsed.getTime()) ? null : parsed; };
  const getDateKeyInChatTimezone = (date: Date) => formatInTimeZone(date, CHAT_TIMEZONE, "yyyy-MM-dd");
  const isTodayInChatTimezone = (date: Date) => getDateKeyInChatTimezone(date) === getDateKeyInChatTimezone(new Date());
  const isYesterdayInChatTimezone = (date: Date) => getDateKeyInChatTimezone(date) === getDateKeyInChatTimezone(subDays(new Date(), 1));
  const formatMessageTime = (dateStr: string) => { const date = parseMessageDate(dateStr); if (!date) return "--:--"; return formatInTimeZone(date, CHAT_TIMEZONE, "HH:mm"); };
  const formatLastMessageTime = (dateStr: string) => { const date = parseMessageDate(dateStr); if (!date) return ""; if (isTodayInChatTimezone(date)) return formatInTimeZone(date, CHAT_TIMEZONE, "HH:mm"); if (isYesterdayInChatTimezone(date)) return "Ontem"; return formatInTimeZone(date, CHAT_TIMEZONE, "dd/MM/yyyy"); };
  const getDateLabel = (msgs: Message[], index: number) => {
    const currentDate = parseMessageDate(msgs[index]?.created_at);
    if (!currentDate) return null;
    const buildLabel = (date: Date) => { if (isTodayInChatTimezone(date)) return "HOJE"; if (isYesterdayInChatTimezone(date)) return "ONTEM"; return formatInTimeZone(date, CHAT_TIMEZONE, "dd/MM/yyyy"); };
    if (index === 0) return buildLabel(currentDate);
    const prevDate = parseMessageDate(msgs[index - 1]?.created_at);
    if (!prevDate) return buildLabel(currentDate);
    if (getDateKeyInChatTimezone(currentDate) !== getDateKeyInChatTimezone(prevDate)) return buildLabel(currentDate);
    return null;
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, "");
    if (clean.length > 15) return null;
    if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
      const ddd = clean.slice(2, 4); const rest = clean.slice(4);
      if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
      if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
    if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    if (clean.length === 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    return phone;
  };

  const getDisplayName = (sub: Subscriber) => {
    const invalidNames = ["Desconhecido", "Sem nome", "desconhecido", "null", "", "{{wa_id}}"];
    const hasValidName = sub.nome && !invalidNames.includes(sub.nome) && !sub.nome.startsWith("{{") && !sub.nome.startsWith("[");
    if (hasValidName) return sub.nome;
    // Se o subscriber tem lead vinculado, usa o nome real do lead
    if (sub.lead_id) {
      const lead = leadNames.find((l) => l.id === sub.lead_id);
      if (lead?.nome && !invalidNames.includes(lead.nome) && !lead.nome.startsWith("{{")) return lead.nome;
    }
    const formattedPhone = formatPhone(sub.telefone);
    if (formattedPhone) return formattedPhone;
    if (sub.telefone && sub.telefone.replace(/\D/g, "").length > 15) return `Grupo #${sub.subscriber_id?.slice(-4) || "????"}`;
    if (sub.telefone && sub.telefone !== "{{wa_id}}") return sub.telefone;
    return `Contato #${sub.subscriber_id?.slice(-4) || "????"}`;
  };

  const saveLeadName = useCallback(async (sub: Subscriber, newName: string) => {
    // Proteção contra duplo disparo (Enter + onBlur)
    if (nameSavingRef.current) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    // Não salva se nome não mudou
    const current = sub.nome?.trim() || "";
    if (trimmed === current) return;
    nameSavingRef.current = true;
    try {
      // 1. Atualiza manychat_subscribers
      const { error: subErr } = await supabase
        .from("manychat_subscribers")
        .update({ nome: trimmed })
        .eq("subscriber_id", sub.subscriber_id);
      if (subErr) throw new Error(`Erro no chat: ${subErr.message}`);

      // Resolve o lead_id: usa o do subscriber ou busca pelo telefone
      let resolvedLeadId = sub.lead_id || null;
      if (!resolvedLeadId && sub.telefone) {
        const phone = sub.telefone.replace(/\D/g, '');
        const phoneSuffix = phone.slice(-9);
        // Tenta encontrar o lead pelo telefone
        const { data: foundLeads } = await supabase
          .from("leads_juridicos")
          .select("id, telefone")
          .or(`telefone.ilike.%${phoneSuffix}`)
          .limit(5);
        if (foundLeads?.length === 1) {
          resolvedLeadId = foundLeads[0].id;
          // Vincula o subscriber ao lead encontrado
          await supabase
            .from("manychat_subscribers")
            .update({ lead_id: resolvedLeadId })
            .eq("subscriber_id", sub.subscriber_id);
        }
      }

      if (resolvedLeadId) {
        // 2. Atualiza leads_juridicos (página de Leads)
        const { error: leadErr } = await supabase
          .from("leads_juridicos")
          .update({ nome: trimmed })
          .eq("id", resolvedLeadId);
        if (leadErr) console.warn("[saveLeadName] leads_juridicos:", leadErr.message);

        // 3. Atualiza processos.nome_cliente (página de Contratos)
        const { error: procErr } = await supabase
          .from("processos")
          .update({ nome_cliente: trimmed })
          .eq("cliente_id", resolvedLeadId);
        if (procErr) console.warn("[saveLeadName] processos:", procErr.message);
      }

      // 4. Atualiza nome do contato no Z-API (fire-and-forget, falha silenciosa)
      if (sub.telefone) {
        (async () => {
          try {
            const { data: instances } = await supabase
              .from("zapi_instances")
              .select("instance_id, token, client_token")
              .order("is_default", { ascending: false })
              .limit(1);
            const inst = instances?.[0];
            if (!inst) return;
            const phone = sub.telefone!.replace(/\D/g, '');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (inst.client_token) headers['Client-Token'] = inst.client_token;
            await fetch(
              `https://api.z-api.io/instances/${inst.instance_id}/token/${inst.token}/update-contact`,
              { method: 'PUT', headers, body: JSON.stringify({ phone, name: trimmed }) }
            );
          } catch { /* Z-API contact update não crítico */ }
        })();
      }

      // 5. Atualiza estado local imediatamente — lista + conversa selecionada
      setSubscribers(prev => prev.map(s => s.subscriber_id === sub.subscriber_id
        ? { ...s, nome: trimmed, lead_id: s.lead_id || resolvedLeadId || s.lead_id }
        : s
      ));
      setSelectedSubscriber(prev => prev?.subscriber_id === sub.subscriber_id
        ? { ...prev, nome: trimmed, lead_id: prev.lead_id || resolvedLeadId || prev.lead_id }
        : prev
      );
      const syncedPlaces = resolvedLeadId ? "leads, contratos e WhatsApp" : "chat e WhatsApp";
      toast({ title: "Nome atualizado", description: `"${trimmed}" salvo em ${syncedPlaces}.` });
    } catch (err: any) {
      toast({ title: "Erro ao salvar nome", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      nameSavingRef.current = false;
    }
  }, [toast]);

  const getInitials = (sub: Subscriber) => {
    const invalidNames = ["Desconhecido", "Sem nome", "desconhecido", "null", "", "{{wa_id}}"];
    const hasValidName = sub.nome && !invalidNames.includes(sub.nome) && !sub.nome.startsWith("{{") && !sub.nome.startsWith("[");
    if (hasValidName) {
      const parts = sub.nome.split(" ").filter(p => p.length > 0);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return sub.nome.substring(0, 2).toUpperCase();
    }
    const phone = sub.telefone?.replace(/\D/g, "");
    if (phone && phone.length >= 2) return phone.slice(-2);
    if (sub.subscriber_id) return sub.subscriber_id.slice(-2);
    return "??";
  };

  const ChannelIcon = ({ canal, size = "sm" }: { canal?: string; size?: "sm" | "md" }) => {
    const normalizedCanal = canal?.toLowerCase() || "";
    const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
    if (normalizedCanal.includes("instagram") || normalizedCanal === "ig") return <div className={`${size === "sm" ? "p-0.5" : "p-1"} rounded bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600`}><Instagram className={`${iconSize} text-white`} /></div>;
    if (normalizedCanal.includes("facebook") || normalizedCanal === "fb" || normalizedCanal.includes("messenger")) return <div className={`${size === "sm" ? "p-0.5" : "p-1"} rounded bg-[#1877F2]`}><Facebook className={`${iconSize} text-white`} /></div>;
    if (normalizedCanal.includes("whatsapp") || normalizedCanal === "wa") return <div className={`${size === "sm" ? "p-0.5" : "p-1"} rounded bg-[#25D366]`}><MessageCircle className={`${iconSize} text-white`} /></div>;
    return null;
  };

  const getActivityStatus = (subscriber: Subscriber) => {
    if (!subscriber.ultima_interacao) return { status: "unknown", text: "" };
    const lastInteraction = new Date(subscriber.ultima_interacao);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastInteraction.getTime()) / (1000 * 60));
    if (diffMinutes < 5) return { status: "active", text: "Ativo agora" };
    if (diffMinutes < 60) return { status: "recent", text: `há ${diffMinutes} min` };
    if (diffMinutes < 1440) return { status: "today", text: `há ${Math.floor(diffMinutes / 60)}h` };
    return { status: "inactive", text: "" };
  };

  const ActivityIndicator = ({ subscriber, showText = false }: { subscriber: Subscriber; showText?: boolean }) => {
    const activity = getActivityStatus(subscriber);
    const isActive = activity.status === "active" || activity.status === "recent";
    return (
      <div className="flex items-center gap-1.5">
        <span className={`relative flex h-2.5 w-2.5 ${isActive ? "" : "opacity-50"}`}>
          {activity.status === "active" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activity.status === "active" ? "bg-emerald-500" : activity.status === "recent" ? "bg-yellow-500" : "bg-gray-400"}`} />
        </span>
        {showText && <span className={`text-xs font-medium ${activity.status === "active" ? "text-emerald-500" : activity.status === "recent" ? "text-yellow-500" : themeClasses.secondaryText}`}>{activity.status === "active" ? "Ativo agora" : activity.status === "recent" ? activity.text : activity.status === "today" ? activity.text : "Offline"}</span>}
      </div>
    );
  };

  // ─── Unread helpers ─────────────────────────────────────────────────────────

  const getUnreadCountForSubscriber = (sub: Subscriber): number => {
    const unreadKey = getConversationUnreadKey(sub);
    const direct = unreadCounts.get(unreadKey) || 0;
    if (direct > 0) return direct;
    const phone = sub.telefone?.replace(/\D/g, "") || "";
    const normalizedPhone = phone && !phone.startsWith("55") ? `55${phone}` : phone;
    const suffix = getSubscriberPhoneSuffix(sub);
    const legacyAliases = [sub.subscriber_id, phone, normalizedPhone, phone ? `zapi_${phone}` : "", normalizedPhone ? `zapi_${normalizedPhone}` : ""].filter(Boolean);
    for (const alias of legacyAliases) { const value = unreadCounts.get(alias) || 0; if (value > 0) return value; }
    if (sub.lead_id) { const leadValue = unreadCounts.get(`lead:${sub.lead_id}`) || 0; if (leadValue > 0) return leadValue; }
    if (suffix) {
      const phoneValue = unreadCounts.get(`phone:${suffix}`) || 0;
      if (phoneValue > 0) return phoneValue;
      for (const [key, value] of unreadCounts.entries()) { if (value > 0 && (key.includes(suffix) || key === `phone:${suffix}`)) return value; }
    }
    return 0;
  };

  const hasUnreadForSubscriber = (sub: Subscriber) => getUnreadCountForSubscriber(sub) > 0 || hasUnreadHintForSubscriber(sub);

  // ─── Filtered subscribers ───────────────────────────────────────────────────

  const filteredSubscribers = subscribers
    .filter(sub => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const displayName = getDisplayName(sub).toLowerCase();
      return displayName.includes(term) || sub.nome?.toLowerCase().includes(term) || sub.telefone?.includes(searchTerm) || sub.subscriber_id?.includes(searchTerm) || sub.email?.toLowerCase().includes(term);
    })
    .filter(sub => {
      if (activeFilter === "unread") return hasUnreadForSubscriber(sub);
      if (activeFilter === "human") return sub.atendimento_humano;
      if (activeFilter === "bot") return !sub.atendimento_humano;
      return true;
    })
    .filter(sub => {
      if (origemFilter === "all") return true;
      if (origemFilter === "trafego") return sub.lead_tipo_origem === "trafego";
      if (origemFilter === "whatsapp_direto") return sub.lead_tipo_origem === "whatsapp_direto";
      return true;
    })
    .filter(sub => {
      if (selectedTagIds.length === 0) return true;
      const subTags = getSubscriberTags(sub.subscriber_id);
      return selectedTagIds.every(tagId => subTags.some(st => st.tag_id === tagId));
    })
    .sort((a, b) => new Date(b.ultima_interacao || 0).getTime() - new Date(a.ultima_interacao || 0).getTime());

  // ─── Message flags (star, delete, etc) ──────────────────────────────────────

  const loadMessageFlags = useCallback(async () => {
    if (!user?.id) return;
    const { data: starredData } = await supabase.from("starred_messages" as any).select("message_id").eq("user_id", user.id);
    if (starredData) setStarredMessageIds(new Set(starredData.map((s: any) => s.message_id)));
    const { data: deletedData } = await supabase.from("deleted_messages" as any).select("message_id").eq("user_id", user.id);
    if (deletedData) setDeletedForMeIds(new Set(deletedData.map((d: any) => d.message_id)));
  }, [user?.id]);

  const handleStarMessage = useCallback(async (messageId: string) => {
    if (!user?.id) return;
    await supabase.from("starred_messages" as any).insert({ user_id: user.id, message_id: messageId } as any);
    setStarredMessageIds(prev => new Set([...prev, messageId]));
    toast({ title: "⭐ Mensagem favoritada!" });
  }, [user?.id, toast]);

  const handleUnstarMessage = useCallback(async (messageId: string) => {
    if (!user?.id) return;
    await supabase.from("starred_messages" as any).delete().eq("user_id", user.id).eq("message_id", messageId);
    setStarredMessageIds(prev => { const next = new Set(prev); next.delete(messageId); return next; });
    toast({ title: "Favorito removido" });
  }, [user?.id, toast]);

  const handleDeleteForMe = useCallback(async (messageId: string) => {
    if (!user?.id) return;
    await supabase.from("deleted_messages" as any).insert({ user_id: user.id, message_id: messageId } as any);
    setDeletedForMeIds(prev => new Set([...prev, messageId]));
    toast({ title: "🗑️ Mensagem apagada para você" });
  }, [user?.id, toast]);

  const handleDeleteForAll = useCallback(async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    await supabase.from("manychat_mensagens").update({ deleted_for_all: true } as any).eq("id", messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, conteudo: "🚫 Mensagem apagada", tipo: "text", metadata: { deleted: true } } : m));
    const providerMessageId = getProviderMessageId(msg);
    if (providerMessageId && selectedSubscriber?.telefone) {
      const outboundInstanceId = resolveInstanceId(selectedSubscriber);
      const { data, error } = await invokeZapiSend({ to_phone: selectedSubscriber.telefone, type: "delete", message_id: providerMessageId, instance_id: outboundInstanceId });
      if (error || !data?.success) toast({ title: "⚠️ Apagada localmente", description: "Não foi possível apagar no WhatsApp", variant: "destructive" });
      else toast({ title: "🗑️ Mensagem apagada no WhatsApp" });
      return;
    }
    toast({ title: "🗑️ Mensagem apagada localmente" });
  }, [messages, selectedSubscriber, toast]);

  const handleStartEdit = useCallback((messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || msg.direcao !== "saida") return;
    setEditingMessageId(messageId);
    setEditingText(msg.conteudo);
  }, [messages]);

  const handleCancelEdit = useCallback(() => { setEditingMessageId(null); setEditingText(""); }, []);

  const handleConfirmEdit = useCallback(async () => {
    if (!editingMessageId || !editingText.trim()) return;
    const originalMsg = messages.find(m => m.id === editingMessageId);
    if (!originalMsg || editingText.trim() === originalMsg.conteudo) { handleCancelEdit(); return; }
    setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, conteudo: editingText.trim(), metadata: { ...((m as any).metadata || {}), edited: true, edited_at: new Date().toISOString(), original_content: originalMsg.conteudo } } : m));
    await supabase.from("manychat_mensagens").update({ conteudo: editingText.trim(), metadata: { ...((originalMsg as any).metadata || {}), edited: true, edited_at: new Date().toISOString(), original_content: originalMsg.conteudo } } as any).eq("id", editingMessageId);
    handleCancelEdit();
    toast({ title: "✏️ Mensagem editada" });
  }, [editingMessageId, editingText, messages, toast, handleCancelEdit]);

  const handleReplyMessage = useCallback((messageId: string) => { const msg = messages.find(m => m.id === messageId); if (!msg) return; setReplyToMessage(msg); }, [messages]);

  const handlePinMessage = useCallback((messageId: string) => {
    if (!selectedSubscriber) return;
    setPinnedMessagesBySubscriber(prev => ({ ...prev, [selectedSubscriber.subscriber_id]: messageId }));
    toast({ title: "📌 Mensagem fixada" });
  }, [selectedSubscriber, toast]);

  const handleUnpinMessage = useCallback((messageId: string) => {
    if (!selectedSubscriber) return;
    setPinnedMessagesBySubscriber(prev => { const next = { ...prev }; if (next[selectedSubscriber.subscriber_id] === messageId) delete next[selectedSubscriber.subscriber_id]; return next; });
    toast({ title: "Mensagem desfixada" });
  }, [selectedSubscriber, toast]);

  const handleSelectMessage = useCallback((messageId: string) => { setSelectedMessageIds(prev => { const next = new Set(prev); if (next.has(messageId)) next.delete(messageId); else next.add(messageId); return next; }); }, []);
  const handleReportMessage = useCallback(() => { toast({ title: "🚩 Mensagem denunciada" }); }, [toast]);

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
      await invokeZapiSend({ to_phone: targetSub.telefone, message: forwarded, type: "text", lead_id: targetSub.lead_id, ...(outboundInstanceId && { instance_id: outboundInstanceId }) });
      await supabase.from("manychat_mensagens" as any).insert({ subscriber_id: targetSubId, subscriber_nome: targetSub.nome, canal: "whatsapp", conteudo: forwarded, tipo: "text", direcao: "saida", lead_id: targetSub.lead_id, metadata: { sent_via: "chat_forward" } } as any);
    }
    toast({ title: "↪️ Mensagem encaminhada!", description: `Enviada para ${subscriberIds.length} contato(s)` });
  }, [selectedSubscriber, subscribers, forwardMessageContent, toast]);

  const handleSendContact = useCallback(async (contact: { nome: string; telefone?: string; subscriber_id: string }) => {
    if (!selectedSubscriber?.telefone || !contact.telefone) return;
    const outboundInstanceId = resolveInstanceId(selectedSubscriber);
    const contactMsg = `👤 *Contato compartilhado*\n📛 ${contact.nome}\n📱 ${contact.telefone}`;
    await invokeZapiSend({ to_phone: selectedSubscriber.telefone, message: contactMsg, type: "text", lead_id: selectedSubscriber.lead_id, ...(outboundInstanceId && { instance_id: outboundInstanceId }) });
    await supabase.from("manychat_mensagens" as any).insert({ subscriber_id: selectedSubscriber.subscriber_id, subscriber_nome: selectedSubscriber.nome, canal: "whatsapp", conteudo: contactMsg, tipo: "text", direcao: "saida", lead_id: selectedSubscriber.lead_id, metadata: { sent_via: "chat_contact_share", shared_contact: { name: contact.nome, phone: contact.telefone } } } as any);
    toast({ title: "👤 Contato enviado!" });
  }, [selectedSubscriber, toast]);

  const handleSearchHighlight = useCallback((messageId: string | null) => {
    setHighlightedMessageId(messageId);
    if (messageId) { const el = document.getElementById(`msg-${messageId}`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }, []);

  useEffect(() => { if (selectedSubscriber) loadMessageFlags(); }, [selectedSubscriber?.subscriber_id, loadMessageFlags]);

  const handleLeadPerdido = async () => {
    if (!selectedSubscriber?.lead_id) return;
    setLeadPerdidoLoading(true);
    try {
      const { error } = await supabase
        .from('leads_juridicos')
        .update({ status: 'Perdido', lead_state: 'LOST', state_updated_at: new Date().toISOString() } as any)
        .eq('id', selectedSubscriber.lead_id);
      if (error) throw error;

      await sendMetaEvent({
        lead_id:          selectedSubscriber.lead_id,
        email:            selectedSubscriber.email,
        phone:            selectedSubscriber.telefone,
        nome:             selectedSubscriber.nome,
        facebook_lead_id: (selectedSubscriber as any).facebook_lead_id,
        event_name:       'LeadPerdido',
        value:            0,
        status:           'Perdido',
      });

      supabase.channel('app-events')
        .send({ type: 'broadcast', event: 'lead_perdido', payload: { lead_id: selectedSubscriber.lead_id } })
        .catch(() => {});

      toast({ title: '❌ Lead marcado como Perdido', description: 'Evento enviado para a Meta.' });
      setLeadPerdidoOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setLeadPerdidoLoading(false);
    }
  };

  // ─── Render message ─────────────────────────────────────────────────────────

  const renderMessage = (message: Message) => {
    const content = message.conteudo || "";
    const type = (message.tipo || "text").toLowerCase();
    const metadata: any = (message as any).metadata || {};
    const original: any = metadata.original || {};
    const mediaUrl = metadata.media_url || original?.audio?.audioUrl || original?.audio?.link || original?.audio?.url || original?.image?.imageUrl || original?.image?.link || original?.image?.url || original?.video?.videoUrl || original?.video?.link || original?.video?.url || original?.document?.documentUrl || original?.document?.link || original?.document?.url;
    const caption = metadata.caption || original?.image?.caption || null;
    const fileName = metadata.file_name || original?.document?.fileName || original?.document?.filename || null;
    const urlCandidate = (mediaUrl || content).replace(/^\[|\]$/g, "").trim();
    const isAudio = type === "audio" || urlCandidate.match(/\.(ogg|mp3|wav|m4a|opus|aac|webm)(\?|$)/i);
    const isImage = type === "image" || urlCandidate.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
    const isVideo = type === "video" || urlCandidate.match(/\.(mp4|webm|mov)(\?|$)/i);
    const isDocument = type === "document" || urlCandidate.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)(\?|$)/i);
    if (isAudio) return <WhatsAppAudioPlayer message={{ ...message, conteudo: urlCandidate, metadata } as any} isSent={message.direcao === "saida"} />;
    if (isImage) return <div className="space-y-1"><img src={urlCandidate} alt="" className="max-w-[280px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(urlCandidate, "_blank")} />{caption && <p className="whitespace-pre-wrap break-words text-[13px] leading-[18px] opacity-90">{formatWhatsAppTextHelper(caption)}</p>}</div>;
    if (isVideo) return <video controls className="max-w-[280px] rounded-lg" preload="metadata"><source src={urlCandidate} /></video>;
    if (isDocument) {
      const display = fileName || urlCandidate.split("/").pop()?.split("?")[0] || "Documento";
      const isPdf = urlCandidate.toLowerCase().includes(".pdf") || display.toLowerCase().endsWith(".pdf");
      if (isPdf) return <div className={`flex flex-col rounded-lg overflow-hidden ${isDark ? "bg-[#1F2C33]" : "bg-[#F0F2F5]"} max-w-[320px]`}><div className="relative w-full h-[200px] bg-gray-100 dark:bg-gray-800"><iframe src={`${urlCandidate}#toolbar=0`} className="w-full h-full border-0" title={display} /><div className="absolute inset-0 cursor-pointer opacity-0 hover:opacity-100 bg-black/30 flex items-center justify-center" onClick={() => window.open(urlCandidate, "_blank")}><div className="bg-white/90 rounded-lg px-4 py-2"><span className="text-sm font-medium">Abrir PDF</span></div></div></div><div className="flex items-center gap-3 p-3"><p className={`text-sm font-medium truncate flex-1 ${themeClasses.headerText}`}>{display}</p><Button size="sm" variant="ghost" onClick={() => window.open(urlCandidate, "_blank")} className="shrink-0 h-8 w-8 p-0"><svg className={`h-5 w-5 ${themeClasses.iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg></Button></div></div>;
      return <div className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? "bg-[#1F2C33]" : "bg-[#F0F2F5]"} min-w-[200px] max-w-[300px]`}><Paperclip className="h-8 w-8 text-blue-500" /><div className="flex-1 min-w-0"><p className={`text-sm font-medium truncate ${themeClasses.headerText}`}>{display}</p><p className={`text-xs ${themeClasses.secondaryText}`}>Documento</p></div><Button size="sm" variant="ghost" onClick={() => window.open(urlCandidate, "_blank")} className="shrink-0 h-8 w-8 p-0"><svg className={`h-5 w-5 ${themeClasses.iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg></Button></div>;
    }
    const sentFromInterface = metadata?.sent_via === "chat_interface";
    return <div className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px] select-text">{sentFromInterface ? content : formatWhatsAppTextHelper(content)}</div>;
  };

  const totalUnreadCount = subscribers.filter(s => hasUnreadForSubscriber(s)).length;

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className={`flex h-dvh w-full overflow-hidden ${themeClasses.bg}`}>

      {/* ═══════════════════════════════════════════════════════════════════════
           SIDEBAR — Lista de Conversas
           ═══════════════════════════════════════════════════════════════════════ */}
      <div className={`${showMobileChat ? "hidden md:flex" : "flex"} w-full md:w-[440px] lg:w-[500px] xl:w-[540px] flex-col ${themeClasses.sidebar} border-r ${themeClasses.border}`}>

        {/* Header sidebar */}
        <div className={`h-[60px] px-4 flex items-center justify-between backdrop-blur-md ${isDark ? "bg-gradient-to-r from-[#202C33] to-[#1A252C]" : "bg-gradient-to-r from-[#F0F2F5] to-[#E8EBEE]"}`}>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={`h-10 w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}><Menu className="h-5 w-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>Dashboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/leads")}>Leads</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/processos")}>Processos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/tarefas")}>Tarefas</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/agenda")}>Agenda</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/financeiro")}>Financeiro</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/contratos")}>Contratos</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/assistente")}>Isa Assistente</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/configuracoes")}>Configurações</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <h1 className={`text-xl font-semibold ${themeClasses.headerText}`}>Conversas</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowTeamPanel(!showTeamPanel)} className={`h-10 w-10 rounded-full relative ${showTeamPanel ? "text-[#00A884] bg-[#00A884]/10" : themeClasses.iconColor} ${themeClasses.hoverBtn}`}>
              <Users className="h-5 w-5" />
              {getOnlineCount() > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 text-[10px] text-white flex items-center justify-center font-medium">{getOnlineCount()}</span>}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} className={`h-10 w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}>{isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</Button>
            <Button variant="ghost" size="icon" onClick={syncAllContacts} disabled={isSyncing} className={`h-10 w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}><RefreshCw className={`h-5 w-5 ${isSyncing ? "animate-spin" : ""}`} /></Button>
          </div>
        </div>

        {/* Search */}
        <div className={`px-3 py-2 ${themeClasses.sidebar}`}>
          <div className="relative">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${themeClasses.secondaryText}`} />
            <Input placeholder="Pesquisar conversa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`pl-12 h-[35px] ${themeClasses.inputSearch} border-0 rounded-xl text-[13px] focus-visible:ring-0`} />
          </div>
        </div>

        {/* ✅ NOVA BARRA DE FILTROS */}
        <ChatFiltersBar
          origemFilter={origemFilter}
          atendFilter={activeFilter}
          selectedTagIds={selectedTagIds}
          availableTags={availableTags}
          totalCount={subscribers.length}
          unreadCount={totalUnreadCount}
          isDark={isDark}
          themeClasses={themeClasses}
          onOrigemChange={setOrigemFilter}
          onAtendChange={setActiveFilter}
          onTagsChange={setSelectedTagIds}
          onResetAll={() => {
            setOrigemFilter('all');
            setActiveFilter('all');
            setSelectedTagIds([]);
          }}
        />

        {/* Lista de Conversas */}
        <ScrollArea className="flex-1">
          {filteredSubscribers.length === 0 ? (
            <div className={`p-8 text-center ${themeClasses.secondaryText}`}><p className="text-sm">{isLoading ? "Carregando..." : "Nenhuma conversa"}</p></div>
          ) : (
            <div>
              {filteredSubscribers.map(subscriber => {
                const isActive = selectedSubscriber?.id === subscriber.id;
                const online = isOnline(subscriber.subscriber_id);
                const unreadCount = getUnreadCountForSubscriber(subscriber);
                const hasUnread = unreadCount > 0;
                const hasUnreadHint = hasUnreadHintForSubscriber(subscriber);
                const isUnreadVisual = hasUnread || hasUnreadHint;
                const msgPreview = lastMessagePreviews.get(subscriber.subscriber_id);
                const instanceInfo = getInstanceInfoFromConnectedPhone(subscriber.instance_name);

                return (
                  <div
                    key={subscriber.id}
                    onClick={() => {
                      const isSameConversation = selectedSubscriber?.subscriber_id === subscriber.subscriber_id;

                      // ✅ FIX BADGE — atualiza lastReadRef ANTES do setState
                      const now = new Date().toISOString();
                      const unreadKey = getConversationUnreadKey(subscriber);
                      lastReadRef.current[unreadKey] = now;
                      lastReadRef.current[subscriber.subscriber_id] = now;
                      try { localStorage.setItem(LAST_READ_KEY, JSON.stringify(lastReadRef.current)); } catch {}

                      setSelectedSubscriber(subscriber);

                      // Zera TODOS os contadores incluindo aliases legados
                      setUnreadCounts(prev => {
                        const next = new Map(prev);
                        next.delete(unreadKey);
                        next.delete(subscriber.subscriber_id);
                        if (subscriber.lead_id) next.delete(`lead:${subscriber.lead_id}`);
                        const suffix = getSubscriberPhoneSuffix(subscriber);
                        if (suffix) next.delete(`phone:${suffix}`);
                        const phone = subscriber.telefone?.replace(/\D/g, '') || '';
                        if (phone) {
                          next.delete(phone);
                          next.delete(`55${phone}`);
                          next.delete(`zapi_${phone}`);
                          next.delete(`zapi_55${phone}`);
                        }
                        return next;
                      });

                      saveLastRead(subscriber);
                      broadcastConversationRead(subscriber);

                      if (isSameConversation) loadMessages(subscriber.subscriber_id, true, subscriber);
                    }}
                    className={`flex items-center gap-3 px-3 py-[10px] cursor-pointer transition-all duration-200 border-b border-opacity-50 ${themeClasses.border} ${themeClasses.hover} hover:translate-x-0.5 ${isActive ? themeClasses.active : ""}`}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-[49px] w-[49px]">
                        <AvatarImage src={subscriber.foto} />
                        <AvatarFallback className="bg-gradient-to-br from-[#00A884] to-[#008069] text-white text-base font-medium">{getInitials(subscriber)}</AvatarFallback>
                      </Avatar>
                      {subscriber.atendimento_humano && <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center text-[9px]">🙋</span>}
                      {online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-[#111B21] animate-pulse-subtle" />}
                    </div>
                    <div className="flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 pr-1">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                          <span className={`text-[15px] truncate leading-tight font-medium ${isUnreadVisual ? "text-[#E9EDEF] font-semibold" : themeClasses.headerText}`}>{getDisplayName(subscriber)}</span>
                          {instanceInfo ? (
                            <InstanceBadge instance={instanceInfo} size="sm" />
                          ) : (formatPhone(subscriber.telefone) && <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 leading-none ${themeClasses.secondaryText}`}>{formatPhone(subscriber.telefone)}</span>)}
                        </div>
                        <div className="flex items-center gap-1 min-w-0 mt-[3px] overflow-hidden">
                          {msgPreview ? (
                            <>
                              {msgPreview.startsWith("Você:") && <CheckCheck className="h-3.5 w-3.5 shrink-0 text-[#53BDEB]" />}
                              <p className={`text-[13px] truncate leading-tight ${isUnreadVisual ? "text-[#D1D7DB] font-medium" : themeClasses.secondaryText}`}>{msgPreview.startsWith("Você: ") ? msgPreview.slice(6) : msgPreview}</p>
                            </>
                          ) : (
                            <p className="flex items-center gap-1 text-[11px] font-semibold text-[#53BDEB]/80">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#53BDEB]/70 shrink-0" />
                              Novo contato
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="w-[76px] min-w-[76px] shrink-0 flex flex-col items-end justify-between gap-1">
                        <span className={`text-[12px] leading-tight whitespace-nowrap text-right ${isUnreadVisual ? "text-[#25D366] font-semibold" : themeClasses.secondaryText}`}>{subscriber.ultima_interacao ? formatLastMessageTime(subscriber.ultima_interacao) : ""}</span>
                        <div className="flex items-center justify-end gap-1.5 min-h-[20px] w-full">
                          {hasUnread ? (
                            <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#25D366] text-white text-[11px] font-bold flex items-center justify-center shadow-sm">{unreadCount > 99 ? "99+" : unreadCount}</span>
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

      {/* ═══════════════════════════════════════════════════════════════════════
           ÁREA DE CHAT
           ═══════════════════════════════════════════════════════════════════════ */}
      <div className={`${!showMobileChat ? "hidden md:flex" : "flex"} flex-1 flex-col min-w-0`}>
        {selectedSubscriber ? (
          <>
            {/* Header Chat */}
            <div className={`h-[50px] md:min-h-[62px] px-1.5 md:px-4 flex items-center gap-1.5 md:gap-3 backdrop-blur-md border-b ${themeClasses.border} ${isDark ? "bg-gradient-to-r from-[#202C33] to-[#1A252C]" : "bg-gradient-to-r from-[#F0F2F5] to-[#E8EBEE]"}`}>
              <Button variant="ghost" size="icon" onClick={() => { setSelectedSubscriber(null); setShowMobileChat(false); }} className={`md:hidden h-8 w-8 shrink-0 ${themeClasses.iconColor}`}><ArrowLeft className="h-5 w-5" /></Button>

              <div className="relative shrink-0">
                <Avatar className="h-9 w-9 md:h-11 md:w-11 cursor-pointer">
                  <AvatarImage src={selectedSubscriber.foto} />
                  <AvatarFallback className="bg-gradient-to-br from-[#00A884] to-[#008069] text-white text-sm">{getInitials(selectedSubscriber)}</AvatarFallback>
                </Avatar>
                {isOnline(selectedSubscriber.subscriber_id) && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 md:h-3.5 md:w-3.5 rounded-full bg-emerald-500 border-2 border-white" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ChannelIcon canal={selectedSubscriber.canal} size="sm" />
                  {editingLeadName ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input
                        ref={nameInputRef}
                        autoFocus
                        value={editingLeadNameValue}
                        onChange={e => setEditingLeadNameValue(e.target.value)}
                        onBlur={() => {
                          // Pequeno delay para não conflitar com Enter
                          setTimeout(() => {
                            if (!nameSavingRef.current) {
                              saveLeadName(selectedSubscriber, editingLeadNameValue);
                            }
                            setEditingLeadName(false);
                          }, 80);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveLeadName(selectedSubscriber, editingLeadNameValue);
                            setEditingLeadName(false);
                          }
                          if (e.key === 'Escape') {
                            nameSavingRef.current = false;
                            setEditingLeadName(false);
                          }
                        }}
                        className="font-semibold text-[14px] md:text-[16px] bg-transparent border-0 border-b-2 border-[#00A884] outline-none min-w-0 w-[160px] md:w-[220px] text-white placeholder:text-white/50"
                        placeholder="Nome do lead..."
                      />
                      <span className="text-[10px] text-white/40 shrink-0 hidden md:block">Enter p/ salvar</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`group flex items-center gap-1 font-semibold text-[14px] md:text-[16px] ${themeClasses.headerText} truncate max-w-[200px] hover:opacity-80 transition-opacity text-left`}
                      title="Clique para editar o nome do lead"
                      onClick={() => {
                        setEditingLeadNameValue(selectedSubscriber.nome?.trim() || getDisplayName(selectedSubscriber));
                        setEditingLeadName(true);
                        setTimeout(() => nameInputRef.current?.focus(), 30);
                      }}
                    >
                      <span className="truncate">{getDisplayName(selectedSubscriber)}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                    </button>
                  )}
                  {(() => {
                    const instanceInfo = getInstanceInfoFromConnectedPhone(selectedSubscriber.instance_name);
                    if (!instanceInfo) return null;
                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="cursor-pointer hover:opacity-75 transition-opacity" title="Alterar origem do lead">
                            <InstanceBadge instance={instanceInfo} size="sm" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-52">
                          <div className="px-2 py-1.5 text-[11px] text-muted-foreground font-medium tracking-wide">Origem / Instância</div>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-xs gap-2 cursor-pointer" onClick={() => changeLeadOrigin(selectedSubscriber, 'trafego')}>
                            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                            Tráfego — 98588-8190
                            {instanceInfo.color === 'trafego' && <span className="ml-auto text-[10px] opacity-60">atual</span>}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs gap-2 cursor-pointer" onClick={() => changeLeadOrigin(selectedSubscriber, 'escritorio')}>
                            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                            Escritório — 99160-4348
                            {instanceInfo.color === 'escritorio' && <span className="ml-auto text-[10px] opacity-60">atual</span>}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden max-h-[16px] md:max-h-none">
                  <ActivityIndicator subscriber={selectedSubscriber} showText />
                  {isTyping(selectedSubscriber.subscriber_id) && <span className="text-[11px] md:text-xs text-[#00A884] font-medium animate-pulse">digitando...</span>}
                  <div className="hidden md:contents">
                    {getSubscriberTags(selectedSubscriber.subscriber_id).slice(0, 3).map(st => st.tag && <TagBadge key={st.id} tag={st.tag} reason={st.reason} size="sm" showRemove onRemove={() => removeTagFromSubscriber(selectedSubscriber.subscriber_id, st.tag_id)} />)}
                    <TagSelector subscriberId={selectedSubscriber.subscriber_id} availableTags={availableTags} currentTags={getSubscriberTags(selectedSubscriber.subscriber_id)} onAddTag={(tagId, reason) => addTagToSubscriber(selectedSubscriber.subscriber_id, tagId, reason, selectedSubscriber.lead_id ?? undefined)} onRemoveTag={tagId => removeTagFromSubscriber(selectedSubscriber.subscriber_id, tagId)} onCreateTag={createTag} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
                {/* ❌ BOTÃO LEAD PERDIDO */}
                {selectedSubscriber.lead_id && (
                  <Button
                    size="sm"
                    onClick={() => setLeadPerdidoOpen(true)}
                    title="Marcar lead como perdido"
                    className="h-7 md:h-8 px-2.5 md:px-3.5 rounded-full gap-1.5 text-[11px] md:text-xs font-semibold
                      border border-red-400/60 bg-red-500/10 text-red-500
                      hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-md hover:shadow-red-500/25
                      active:scale-95 transition-all duration-150"
                  >
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden lg:inline">Perdido</span>
                  </Button>
                )}

                {/* ✅ BOTÃO CONTRATO FECHADO */}
                <Button
                  size="sm"
                  onClick={() => setContratoModalOpen(true)}
                  title="Registrar contrato fechado"
                  className="h-7 md:h-8 px-2.5 md:px-3.5 rounded-full gap-1.5 text-[11px] md:text-xs font-semibold
                    bg-emerald-500 text-white border border-emerald-500
                    hover:bg-emerald-600 hover:border-emerald-600 hover:shadow-md hover:shadow-emerald-500/30
                    active:scale-95 transition-all duration-150"
                >
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden lg:inline">Contrato Fechado</span>
                </Button>

                {selectedSubscriber.telefone && (
                  <>
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); window.open(`https://wa.me/${selectedSubscriber.telefone?.replace(/\D/g, "")}`, "_blank"); }} className={`h-8 w-8 md:h-10 md:w-10 rounded-full text-[#00A884] ${themeClasses.hoverBtn}`}>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 md:h-5 md:w-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); window.open(`tel:${selectedSubscriber.telefone}`, "_self"); }} className={`hidden md:flex h-10 w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}><Phone className="h-5 w-5" /></Button>
                  </>
                )}

                <Button variant="ghost" size="icon" onClick={async e => {
                  e.stopPropagation();
                  const novoStatus = !selectedSubscriber.atendimento_humano;
                  const { error } = await supabase.from("manychat_subscribers").update({ atendimento_humano: novoStatus, atendimento_humano_desde: novoStatus ? new Date().toISOString() : null }).eq("subscriber_id", selectedSubscriber.subscriber_id);
                  if (!error) {
                    setSelectedSubscriber(prev => prev ? { ...prev, atendimento_humano: novoStatus } : null);
                    setSubscribers(prev => prev.map(s => s.subscriber_id === selectedSubscriber.subscriber_id ? { ...s, atendimento_humano: novoStatus } : s));
                    toast({ title: novoStatus ? "🙋 Atendimento Humano" : "🤖 Isa Ativada" });
                  }
                }} className={`h-8 w-8 md:h-10 md:w-10 rounded-full transition-all ${selectedSubscriber.atendimento_humano ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20" : `${themeClasses.iconColor} ${themeClasses.hoverBtn}`}`}>
                  {selectedSubscriber.atendimento_humano ? <UserRound className="h-4 w-4 md:h-5 md:w-5" /> : <Bot className="h-4 w-4 md:h-5 md:w-5" />}
                </Button>

                {/* Desktop only buttons */}
                <div className="hidden md:flex items-center gap-1">
                  <ConversationAssignmentMenu teamMembers={getTeamWithStatus()} currentUserId={user?.id} currentAssignee={selectedSubscriber.assigned_to} onAssign={assignConversation} />
                  <CalWidget subscriberId={selectedSubscriber.subscriber_id} subscriberName={getDisplayName(selectedSubscriber)} subscriberEmail={selectedSubscriber.email} subscriberPhone={selectedSubscriber.telefone} leadId={selectedSubscriber.lead_id} onScheduled={() => toast({ title: "📅 Agendado!" })} />
                  {selectedSubscriber.lead_id && (
                    <Button variant="ghost" size="icon" onClick={() => setShowContextPanel(!showContextPanel)} className={`h-10 w-10 rounded-full transition-all ${showContextPanel ? "text-[#00A884] bg-[#00A884]/10 hover:bg-[#00A884]/20" : `${themeClasses.iconColor} ${themeClasses.hoverBtn}`}`}>
                      {showContextPanel ? <PanelRightClose className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                    </Button>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className={`h-8 w-8 md:h-10 md:w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}><MoreVertical className="h-4 w-4 md:h-5 md:w-5" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {selectedSubscriber.lead_id && <DropdownMenuItem onClick={() => navigate(`/leads/${selectedSubscriber.lead_id}`)}>📋 Ver Lead no CRM</DropdownMenuItem>}
                    <DropdownMenuItem onClick={() => setShowConversationSearch(true)}>🔍 Buscar na conversa</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSendContactModalOpen(true)}>👤 Enviar contato</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={async () => {
                      if (!selectedSubscriber.telefone) return;
                      if (!window.confirm(`Bloquear ${selectedSubscriber.nome || selectedSubscriber.telefone}?`)) return;
                      const outboundInstanceId = resolveInstanceId(selectedSubscriber);
                      const { data: result, error } = await invokeZapiSend({ to_phone: selectedSubscriber.telefone, type: "block", ...(outboundInstanceId && { instance_id: outboundInstanceId }) });
                      if (error || !result?.success) toast({ title: "Erro ao bloquear", variant: "destructive" });
                      else toast({ title: "🚫 Contato bloqueado" });
                    }}>🚫 Bloquear no WhatsApp</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="hidden md:flex items-center gap-1 ml-1">
                <Button variant="ghost" size="icon" onClick={() => setShowConversationSearch(!showConversationSearch)} className={`h-10 w-10 rounded-full ${showConversationSearch ? "text-[#00A884] bg-[#00A884]/10" : `${themeClasses.iconColor} ${themeClasses.hoverBtn}`}`}><Search className="h-5 w-5" /></Button>
              </div>
            </div>

            <ConversationSearch open={showConversationSearch} onClose={() => setShowConversationSearch(false)} messages={messages} onHighlight={handleSearchHighlight} isDark={isDark} themeClasses={themeClasses} />

            {/* Mensagens */}
            <div
              ref={messagesContainerRef}
              onScroll={(e) => { if (e.currentTarget.scrollTop < 200 && !isLoadingMoreRef.current) loadMoreMessages(); }}
              className={`flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-16 lg:px-[63px] py-4 ${themeClasses.bg}`}
            >
              {isLoadingMessages ? (
                <div className="h-full flex items-center justify-center"><RefreshCw className={`h-8 w-8 animate-spin ${themeClasses.secondaryText}`} /></div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center"><div className={`${isDark ? "bg-[#332F24]" : "bg-[#FCF4CB]"} rounded-xl px-6 py-4 max-w-md shadow-lg`}><p className={`text-[13px] ${themeClasses.secondaryText} text-center`}>🔒 As mensagens são protegidas com criptografia de ponta a ponta.</p></div></div>
              ) : (
                <div className="space-y-1 max-w-[750px] mx-auto">
                  {isLoadingMoreMessages && (
                    <div className="flex justify-center py-3">
                      <RefreshCw className={`h-4 w-4 animate-spin ${themeClasses.secondaryText}`} />
                    </div>
                  )}
                  {messages.filter(m => !deletedForMeIds.has(m.id) && !(m as any).deleted_for_all).sort(compareMessagesChronological).map((message, index, filteredMsgs) => {
                    const dateLabel = getDateLabel(filteredMsgs, index);
                    const isOutgoing = message.direcao === "saida";
                    const isStarred = starredMessageIds.has(message.id);
                    const isHighlighted = highlightedMessageId === message.id;
                    return (
                      <div key={message.id} id={`msg-${message.id}`} className={`transition-colors duration-700 rounded-lg ${isHighlighted ? (isDark ? "bg-[#00A884]/10" : "bg-[#00A884]/08") : ""}`}>
                        {dateLabel && <div className="flex justify-center my-4"><span className={`px-4 py-1.5 rounded-lg ${isDark ? "bg-[#1F2C34]" : "bg-white"} text-[12px] ${themeClasses.secondaryText} shadow-sm font-medium`}>{dateLabel}</span></div>}
                        <div className={`flex ${isOutgoing ? "justify-end pr-2" : "justify-start pl-2"} mb-[3px]`}>
                          <div className={`group relative max-w-[75%] md:max-w-[65%] rounded-xl px-2.5 md:px-3 pt-2 pb-2 shadow-sm transition-all hover:shadow-md ${isOutgoing ? themeClasses.messageSent : themeClasses.messageReceived} ${isHighlighted ? "ring-2 ring-[#00A884]/60" : ""}`} style={{ borderTopLeftRadius: !isOutgoing ? "4px" : undefined, borderTopRightRadius: isOutgoing ? "4px" : undefined }}>
                            <MessageContextMenu messageId={message.id} messageContent={message.conteudo} messageType={(message as any).tipo || "text"} isOutgoing={isOutgoing} isStarred={isStarred} isPinned={selectedSubscriber ? pinnedMessagesBySubscriber[selectedSubscriber.subscriber_id] === message.id : false} isSelected={selectedMessageIds.has(message.id)} isDark={isDark} isEdited={!!(message as any).metadata?.edited} onStar={handleStarMessage} onUnstar={handleUnstarMessage} onPin={handlePinMessage} onUnpin={handleUnpinMessage} onSelect={handleSelectMessage} onReport={handleReportMessage} onDeleteForMe={handleDeleteForMe} onDeleteForAll={handleDeleteForAll} onForward={handleOpenForward} onReply={handleReplyMessage} onEdit={handleStartEdit} />
                            {editingMessageId === message.id ? (
                              <div className="flex flex-col min-w-[260px] max-w-[420px]">
                                <textarea value={editingText} onChange={e => setEditingText(e.target.value)} className={`w-full px-3 py-2 text-[14.2px] resize-none border-0 outline-none ${isDark ? "bg-[#2A3942] text-[#E9EDEF]" : "bg-[#F0F2F5] text-[#111B21]"}`} rows={Math.min(Math.max(editingText.split("\n").length, 2), 8)} autoFocus onKeyDown={e => { if (e.key === "Escape") handleCancelEdit(); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleConfirmEdit(); } }} />
                                <div className="flex items-center justify-end gap-2 mt-2">
                                  <button onClick={handleCancelEdit} className="text-[12px] px-3 py-1 rounded-full hover:bg-black/5">Cancelar</button>
                                  <button onClick={handleConfirmEdit} className="text-[12px] px-4 py-1 rounded-full bg-[#00A884] text-white">Salvar</button>
                                </div>
                              </div>
                            ) : renderMessage(message)}
                            <div className="flex items-center justify-end gap-1 mt-1">
                              {isStarred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                              {(message as any).metadata?.edited && <span className={`text-[11px] italic ${isOutgoing ? themeClasses.messageTime : themeClasses.secondaryText}`}>editada</span>}
                              <span className={`text-[11px] ${isOutgoing ? themeClasses.messageTime : themeClasses.secondaryText}`}>{formatMessageTime(message.created_at)}</span>
                              {isOutgoing && <CheckCheck className="h-4 w-4 text-[#53BDEB]" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Preview arquivo */}
            {selectedFile && (
              <div className={`px-4 py-2 ${themeClasses.header} border-t ${themeClasses.border}`}>
                <div className={`flex items-center gap-3 p-2 rounded-lg ${themeClasses.sidebar}`}>
                  {selectedFile.type.startsWith("image/") ? <img src={previewUrl || ""} alt="" className="h-12 w-12 object-cover rounded" /> : selectedFile.type.startsWith("audio/") ? <audio controls src={previewUrl || ""} className="h-10 flex-1 max-w-[200px]" /> : <div className="h-12 w-12 rounded bg-red-500 flex items-center justify-center"><FileText className="h-5 w-5 text-white" /></div>}
                  <div className="flex-1 min-w-0">
                    {!selectedFile.type.startsWith("audio/") && <><p className={`font-medium text-sm truncate ${themeClasses.headerText}`}>{selectedFile.name}</p><p className={`text-xs ${themeClasses.secondaryText}`}>{(selectedFile.size / 1024).toFixed(1)} KB</p></>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="h-8 w-8"><X className="h-4 w-4" /></Button>
                  {selectedFile.type.startsWith("audio/") && <Button onClick={sendAudioFromPreview} disabled={isSending} size="icon" className="h-10 w-10 rounded-full bg-[#00A884] hover:bg-[#008069] text-white"><Send className="h-4 w-4" /></Button>}
                </div>
              </div>
            )}

            {/* Reply bar */}
            {replyToMessage && (
              <div className={`px-4 py-2 flex items-center gap-3 border-t ${isDark ? "bg-[#1F2C34] border-[#313D45]" : "bg-[#F0F2F5] border-[#E9EDEF]"}`}>
                <div className={`flex-1 rounded-lg px-3 py-2 border-l-4 ${replyToMessage.direcao === "saida" ? "border-l-[#00A884]" : "border-l-[#6B7B8D]"} ${isDark ? "bg-[#111B21]" : "bg-white"}`}>
                  <p className={`text-xs font-medium ${replyToMessage.direcao === "saida" ? "text-[#00A884]" : isDark ? "text-[#E9EDEF]" : "text-[#111B21]"}`}>{replyToMessage.direcao === "saida" ? "Você" : selectedSubscriber?.nome || "Contato"}</p>
                  <p className={`text-[13px] truncate ${isDark ? "text-[#8696A0]" : "text-[#667781]"}`}>{replyToMessage.conteudo.substring(0, 100)}</p>
                </div>
                <button onClick={() => setReplyToMessage(null)} className={`p-1 rounded-full ${isDark ? "hover:bg-white/10 text-[#8696A0]" : "hover:bg-black/5 text-[#667781]"}`}><X className="h-5 w-5" /></button>
              </div>
            )}

            {/* Input */}
            <div className={`min-h-[52px] md:h-[66px] px-2 md:px-4 py-1.5 md:py-2 flex items-center gap-1 md:gap-2 ${themeClasses.header} border-t ${isDark ? "border-[#222D34]/50" : "border-[#E9EDEF]/50"}`}>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden" />
              <Button variant="ghost" size="icon" className={`hidden md:flex h-10 w-10 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}><Smile className="h-6 w-6" /></Button>
              <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isSending} className={`h-8 w-8 md:h-10 md:w-10 rounded-full shrink-0 ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}><Paperclip className="h-5 w-5 md:h-6 md:w-6" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setSendContactModalOpen(true)} disabled={isSending} className={`hidden md:flex h-10 w-10 rounded-full shrink-0 ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}><Contact className="h-5 w-5" /></Button>
              <div className="flex-1">
                <textarea placeholder="Digite uma mensagem" value={newMessage} onChange={e => { setNewMessage(e.target.value); handleTyping(); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (selectedFile) { if (selectedFile.type.startsWith("audio/")) sendAudioFromPreview(); else uploadAndSendFile(); } else sendMessage(); } }} onPaste={e => { const items = e.clipboardData?.items; if (!items) return; for (const item of Array.from(items)) { if (item.type.startsWith("image/")) { e.preventDefault(); const file = item.getAsFile(); if (file) { const namedFile = new File([file], `screenshot_${Date.now()}.png`, { type: file.type }); setSelectedFile(namedFile); setPreviewUrl(URL.createObjectURL(namedFile)); toast({ title: "📷 Imagem colada!" }); } return; } } }} disabled={isSending || isRecording} rows={1} style={{ minHeight: "44px", maxHeight: "120px", resize: "none" }} onInput={e => { const target = e.target as HTMLTextAreaElement; target.style.height = "44px"; target.style.height = Math.min(target.scrollHeight, 120) + "px"; }} className={`w-full rounded-2xl ${themeClasses.input} border-0 text-[15px] focus-visible:ring-0 focus-visible:outline-none shadow-sm py-[10px] px-4 overflow-y-auto`} />
              </div>
              {newMessage.trim() || (selectedFile && !selectedFile.type.startsWith("audio/")) ? (
                <Button onClick={selectedFile ? uploadAndSendFile : () => sendMessage()} disabled={isSending} size="icon" className={`h-11 w-11 rounded-full bg-[#00A884] hover:bg-[#008069] text-white shadow-lg`}><Send className="h-5 w-5" /></Button>
              ) : selectedFile?.type.startsWith("audio/") ? null : isRecording ? (
                <Button size="icon" onClick={stopRecording} className="h-11 w-11 rounded-full bg-red-500 hover:bg-red-600 text-white animate-pulse"><Square className="h-5 w-5" /></Button>
              ) : (
                <Button variant="ghost" size="icon" onClick={startRecording} disabled={isSending} className={`h-11 w-11 rounded-full ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}><Mic className="h-6 w-6" /></Button>
              )}
            </div>
          </>
        ) : (
          <div className={`h-full flex flex-col items-center justify-center ${themeClasses.emptyState} border-b-[6px] border-[#00A884]`}>
            <div className="text-center max-w-md px-4">
              <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#00A884] to-[#008069] flex items-center justify-center shadow-xl"><MessageCircle className="h-16 w-16 text-white" /></div>
              <h2 className="text-2xl font-semibold mb-3 bg-gradient-to-r from-[#00A884] to-[#008069] bg-clip-text text-transparent">Central de Mensagens</h2>
              <p className={`text-[14px] ${themeClasses.secondaryText} leading-6 mb-6`}>Selecione uma conversa para começar a atender seus leads.</p>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
           PAINÉIS LATERAIS E MODAIS
           ═══════════════════════════════════════════════════════════════════════ */}

      {showContextPanel && selectedSubscriber?.lead_id && (
        <LeadContextPanel leadId={selectedSubscriber.lead_id} onClose={() => setShowContextPanel(false)} onNavigateToLead={() => navigate(`/leads/${selectedSubscriber.lead_id}`)} />
      )}

      {showTeamPanel && (
        <TeamPresencePanel teamMembers={getTeamWithStatus()} currentUserId={user?.id} onClose={() => setShowTeamPanel(false)} onAssignToMember={assignConversation} subscriberName={selectedSubscriber ? selectedSubscriber.nome || "Contato" : undefined} isAssigning={!!selectedSubscriber} />
      )}

      <ForwardMessageModal open={forwardModalOpen} onClose={() => setForwardModalOpen(false)} subscribers={subscribers} messageContent={forwardMessageContent} onForward={handleForwardToSubscribers} />
      <SendContactModal open={sendContactModalOpen} onClose={() => setSendContactModalOpen(false)} contacts={subscribers} onSend={handleSendContact} />

      {/* ✅ Modal Contrato Fechado */}
      <ContratoFechadoModal
        open={contratoModalOpen}
        onClose={() => setContratoModalOpen(false)}
        leadId={selectedSubscriber?.lead_id || null}
        leadNome={selectedSubscriber ? getDisplayName(selectedSubscriber) : ''}
      />

      {/* ❌ Confirmação Lead Perdido */}
      <Dialog open={leadPerdidoOpen} onOpenChange={(v: boolean) => { if (!leadPerdidoLoading) setLeadPerdidoOpen(v); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          {/* Header vermelho */}
          <div className="bg-gradient-to-br from-red-500 to-red-700 px-6 pt-6 pb-5 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <X className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-base font-bold leading-tight">Lead Perdido</DialogTitle>
                <p className="text-red-100 text-xs mt-0.5">Esta ação notificará a Meta Ads</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-3">
            <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 p-3">
              <span className="text-xl mt-0.5">👤</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{selectedSubscriber ? getDisplayName(selectedSubscriber) : ''}</p>
                <p className="text-xs text-gray-500 mt-0.5">Lead será arquivado como <span className="font-semibold text-red-600">Perdido</span></p>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 flex gap-2 items-start">
              <span className="text-sm mt-0.5">📊</span>
              <p className="text-xs text-amber-700">
                Um evento <strong>LeadPerdido</strong> será enviado à Meta para que o algoritmo aprenda a não exibir anúncios para perfis similares.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setLeadPerdidoOpen(false)}
              disabled={leadPerdidoLoading}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleLeadPerdido}
              disabled={leadPerdidoLoading}
              className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 gap-1.5"
            >
              {leadPerdidoLoading
                ? <><span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" /> Salvando...</>
                : <><X className="h-3.5 w-3.5" /> Confirmar Perdido</>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ManyChatInbox = () => (
  <ChatThemeProvider>
    <ManyChatInboxContent />
  </ChatThemeProvider>
);

export default ManyChatInbox;
