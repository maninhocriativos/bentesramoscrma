import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  conteudo: string;
  created_at: string;
  direcao: 'entrada' | 'saida';
  tipo: string;
  subscriber_id?: string;
  subscriber_nome?: string;
  metadata?: {
    zapi_status?: string;
    message_id?: string;
    sent_via?: string;
  };
}

export interface UseChatMessagesOptions {
  subscriberId: string | null;
  onNewMessage?: (message: ChatMessage) => void;
}

function buildPossibleIds(subscriberId: string): string[] {
  const ids = new Set<string>([subscriberId]);
  
  const phoneMatch = subscriberId.match(/\d{10,13}/);
  if (phoneMatch) {
    const phone = phoneMatch[0];
    const normalized = phone.startsWith('55') ? phone : '55' + phone;
    ids.add(`zapi_${normalized}`);
    ids.add(`zapi_${phone}`);
    if (normalized.length === 12) {
      const with9 = normalized.slice(0, 4) + '9' + normalized.slice(4);
      ids.add(`zapi_${with9}`);
    }
  }
  
  if (subscriberId.startsWith('zapi_')) {
    const phone = subscriberId.replace('zapi_', '');
    ids.add(phone);
    if (!phone.startsWith('55') && phone.length >= 10) {
      ids.add(`zapi_55${phone}`);
    }
  }

  return [...ids];
}

