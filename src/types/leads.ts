export type LeadStatus = 
  | 'Lead Frio' 
  | 'Em Atendimento' 
  | 'Aguardando Contrato' 
  | 'Contrato Assinado' 
  | 'Ganho' 
  | 'Perdido';

export type LeadOrigem = 'Instagram' | 'Google' | 'Site' | 'Indicação' | 'Outro';

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
}
