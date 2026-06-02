// Templates Zapsign baseados nos .docx originais do escritório.
// Os arquivos ficam em /public/templates-zapsign-docx/ e são preenchidos no
// cliente via docxtemplater (mesmo motor do gerador de petições). O .docx
// preenchido é enviado em base64 para a Zapsign, que o converte e gera o
// documento assinável mantendo o layout EXATO do escritório.

export interface CampoTemplateDocx {
  id: string;          // chave do placeholder no .docx ({{ID}})
  label: string;
  tipo: 'texto' | 'cpf' | 'telefone' | 'data' | 'numero';
  obrigatorio: boolean;
  default?: string;
  origem: 'lead' | 'manual';
}

export interface TemplateDocx {
  key: string;
  nome: string;
  arquivo: string;     // caminho público do .docx
  campos: CampoTemplateDocx[];
}

// Campos comuns de qualificação (presentes na maioria dos documentos)
const CAMPOS_QUALIFICACAO: CampoTemplateDocx[] = [
  { id: 'NOME_COMPLETO', label: 'Nome Completo',  tipo: 'texto', obrigatorio: true,  origem: 'lead' },
  { id: 'NACIONALIDADE', label: 'Nacionalidade',  tipo: 'texto', obrigatorio: true,  origem: 'manual', default: 'brasileiro(a)' },
  { id: 'NATURALIDADE',  label: 'Naturalidade',   tipo: 'texto', obrigatorio: false, origem: 'manual', default: 'amazonense' },
  { id: 'ESTADO_CIVIL',  label: 'Estado Civil',   tipo: 'texto', obrigatorio: true,  origem: 'manual' },
  { id: 'PROFISSAO',     label: 'Profissão',      tipo: 'texto', obrigatorio: true,  origem: 'manual' },
  { id: 'RG',            label: 'RG',             tipo: 'texto', obrigatorio: true,  origem: 'lead' },
  { id: 'CPF',           label: 'CPF',            tipo: 'cpf',   obrigatorio: true,  origem: 'lead' },
];

const CAMPOS_ENDERECO: CampoTemplateDocx[] = [
  { id: 'ENDERECO', label: 'Rua/Av.',  tipo: 'texto',  obrigatorio: true,  origem: 'lead' },
  { id: 'NUMERO',   label: 'Número',   tipo: 'texto',  obrigatorio: true,  origem: 'lead' },
  { id: 'BAIRRO',   label: 'Bairro',   tipo: 'texto',  obrigatorio: true,  origem: 'lead' },
  { id: 'CIDADE',   label: 'Cidade',   tipo: 'texto',  obrigatorio: false, origem: 'lead', default: 'Manaus' },
  { id: 'UF',       label: 'UF',       tipo: 'texto',  obrigatorio: false, origem: 'lead', default: 'AM' },
  { id: 'CEP',      label: 'CEP',      tipo: 'texto',  obrigatorio: true,  origem: 'lead' },
];

const BASE = '/templates-zapsign-docx';

export const TEMPLATES_DOCX: TemplateDocx[] = [
  {
    key: 'contrato-honorarios',
    nome: 'Contrato de Prestação de Serviços e Honorários',
    arquivo: `${BASE}/contrato-honorarios.docx`,
    campos: [
      ...CAMPOS_QUALIFICACAO,
      ...CAMPOS_ENDERECO,
      { id: 'TELEFONE',     label: 'Telefone para Contato',    tipo: 'telefone', obrigatorio: true, origem: 'lead' },
      { id: 'REU',          label: 'Réu / Parte Adversa',      tipo: 'texto',    obrigatorio: true, origem: 'manual' },
    ],
  },
  {
    key: 'procuracao',
    nome: 'Instrumento de Procuração Ad Judicia Et Extra',
    arquivo: `${BASE}/procuracao.docx`,
    campos: [
      ...CAMPOS_QUALIFICACAO,
      ...CAMPOS_ENDERECO,
      { id: 'REU',          label: 'Réu / Parte Adversa',      tipo: 'texto', obrigatorio: true, origem: 'manual' },
      { id: 'CONTRATO_REU', label: 'Número do Contrato',       tipo: 'texto', obrigatorio: true, origem: 'manual' },
    ],
  },
  {
    key: 'declaracao-hipossuficiencia',
    nome: 'Declaração de Hipossuficiência',
    arquivo: `${BASE}/declaracao-hipossuficiencia.docx`,
    campos: [
      ...CAMPOS_QUALIFICACAO,
    ],
  },
  {
    key: 'declaracao-nao-contratacao',
    nome: 'Declaração de Não Contratação / Não Autorização de Descontos',
    arquivo: `${BASE}/declaracao-nao-contratacao.docx`,
    campos: [
      ...CAMPOS_QUALIFICACAO,
      ...CAMPOS_ENDERECO,
      { id: 'CONTA',         label: 'Conta Bancária',       tipo: 'texto', obrigatorio: true, origem: 'manual' },
      { id: 'AGENCIA',       label: 'Agência',              tipo: 'texto', obrigatorio: true, origem: 'manual' },
      { id: 'DATA_DESCONTO', label: 'Data Início Descontos', tipo: 'texto', obrigatorio: true, origem: 'manual' },
    ],
  },
];

