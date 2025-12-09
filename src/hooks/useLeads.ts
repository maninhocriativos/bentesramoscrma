import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus } from '@/types/leads';
import { useToast } from '@/hooks/use-toast';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads_juridicos')
      .select('*')
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

  useEffect(() => {
    fetchLeads();

    // Real-time subscription - ensures UI updates immediately
    const channel = supabase
      .channel('leads-realtime-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads_juridicos' },
        (payload) => {
          console.log('Lead change detected:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            setLeads(prev => [payload.new as Lead, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setLeads(prev => 
              prev.map(lead => 
                lead.id === (payload.new as Lead).id ? (payload.new as Lead) : lead
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setLeads(prev => prev.filter(lead => lead.id !== (payload.old as Lead).id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeads]);

  const createLead = async (lead: Omit<Lead, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('leads_juridicos')
      .insert(lead)
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao criar lead',
        description: error.message,
        variant: 'destructive',
      });
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
      toast({
        title: 'Erro ao atualizar lead',
        description: error.message,
        variant: 'destructive',
      });
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
      toast({
        title: 'Erro ao excluir lead',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({ title: 'Lead excluído!' });
    return { error: null };
  };

  // Optimistic update for drag and drop - UI updates immediately
  const updateLeadStatus = async (id: string, status: LeadStatus) => {
    // Store previous state for rollback
    const previousLeads = [...leads];
    
    // Optimistic update - update UI immediately
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
      // Revert on error
      setLeads(previousLeads);
      toast({
        title: 'Erro ao mover lead',
        description: error.message,
        variant: 'destructive',
      });
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