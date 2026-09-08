import { TipoTarefa } from './tarefas';

export type FrequenciaRecorrencia = 'diaria' | 'semanal' | 'mensal';

export const DIAS_SEMANA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DIAS_SEMANA_LABELS_LONGO = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado',
];

export interface TarefaRecorrente {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoTarefa;
  prioridade: 'Baixa' | 'Media' | 'Alta' | 'Urgente';
  responsaveis_ids: string[];
  processo_id: string | null;
  cliente_id: string | null;
  frequencia: FrequenciaRecorrencia;
  dias_semana: number[] | null;
  dia_mes: number | null;
  horario: string | null;
  ativa: boolean;
  ultima_geracao_em: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Texto legível pra exibir na lista de recorrências (ex.: "Toda segunda-feira e quarta-feira", "Todo dia 5", "Diariamente"). */
export function descreverRecorrencia(rec: Pick<TarefaRecorrente, 'frequencia' | 'dias_semana' | 'dia_mes'>): string {
  if (rec.frequencia === 'diaria') return 'Diariamente';
  if (rec.frequencia === 'semanal') {
    const dias = (rec.dias_semana || []).slice().sort((a, b) => a - b);
    if (dias.length === 0) return 'Semanal (sem dia definido)';
    const nomes = dias.map(d => DIAS_SEMANA_LABELS_LONGO[d] || '?');
    return `Toda ${nomes.join(', ')}`;
  }
  if (rec.frequencia === 'mensal') {
    return rec.dia_mes ? `Todo dia ${rec.dia_mes} do mês` : 'Mensal (sem dia definido)';
  }
  return '';
}