export function useChatMessages({ subscriberId, onNewMessage }: UseChatMessagesOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const activeSubscriberRef = useRef<string | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  const { toast } = useToast();

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);
  useEffect(() => { activeSubscriberRef.current = subscriberId; }, [subscriberId]);

  const loadMessages = useCallback(async (loadAll = false) => {
    if (!subscriberId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    try {
      const possibleIds = buildPossibleIds(subscriberId);
      const idsFilter = possibleIds.map(id => `subscriber_id.eq.${id}`).join(',');
      
      let query = supabase
        .from('manychat_mensagens' as any)
        .select('*')
        .or(idsFilter)
        .order('created_at', { ascending: true });

      if (!loadAll) {
        query = query.limit(1000);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      if (activeSubscriberRef.current !== subscriberId) return;
      
      const seen = new Set<string>();
      const uniqueMessages = ((data as ChatMessage[]) || []).filter(msg => {
        if (seen.has(msg.id)) return false;
        seen.add(msg.id);
        return true;
      });
      
      setMessages(uniqueMessages);
    } catch (error) {
      // silent — subscriber pode não ter mensagens ainda
    } finally {
      setIsLoading(false);
    }
  }, [subscriberId]);

  useEffect(() => {
    setMessages([]);
    loadMessages();
  }, [subscriberId, loadMessages]);

  useEffect(() => {
    if (!subscriberId) return;

    const possibleIds = buildPossibleIds(subscriberId);
    const channelName = `chat-msgs-${subscriberId.replace(/[^a-zA-Z0-9_]/g, '_')}`;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'manychat_mensagens' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (!newMsg.subscriber_id || !possibleIds.includes(newMsg.subscriber_id)) return;
          if (activeSubscriberRef.current !== subscriberId) return;
          if (lastMessageIdRef.current === newMsg.id) return;
          lastMessageIdRef.current = newMsg.id;
          
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          onNewMessageRef.current?.(newMsg);
        }
      )
      .subscribe();

    let pollActive = true;
    const pollInterval = setInterval(async () => {
      if (!pollActive || activeSubscriberRef.current !== subscriberId) return;
      try {
        const idsFilter = possibleIds.map(id => `subscriber_id.eq.${id}`).join(',');
        const currentMessages = messagesRef.current;
        const lastMsg = currentMessages[currentMessages.length - 1];
        const since = lastMsg?.created_at || new Date(Date.now() - 60000).toISOString();
        
        const { data } = await supabase
          .from('manychat_mensagens' as any)
          .select('id,conteudo,created_at,direcao,tipo,subscriber_id,subscriber_nome,metadata')
          .or(idsFilter)
          .gt('created_at', since)
          .order('created_at', { ascending: true })
          .limit(50);
        
        if (data && data.length > 0 && activeSubscriberRef.current === subscriberId) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = (data as ChatMessage[]).filter(m => !existingIds.has(m.id));
            if (newMsgs.length === 0) return prev;
            return [...prev, ...newMsgs];
          });
        }
      } catch (e) {
        // Silent fail for polling
      }
    }, 15000);

    return () => { 
      pollActive = false;
      clearInterval(pollInterval);
      supabase.removeChannel(channel); 
    };
  }, [subscriberId]);

  // ── Reativar ISA ────────────────────────────────────────────────────────────
  const reativarISA = useCallback(async (leadId: string): Promise<boolean> => {
    try {
      await supabase
        .from('manychat_subscribers')
        .update({ 
          atendimento_humano: false,
          atendimento_humano_desde: null,
        })
        .eq('lead_id', leadId);

      await supabase
        .from('leads_juridicos')
        .update({ 
          isa_ativa: true,
          owner_tipo: 'isa',
        })
        .eq('id', leadId);

      toast({ title: '🤖 ISA reativada', description: 'A ISA voltou a atender automaticamente.' });
      return true;
    } catch (err) {
      console.error('[useChatMessages] Erro ao reativar ISA:', err);
      toast({ title: 'Erro ao reativar ISA', variant: 'destructive' });
      return false;
    }
  }, [toast]);

  // ── Enviar mensagem ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (
    content: string,
    options: {
      phone?: string;
      leadId?: string;
      subscriberName?: string;
      mediaType?: string;
      mediaUrl?: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    if (!content || !subscriberId) {
      return { success: false, error: 'Conteúdo ou subscriber inválido' };
    }

    const messageContent = options.mediaUrl || content;
    
    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conteudo: messageContent,
      created_at: new Date().toISOString(),
      direcao: 'saida',
      tipo: options.mediaType || 'text',
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setIsSending(true);

    try {
      const { data: zapiResult, error: zapiError } = await supabase.functions.invoke('zapi-send', {
        body: {
          to_phone: options.phone,
          message: messageContent,
          type: options.mediaType || 'text',
          lead_id: options.leadId,
        },
      });

      if (zapiError) {
        throw new Error(zapiError.message || 'Erro ao enviar via Z-API');
      }

      // Salva mensagem no banco
      const { data: savedMsg, error: saveError } = await supabase
        .from('manychat_mensagens' as any)
        .insert({
          subscriber_id: subscriberId,
          subscriber_nome: options.subscriberName || 'Escritório',
          canal: 'whatsapp',
          conteudo: messageContent,
          tipo: options.mediaType || 'text',
          direcao: 'saida',
          lead_id: options.leadId,
          metadata: { 
            sent_via: 'chat_interface', 
            zapi_status: zapiResult?.success ? 'success' : 'error', 
            message_id: zapiResult?.messageId || zapiResult?.data?.messageId
          }
        } as any)
        .select()
        .single();

      if (saveError) {
        // mensagem enviada mas não salva localmente — realtime irá sincronizar
      }

      // Substitui mensagem otimista pela real
      if (savedMsg) {
        setMessages(prev => prev.map(m => m.id === tempId ? savedMsg as ChatMessage : m));
      }

      // Registra interação e pausa ISA
      if (options.leadId) {
        await supabase.from('interacoes').insert({
          cliente_id: options.leadId,
          tipo: 'Chat',
          resumo: `Mensagem via WhatsApp: ${content.substring(0, 100)}...`,
          detalhes: content,
          direcao: 'saida',
          data_interacao: new Date().toISOString(),
        });

        // ── Pausa ISA automaticamente quando atendente humano intervir ────────
        try {
          await supabase
            .from('manychat_subscribers')
            .update({
              atendimento_humano: true,
              atendimento_humano_desde: new Date().toISOString(),
            })
            .eq('lead_id', options.leadId);

          await supabase
            .from('leads_juridicos')
            .update({
              isa_ativa: false,
              owner_tipo: 'humano',
            })
            .eq('id', options.leadId);
        } catch {
          // não bloqueia envio de mensagem
        }
      }

      if (!zapiResult?.success) {
        return { 
          success: false, 
          error: zapiResult?.error || 'Mensagem pode não ter chegado ao destinatário' 
        };
      }

      return { 
        success: true, 
        messageId: zapiResult?.messageId || zapiResult?.data?.messageId 
      };
    } catch (error: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      return { success: false, error: error.message };
    } finally {
      setIsSending(false);
    }
  }, [subscriberId]);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      if (prev.some(m => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  return {
    messages,
    isLoading,
    isSending,
    loadMessages,
    sendMessage,
    addMessage,
    setMessages,
    reativarISA,
  };
}
