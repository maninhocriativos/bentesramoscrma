import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MetaFormLead, MetaFormLeadStatus, CrmConversation, CrmMessage } from '@/types/metaFormLeads';

const ZAPI_INSTANCE = '3EDDF959BC2B81F86B410203B614D70E';
const ZAPI_TOKEN = 'EB4D1716F4FB661310E9DE33';
const ZAPI_BASE = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}`;

export function useMetaFormLeads() {
  const [leads, setLeads] = useState<MetaFormLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [formIds, setFormIds] = useState<string[]>([]);
  const { toast } = useToast();
  const initialLoadDone = useRef(false);
  const fetchLeadsRef = useRef<() => Promise<void>>();

  const fetchLeads = useCallback(async () => {
    if (!initialLoadDone.current) setLoading(true);
    try {
      const [metaResult, leadsResult] = await Promise.all([
        supabase.from('meta_form_leads').select('*').order('created_at', { ascending: false }),
        supabase.from('leads_juridicos').select('*').eq('tipo_origem', 'trafego').order('created_at', { ascending: false }),
      ]);

      if (metaResult.error) throw metaResult.error;

      const metaLeads = (metaResult.data as MetaFormLead[]) || [];
      const linkedIds = new Set(metaLeads.map(m => m.linked_lead_id).filter(Boolean));
      const uniqueFormIds = [...new Set(metaLeads.map(m => m.form_id).filter(Boolean))] as string[];
      setFormIds(uniqueFormIds);

      const extraLeads: MetaFormLead[] = ((leadsResult.data || []) as any[])
        .filter((l: any) => !linkedIds.has(l.id))
        .map((l: any) => ({
          id: l.id,
          meta_lead_id: `lead_${l.id}`,
          form_id: null,
          ad_id: null,
          ad_name: null,
          campaign_id: null,
          campaign_name: null,
          adset_id: null,
          adset_name: null,
          created_time: l.created_at,
          nome: l.nome,
          telefone: l.telefone,
          email: l.email,
          form_fields: {},
          raw: {},
          status: mapLeadStatus(l.status, l.is_lost),
          source: null,
          dedupe_key: null,
          linked_lead_id: l.id,
          last_contact_at: l.last_contact_at,
          created_at: l.created_at,
          updated_at: l.updated_at || l.created_at,
        }));

      const allLeads = [...metaLeads, ...extraLeads];
      allLeads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setLeads(allLeads);
    } catch (err: any) {
      console.error('[useMetaFormLeads] Error:', err);
      toast({ title: 'Erro ao carregar leads', description: err.message, variant: 'destructive' });
    } finally {
      initialLoadDone.current = true;
      setLoading(false);
    }
  }, [toast]);

  // Mantém ref atualizada
  useEffect(() => { fetchLeadsRef.current = fetchLeads; }, [fetchLeads]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Realtime — canal fixo com [], usa ref para não recriar
  useEffect(() => {
    const channel = supabase
      .channel('meta-leads-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads_juridicos', filter: 'tipo_origem=eq.trafego' },
        (payload) => {
          const l = payload.new as any;
          const newLead: MetaFormLead = {
            id: l.id,
            meta_lead_id: `lead_${l.id}`,
            form_id: null, ad_id: null, ad_name: null,
            campaign_id: null, campaign_name: null,
            adset_id: null, adset_name: null,
            created_time: l.created_at,
            nome: l.nome, telefone: l.telefone, email: l.email,
            form_fields: {}, raw: {},
            status: mapLeadStatus(l.status, l.is_lost),
            source: null, dedupe_key: null,
            linked_lead_id: l.id,
            last_contact_at: l.last_contact_at,
            created_at: l.created_at,
            updated_at: l.updated_at || l.created_at,
          };
          setLeads(prev => {
            if (prev.some(x => x.id === newLead.id)) return prev;
            return [newLead, ...prev];
          });
          // Disparo automático da ISA para leads de tráfego novos
          if (l.telefone) {
            dispararISA(l.telefone, l.nome);
          }
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meta_form_leads' },
        (payload) => {
          const l = payload.new as MetaFormLead;
          setLeads(prev => {
            if (prev.some(x => x.id === l.id)) return prev;
            return [l, ...prev];
          });
          // Disparo automático da ISA para leads Meta novos
          if (l.telefone) {
            dispararISA(l.telefone, l.nome);
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meta_form_leads' },
        (payload) => {
          const l = payload.new as MetaFormLead;
          setLeads(prev => prev.map(x => x.id === l.id ? l : x));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []); // ✅ Canal fixo — nunca recriado

  // Disparo automático ISA via Z-API
  const dispararISA = async (telefone: string, nome: string | null) => {
    try {
      const numero = telefone.replace(/\D/g, '');
      const numeroFinal = numero.startsWith('55') ? numero : `55${numero}`;
      const primeiroNome = nome ? nome.split(' ')[0] : 'você';
      const mensagem = `Olá ${primeiroNome}! 👋 Recebi seu contato e estou aqui para te ajudar. Me conta um pouco mais sobre o que você precisa! 😊`;

      await fetch(`${ZAPI_BASE}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: numeroFinal, message: mensagem }),
      });
    } catch (err) {
      console.error('[ISA] Erro no disparo automático:', err);
    }
  };

  // Disparo manual da ISA
  const dispararISAManual = async (lead: MetaFormLead, mensagem?: string) => {
    if (!lead.telefone) {
      toast({ title: 'Lead sem telefone', description: 'Não é possível enviar mensagem.', variant: 'destructive' });
      return { error: 'Sem telefone' };
    }
    try {
      const numero = lead.telefone.replace(/\D/g, '');
      const numeroFinal = numero.startsWith('55') ? numero : `55${numero}`;
      const primeiroNome = lead.nome ? lead.nome.split(' ')[0] : 'você';
      const msg = mensagem || `Olá ${primeiroNome}! 👋 Vi seu contato e estou aqui para te ajudar. Me conta mais sobre o que você precisa! 😊`;

      const res = await fetch(`${ZAPI_BASE}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: numeroFinal, message: msg }),
      });

      if (!res.ok) throw new Error(`Z-API error: ${res.status}`);
      toast({ title: '✅ Mensagem enviada pela ISA!', description: `WhatsApp enviado para ${lead.nome || lead.telefone}` });
      
      // Atualiza status para em_atendimento
      await updateLeadStatus(lead.id, 'em_atendimento');
      return { error: null };
    } catch (err: any) {
      toast({ title: 'Erro ao enviar mensagem', description: err.message, variant: 'destructive' });
      return { error: err.message };
    }
  };

  const syncFromMeta = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const { data, error } = await supabase.functions.invoke('sheets-meta-sync', {
        body: { sync_all: true },
      });
      if (error || data?.error) {
        const msg = data?.error || error?.message || 'Erro na sincronização';
        setSyncError(msg);
        toast({ title: '⚠️ Erro na sincronização', description: msg, variant: 'destructive' });
      } else {
        const totalNew = data?.new_leads || 0;
        const vcNew = data?.venda_casada?.new_leads || 0;
        const desc = vcNew > 0 ? `${totalNew} novos leads (${vcNew} Venda Casada)` : `${totalNew} novos leads`;
        toast({ title: '✅ Sincronização concluída', description: desc });
      }
      await fetchLeads();
    } catch (err: any) {
      const msg = err.message || 'Falha na sincronização';
      setSyncError(msg);
      toast({ title: 'Erro na sincronização', description: msg, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }, [toast, fetchLeads]);

  const updateLeadStatus = async (leadId: string, status: MetaFormLeadStatus) => {
    try {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'em_atendimento') updates.last_contact_at = new Date().toISOString();
      await supabase.from('meta_form_leads').update(updates).eq('id', leadId);
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

  return { leads, loading, syncing, syncError, formIds, fetchLeads, syncFromMeta, updateLeadStatus, dispararISAManual };
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

  const loadConversation = useCallback(async () => {
    if (!leadId) { setConversation(null); setMessages([]); return; }
    setLoading(true);
    try {
      const { data: existingConv } = await supabase
        .from('crm_conversations').select('*')
        .eq('lead_type', 'meta_forms').eq('lead_ref_id', leadId).maybeSingle();

      let conv = existingConv as CrmConversation | null;
      if (!conv) {
        const { data: newConv } = await supabase
          .from('crm_conversations')
          .insert({ lead_type: 'meta_forms', lead_ref_id: leadId, title: 'Nova conversa', status: 'open' })
          .select().single();
        conv = newConv as CrmConversation;
      }
      setConversation(conv);
      if (conv) {
        const { data: msgs } = await supabase
          .from('crm_messages').select('*')
          .eq('conversation_id', conv.id).order('created_at', { ascending: true });
        setMessages((msgs as CrmMessage[]) || []);
      }
    } catch (err: any) {
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
