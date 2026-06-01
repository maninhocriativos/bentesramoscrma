// Templates Zapsign — usando PDFs originais (não markdown)
// Apenas renderiza campos para seleção e preenchimento

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
  pdfUrl: string;
  campos: CampoTemplate[];
}

const CAMPOS_PESSOAIS: CampoTemplate[] = [
  { id: 'nome_completo',      label: 'Nome Completo',       obrigatorio: true,  tipo: 'texto',    origem: 'lead' },
  { id: 'cpf',                label: 'CPF',                 obrigatorio: true,  tipo: 'cpf',      origem: 'lead' },
  { id: 'rg',                 label: 'RG',                  obrigatorio: true,  tipo: 'texto',    origem: 'lead' },
  { id: 'orgao_rg',           label: 'Órgão Expedidor',      obrigatorio: false, tipo: 'texto',    origem: 'lead', default: 'SSP/AM' },
  { id: 'nacionalidade',      label: 'Nacionalidade',       obrigatorio: false, tipo: 'texto',    origem: 'lead', default: 'Brasileiro(a)' },
  { id: 'estado_civil',       label: 'Estado Civil',        obrigatorio: true,  tipo: 'texto',    origem: 'lead' },
  { id: 'profissao',          label: 'Profissão',           obrigatorio: true,  tipo: 'texto',    origem: 'lead' },
  { id: 'endereco',           label: 'Rua/Av.',             obrigatorio: true,  tipo: 'texto',    origem: 'lead' },
  { id: 'numero_end',         label: 'Número',              obrigatorio: true,  tipo: 'texto',    origem: 'lead' },
  { id: 'bairro',             label: 'Bairro',              obrigatorio: true,  tipo: 'texto',    origem: 'lead' },
  { id: 'cidade_uf',          label: 'Cidade/UF',           obrigatorio: false, tipo: 'texto',    origem: 'lead', default: 'Manaus/AM' },
  { id: 'cep',                label: 'CEP',                 obrigatorio: true,  tipo: 'texto',    origem: 'lead' },
];

const BASE_URL = 'https://bentesramoscrma.lovable.app/templates-zapsign';

export const TEMPLATES_DISPONIVEIS: TemplateInfo[] = [
  {
    key: 'declaracao-nao-contratacao',
    nome: 'Declaração de Não Contratação de Empréstimo',
    pdfUrl: `${BASE_URL}/declaracao-nao-contratacao.pdf`,
    campos: [
      ...CAMPOS_PESSOAIS,
      { id: 'numeros_contratos',  label: 'Nº dos Contratos',     obrigatorio: true,  tipo: 'texto', origem: 'manual' },
      { id: 'banco',              label: 'Banco',                obrigatorio: true,  tipo: 'texto', origem: 'manual' },
      { id: 'numero_beneficio',   label: 'Nº do Benefício',      obrigatorio: true,  tipo: 'texto', origem: 'manual' },
    ],
  },
  {
    key: 'declaracao-falso-advogado',
    nome: 'Declaração de Ciência e Orientação (Falso Advogado)',
    pdfUrl: `${BASE_URL}/declaracao-falso-advogado.pdf`,
    campos: CAMPOS_PESSOAIS,
  },
  {
    key: 'declaracao-hipossuficiencia',
    nome: 'Declaração de Hipossuficiência',
    pdfUrl: `${BASE_URL}/declaracao-hipossuficiencia.pdf`,
    campos: CAMPOS_PESSOAIS,
  },
  {
    key: 'contrato-honorarios',
    nome: 'Contrato de Prestação de Serviços e Honorários',
    pdfUrl: `${BASE_URL}/contrato-honorarios.pdf`,
    campos: [
      ...CAMPOS_PESSOAIS,
      { id: 'telefone_contato',      label: 'Telefone para Contato',   obrigatorio: true,  tipo: 'telefone', origem: 'lead' },
      { id: 'reu',                   label: 'Réu / Parte Adversa',     obrigatorio: true,  tipo: 'texto',    origem: 'manual' },
      { id: 'contrato_reu',          label: 'Número do Contrato/Proc', obrigatorio: true,  tipo: 'texto',    origem: 'manual' },
      { id: 'percentual_honorarios', label: 'Honorários de Êxito (%)', obrigatorio: false, tipo: 'texto',    origem: 'manual', default: '40' },
    ],
  },
  {
    key: 'procuracao',
    nome: 'Instrumento de Procuração Ad Judicia Et Extra',
    pdfUrl: `${BASE_URL}/procuracao.pdf`,
    campos: [
      ...CAMPOS_PESSOAIS,
      { id: 'reu',          label: 'Réu / Parte Adversa',      obrigatorio: true, tipo: 'texto', origem: 'manual' },
      { id: 'contrato_reu', label: 'Número do Contrato/Proc',  obrigatorio: true, tipo: 'texto', origem: 'manual' },
    ],
  },
];

