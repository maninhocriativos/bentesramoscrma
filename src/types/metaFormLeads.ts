export type MetaFormLeadStatus = 'novo' | 'em_atendimento' | 'concluido' | 'perdido';

export interface MetaFormLead {
  id: string;
  meta_lead_id: string;
  form_id: string | null;
  ad_id: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  created_time: string | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  form_fields: Record<string, any>;
  raw: Record<string, any>;
  status: MetaFormLeadStatus;
  linked_lead_id: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmConversation {
  id: string;
  lead_type: string;
  lead_ref_id: string;
  title: string | null;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface CrmMessage {
  id: string;
  conversation_id: string;
  sender_type: 'agent' | 'client' | 'isa';
  sender_name: string | null;
  message: string;
  channel: string;
  created_at: string;
}
