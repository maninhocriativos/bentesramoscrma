import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChatSubscriber } from '@/hooks/useChatSubscribers';

/**
 * Normalize phone number to international Brazilian format
 */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

/**
 * Format phone for display
 */
export function formatPhone(phone?: string): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, '');
  
  // Se for número muito longo (possível ID de grupo), ignorar
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
}

/**
 * Get display name for subscriber (handles placeholders)
 */
export function getDisplayName(sub: ChatSubscriber): string {
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
}

/**
 * Get initials for avatar
 */
export function getInitials(sub: ChatSubscriber): string {
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
}

/**
 * Format message time
 */
export function formatMessageTime(dateStr: string): string {
  return format(new Date(dateStr), "HH:mm");
}

/**
 * Format last message time for conversation list
 */
export function formatLastMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM/yyyy");
}

/**
 * Get date label for message groups
 */
export function getDateLabel(msgs: { created_at: string }[], index: number): string | null {
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
}

/**
 * Detect media type from URL or content
 */
export function detectMediaType(content: string, tipo?: string): 'audio' | 'image' | 'video' | 'text' | 'document' {
  if (tipo && tipo !== 'text') return tipo as any;
  
  const url = content.replace(/^\[|\]$/g, '');
  
  if (url.match(/\.(ogg|mp3|wav|m4a)(\?|$)/i)) return 'audio';
  if (url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) return 'image';
  if (url.match(/\.(mp4|webm)(\?|$)/i)) return 'video';
  if (url.match(/\.(pdf|doc|docx|xls|xlsx)(\?|$)/i)) return 'document';
  
  return 'text';
}

/**
 * Generate subscriber ID from phone
 */
export function generateSubscriberId(phone: string): string {
  return `zapi_${normalizePhone(phone)}`;
}

/**
 * Chat theme classes
 */
export function getChatThemeClasses(isDark: boolean) {
  return {
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
    messageSentText: isDark ? 'text-[#E9EDEF]' : 'text-[#111B21]',
    messageReceivedText: isDark ? 'text-[#E9EDEF]' : 'text-[#111B21]',
    messageTime: isDark ? 'text-[#8FBFB1]' : 'text-[#667781]',
  };
}
