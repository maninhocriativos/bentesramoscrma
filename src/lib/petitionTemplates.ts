// Registry of pre-built petition templates organized by type

export interface PetitionTemplate {
  id: string;
  title: string;
  description: string;
  typeSlug: string;
  filePath: string;
  fileType: 'docx' | 'doc';
  tags: string[];
  acaoTitulo: string;
}

export const PETITION_TEMPLATES: PetitionTemplate[] = [
  // === Empréstimo Não Reconhecido ===
  {
    id: 'servidor-publico-emprestimo',
    title: 'Servidor Público – Matrícula A',
    description: 'Ação Declaratória de Inexistência de Débito c/c Indenização por Danos Morais e Materiais - Desconto em folha não autorizado (servidor público municipal)',
    typeSlug: 'emprestimo_nao_reconhecido',
    filePath: '/templates/servidor-publico-emprestimo-nao-reconhecido.docx',
    fileType: 'docx',
    tags: ['Servidor Público', 'Matrícula', 'Desconto em Folha'],
    acaoTitulo: 'Ação Declaratória de Inexistência de Débito c/c Indenização por Danos Morais e Materiais com Pedido de Liminar',
  },
  {
    id: 'servidor-aposentado-idoso',
    title: 'Servidor Aposentado Idoso – Matrícula B',
    description: 'Ação Declaratória de Inexistência de Débito c/c Indenização - Servidor aposentado idoso com pedido de tramitação preferencial',
    typeSlug: 'emprestimo_nao_reconhecido',
    filePath: '/templates/servidor-aposentado-idoso-emprestimo.docx',
    fileType: 'docx',
    tags: ['Servidor Aposentado', 'Idoso', 'Tramitação Preferencial'],
    acaoTitulo: 'Ação Declaratória de Inexistência de Débito c/c Indenização por Danos Morais e Materiais com Pedido de Liminar',
  },

  // === Empréstimo Fraudulento ===
  {
    id: 'emprestimo-fraudulento-inss',
    title: 'Empréstimo Fraudulento – INSS',
    description: 'Ação Declaratória de Inexistência de Débito - Empréstimo consignado fraudulento em benefício INSS (idoso)',
    typeSlug: 'emprestimo_fraudulento',
    filePath: '/templates/emprestimo-fraudulento-inss.docx',
    fileType: 'docx',
    tags: ['INSS', 'Idoso', 'Consignado Fraudulento'],
    acaoTitulo: 'Ação Declaratória de Inexistência de Débito c/c Indenização por Danos Morais e Materiais com Pedido de Liminar',
  },

  // === Renovação de Empréstimo ===
  {
    id: 'renovacao-emprestimo-inss',
    title: 'Renovação Fraudulenta – INSS',
    description: 'Ação contra renovação não autorizada de empréstimo consignado em benefício INSS (idoso)',
    typeSlug: 'renovacao_emprestimo',
    filePath: '/templates/renovacao-emprestimo-fraudulento-inss.docx',
    fileType: 'docx',
    tags: ['INSS', 'Idoso', 'Renovação Não Autorizada'],
    acaoTitulo: 'Ação Declaratória de Inexistência de Débito c/c Indenização por Danos Morais e Materiais com Pedido de Liminar',
  },

  // === RMC / RCC ===
  {
    id: 'rmc-idoso-inss',
    title: 'RMC – Idoso INSS',
    description: 'Ação Declaratória de Inexistência de Débito - Reserva de Margem Consignável não autorizada em benefício INSS (idoso)',
    typeSlug: 'rmc_rcc',
    filePath: '/templates/idoso-inss-rmc.docx',
    fileType: 'docx',
    tags: ['INSS', 'Idoso', 'RMC', 'Tramitação Preferencial'],
    acaoTitulo: 'Ação Declaratória de Inexistência de Débito c/c Indenização por Danos Morais e Materiais com Pedido de Liminar',
  },

  // === Vendas Casadas ===
  {
    id: 'venda-casada-inss',
    title: 'Venda Casada – INSS (Idoso)',
    description: 'Ação de Indenização por Danos Morais c/c Repetição de Indébito - Seguro vinculado a empréstimo consignado INSS',
    typeSlug: 'vendas_casadas',
    filePath: '/templates/venda-casada-inss.doc',
    fileType: 'doc',
    tags: ['INSS', 'Idoso', 'Seguro Vinculado'],
    acaoTitulo: 'Ação de Indenização por Danos Morais c/c Pedido de Repetição de Indébito',
  },
  {
    id: 'venda-casada-geral',
    title: 'Venda Casada – Geral',
    description: 'Ação de Indenização por Danos Morais c/c Repetição de Indébito - Seguro vinculado a empréstimo consignado',
    typeSlug: 'vendas_casadas',
    filePath: '/templates/venda-casada.doc',
    fileType: 'doc',
    tags: ['Servidor Público', 'Seguro Vinculado'],
    acaoTitulo: 'Ação de Indenização por Danos Morais c/c Pedido de Repetição de Indébito',
  },

  // === Seguro Não Contratado ===
  {
    id: 'seguro-nao-contratado',
    title: 'Seguro Não Contratado',
    description: 'Ação Declaratória de Inexistência de Débito c/c Repetição de Indébito - Seguro Mais Proteção não contratado',
    typeSlug: 'seguro_nao_contratado',
    filePath: '/templates/seguro-nao-contratado.doc',
    fileType: 'doc',
    tags: ['Seguro', 'Policial Militar', 'Repetição de Indébito'],
    acaoTitulo: 'Ação Declaratória de Inexistência de Débito c/c Repetição de Indébito c/c Reparação por Danos Morais',
  },

  // === Tarifa Bancária ===
  {
    id: 'tarifa-bancaria',
    title: 'Tarifa Bancária Indevida',
    description: 'Ação de Repetição de Indébito c/c Reparação por Danos Morais - Cobrança indevida de tarifas bancárias',
    typeSlug: 'tarifa_bancaria',
    filePath: '/templates/tarifa-bancaria.doc',
    fileType: 'doc',
    tags: ['Tarifa', 'Repetição de Indébito', 'Tutela de Urgência'],
    acaoTitulo: 'Ação de Repetição de Indébito c/c Reparação por Danos Morais c/c Pedido de Antecipação de Tutela',
  },

  // === Cancelamento de Voo ===
  {
    id: 'cancelamento-voo',
    title: 'Cancelamento de Voo',
    description: 'Ação de Reparação por Danos Morais - Cancelamento/atraso de voo (Juizado Especial)',
    typeSlug: 'cancelamento_voo',
    filePath: '/templates/cancelamento-voo.docx',
    fileType: 'docx',
    tags: ['Aéreo', 'Juizado Especial', 'Danos Morais'],
    acaoTitulo: 'Ação de Reparação por Danos Morais',
  },
];

export function getTemplatesByType(typeSlug: string): PetitionTemplate[] {
  return PETITION_TEMPLATES.filter(t => t.typeSlug === typeSlug);
}

export function getTemplateById(id: string): PetitionTemplate | undefined {
  return PETITION_TEMPLATES.find(t => t.id === id);
}

export function getTypesWithTemplates(): string[] {
  return [...new Set(PETITION_TEMPLATES.map(t => t.typeSlug))];
}