export const ENVELOPE_PRESETS_DOCX = [
  {
    id: 'kit-bancario',
    label: 'Kit Bancário Completo',
    descricao: 'Contrato + Procuração + Hipossuficiência (3 documentos)',
    templates: ['contrato-honorarios', 'procuracao', 'declaracao-hipossuficiencia'],
  },
  {
    id: 'kit-nao-contratacao',
    label: 'Kit Não Contratação',
    descricao: 'Não Contratação + Procuração + Hipossuficiência',
    templates: ['declaracao-nao-contratacao', 'procuracao', 'declaracao-hipossuficiencia'],
  },
  {
    id: 'kit-completo',
    label: 'Kit Completo (4 documentos)',
    descricao: 'Todos os documentos em um único link',
    templates: ['contrato-honorarios', 'procuracao', 'declaracao-hipossuficiencia', 'declaracao-nao-contratacao'],
  },
];

export function getTemplateDocx(key: string): TemplateDocx | undefined {
  return TEMPLATES_DOCX.find(t => t.key === key);
}

export function getCamposDocx(key: string): CampoTemplateDocx[] {
  return getTemplateDocx(key)?.campos || [];
}

/**
 * Gera a data por extenso para o campo {{DATA}} (preenchido automaticamente).
 */
export function dataPorExtenso(d = new Date()): string {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho',
    'agosto','setembro','outubro','novembro','dezembro'];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * Preenche um template .docx no cliente usando docxtemplater e retorna o
 * resultado como base64 (sem o prefixo data:). Usa o mesmo padrão de
 * normalização de tags do gerador de petições ({{X}} -> {X}).
 */
export async function preencherDocxBase64(
  arquivo: string,
  dados: Record<string, string>,
): Promise<{ base64: string; arrayBuffer: ArrayBuffer }> {
  const [{ default: PizZip }, { default: Docxtemplater }] = await Promise.all([
    import('pizzip'),
    import('docxtemplater'),
  ]);

  const resp = await fetch(arquivo);
  if (!resp.ok) throw new Error(`Não foi possível carregar o modelo: ${arquivo}`);
  const templateBuffer = await resp.arrayBuffer();

  const zip = new PizZip(templateBuffer);

  // Normaliza {{TAG}} -> {TAG} nos XMLs (igual useModelosPeticaoDocx)
  const XML_FILES = [
    'word/document.xml',
    'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
    'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml',
  ];
  const TAG_RE = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;
  for (const xml of XML_FILES) {
    const file = zip.file(xml);
    if (!file) continue;
    const content = file.asText();
    const normalized = content.replace(TAG_RE, '{$1}');
    if (normalized !== content) zip.file(xml, normalized);
  }

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });

  doc.render(dados);

  const arrayBuffer = doc.getZip().generate({ type: 'arraybuffer' }) as ArrayBuffer;

  // ArrayBuffer -> base64 (sem estourar a pilha com arquivos grandes)
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 = btoa(binary);

  return { base64, arrayBuffer };
}
