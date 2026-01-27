export type LeadStatus = 
  | 'Lead Frio' 
  | 'Em Atendimento'
  | 'Em Negociação'
  | 'Aguardando Contrato' 
  | 'Contrato Assinado' 
  | 'Ganho' 
  | 'Perdido';

export type LeadOrigem = 'Instagram' | 'Google' | 'Site' | 'Indicação' | 'Outro';

// Tipo de origem do lead (tráfego pago vs contato direto)
export type TipoOrigem = 'trafego' | 'whatsapp_direto' | 'indefinido';

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
}
