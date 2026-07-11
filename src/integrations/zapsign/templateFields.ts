// Templates Zapsign — usando PDFs originais (não markdown)
// Apenas renderiza campos para seleção e preenchimento

import { HTML_TEMPLATES } from './html-templates';
import { assetUrl } from '@/lib/siteConfig';

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

const BASE_URL = assetUrl('templates-zapsign');

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

// Gerar HTML com placeholders substituídos
export function gerarMarkdownComDados(templateKey: string, dados: Record<string, string>): string {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const hoje = new Date();
  const data = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  const templateFn = HTML_TEMPLATES[templateKey as keyof typeof HTML_TEMPLATES];

  if (!templateFn) {
    throw new Error(`Template não encontrado: ${templateKey}`);
  }

  let html = templateFn(dados);

  // Calcular percentual por extenso
  let percentualExtenso = '';
  const percentual = dados.percentual_honorarios || '40';
  const numeros = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
    'vinte', 'vinte e um', 'vinte e dois', 'vinte e três', 'vinte e quatro', 'vinte e cinco',
    'vinte e seis', 'vinte e sete', 'vinte e oito', 'vinte e nove', 'trinta', 'trinta e um',
    'trinta e dois', 'trinta e três', 'trinta e quatro', 'trinta e cinco', 'trinta e seis',
    'trinta e sete', 'trinta e oito', 'trinta e nove', 'quarenta'];
  if (parseInt(percentual) >= 0 && parseInt(percentual) <= 40) {
    percentualExtenso = numeros[parseInt(percentual)] || percentual;
  } else {
    percentualExtenso = percentual;
  }

  // Substituir placeholders
  html = html.replace(/{{data}}/g, data);
  html = html.replace(/{{nome_completo}}/g, dados.nome_completo || '');
  html = html.replace(/{{nacionalidade}}/g, dados.nacionalidade || 'brasileiro(a)');
  html = html.replace(/{{estado_civil}}/g, dados.estado_civil || '');
  html = html.replace(/{{profissao}}/g, dados.profissao || '');
  html = html.replace(/{{rg}}/g, dados.rg || '');
  html = html.replace(/{{orgao_rg}}/g, dados.orgao_rg || 'SSP/AM');
  html = html.replace(/{{cpf}}/g, dados.cpf || '');
  html = html.replace(/{{endereco}}/g, dados.endereco || '');
  html = html.replace(/{{numero_end}}/g, dados.numero_end || '');
  html = html.replace(/{{bairro}}/g, dados.bairro || '');
  html = html.replace(/{{cidade_uf}}/g, dados.cidade_uf || 'Manaus/AM');
  html = html.replace(/{{cep}}/g, dados.cep || '');
  html = html.replace(/{{numeros_contratos}}/g, dados.numeros_contratos || '');
  html = html.replace(/{{banco}}/g, dados.banco || '');
  html = html.replace(/{{numero_beneficio}}/g, dados.numero_beneficio || '');
  html = html.replace(/{{telefone_contato}}/g, dados.telefone_contato || '');
  html = html.replace(/{{reu}}/g, dados.reu || '');
  html = html.replace(/{{contrato_reu}}/g, dados.contrato_reu || '');
  html = html.replace(/{{percentual_honorarios}}/g, percentual);
  html = html.replace(/{{percentual_honorarios_extenso}}/g, percentualExtenso);

  return html;
}
