export interface Tarefa {
  id: string;
  processo_id: string | null;
  cliente_id: string | null;
  titulo: string;
  descricao: string | null;
  responsavel_id: string | null;
  prioridade: 'Baixa' | 'Media' | 'Alta' | 'Urgente';
  status: 'Pendente' | 'Em Andamento' | 'Concluída' | 'Cancelada';
  data_limite: string | null;
  prazo_seguranca: string | null;
  prazo_fatal: string | null;
  data_conclusao: string | null;
  created_at: string;
  updated_at: string;
  // Approval workflow
  entrega_texto: string | null;
  entrega_anexo_url: string | null;
  entregue_em: string | null;
  aprovacao_status: 'aguardando_aprovacao' | 'aprovada' | 'devolvida' | null;
  aprovacao_nota: number | null;
  aprovacao_feedback: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
}

export interface Timesheet {
  id: string;
  usuario_id: string;
  processo_id: string | null;
  tarefa_id: string | null;
  cliente_id: string | null;
  descricao: string;
  data_atividade: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  duracao_minutos: number;
  tipo_atividade: string | null;
  faturavel: boolean;
  created_at: string;
  updated_at: string;
}
