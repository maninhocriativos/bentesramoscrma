// Tipos para o módulo de Gerador de Petições

export interface PetitionType {
  slug: string;
  title: string;
  description: string | null;
  icon: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PetitionPayload {
  // Cliente
  client?: {
    nome_completo?: string;
    cpf?: string;
    rg?: string;
    estado_civil?: string;
    profissao?: string;
    nacionalidade?: string;
    email?: string;
    telefone?: string;
    data_nascimento?: string;
  };
  // Endereço
  endereco?: {
    cep?: string;
    rua?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
  // Banco
  banco?: {
    banco_nome?: string;
    banco_cnpj?: string;
    agencia?: string;
    conta?: string;
    produto?: 'emprestimo' | 'financiamento' | 'pacote_servicos' | 'consignado' | 'cartao' | 'outros';
    data_inicio?: string;
    data_fim?: string;
  };
  // Valores
  valores?: {
    valor_cobrado?: number;
    valor_total?: number;
    periodo_inicio?: string;
    periodo_fim?: string;
    parcelas?: number;
    observacoes?: string;
    pedidos_selecionados?: string[];
  };
  // Anexos
  anexos?: Array<{
    url: string;
    tipo: string;
    descricao: string;
  }>;
}

export interface Petition {
  id: string;
  petition_type_slug: string;
  lead_id: string | null;
  client_name: string | null;
  client_cpf: string | null;
  status: 'rascunho' | 'em_revisao' | 'aprovado' | 'gerado' | 'protocolado' | 'arquivado';
  step_current: number;
  payload: PetitionPayload;
  summary_isa: string | null;
  validation_isa: ValidationIsa | null;
  model_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  petition_types?: PetitionType;
  leads_juridicos?: { nome: string | null };
}

export interface ValidationIsa {
  errors: string[];
  warnings: string[];
  checklist_docs: Array<{
    item: string;
    required: boolean;
    present: boolean;
  }>;
}

export interface PetitionDocument {
  id: string;
  petition_id: string;
  version: number;
  html_content: string | null;
  pdf_url: string | null;
  docx_url: string | null;
  generated_by: string;
  notes: string | null;
  created_at: string;
}

export interface PetitionModel {
  id: string;
  title: string;
  petition_type_slug: string | null;
  version: string;
  is_active: boolean;
  is_default: boolean;
  file_url: string;
  file_type: 'docx' | 'pdf';
  extracted_text: string | null;
  extracted_sections: Record<string, string> | null;
  variables_map: VariablesMap | null;
  tags: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Mapeamento de variáveis do modelo para campos do payload
export type VariablesMap = Record<string, string>;

export interface ModelChunk {
  id: string;
  model_id: string;
  petition_type_slug: string | null;
  chunk_type: 'qualificacao' | 'fatos' | 'fundamentos' | 'pedidos' | 'jurisprudencia' | 'provas' | 'geral';
  content: string;
  embedding?: number[];
  created_at: string;
}

export interface OfficeSettings {
  id: string;
  office_name: string;
  logo_url: string | null;
  lawyer_name: string | null;
  oab_number: string | null;
  oab_state: string | null;
  oab_main: string | null;
  oab_secondary: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  address: string | null;
  address_main: string | null;
  address_secondary: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface PetitionAuditLog {
  id: string;
  petition_id: string | null;
  action: string;
  actor: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

// Wizard steps
export const WIZARD_STEPS = [
  { id: 1, title: 'Cliente', description: 'Dados do cliente' },
  { id: 2, title: 'Endereço', description: 'Endereço do cliente' },
  { id: 3, title: 'Banco', description: 'Dados bancários' },
  { id: 4, title: 'Valores', description: 'Valores e pedidos' },
] as const;

// Status labels
export const STATUS_LABELS: Record<Petition['status'], { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-gray-500' },
  em_revisao: { label: 'Em Revisão', color: 'bg-yellow-500' },
  aprovado: { label: 'Aprovado', color: 'bg-blue-500' },
  gerado: { label: 'PDF Gerado', color: 'bg-green-500' },
  protocolado: { label: 'Protocolado', color: 'bg-purple-500' },
  arquivado: { label: 'Arquivado', color: 'bg-gray-400' },
};

// Produtos bancários
export const PRODUTOS_BANCARIOS = [
  { value: 'emprestimo', label: 'Empréstimo' },
  { value: 'financiamento', label: 'Financiamento' },
  { value: 'pacote_servicos', label: 'Pacote de Serviços' },
  { value: 'consignado', label: 'Consignado' },
  { value: 'cartao', label: 'Cartão de Crédito' },
  { value: 'outros', label: 'Outros' },
] as const;

// Estados civis
export const ESTADOS_CIVIS = [
  'Solteiro(a)',
  'Casado(a)',
  'Divorciado(a)',
  'Viúvo(a)',
  'União Estável',
] as const;

// UFs brasileiras
export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;

// Tipos de pedidos disponíveis
export const TIPOS_PEDIDOS = [
  { value: 'dano_moral', label: 'Danos Morais' },
  { value: 'repeticao_indebito', label: 'Repetição de Indébito' },
  { value: 'tutela_urgencia', label: 'Tutela de Urgência' },
  { value: 'revisao_contratual', label: 'Revisão Contratual' },
  { value: 'declaratoria_inexistencia', label: 'Declaratória de Inexistência' },
  { value: 'restituicao_valores', label: 'Restituição de Valores' },
  { value: 'cancelamento_contrato', label: 'Cancelamento de Contrato' },
  { value: 'exclusao_cadastros', label: 'Exclusão de Cadastros Restritivos' },
] as const;
