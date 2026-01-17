export type ProcessoStatus = 'Em Andamento' | 'Suspenso' | 'Arquivado' | 'Ganho' | 'Perdido';

export interface Processo {
  id: string;
  numero_processo: string | null;
  titulo_acao: string | null;
  status: ProcessoStatus | null;
  advogado_responsavel: string | null;
  cliente_id: string | null;
  created_at: string | null;
  // Campos de notificação
  frequencia_notificacao_dias: number | null;
  notificacao_ativa: boolean | null;
  ultima_notificacao_at: string | null;
}
