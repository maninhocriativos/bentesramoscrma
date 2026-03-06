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

export function useChatMessages({ subscriberId, onNewMessage }: UseChatMessagesOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const { toast } = useToast();

  // Keep ref in sync to avoid stale closures in polling
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Load messages for a subscriber (considering multiple possible IDs)
  const loadMessages = useCallback(async (loadAll = false) => {
    if (!subscriberId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    try {
      // Build possible subscriber IDs
      const possibleIds = [subscriberId];
      
      // If subscriberId looks like a phone, also try zapi_ format
      const phoneMatch = subscriberId.match(/\d{10,13}/);
      if (phoneMatch) {
        const phone = phoneMatch[0];
        const normalized = phone.startsWith('55') ? phone : '55' + phone;
        possibleIds.push(`zapi_${normalized}`);
        possibleIds.push(`zapi_${phone}`);
      }
      
      // If it's already zapi_ format, extract phone and add variations
      if (subscriberId.startsWith('zapi_')) {
        const phone = subscriberId.replace('zapi_', '');
        possibleIds.push(phone);
        if (!phone.startsWith('55') && phone.length >= 10) {
          possibleIds.push(`zapi_55${phone}`);
        }
      }

      

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
      
      // Deduplicar por ID
      const uniqueMessages = (data as ChatMessage[])?.reduce((acc, msg) => {
        if (!acc.find(m => m.id === msg.id)) {
          acc.push(msg);
        }
        return acc;
      }, [] as ChatMessage[]) || [];
      
      setMessages(uniqueMessages);
    } catch (error) {
      console.error('[useChatMessages] Erro ao carregar mensagens:', error);
    } finally {
      setIsLoading(false);
    }
  }, [subscriberId]);

  // Clear messages immediately and load new ones when subscriber changes
  useEffect(() => {
    setMessages([]);
    loadMessages();
  }, [subscriberId, loadMessages]);

  // Realtime subscription for messages + fallback polling
  useEffect(() => {
    if (!subscriberId) return;

    // Build all possible subscriber IDs for broader realtime coverage
    const possibleIds = [subscriberId];
    const phoneMatch = subscriberId.match(/\d{10,13}/);
    if (phoneMatch) {
      const phone = phoneMatch[0];
      const normalized = phone.startsWith('55') ? phone : '55' + phone;
      possibleIds.push(`zapi_${normalized}`);
      possibleIds.push(`zapi_${phone}`);
    }
    if (subscriberId.startsWith('zapi_')) {
      const phone = subscriberId.replace('zapi_', '');
      possibleIds.push(phone);
      if (!phone.startsWith('55') && phone.length >= 10) {
        possibleIds.push(`zapi_55${phone}`);
      }
    }
    const uniqueIds = [...new Set(possibleIds)];

    // Subscribe to ALL possible subscriber IDs
    const channels = uniqueIds.map((id, idx) => 
      supabase
        .channel(`chat-messages-${id}-${Date.now()}-${idx}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'manychat_mensagens',
            filter: `subscriber_id=eq.${id}`
          },
          (payload) => {
            const newMsg = payload.new as ChatMessage;
            if (lastMessageIdRef.current === newMsg.id) return;
            lastMessageIdRef.current = newMsg.id;
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            onNewMessage?.(newMsg);
          }
        )
        .subscribe()
    );

    // Fallback polling every 15s to catch missed messages
    let pollActive = true;
    const pollInterval = setInterval(async () => {
      if (!pollActive) return;
      try {
        const idsFilter = uniqueIds.map(id => `subscriber_id.eq.${id}`).join(',');
        const currentMessages = messagesRef.current;
        const lastMsg = currentMessages[currentMessages.length - 1];
        const since = lastMsg?.created_at || new Date(Date.now() - 60000).toISOString();
        
        const { data } = await supabase
          .from('manychat_mensagens' as any)
          .select('*')
          .or(idsFilter)
          .gt('created_at', since)
          .order('created_at', { ascending: true });
        
        if (data && data.length > 0) {
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
      channels.forEach(ch => supabase.removeChannel(ch)); 
    };
  }, [subscriberId, onNewMessage]);

  // Send message via Z-API
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
      // Send via Z-API
      const { data: zapiResult, error: zapiError } = await supabase.functions.invoke('zapi-send', {
        body: {
          to_phone: options.phone,
          message: messageContent,
          type: options.mediaType || 'text',
          lead_id: options.leadId,
        },
      });

      console.log('[useChatMessages] Z-API response:', zapiResult, zapiError);

      if (zapiError) {
        throw new Error(zapiError.message || 'Erro ao enviar via Z-API');
      }

      // Save message to database
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
        console.error('[useChatMessages] Erro ao salvar mensagem:', saveError);
      }

      // Replace optimistic message with real one
      if (savedMsg) {
        setMessages(prev => prev.map(m => m.id === tempId ? savedMsg as ChatMessage : m));
      }

      // Register interaction if lead exists
      if (options.leadId) {
        await supabase.from('interacoes').insert({
          cliente_id: options.leadId,
          tipo: 'Chat',
          resumo: `Mensagem via WhatsApp: ${content.substring(0, 100)}...`,
          detalhes: content,
          direcao: 'saida',
          data_interacao: new Date().toISOString(),
        });
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
      console.error('[useChatMessages] Erro ao enviar:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      return { success: false, error: error.message };
    } finally {
      setIsSending(false);
    }
  }, [subscriberId]);

  // Add message locally (for optimistic updates from other sources)
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
  };
}
