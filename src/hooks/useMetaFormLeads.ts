import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MetaFormLead, MetaFormLeadStatus, CrmConversation, CrmMessage } from '@/types/metaFormLeads';

export function useMetaFormLeads() {
  const [leads, setLeads] = useState<MetaFormLead[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('meta_form_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads((data as MetaFormLead[]) || []);
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
      const updates: any = { status, updated_at: new Date().toISOString() };
      
      if (status === 'em_atendimento') {
        updates.last_contact_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('meta_form_leads')
        .update(updates)
        .eq('id', leadId);

      if (error) throw error;

      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
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
      // Check if conversation exists
      const { data: existingConv, error: convError } = await supabase
        .from('crm_conversations')
        .select('*')
        .eq('lead_type', 'meta_forms')
        .eq('lead_ref_id', leadId)
        .maybeSingle();

      if (convError) throw convError;

      let conv = existingConv as CrmConversation | null;

      // If no conversation exists, create one with greeting
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

        // Create initial greeting message
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

        // Update lead status to em_atendimento
        await supabase
          .from('meta_form_leads')
          .update({ 
            status: 'em_atendimento',
            last_contact_at: new Date().toISOString(),
          })
          .eq('id', leadId);
      }

      setConversation(conv);

      // Load messages
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

  // Realtime subscription for messages
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

      // Update last_contact_at
      await supabase
        .from('meta_form_leads')
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
