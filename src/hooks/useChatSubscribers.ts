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
      
      // Skip heavy message queries for subscribers that already have instance_name
      const subsWithoutInstance = subs.filter(s => !s.instance_name);
      
      if (subs.length === 0 || subsWithoutInstance.length === 0) {
        setSubscribers(subs);
        return;
      }

      const missingLeadIds = Array.from(new Set(subsWithoutInstance.map(s => s.lead_id).filter(Boolean))) as string[];
      const missingSubIds = subsWithoutInstance.map(s => s.subscriber_id);

      const instanceByLeadId = new Map<string, string>();
      const instanceBySubscriberId = new Map<string, string>();

      // 1) Por lead_id (only for subs missing instance_name)
      if (missingLeadIds.length > 0) {
        const { data: byLeadMessages } = await supabase
          .from('manychat_mensagens')
          .select('lead_id, metadata, created_at')
          .in('lead_id', missingLeadIds)
          .order('created_at', { ascending: false })
          .limit(2000);

        if (byLeadMessages) {
          for (const msg of byLeadMessages as any[]) {
            const leadId = msg.lead_id as string | null;
            if (!leadId || instanceByLeadId.has(leadId)) continue;
            const connectedPhone = (msg.metadata as any)?.original?.connectedPhone;
            if (connectedPhone) instanceByLeadId.set(leadId, connectedPhone);
          }
        }
      }

      // 2) Fallback por subscriber_id (only for subs missing instance_name)
      if (missingSubIds.length > 0) {
        const { data: bySubscriberMessages } = await supabase
          .from('manychat_mensagens')
          .select('subscriber_id, metadata, created_at')
          .in('subscriber_id', missingSubIds)
          .order('created_at', { ascending: false })
          .limit(2000);

        if (bySubscriberMessages) {
          for (const msg of bySubscriberMessages as any[]) {
            const sid = msg.subscriber_id as string;
            if (!sid || instanceBySubscriberId.has(sid)) continue;
            const connectedPhone = (msg.metadata as any)?.original?.connectedPhone;
            if (connectedPhone) instanceBySubscriberId.set(sid, connectedPhone);
          }
        }
      }

      const enrichedSubs = subs.map(sub => ({
        ...sub,
        instance_name: sub.instance_name || (sub.lead_id ? instanceByLeadId.get(sub.lead_id) : undefined) || instanceBySubscriberId.get(sub.subscriber_id) || undefined,
      }));

      setSubscribers(enrichedSubs);
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

  // Polling fallback only — no visibility refetch (handled by QueryClient staleTime)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      loadSubscribers();
    }, 120000);

    return () => clearInterval(pollInterval);
  }, [loadSubscribers]);

  // Realtime subscription (primary update mechanism)
  useEffect(() => {
    console.log('[useChatSubscribers] Configurando realtime...');
    
    const channel = supabase
      .channel(`chat-subscribers-${Date.now()}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'manychat_subscribers' },
        (payload) => {
          
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
      .subscribe();

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
