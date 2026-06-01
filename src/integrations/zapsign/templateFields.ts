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

// ── Geração de documentos markdown no frontend ───────────────────────────────

type D = Record<string, string>;

function hoje(): string {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const d = new Date();
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

const CAB = `**BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA**
Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040
(92) 3343-6173 | (92) 98223-7330 / (92) 99160-4348
juridico@bentesramos.adv.br | www.bentesramos.com.br

---

`;

function ident(d: D) {
  return `**${d.nome_completo}**, ${d.nacionalidade || 'brasileiro(a)'}, ${d.estado_civil}, ${d.profissao}, detentor(a) da cédula de identidade n° ${d.rg} ${d.orgao_rg || 'SSP/AM'} e do CPF n° ${d.cpf}, residente e domiciliado(a) na ${d.endereco}, n° ${d.numero_end}, bairro: ${d.bairro}, ${d.cidade_uf || 'Manaus/AM'}, Cep: ${d.cep}`;
}

export function gerarMarkdown(templateKey: string, d: D): string {
  const local = `${d.cidade_uf || 'Manaus/AM'}, ${hoje()}`;

  switch (templateKey) {
    case 'declaracao-nao-contratacao':
      return CAB +
        `# DECLARAÇÃO DE NÃO CONTRATAÇÃO DE EMPRÉSTIMO\n\n` +
        `Eu, ${ident(d)}, **DECLARO** para os devidos fins de direito, sob as penas da lei, que as informações prestadas e documentos que apresentei ao escritório jurídico, referente a **NÃO CONTRATAÇÃO DOS EMPRÉSTIMOS ${d.numeros_contratos}**, vinculados ao **${d.banco}**, indevidamente averbados em meu benefício previdenciário n° ${d.numero_beneficio}, são verdadeiras.\n\n` +
        `${local}.\n\n---\n\n___________________________________________\n**${d.nome_completo}**\n`;

    case 'declaracao-falso-advogado':
      return CAB +
        `# DECLARAÇÃO DE CIÊNCIA E ORIENTAÇÃO\n*(Golpe do "Falso Advogado")*\n\n` +
        `Eu, ${ident(d)}, **declaro** para os devidos fins que, fui informado(a) e orientado(a) pelo escritório **Bentes Ramos Advocacia e Consultoria Jurídica** sobre a existência do golpe conhecido como **"falso advogado"**.\n\n` +
        `**Estou ciente de que nenhum advogado do escritório solicita pagamentos, transferências, códigos, senhas ou dados pessoais por números desconhecidos ou não informados previamente.**\n\n` +
        `Os únicos meios oficiais de contato: (92) 99160-4348 | (92) 98223-7330 | (92) 98588-8190 | juridico@bentesramos.adv.br\n\n` +
        `${local}.\n\n---\n\n___________________________________________\n**${d.nome_completo}**\n`;

    case 'declaracao-hipossuficiencia':
      return CAB +
        `# DECLARAÇÃO DE HIPOSSUFICIÊNCIA\n\n` +
        `Eu, ${ident(d)}, **DECLARO**, com base no artigo 5º, inciso LXXIV da CF/88 c/c art. 98 do CPC/2015 que não posso arcar com o pagamento de custas e demais despesas processuais sem o prejuízo do meu próprio sustento e de minha família, responsabilizando-me integralmente pelo conteúdo da presente declaração.\n\n` +
        `${local}.\n\n---\n\n___________________________________________\n**${d.nome_completo}**\n`;

    case 'contrato-honorarios': {
      const perc = d.percentual_honorarios || '40';
      const percExtenso = perc === '20' ? 'vinte' : perc === '30' ? 'trinta' : perc === '50' ? 'cinquenta' : 'quarenta';
      return CAB +
        `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS E HONORÁRIOS ADVOCATÍCIOS\n\n` +
        `**CONTRATANTE:** ${ident(d)}.\n\n` +
        `**CONTRATADOS:** BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA, OAB/AM n° 115/2016, CNPJ n° 29.516.950/0001-55, Rua Salvador, 120, sala 708, Vieiralves Business Center, Adrianópolis, Manaus/AM, através de **ANDREY AUGUSTO BENTES RAMOS**, OAB/AM 7.526, juridico@bentesramos.adv.br, (92) 3343-6173 / 99160-4348.\n\n` +
        `## CLÁUSULA 1ª – DO OBJETO\n\n` +
        `Prestação de serviços advocatícios para ajuizamento de **AÇÃO JUDICIAL** em face de **${d.reu}**, referente ao contrato **${d.contrato_reu}**.\n\n` +
        `## CLÁUSULA 2ª – DAS OBRIGAÇÕES\n\n` +
        `O CONTRATANTE autoriza contato pelo telefone **${d.telefone_contato}**.\n\n` +
        `## CLÁUSULA 3ª – DA REMUNERAÇÃO\n\n` +
        `Honorários de êxito: **${perc}% (${percExtenso} por cento)** sobre o valor da condenação. **Sem êxito, nada será devido.**\n\n` +
        `## CLÁUSULA 8ª – ORIENTAÇÃO SOBRE GOLPE DO FALSO ADVOGADO\n\n` +
        `O CONTRATANTE declara que foi orientado sobre práticas fraudulentas de terceiros. Confirmar qualquer pagamento pelos canais oficiais: (92) 3343-6173 / 99160-4348 / 98223-7330.\n\n` +
        `## CLÁUSULA 9ª – LGPD\n\n` +
        `O CONTRATANTE consente com coleta e tratamento de dados para fins deste contrato.\n\n` +
        `${local}.\n\n` +
        `---\n\n___________________________________________\n**${d.nome_completo} - CONTRATANTE**\n\n` +
        `---\n\n___________________________________________\n**ANDREY AUGUSTO BENTES RAMOS - CONTRATADO**\nOAB/AM 7.526\n\n` +
        `Testemunhas:\n\n___________________________________________\n\n___________________________________________\n`;
    }

    case 'procuracao':
      return CAB +
        `# INSTRUMENTO DE PROCURAÇÃO *"AD JUDICIA ET EXTRA"*\n\n` +
        `**OUTORGANTE:** ${ident(d)}.\n\n` +
        `**OUTORGADO:** Advogados do escritório **BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA**, OAB/AM 115/2016, CNPJ 29.516.950/0001-55, Rua Salvador 120, sala 708, Vieiralves Business Center, Adrianópolis, Manaus/AM. Advogados: **ANDREY AUGUSTO BENTES RAMOS** (OAB/AM 7.526) e **GUSTAVO DA SILVA GRILLO** (OAB/AM 7.883).\n\n` +
        `**PODERES:** Poderes "ad judicia et extra" para defender os interesses do outorgante em qualquer Juízo, Instância ou Tribunal, com **PODERES ESPECIAIS** para confessar, desistir, transigir, firmar acordos, receber e dar quitação, pedir Justiça Gratuita, **para o fim de ingressar com ação judicial em face de ${d.reu}, referente ao contrato ${d.contrato_reu}.**\n\n` +
        `**LGPD:** O OUTORGANTE consente com o uso dos dados para propositura de demanda judicial.\n\n` +
        `**Golpe do Falso Advogado:** O OUTORGANTE declara estar ciente de que não deve realizar pagamentos sem confirmação pelos canais oficiais do escritório.\n\n` +
        `${local}.\n\n---\n\n___________________________________________\n**${d.nome_completo}**\n`;

    default:
      return `# Documento\n\nConteúdo não disponível para template: ${templateKey}`;
  }
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
