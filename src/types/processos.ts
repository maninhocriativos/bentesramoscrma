export type ProcessoStatus = 'Em Andamento' | 'Suspenso' | 'Arquivado' | 'Ganho' | 'Perdido';

export interface ProcessoMovimento {
  dataHora: string;
  dataHoraRaw?: string;
  nome: string;
  complemento?: string | null;
  codigo?: number | null;
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
  created_at: string | null;
  updated_at?: string | null;

  // Numeração
  numero_processo: string | null;
  numero_complementar: string | null;

  // Dados principais
  titulo_acao: string | null;
  status: ProcessoStatus | null;
  status_detalhado: string | null;
  advogado_responsavel: string | null;

  // Cliente
  cliente_id: string | null;
  cpf_cliente: string | null;
  nome_cliente: string | null;
  origem_cliente: string | null;
  data_nascimento_cliente: string | null;
  categoria_beneficiario: string | null;

  // Endereçamento judicial
  tribunal: string | null;
  vara_comarca: string | null;
  orgao_julgador: string | null;
  tipo_orgao_julgador: string | null;
  grau: string | null;
  sistema_judicial: string | null;       // coluna: sistema_judicial
  complemento_enderecamento: string | null;

  // Classificação CNJ
  classe_cnj: string | null;
  classe_cnj_codigo?: string | null;
  classe_cnj_nome?: string | null;
  assunto: string | null;
  assunto_cnj: string | null;

  // Valores
  valor_causa: number | null;
  valor_provisionado: number | null;
  probabilidade: string | null;

  // Datas
  data_ajuizamento: string | null;       // coluna: data_ajuizamento
  data_ultima_atualizacao: string | null;
  data_distribuicao: string | null;
  data_citacao: string | null;
  data_recebimento: string | null;
  data_arquivamento: string | null;
  data_encerramento: string | null;

  // Extras
  descricao: string | null;
  marcadores: string | null;
  area: string | null;
  fase: string | null;
  segredo_justica: boolean | null;
  monitorar_push: boolean | null;

  // Notificações
  frequencia_notificacao_dias: number | null;
  notificacao_ativa: boolean | null;
  ultima_notificacao_at: string | null;

  // JSON columns
  partes_json: ProcessoParte[] | null;
  movimentos_json: ProcessoMovimento[] | null;
  dados_datajud?: any | null;

  // API sync
  ultima_consulta_api_at: string | null;

  // Hierarquia
  processo_pai_id: string | null;
  processos_filhos?: Pick<Processo, 'id' | 'numero_processo' | 'titulo_acao' | 'status' | 'fase'>[];

  // Co-responsável
  co_responsavel_id: string | null;
  co_responsavel?: { id: string; nome: string | null; sobrenome: string | null } | null;
}
