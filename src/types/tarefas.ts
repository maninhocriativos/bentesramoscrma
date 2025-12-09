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
  data_conclusao: string | null;
  created_at: string;
  updated_at: string;
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