export function getTemplateInfo(key: string): TemplateInfo | null {
  return TEMPLATES_DISPONIVEIS.find(t => t.key === key) || null;
}

export function getTemplatePdfUrl(key: string): string {
  const template = getTemplateInfo(key);
  return template?.pdfUrl || '';
}

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

// Gerar markdown com placeholders substituídos
export function gerarMarkdownComDados(templateKey: string, dados: Record<string, string>): string {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const hoje = new Date();
  const data = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  // Simulação dos templates em markdown (em produção virão de markdown-templates.ts)
  // Por enquanto, retorna markdown simples com placeholders
  let template = '';

  switch (templateKey) {
    case 'declaracao-nao-contratacao':
      template = `# DECLARAÇÃO DE NÃO CONTRATAÇÃO DE EMPRÉSTIMO\n\nEu, {{nome_completo}}, {{nacionalidade}}, {{estado_civil}}, {{profissao}}, detentor(a) da cédula de identidade n° {{rg}} {{orgao_rg}} e do CPF n° {{cpf}}, residente e domiciliado(a) na {{endereco}}, n° {{numero_end}}, bairro: {{bairro}}, {{cidade_uf}}, Cep: {{cep}}, **DECLARO** para os devidos fins de direito, sob as penas da lei, que as informações prestadas e documentos que apresentei ao escritório jurídico, referente a **NÃO CONTRATAÇÃO DOS EMPRÉSTIMOS {{numeros_contratos}}**, vinculados ao **{{banco}}**, indevidamente averbados em meu benefício previdenciário n° {{numero_beneficio}}, são verdadeiras.\n\n{{data}}.\n\n_______________________________________________\n**{{nome_completo}}**`;
      break;
    case 'declaracao-falso-advogado':
      template = `# DECLARAÇÃO DE CIÊNCIA E ORIENTAÇÃO - Falso Advogado\n\nEu, {{nome_completo}}, {{nacionalidade}}, {{estado_civil}}, {{profissao}}, detentor(a) da cédula de identidade n° {{rg}} {{orgao_rg}} e do CPF n° {{cpf}}, residente e domiciliado(a) na {{endereco}}, n° {{numero_end}}, bairro: {{bairro}}, {{cidade_uf}}, Cep: {{cep}}, declaro que fui informado(a) e orientado(a) sobre o golpe do "falso advogado".\n\n{{data}}.\n\n_______________________________________________\n**{{nome_completo}}**`;
      break;
    case 'declaracao-hipossuficiencia':
      template = `# DECLARAÇÃO DE HIPOSSUFICIÊNCIA\n\nEu, {{nome_completo}}, {{nacionalidade}}, {{estado_civil}}, {{profissao}}, detentor(a) da cédula de identidade n° {{rg}} {{orgao_rg}} e do CPF n° {{cpf}}, residente e domiciliado(a) na {{endereco}}, n° {{numero_end}}, bairro: {{bairro}}, {{cidade_uf}}, Cep: {{cep}}, DECLARO, com base no artigo 5°, inciso LXXIV da CF/88 que não posso arcar com custas processuais sem prejuízo do meu sustento.\n\n{{data}}.\n\n_______________________________________________\n**{{nome_completo}}**`;
      break;
    case 'contrato-honorarios':
      template = `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS\n\n**CONTRATANTE:** {{nome_completo}}, {{nacionalidade}}, {{estado_civil}}, {{profissao}}, detentor(a) da cédula de identidade n° {{rg}} {{orgao_rg}} e do CPF n° {{cpf}}, residente e domiciliado(a) na {{endereco}}, n° {{numero_end}}, bairro: {{bairro}}, {{cidade_uf}}, Cep: {{cep}}.\n\n**Objeto:** Ação judicial em face de **{{reu}}**, referente ao contrato **{{contrato_reu}}**.\n\n**Telefone:** {{telefone_contato}}\n\n**Honorários:** {{percentual_honorarios}}% em caso de êxito.\n\n{{data}}.\n\n_______________________________________________\n**{{nome_completo}} - CONTRATANTE**`;
      break;
    case 'procuracao':
      template = `# INSTRUMENTO DE PROCURAÇÃO\n\n**OUTORGANTE:** {{nome_completo}}, {{nacionalidade}}, {{estado_civil}}, {{profissao}}, detentor(a) da cédula de identidade n° {{rg}} {{orgao_rg}} e do CPF n° {{cpf}}, residente e domiciliado(a) na {{endereco}}, n° {{numero_end}}, bairro: {{bairro}}, {{cidade_uf}}, Cep: {{cep}}.\n\n**Poderes:** Para ingressar com ação judicial em face de **{{reu}}**, referente ao contrato **{{contrato_reu}}, com poderes especiais para confessar, desistir, transigir e firmar acordos.\n\n{{data}}.\n\n_______________________________________________\n**{{nome_completo}}**`;
      break;
  }

  // Substituir placeholders
  let resultado = template;
  resultado = resultado.replace(/{{data}}/g, data);
  resultado = resultado.replace(/{{nome_completo}}/g, dados.nome_completo || '');
  resultado = resultado.replace(/{{nacionalidade}}/g, dados.nacionalidade || 'brasileiro(a)');
  resultado = resultado.replace(/{{estado_civil}}/g, dados.estado_civil || '');
  resultado = resultado.replace(/{{profissao}}/g, dados.profissao || '');
  resultado = resultado.replace(/{{rg}}/g, dados.rg || '');
  resultado = resultado.replace(/{{orgao_rg}}/g, dados.orgao_rg || 'SSP/AM');
  resultado = resultado.replace(/{{cpf}}/g, dados.cpf || '');
  resultado = resultado.replace(/{{endereco}}/g, dados.endereco || '');
  resultado = resultado.replace(/{{numero_end}}/g, dados.numero_end || '');
  resultado = resultado.replace(/{{bairro}}/g, dados.bairro || '');
  resultado = resultado.replace(/{{cidade_uf}}/g, dados.cidade_uf || 'Manaus/AM');
  resultado = resultado.replace(/{{cep}}/g, dados.cep || '');
  resultado = resultado.replace(/{{numeros_contratos}}/g, dados.numeros_contratos || '');
  resultado = resultado.replace(/{{banco}}/g, dados.banco || '');
  resultado = resultado.replace(/{{numero_beneficio}}/g, dados.numero_beneficio || '');
  resultado = resultado.replace(/{{telefone_contato}}/g, dados.telefone_contato || '');
  resultado = resultado.replace(/{{reu}}/g, dados.reu || '');
  resultado = resultado.replace(/{{contrato_reu}}/g, dados.contrato_reu || '');
  resultado = resultado.replace(/{{percentual_honorarios}}/g, dados.percentual_honorarios || '40');

  return resultado;
}
