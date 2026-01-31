import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ChatSubscriber {
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
  // Instance info from messages metadata
  instance_name?: string;
}

export type ConversationFilter = 'all' | 'unread' | 'human' | 'bot' | 'mine';

interface UseChatSubscribersOptions {
  userId?: string;
  onNewSubscriber?: (subscriber: ChatSubscriber) => void;
  onSubscriberUpdated?: (subscriber: ChatSubscriber) => void;
}

export function useChatSubscribers({ userId, onNewSubscriber, onSubscriberUpdated }: UseChatSubscribersOptions = {}) {
  const [subscribers, setSubscribers] = useState<ChatSubscriber[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Load all subscribers with instance info from messages
  const loadSubscribers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get subscribers
      const { data: subsData, error: subsError } = await supabase
        .from('manychat_subscribers' as any)
        .select('*')
        .order('ultima_interacao', { ascending: false });

      if (subsError) throw subsError;
      
      const subs = (subsData as ChatSubscriber[]) || [];
      
      // Get instance info from most recent message for each subscriber (in batches)
      // We'll get the instance_name from the most recent message's metadata
      if (subs.length > 0) {
        const subscriberIds = subs.map(s => s.subscriber_id);
        
        // Get the most recent message for each subscriber to find instance_name
        const { data: messagesData } = await supabase
          .from('manychat_mensagens')
          .select('subscriber_id, metadata')
          .in('subscriber_id', subscriberIds)
          .not('metadata->instance_name', 'is', null)
          .order('created_at', { ascending: false });
        
        // Create a map of subscriber_id -> instance_name (first occurrence = most recent)
        const instanceMap = new Map<string, string>();
        if (messagesData) {
          for (const msg of messagesData) {
            if (!instanceMap.has(msg.subscriber_id)) {
              const instanceName = (msg.metadata as any)?.instance_name;
              if (instanceName) {
                instanceMap.set(msg.subscriber_id, instanceName);
              }
            }
          }
        }
        
        // Enrich subscribers with instance info
        const enrichedSubs = subs.map(sub => ({
          ...sub,
          instance_name: instanceMap.get(sub.subscriber_id) || undefined
        }));
        
        setSubscribers(enrichedSubs);
      } else {
        setSubscribers(subs);
      }
    } catch (error) {
      console.error('[useChatSubscribers] Erro ao carregar subscribers:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadSubscribers();
  }, [loadSubscribers]);

  // Polling and visibility handlers
  useEffect(() => {
    // Reduced polling - realtime is primary
    const pollInterval = setInterval(() => {
      console.log('[useChatSubscribers] Polling refresh...');
      loadSubscribers();
    }, 30000);

    const handleFocus = () => {
      console.log('[useChatSubscribers] Window focus - reloading...');
      loadSubscribers();
    };
    window.addEventListener('focus', handleFocus);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadSubscribers();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadSubscribers]);

  // Realtime subscription
  useEffect(() => {
    console.log('[useChatSubscribers] Configurando realtime...');
    
    const channel = supabase
      .channel(`chat-subscribers-${Date.now()}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'manychat_subscribers' },
        (payload) => {
          console.log('[useChatSubscribers] Realtime evento:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            const newSub = payload.new as ChatSubscriber;
            setSubscribers(prev => {
              if (prev.some(s => s.subscriber_id === newSub.subscriber_id)) return prev;
              return [newSub, ...prev];
            });
            onNewSubscriber?.(newSub);
          } else if (payload.eventType === 'UPDATE') {
            const updatedSub = payload.new as ChatSubscriber;
            setSubscribers(prev => {
              const idx = prev.findIndex(s => s.subscriber_id === updatedSub.subscriber_id);
              if (idx === -1) return prev;
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...updatedSub };
              return updated;
            });
            onSubscriberUpdated?.(updatedSub);
          }
        }
      )
      .subscribe((status) => {
        console.log('[useChatSubscribers] Realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onNewSubscriber, onSubscriberUpdated]);

  // Sync contacts via Z-API
  const syncContacts = useCallback(async () => {
    setIsSyncing(true);
    try {
      toast({ title: 'Sincronização iniciada', description: 'Atualizando contatos via Z-API...' });
      
      // Sync subscriber names
      await supabase.functions.invoke('sync-subscriber-names');
      
      await loadSubscribers();
      toast({
        title: 'Sincronização concluída!',
        description: 'Lista de contatos atualizada'
      });
    } catch (error: any) {
      console.error('[useChatSubscribers] Sync error:', error);
      toast({ title: 'Erro na sincronização', description: error.message, variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  }, [loadSubscribers, toast]);

  // Update subscriber order when new message arrives
  const bumpSubscriber = useCallback((subscriberId: string) => {
    setSubscribers(prev => {
      const idx = prev.findIndex(s => s.subscriber_id === subscriberId);
      if (idx === -1) return prev;
      const updated = [...prev];
      const [subscriber] = updated.splice(idx, 1);
      return [{ ...subscriber, ultima_interacao: new Date().toISOString() }, ...updated];
    });
  }, []);

  // Toggle human attendance mode
  const toggleHumanMode = useCallback(async (subscriberId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('manychat_subscribers')
        .update({ 
          atendimento_humano: enabled,
          atendimento_humano_desde: enabled ? new Date().toISOString() : null
        })
        .eq('subscriber_id', subscriberId);

      if (error) throw error;

      setSubscribers(prev => prev.map(s => 
        s.subscriber_id === subscriberId 
          ? { ...s, atendimento_humano: enabled, atendimento_humano_desde: enabled ? new Date().toISOString() : undefined }
          : s
      ));

      toast({
        title: enabled ? '👤 Atendimento humano ativado' : '🤖 Isa IA reativada',
        description: enabled ? 'Isa não responderá automaticamente' : 'Isa voltará a responder automaticamente'
      });

      return { success: true };
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return { success: false, error: error.message };
    }
  }, [toast]);

  // Assign conversation to team member
  const assignConversation = useCallback(async (subscriberId: string, memberId: string) => {
    try {
      const { error } = await supabase
        .from('manychat_subscribers')
        .update({ assigned_to: memberId })
        .eq('subscriber_id', subscriberId);

      if (error) throw error;

      setSubscribers(prev => prev.map(s => 
        s.subscriber_id === subscriberId 
          ? { ...s, assigned_to: memberId }
          : s
      ));

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, []);

  // Filter subscribers
  const filterSubscribers = useCallback((
    searchTerm: string, 
    filter: ConversationFilter
  ): ChatSubscriber[] => {
    return subscribers
      .filter(sub => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          sub.nome?.toLowerCase().includes(term) ||
          sub.telefone?.includes(searchTerm) ||
          sub.subscriber_id?.includes(searchTerm) ||
          sub.email?.toLowerCase().includes(term)
        );
      })
      .filter(sub => {
        if (filter === 'human') return sub.atendimento_humano;
        if (filter === 'bot') return !sub.atendimento_humano;
        if (filter === 'mine') return sub.assigned_to === userId;
        return true;
      });
  }, [subscribers, userId]);

  return {
    subscribers,
    isLoading,
    isSyncing,
    loadSubscribers,
    syncContacts,
    bumpSubscriber,
    toggleHumanMode,
    assignConversation,
    filterSubscribers,
    setSubscribers,
  };
}
