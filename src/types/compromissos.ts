export type TipoCompromisso = 'Reunião' | 'Audiência' | 'Prazo' | 'Tarefa' | 'Outro';
export type ConfirmacaoStatus = 'pendente' | 'confirmado' | 'remarcado' | 'cancelado';
export type ModalidadeCompromisso = 'online' | 'presencial';

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
  origem?: string | null;
  external_id?: string | null;
  tarefa_id?: string | null;
  google_event_id?: string | null;
  // Agendamento presencial/online (modal "Agendar Consulta Jurídica" do chat)
  modalidade?: ModalidadeCompromisso | null;
  local_reuniao?: string | null;
  nome_contato?: string | null;
  telefone_contato?: string | null;
  subscriber_id?: string | null;
  zapi_instance_id?: string | null;
  lembrete_24h_enviado_em?: string | null;
  lembrete_5h_enviado_em?: string | null;
  lembrete_2h_enviado_em?: string | null;
  verificacao_comparecimento_em?: string | null;
}
