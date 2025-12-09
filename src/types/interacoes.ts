export interface Interacao {
  id: string;
  cliente_id: string | null;
  processo_id: string | null;
  tipo: 'Ligação' | 'Email' | 'WhatsApp' | 'Reunião' | 'Atendimento Presencial';
  direcao: 'Entrada' | 'Saída';
  resumo: string;
  detalhes: string | null;
  responsavel_id: string | null;
  data_interacao: string;
  created_at: string;
}

export interface NotificacaoPrazo {
  id: string;
  processo_id: string | null;
  compromisso_id: string | null;
  tarefa_id: string | null;
  tipo: 'Prazo Judicial' | 'Audiência' | 'Reunião' | 'Tarefa';
  titulo: string;
  data_prazo: string;
  dias_antecedencia: number;
  notificado: boolean;
  notificado_em: string | null;
  canal: 'Email' | 'WhatsApp' | 'Ambos';
  destinatario_id: string | null;
  created_at: string;
}
