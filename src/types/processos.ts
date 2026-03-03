export type ProcessoStatus = 'Em Andamento' | 'Suspenso' | 'Arquivado' | 'Ganho' | 'Perdido';

export interface ProcessoMovimento {
  dataHora: string;
  nome: string;
  complemento?: string;
  codigo?: number;
}

export interface ProcessoParte {
  nome: string;
  tipo: string;
  polo: string;
  tipoPessoa: string;
  documento?: string;
  celular?: string;
  telefone_adicional?: string;
  advogados?: Array<{
    nome: string;
    oab?: string;
  }>;
}

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
  // Novos campos detalhados
  tribunal: string | null;
  vara_comarca: string | null;
  assunto: string | null;
  valor_causa: number | null;
  data_ajuizamento: string | null;
  data_ultima_atualizacao: string | null;
  orgao_julgador: string | null;
  grau: string | null;
  classe_cnj: string | null;
  status_detalhado: string | null;
  partes_json: ProcessoParte[] | null;
  movimentos_json: ProcessoMovimento[] | null;
  dados_datajud: any | null;
  ultima_consulta_api_at: string | null;
  origem_cliente: string | null;
}
