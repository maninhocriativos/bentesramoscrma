// Definição dos templates Zapsign (espelho do arquivo na edge function)
// Usado pelo frontend para renderizar os campos corretos no modal

export interface CampoTemplate {
  id: string;
  label: string;
  placeholder?: string;
  tipo: 'texto' | 'cpf' | 'telefone' | 'area' | 'data';
  obrigatorio: boolean;
  default?: string;
  origem: 'lead' | 'manual' | 'auto';
}

export interface TemplateInfo {
  key: string;
  nome: string;
  campos: CampoTemplate[];
}

const CAMPOS_PESSOAIS: CampoTemplate[] = [
  { id: 'nome_completo', label: 'Nome Completo',    obrigatorio: true,  tipo: 'texto',  origem: 'lead' },
  { id: 'cpf',           label: 'CPF',              obrigatorio: true,  tipo: 'cpf',    origem: 'lead' },
  { id: 'rg',            label: 'RG',               obrigatorio: true,  tipo: 'texto',  origem: 'manual', placeholder: 'Ex: 0210729-5' },
  { id: 'orgao_rg',      label: 'Órgão Emissor RG', obrigatorio: false, tipo: 'texto',  origem: 'manual', default: 'SSP/AM' },
  { id: 'nacionalidade', label: 'Nacionalidade',    obrigatorio: false, tipo: 'texto',  origem: 'manual', default: 'brasileiro(a)' },
  { id: 'estado_civil',  label: 'Estado Civil',     obrigatorio: true,  tipo: 'texto',  origem: 'manual', placeholder: 'solteiro(a), casado(a), viúvo(a)...' },
  { id: 'profissao',     label: 'Profissão',        obrigatorio: true,  tipo: 'texto',  origem: 'manual', placeholder: 'aposentado(a), pensionista...' },
  { id: 'endereco',      label: 'Rua/Av.',          obrigatorio: true,  tipo: 'texto',  origem: 'manual' },
  { id: 'numero_end',    label: 'Número',           obrigatorio: true,  tipo: 'texto',  origem: 'manual' },
  { id: 'bairro',        label: 'Bairro',           obrigatorio: true,  tipo: 'texto',  origem: 'manual' },
  { id: 'cidade_uf',     label: 'Cidade/UF',        obrigatorio: false, tipo: 'texto',  origem: 'manual', default: 'Manaus/AM' },
  { id: 'cep',           label: 'CEP',              obrigatorio: true,  tipo: 'texto',  origem: 'manual', placeholder: 'Ex: 69.048-180' },
];

export const TEMPLATES_DISPONIVEIS: TemplateInfo[] = [
  {
    key: 'declaracao-nao-contratacao',
    nome: 'Declaração de Não Contratação de Empréstimo',
    campos: [
      ...CAMPOS_PESSOAIS,
      { id: 'numeros_contratos', label: 'Números dos Contratos', obrigatorio: true, tipo: 'texto', origem: 'manual', placeholder: 'Ex: 444650908, 448401465 e 445501467' },
      { id: 'banco',             label: 'Banco',                 obrigatorio: true, tipo: 'texto', origem: 'manual', placeholder: 'Ex: Banco BMG S/A' },
      { id: 'numero_beneficio',  label: 'Número do Benefício',   obrigatorio: true, tipo: 'texto', origem: 'manual', placeholder: 'Ex: 100.033.537-0' },
    ],
  },
  {
    key: 'declaracao-falso-advogado',
    nome: 'Declaração de Ciência e Orientação (Falso Advogado)',
    campos: [...CAMPOS_PESSOAIS],
  },
  {
    key: 'declaracao-hipossuficiencia',
    nome: 'Declaração de Hipossuficiência',
    campos: [...CAMPOS_PESSOAIS],
  },
  {
    key: 'contrato-honorarios',
    nome: 'Contrato de Prestação de Serviços e Honorários',
    campos: [
      ...CAMPOS_PESSOAIS,
      { id: 'telefone_contato',      label: 'Telefone para Contato',   obrigatorio: true,  tipo: 'telefone', origem: 'lead' },
      { id: 'reu',                   label: 'Réu / Parte Adversa',     obrigatorio: true,  tipo: 'texto',    origem: 'manual', placeholder: 'Ex: FACTA FINANCEIRA S/A' },
      { id: 'contrato_reu',          label: 'Número do Contrato/Proc', obrigatorio: true,  tipo: 'texto',    origem: 'manual', placeholder: 'Ex: 235084460003' },
      { id: 'percentual_honorarios', label: 'Honorários de Êxito (%)', obrigatorio: false, tipo: 'texto',    origem: 'manual', default: '40' },
    ],
  },
  {
    key: 'procuracao',
    nome: 'Instrumento de Procuração Ad Judicia Et Extra',
    campos: [
      ...CAMPOS_PESSOAIS,
      { id: 'reu',          label: 'Réu / Parte Adversa',   obrigatorio: true, tipo: 'texto', origem: 'manual', placeholder: 'Ex: FACTA FINANCEIRA S/A' },
      { id: 'contrato_reu', label: 'Número do Contrato/Proc',obrigatorio: true, tipo: 'texto', origem: 'manual', placeholder: 'Ex: 235084460003' },
    ],
  },
];

export function getTemplateInfo(key: string): TemplateInfo | null {
  return TEMPLATES_DISPONIVEIS.find(t => t.key === key) || null;
}

// Templates que fazem sentido enviar juntos como envelope
export const ENVELOPE_PRESETS = [
  {
    id: 'kit-bancario',
    label: 'Kit Bancário Completo',
    descricao: 'Contrato + Procuração + Declarações (4 documentos)',
    templates: ['contrato-honorarios', 'procuracao', 'declaracao-hipossuficiencia', 'declaracao-falso-advogado'],
  },
  {
    id: 'kit-nao-contratacao',
    label: 'Kit Não Contratação',
    descricao: 'Declaração de Não Contratação + Procuração + Hipossuficiência',
    templates: ['declaracao-nao-contratacao', 'procuracao', 'declaracao-hipossuficiencia'],
  },
  {
    id: 'kit-completo',
    label: 'Kit Completo (5 documentos)',
    descricao: 'Todos os 5 documentos em um único link',
    templates: ['contrato-honorarios', 'procuracao', 'declaracao-hipossuficiencia', 'declaracao-falso-advogado', 'declaracao-nao-contratacao'],
  },
];
