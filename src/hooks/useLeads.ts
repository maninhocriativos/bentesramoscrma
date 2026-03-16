import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus } from '@/types/leads';
import { useToast } from '@/hooks/use-toast';

// Select only the columns actually used by dashboard/kanban/list views
const LEADS_SELECT = 'id,created_at,updated_at,nome,telefone,email,status,origem,tipo_acao,lead_state,state_updated_at,valor_causa,resumo_ia,tipo_origem,fonte_trafego,linha_whatsapp,empresa_tag,owner_tipo,isa_ativa,is_lost,lost_reason,lost_at,link_contrato,contract_key,contract_sent_at,contract_signed_at,last_contact_at,cidade,uf,cpf,triage_started_at,canal_origem,facebook_lead_id,contratos_adicionais';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const lastRefetchRef = useRef(Date.now());

  const fetchLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads_juridicos')
      .select(LEADS_SELECT)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Erro ao carregar leads',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setLeads((data as Lead[]) || []);
    }
    setLoading(false);
  }, [toast]);

  // Initial fetch
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Fallback sync with proper debounce
  useEffect(() => {
    let mounted = true;
    const MIN_GAP = 60_000; // 60s minimum between refetches

    const safeRefetch = () => {
      if (!mounted) return;
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefetchRef.current < MIN_GAP) return;
      lastRefetchRef.current = now;
      fetchLeads();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') safeRefetch();
    };

    document.addEventListener('visibilitychange', onVisibility);

    // Periodic check – 120s (realtime handles instant updates)
    const interval = setInterval(safeRefetch, 120_000);

    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchLeads]);

  // Realtime subscription (single, stable)
  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads_juridicos' },
        (payload) => {
          setLeads(prev => {
            if (prev.some(l => l.id === (payload.new as Lead).id)) return prev;
            return [payload.new as Lead, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads_juridicos' },
        (payload) => {
          setLeads(prev =>
            prev.map(lead =>
              lead.id === (payload.new as Lead).id ? (payload.new as Lead) : lead
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'leads_juridicos' },
        (payload) => {
          setLeads(prev => prev.filter(lead => lead.id !== (payload.old as Lead).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createLead = async (lead: Omit<Lead, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('leads_juridicos')
      .insert(lead)
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar lead', description: error.message, variant: 'destructive' });
      return { error };
    }

    toast({ title: 'Lead criado com sucesso!' });
    return { data: data as Lead };
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    const { error } = await supabase
      .from('leads_juridicos')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao atualizar lead', description: error.message, variant: 'destructive' });
      return { error };
    }
    return { error: null };
  };

  const deleteLead = async (id: string) => {
    const { error } = await supabase
      .from('leads_juridicos')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir lead', description: error.message, variant: 'destructive' });
      return { error };
    }

    toast({ title: 'Lead excluído!' });
    return { error: null };
  };

  // Optimistic update for drag and drop
  const updateLeadStatus = async (id: string, status: LeadStatus) => {
    const previousLeads = [...leads];

    setLeads(prev =>
      prev.map(lead =>
        lead.id === id ? { ...lead, status, updated_at: new Date().toISOString() } : lead
      )
    );

    const { error } = await supabase
      .from('leads_juridicos')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      setLeads(previousLeads);
      toast({ title: 'Erro ao mover lead', description: error.message, variant: 'destructive' });
      return { error };
    }

    return { error: null };
  };

  return {
    leads,
    setLeads,
    loading,
    fetchLeads,
    createLead,
    updateLead,
    deleteLead,
    updateLeadStatus,
  };
}
