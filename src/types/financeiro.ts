export interface Honorario {
  id: string;
  cliente_id: string | null;
  processo_id: string | null;
  tipo: 'Fixo' | 'Por Êxito' | 'Misto';
  valor_total: number;
  valor_entrada: number | null;
  percentual_exito: number | null;
  forma_pagamento: 'À Vista' | 'Parcelado';
  num_parcelas: number | null;
  data_contrato: string | null;
  status: 'Ativo' | 'Cancelado' | 'Concluído';
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Parcela {
  id: string;
  honorario_id: string | null;
  numero: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: 'Pendente' | 'Pago' | 'Atrasado' | 'Cancelado';
  forma_pagamento: string | null;
  comprovante_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Despesa {
  id: string;
  processo_id: string | null;
  cliente_id: string | null;
  tipo: string;
  descricao: string;
  valor: number;
  data_despesa: string | null;
  data_pagamento: string | null;
  status: 'Pendente' | 'Pago' | 'Reembolsado';
  responsavel_pagamento: 'Escritório' | 'Cliente';
  comprovante_url: string | null;
  created_at: string;
  updated_at: string;
}
