import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MetaFormLead, MetaFormLeadStatus, CrmConversation, CrmMessage } from '@/types/metaFormLeads';

export function useMetaFormLeads() {
  const [leads, setLeads] = useState<MetaFormLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch from both meta_form_leads AND leads_juridicos with trafego
      const [metaResult, leadsResult] = await Promise.all([
        supabase.from('meta_form_leads').select('*').order('created_at', { ascending: false }),
        supabase.from('leads_juridicos').select('*').eq('tipo_origem', 'trafego').order('created_at', { ascending: false }),
      ]);

      if (metaResult.error) throw metaResult.error;

      const metaLeads = (metaResult.data as MetaFormLead[]) || [];
      const linkedIds = new Set(metaLeads.map(m => m.linked_lead_id).filter(Boolean));

      // Add trafego leads that are NOT already linked in meta_form_leads
      const extraLeads: MetaFormLead[] = ((leadsResult.data || []) as any[])
        .filter((l: any) => !linkedIds.has(l.id))
        .map((l: any) => ({
          id: l.id,
          meta_lead_id: `lead_${l.id}`,
          form_id: null,
          ad_id: null,
          campaign_id: null,
          adset_id: null,
          created_time: l.created_at,
          nome: l.nome,
          telefone: l.telefone,
          email: l.email,
          form_fields: {},
          raw: {},
          status: mapLeadStatus(l.status, l.is_lost),
          linked_lead_id: l.id,
          last_contact_at: l.last_contact_at,
          created_at: l.created_at,
          updated_at: l.updated_at || l.created_at,
        }));

      // Merge: meta_form_leads first, then extra leads from leads_juridicos
      const allLeads = [...metaLeads, ...extraLeads];
      allLeads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setLeads(allLeads);
    } catch (err: any) {
      console.error('[useMetaFormLeads] Error fetching leads:', err);
      toast({ title: 'Erro ao carregar leads', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const syncFromMeta = useCallback(async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-leads-sync', {
        body: { page_id: '61585487574008' },
      });

      if (error) throw error;

      toast({
        title: 'Sincronização concluída',
        description: `${data.total_processed || 0} leads processados, ${data.new_leads || 0} novos.`,
      });

      // Refresh list
      await fetchLeads();
      return data;
    } catch (err: any) {
      console.error('[useMetaFormLeads] Sync error:', err);
      toast({ title: 'Erro na sincronização', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }, [toast, fetchLeads]);

  const updateLeadStatus = async (leadId: string, status: MetaFormLeadStatus) => {
    try {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'em_atendimento') updates.last_contact_at = new Date().toISOString();

      // Try updating meta_form_leads first
      await supabase.from('meta_form_leads').update(updates).eq('id', leadId);
      
      // Also update leads_juridicos if linked
      const lead = leads.find(l => l.id === leadId);
      const targetId = lead?.linked_lead_id || leadId;
      
      let ljStatus: string;
      const ljUpdates: any = { updated_at: new Date().toISOString() };
      switch (status) {
        case 'novo': ljStatus = 'Lead Frio'; break;
        case 'em_atendimento': ljStatus = 'Em Atendimento'; ljUpdates.last_contact_at = new Date().toISOString(); break;
        case 'concluido': ljStatus = 'Ganho'; break;
        case 'perdido': ljStatus = 'Perdido'; ljUpdates.is_lost = true; ljUpdates.lost_at = new Date().toISOString(); break;
        default: ljStatus = 'Em Atendimento';
      }
      ljUpdates.status = ljStatus;
      await supabase.from('leads_juridicos').update(ljUpdates).eq('id', targetId);

      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
      toast({ title: 'Status atualizado' });
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar status', description: err.message, variant: 'destructive' });
    }
  };

  return { leads, loading, syncing, fetchLeads, syncFromMeta, updateLeadStatus };
}

function mapLeadStatus(status: string | null, isLost: boolean | null): MetaFormLeadStatus {
  if (isLost) return 'perdido';
  if (!status) return 'novo';
  const s = status.toLowerCase();
  if (s === 'ganho' || s === 'contrato assinado') return 'concluido';
  if (s === 'perdido') return 'perdido';
  if (s === 'lead frio') return 'novo';
  return 'em_atendimento';
}

export function useMetaFormChat(leadId: string | null) {
  const [conversation, setConversation] = useState<CrmConversation | null>(null);
  const [messages, setMessages] = useState<CrmMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const DEFAULT_GREETING = "Olá! 👋 Vi seu contato pelo nosso formulário. Me diz rapidinho como posso te ajudar?";

  const loadConversation = useCallback(async () => {
    if (!leadId) { setConversation(null); setMessages([]); return; }
    setLoading(true);
    try {
      const { data: existingConv, error: convError } = await supabase
        .from('crm_conversations').select('*')
        .eq('lead_type', 'meta_forms').eq('lead_ref_id', leadId).maybeSingle();
      if (convError) throw convError;

      let conv = existingConv as CrmConversation | null;
      if (!conv) {
        const { data: newConv, error: createError } = await supabase
          .from('crm_conversations')
          .insert({ lead_type: 'meta_forms', lead_ref_id: leadId, title: 'Nova conversa', status: 'open' })
          .select().single();
        if (createError) throw createError;
        conv = newConv as CrmConversation;

        await supabase.from('crm_messages').insert({
          conversation_id: conv.id, sender_type: 'agent', sender_name: 'Sistema',
          message: DEFAULT_GREETING, channel: 'crm',
        });

        await supabase.from('leads_juridicos').update({
          status: 'Em Atendimento', last_contact_at: new Date().toISOString(),
        }).eq('id', leadId);
      }

      setConversation(conv);
      if (conv) {
        const { data: msgs, error: msgsError } = await supabase
          .from('crm_messages').select('*')
          .eq('conversation_id', conv.id).order('created_at', { ascending: true });
        if (msgsError) throw msgsError;
        setMessages((msgs as CrmMessage[]) || []);
      }
    } catch (err: any) {
      console.error('[useMetaFormChat] Error:', err);
      toast({ title: 'Erro ao carregar conversa', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [leadId, toast]);

  useEffect(() => { loadConversation(); }, [loadConversation]);

  useEffect(() => {
    if (!conversation?.id) return;
    const channel = supabase
      .channel(`crm-messages-${conversation.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const newMsg = payload.new as CrmMessage;
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation?.id]);

  const sendMessage = async (text: string, senderName?: string) => {
    if (!conversation || !text.trim()) return;
    setSending(true);
    try {
      const { data: newMsg, error } = await supabase.from('crm_messages')
        .insert({ conversation_id: conversation.id, sender_type: 'agent', sender_name: senderName || 'Atendente', message: text.trim(), channel: 'crm' })
        .select().single();
      if (error) throw error;
      await supabase.from('leads_juridicos').update({ last_contact_at: new Date().toISOString() }).eq('id', leadId);
      return newMsg as CrmMessage;
    } catch (err: any) {
      toast({ title: 'Erro ao enviar mensagem', description: err.message, variant: 'destructive' });
    } finally { setSending(false); }
  };

  return { conversation, messages, loading, sending, sendMessage, loadConversation };
}
