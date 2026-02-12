import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MetaFormLead, MetaFormLeadStatus, CrmConversation, CrmMessage } from '@/types/metaFormLeads';

// Map leads_juridicos status to MetaFormLeadStatus
function mapLeadStatus(status: string | null, isLost: boolean | null): MetaFormLeadStatus {
  if (isLost) return 'perdido';
  if (!status) return 'novo';
  const s = status.toLowerCase();
  if (s === 'ganho' || s === 'contrato assinado') return 'concluido';
  if (s === 'perdido') return 'perdido';
  if (s === 'lead frio') return 'novo';
  return 'em_atendimento';
}

export function useMetaFormLeads() {
  const [leads, setLeads] = useState<MetaFormLead[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      // Pull directly from leads_juridicos where tipo_origem = 'trafego'
      const { data, error } = await supabase
        .from('leads_juridicos')
        .select('*')
        .eq('tipo_origem', 'trafego')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map leads_juridicos rows to MetaFormLead interface
      const mapped: MetaFormLead[] = (data || []).map((lead: any) => ({
        id: lead.id,
        meta_lead_id: lead.facebook_lead_id || `lead_${lead.id}`,
        form_id: null,
        ad_id: null,
        campaign_id: null,
        adset_id: null,
        created_time: lead.created_at,
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        form_fields: {},
        raw: {},
        status: mapLeadStatus(lead.status, lead.is_lost),
        linked_lead_id: lead.id,
        last_contact_at: lead.last_contact_at,
        created_at: lead.created_at,
        updated_at: lead.updated_at || lead.created_at,
      }));

      setLeads(mapped);
    } catch (err: any) {
      console.error('[useMetaFormLeads] Error fetching leads:', err);
      toast({
        title: 'Erro ao carregar leads',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const updateLeadStatus = async (leadId: string, status: MetaFormLeadStatus) => {
    try {
      // Map MetaFormLeadStatus back to leads_juridicos status
      let ljStatus: string;
      const updates: any = { updated_at: new Date().toISOString() };
      
      switch (status) {
        case 'novo': ljStatus = 'Lead Frio'; break;
        case 'em_atendimento': 
          ljStatus = 'Em Atendimento'; 
          updates.last_contact_at = new Date().toISOString();
          break;
        case 'concluido': ljStatus = 'Ganho'; break;
        case 'perdido': ljStatus = 'Perdido'; updates.is_lost = true; updates.lost_at = new Date().toISOString(); break;
        default: ljStatus = 'Em Atendimento';
      }
      
      updates.status = ljStatus;

      const { error } = await supabase
        .from('leads_juridicos')
        .update(updates)
        .eq('id', leadId);

      if (error) throw error;

      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status, ...updates } : l));
      toast({ title: 'Status atualizado' });
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar status', description: err.message, variant: 'destructive' });
    }
  };

  return { leads, loading, fetchLeads, updateLeadStatus };
}

export function useMetaFormChat(leadId: string | null) {
  const [conversation, setConversation] = useState<CrmConversation | null>(null);
  const [messages, setMessages] = useState<CrmMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const DEFAULT_GREETING = "Olá! 👋 Vi seu contato pelo nosso formulário. Me diz rapidinho como posso te ajudar?";

  // Load or create conversation
  const loadConversation = useCallback(async () => {
    if (!leadId) {
      setConversation(null);
      setMessages([]);
      return;
    }

    setLoading(true);
    try {
      const { data: existingConv, error: convError } = await supabase
        .from('crm_conversations')
        .select('*')
        .eq('lead_type', 'meta_forms')
        .eq('lead_ref_id', leadId)
        .maybeSingle();

      if (convError) throw convError;

      let conv = existingConv as CrmConversation | null;

      if (!conv) {
        const { data: newConv, error: createError } = await supabase
          .from('crm_conversations')
          .insert({
            lead_type: 'meta_forms',
            lead_ref_id: leadId,
            title: 'Nova conversa',
            status: 'open',
          })
          .select()
          .single();

        if (createError) throw createError;
        conv = newConv as CrmConversation;

        const { error: msgError } = await supabase
          .from('crm_messages')
          .insert({
            conversation_id: conv.id,
            sender_type: 'agent',
            sender_name: 'Sistema',
            message: DEFAULT_GREETING,
            channel: 'crm',
          });

        if (msgError) console.error('Error creating greeting:', msgError);

        await supabase
          .from('leads_juridicos')
          .update({ 
            status: 'Em Atendimento',
            last_contact_at: new Date().toISOString(),
          })
          .eq('id', leadId);
      }

      setConversation(conv);

      if (conv) {
        const { data: msgs, error: msgsError } = await supabase
          .from('crm_messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });

        if (msgsError) throw msgsError;
        setMessages((msgs as CrmMessage[]) || []);
      }
    } catch (err: any) {
      console.error('[useMetaFormChat] Error:', err);
      toast({
        title: 'Erro ao carregar conversa',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [leadId, toast]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!conversation?.id) return;

    const channel = supabase
      .channel(`crm-messages-${conversation.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const newMsg = payload.new as CrmMessage;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  const sendMessage = async (text: string, senderName?: string) => {
    if (!conversation || !text.trim()) return;

    setSending(true);
    try {
      const { data: newMsg, error } = await supabase
        .from('crm_messages')
        .insert({
          conversation_id: conversation.id,
          sender_type: 'agent',
          sender_name: senderName || 'Atendente',
          message: text.trim(),
          channel: 'crm',
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('leads_juridicos')
        .update({ last_contact_at: new Date().toISOString() })
        .eq('id', leadId);

      return newMsg as CrmMessage;
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar mensagem',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return { conversation, messages, loading, sending, sendMessage, loadConversation };
}
