export interface AnaliseConfig {
  arquivos: File[];
  banco: string;
  dataInicial: string;
  dataFinal: string;
  tiposCobranças: string[];
  nomeCliente: string;
  cpf: string;
  numeroContrato: string;
}

export interface AnaliseResultado {
  resumo: {
    total_lancamentos: number;
    irregularidades_encontradas: number;
    valor_total_indevido: number;
    periodo_analisado: string;
    banco: string;
  };
  cobrancas_indevidas: Array<{
    data: string;
    descricao: string;
    valor_unitario: number;
    quantidade_ocorrencias: number;
    valor_total: number;
    categoria: string;
    status: string;
    base_legal: string;
    justificativa: string;
    recorrente: boolean;
  }>;
  por_categoria: Array<{
    categoria: string;
    total: number;
    ocorrencias: number;
  }>;
  recomendacao: {
    tipo_acao: string;
    fundamentacao: string;
    estimativa_recuperacao: number;
    prazo_prescricional: string;
    prioridade: 'alta' | 'media' | 'baixa';
  };
}
