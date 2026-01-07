export type TipoCompromisso = 'Reunião' | 'Audiência' | 'Prazo' | 'Tarefa' | 'Outro';
export type ConfirmacaoStatus = 'pendente' | 'confirmado' | 'remarcado' | 'cancelado';

export interface Compromisso {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  tipo: TipoCompromisso;
  lead_id: string | null;
  processo_id: string | null;
  responsavel_id: string | null;
  created_at: string;
  updated_at: string;
  confirmacao_status?: ConfirmacaoStatus;
  confirmado_em?: string | null;
  confirmacao_resposta?: string | null;
}
