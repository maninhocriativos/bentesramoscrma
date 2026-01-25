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
  const { toast } = useToast();

  // Load messages for a subscriber
  const loadMessages = useCallback(async (loadAll = false) => {
    if (!subscriberId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    try {
      let query = supabase
        .from('manychat_mensagens' as any)
        .select('*')
        .eq('subscriber_id', subscriberId)
        .order('created_at', { ascending: true });

      if (!loadAll) {
        query = query.limit(100);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMessages((data as ChatMessage[]) || []);
    } catch (error) {
      console.error('[useChatMessages] Erro ao carregar mensagens:', error);
    } finally {
      setIsLoading(false);
    }
  }, [subscriberId]);

  // Load initial messages when subscriber changes
  useEffect(() => {
    loadMessages();
  }, [subscriberId, loadMessages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!subscriberId) return;

    console.log('[useChatMessages] Configurando realtime para:', subscriberId);
    
    const channel = supabase
      .channel(`chat-messages-${subscriberId}-${Date.now()}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'manychat_mensagens',
          filter: `subscriber_id=eq.${subscriberId}`
        },
        (payload) => {
          console.log('[useChatMessages] Nova mensagem realtime:', payload);
          const newMsg = payload.new as ChatMessage;
          
          // Prevent duplicates
          if (lastMessageIdRef.current === newMsg.id) return;
          lastMessageIdRef.current = newMsg.id;
          
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          
          onNewMessage?.(newMsg);
        }
      )
      .subscribe((status) => {
        console.log('[useChatMessages] Realtime status:', status);
      });

    return () => {
      console.log('[useChatMessages] Removendo canal realtime');
      supabase.removeChannel(channel);
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
