import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SystemEvent {
  id: string;
  tipo: string;
  fonte: string;
  acao: string;
  entidade_tipo: string | null;
  entidade_id: string | null;
  lead_id: string | null;
  dados: Record<string, any>;
  metadata: Record<string, any>;
  ip_origem: string | null;
  user_agent: string | null;
  processado: boolean;
  erro: string | null;
  created_at: string;
  leads_juridicos?: { nome: string } | null;
}

interface EventStats {
  total: number;
  by_tipo: Record<string, number>;
  by_fonte: Record<string, number>;
  by_acao: Record<string, number>;
}

export function useSystemEvents(filters?: {
  tipo?: string;
  fonte?: string;
  leadId?: string;
  limit?: number;
}) {
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('system_events')
        .select('id, tipo, fonte, acao, entidade_tipo, entidade_id, lead_id, processado, erro, created_at, metadata, leads_juridicos(nome)')
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 100);

      if (filters?.tipo) query = query.eq('tipo', filters.tipo);
      if (filters?.fonte) query = query.eq('fonte', filters.fonte);
      if (filters?.leadId) query = query.eq('lead_id', filters.leadId);

      const { data, error } = await query;
      if (error) throw error;
      
      setEvents(data as SystemEvent[]);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      toast({ 
        title: 'Erro ao carregar eventos', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }, [filters?.tipo, filters?.fonte, filters?.leadId, filters?.limit, toast]);

  const fetchStats = useCallback(async (since?: string) => {
    try {
      const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('system_events')
        .select('tipo, fonte, acao')
        .gte('created_at', sinceDate)
        .limit(500);

      if (error) throw error;

      const byTipo: Record<string, number> = {};
      const byFonte: Record<string, number> = {};
      const byAcao: Record<string, number> = {};

      for (const event of data || []) {
        byTipo[event.tipo] = (byTipo[event.tipo] || 0) + 1;
        byFonte[event.fonte] = (byFonte[event.fonte] || 0) + 1;
        byAcao[event.acao] = (byAcao[event.acao] || 0) + 1;
      }

      setStats({
        total: data?.length || 0,
        by_tipo: byTipo,
        by_fonte: byFonte,
        by_acao: byAcao
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  // Real-time subscription
  useEffect(() => {
    fetchEvents();
    fetchStats();

    const channel = supabase
      .channel('system-events-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_events'
        },
        (payload) => {
          console.log('New system event:', payload.new);
          const newEvent = payload.new as SystemEvent;
          
          setEvents(prev => [newEvent, ...prev].slice(0, filters?.limit || 100));
          
          // Show toast for important events
          if (newEvent.tipo === 'contrato' || newEvent.tipo === 'lead_status') {
            toast({
              title: `${newEvent.fonte}: ${newEvent.acao}`,
              description: newEvent.entidade_tipo || 'Novo evento recebido'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents, fetchStats, filters?.limit, toast]);

  const deleteEvent = async (id: string) => {
    const { error } = await supabase
      .from('system_events')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir evento', description: error.message, variant: 'destructive' });
      return false;
    }

    setEvents(prev => prev.filter(e => e.id !== id));
    return true;
  };

  const clearEvents = async (before?: string) => {
    const beforeDate = before || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from('system_events')
      .delete()
      .lt('created_at', beforeDate);

    if (error) {
      toast({ title: 'Erro ao limpar eventos', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Eventos antigos removidos' });
    fetchEvents();
    return true;
  };

  return { 
    events, 
    stats,
    loading, 
    fetchEvents, 
    fetchStats,
    deleteEvent,
    clearEvents
  };
}
