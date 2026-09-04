// Mesmo vocabulário de compromissos.tipo — as duas tabelas ficam espelhadas
// por trigger (tarefa <-> compromisso), então o tipo precisa ser o mesmo.
export type TipoTarefa = 'Reunião' | 'Audiência' | 'Prazo' | 'Tarefa' | 'Outro';

export const TIPOS_TAREFA: { value: TipoTarefa; label: string; emoji: string }[] = [
  { value: 'Tarefa',    label: 'Tarefa',    emoji: '📋' },
  { value: 'Audiência', label: 'Audiência', emoji: '⚖️' },
  { value: 'Prazo',     label: 'Prazo',     emoji: '⏰' },
  { value: 'Reunião',   label: 'Reunião',   emoji: '🤝' },
  { value: 'Outro',     label: 'Outro',     emoji: '📌' },
];

export interface Tarefa {
  id: string;
  processo_id: string | null;
  cliente_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: TipoTarefa;
  /** Responsável principal (= responsaveis_ids[0], mantido por trigger). Use `responsaveisDe()` pra ler todos. */
  responsavel_id: string | null;
  /** Todos os responsáveis. Pode vir vazio em linhas antigas — `responsaveisDe()` faz o fallback. */
  responsaveis_ids: string[];
  prioridade: 'Baixa' | 'Media' | 'Alta' | 'Urgente';
  status: 'Pendente' | 'Em Andamento' | 'Concluída' | 'Cancelada';
  data_limite: string | null;
  prazo_seguranca: string | null;
  prazo_fatal: string | null;
  horario: string | null;
  link_audiencia: string | null;
  data_conclusao: string | null;
  started_at: string | null;
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

/**
 * Lista de responsáveis de uma tarefa/compromisso, tolerante a linhas antigas
 * (só `responsavel_id`) e a payloads de realtime que ainda não trazem o array.
 */
export function responsaveisDe(item: { responsavel_id?: string | null; responsaveis_ids?: string[] | null }): string[] {
  const arr = (item.responsaveis_ids || []).filter(Boolean);
  if (arr.length > 0) return arr;
  return item.responsavel_id ? [item.responsavel_id] : [];
}

export function ehResponsavel(item: { responsavel_id?: string | null; responsaveis_ids?: string[] | null }, userId?: string | null): boolean {
  return !!userId && responsaveisDe(item).includes(userId);
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
