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
  // Cada item é um lançamento individual do extrato (análise item a item, sem agrupamento).
  cobrancas_indevidas: Array<{
    data: string;
    descricao: string;
    valor_unitario: number;
    /** Sempre 1 no modelo individual — mantido por compatibilidade. */
    quantidade_ocorrencias: number;
    valor_total: number;
    categoria: string;
    status: string;
    base_legal: string;
    /** Justificativa jurídica individual do lançamento (gerada pela IA). */
    justificativa: string;
    /** Sempre false no modelo individual — mantido por compatibilidade. */
    recorrente: boolean;
  }>;
  recomendacao: {
    tipo_acao: string;
    fundamentacao: string;
    estimativa_recuperacao: number;
    prazo_prescricional: string;
    prioridade: 'alta' | 'media' | 'baixa';
  };
}
