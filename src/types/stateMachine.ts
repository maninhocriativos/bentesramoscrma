// Lead State Machine Types

export type LeadState = 
  | 'NEW'
  | 'TRIAGE'
  | 'CLASSIFIED'
  | 'DATA_CAPTURE'
  | 'CONTRACT_SENT'
  | 'CONTRACT_SIGNED'
  | 'DOCS_PENDING'
  | 'READY_FOR_LAWYER';

export const LEAD_STATE_LABELS: Record<LeadState, string> = {
  NEW: 'Novo',
  TRIAGE: 'Triagem',
  CLASSIFIED: 'Classificado',
  DATA_CAPTURE: 'Coletando Dados',
  CONTRACT_SENT: 'Contrato Enviado',
  CONTRACT_SIGNED: 'Contrato Assinado',
  DOCS_PENDING: 'Aguardando Docs',
  READY_FOR_LAWYER: 'Pronto p/ Advogado',
};

export const LEAD_STATE_COLORS: Record<LeadState, { bg: string; text: string; border: string }> = {
  NEW: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  TRIAGE: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  CLASSIFIED: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  DATA_CAPTURE: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  CONTRACT_SENT: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  CONTRACT_SIGNED: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  DOCS_PENDING: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  READY_FOR_LAWYER: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
};

export const VALID_TRANSITIONS: Record<LeadState, LeadState[]> = {
  NEW: ['TRIAGE'],
  TRIAGE: ['CLASSIFIED', 'NEW'],
  CLASSIFIED: ['DATA_CAPTURE', 'TRIAGE'],
  DATA_CAPTURE: ['CONTRACT_SENT', 'CLASSIFIED'],
  CONTRACT_SENT: ['CONTRACT_SIGNED', 'DATA_CAPTURE'],
  CONTRACT_SIGNED: ['DOCS_PENDING', 'CONTRACT_SENT'],
  DOCS_PENDING: ['READY_FOR_LAWYER', 'CONTRACT_SIGNED'],
  READY_FOR_LAWYER: ['DOCS_PENDING'],
};

export interface LeadStateHistory {
  id: string;
  lead_id: string;
  from_state: string | null;
  to_state: string;
  changed_by: string;
  reason: string | null;
  created_at: string;
}

export interface LeadClassification {
  id: string;
  lead_id: string;
  case_type: string;
  sub_type: string | null;
  summary: string | null;
  recommended_docs: string[] | null;
  confidence_score: number | null;
  classified_by: string;
  created_at: string;
}

export interface LeadContractData {
  id: string;
  lead_id: string;
  cpf: string | null;
  rg: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  estado_civil: string | null;
  profissao: string | null;
  nacionalidade: string | null;
  data_nascimento: string | null;
  nome_mae: string | null;
  dados_extras: Record<string, unknown>;
  created_at: string;
}

export interface LeadDocsChecklist {
  id: string;
  lead_id: string;
  doc_type: string;
  doc_label: string;
  is_required: boolean;
  received: boolean;
  received_at: string | null;
  file_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface AiPrompt {
  id: string;
  name: string;
  content: string;
  greeting_message: string | null;
  strict_mode: boolean;
  version: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationConfig {
  id: string;
  provider: 'zapi' | 'fiqon';
  config_json: {
    instance_id?: string;
    token?: string;
    client_token?: string;
    webhook_secret?: string;
    base_url?: string;
    api_key?: string;
  };
  is_active: boolean;
  last_test_at: string | null;
  last_test_status: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationLog {
  id: string;
  provider: string;
  direction: 'inbound' | 'outbound';
  endpoint: string | null;
  payload_json: unknown;
  response_json: unknown;
  status: 'ok' | 'error' | 'pending';
  error_message: string | null;
  duration_ms: number | null;
  lead_id: string | null;
  created_at: string;
}
