export type LeadStatus = 
  | 'Lead Frio' 
  | 'Bentes Ramos'
  | 'Em Atendimento'
  | 'Em Negociação'
  | 'Aguardando Contrato' 
  | 'Contrato Assinado' 
  | 'Ganho' 
  | 'Perdido';

export type LeadOrigem = 'Instagram' | 'Google' | 'Site' | 'Indicação' | 'Bentes Ramos' | 'Escritório' | 'Tráfego Pago' | 'WhatsApp Z-API' | 'Outro';

// Tipo de origem do lead (tráfego pago vs contato direto)
export type TipoOrigem = 'trafego' | 'whatsapp_direto' | 'indefinido';

// Linha de WhatsApp (número de entrada)
export type LinhaWhatsapp = 'trafego_isa' | 'bentes_ramos_antigo' | 'indefinido';

// Tipo de owner (quem está atendendo)
export type OwnerTipo = 'isa' | 'humano';

export interface Lead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  status: LeadStatus;
  resumo_ia: string | null;
  link_contrato: string | null;
  created_at: string;
  updated_at?: string | null;
  origem: LeadOrigem | null;
  valor_causa: number | null;
  tipo_acao: string | null;
  // State Machine fields (optional - may not be set on all leads)
  lead_state?: string | null;
  state_updated_at?: string | null;
  is_lost?: boolean | null;
  lost_reason?: string | null;
  lost_at?: string | null;
  triage_started_at?: string | null;
  contract_sent_at?: string | null;
  contract_signed_at?: string | null;
  last_contact_at?: string | null;
  // Traffic source tracking
  fonte_trafego?: string | null;
  canal_origem?: string | null;
  tipo_origem?: TipoOrigem | null;
  // Contract reuse tracking
  contratos_adicionais?: number | null;
  // Meta CAPI - Facebook Lead ID
  facebook_lead_id?: string | null;
  // Novos campos para separação Bentes Ramos vs Tráfego
  linha_whatsapp?: LinhaWhatsapp | null;
  empresa_tag?: string | null;
  owner_tipo?: OwnerTipo | null;
  isa_ativa?: boolean | null;
  whatsapp_numero_destino?: string | null;
}
