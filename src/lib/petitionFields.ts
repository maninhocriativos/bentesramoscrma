// Geração dinâmica dos campos do formulário de petição a partir dos {{marcadores}}
// do próprio template .docx. Assim cada modelo coleta exatamente o que precisa,
// sem configuração manual por tipo de ação.

import {
  User, MapPin, Building2, FileText, Scale, DollarSign, CheckCircle2, List, Image as ImageIcon,
} from 'lucide-react';

export const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];
export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
export const ANOS = Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() - i));
export const BANCOS = [
  'Banco do Brasil','Bradesco','Itaú Unibanco','Caixa Econômica Federal','Santander',
  'Banco Safra','Banco Inter','Nubank','C6 Bank','Banco PAN','Banco BMG','Banrisul',
  'Banco do Nordeste','Banco da Amazônia','Sicoob','Sicredi','Agibank','Banco Cetelem',
  'Banco Crefisa','PicPay','Will Bank','Facta Financeira','Banco Itaú Consignado',
  'Banco Daycoval','Banco Mercantil','Outro',
];

// CNPJ dos bancos réus mais comuns (dado público). Preenche automaticamente ao
// selecionar o banco. ⚠️ Conferir sempre — o advogado revisa antes de protocolar.
// Bancos sem entrada aqui ficam em preenchimento manual.
export const BANCO_CNPJ: Record<string, string> = {
  'Banco do Brasil':          '00.000.000/0001-91',
  'Caixa Econômica Federal':  '00.360.305/0001-04',
  'Bradesco':                 '60.746.948/0001-12',
  'Itaú Unibanco':            '60.701.190/0001-04',
  'Santander':                '90.400.888/0001-42',
  'Banco Safra':              '58.160.789/0001-28',
  'Banco BMG':                '61.186.680/0001-74',
  'Banco PAN':                '59.285.411/0001-13',
  'Banco Inter':              '00.416.968/0001-01',
  'Nubank':                   '18.236.120/0001-58',
  'Banrisul':                 '92.702.067/0001-96',
  'Banco do Nordeste':        '07.237.373/0001-20',
  'Banco da Amazônia':        '04.902.979/0001-44',
  'Banco Mercantil':          '17.184.037/0001-10',
  'Banco Daycoval':           '62.232.889/0001-82',
  'C6 Bank':                  '31.872.495/0001-72',
  'Facta Financeira':         '15.581.638/0001-30',
};

// Endereço da sede dos bancos réus mais comuns (dado público, registrado no CNPJ).
// Preenche automaticamente ao selecionar o banco. ⚠️ Conferir sempre — endereço de
// sede é usado para citação, um dado desatualizado pode prejudicar o processo.
// Lista deliberadamente parcial: só entram bancos com endereço de sede bem
// conhecido/estável; os demais ficam em preenchimento manual em vez de arriscar
// um endereço errado.
export const BANCO_ENDERECO: Record<string, { endereco: string; cep: string }> = {
  'Banco do Brasil':         { endereco: 'SAUN Quadra 5, Lote B, Torre I, Asa Norte, Brasília/DF', cep: '70040-912' },
  'Caixa Econômica Federal': { endereco: 'SBS Quadra 4, Lotes 3/4, Asa Sul, Brasília/DF', cep: '70092-900' },
  'Bradesco':                { endereco: 'Cidade de Deus, s/n, Vila Yara, Osasco/SP', cep: '06029-900' },
  'Itaú Unibanco':           { endereco: 'Praça Alfredo Egydio de Souza Aranha, 100, Torre Itaúsa, Jabaquara, São Paulo/SP', cep: '04344-902' },
  'Santander':               { endereco: 'Av. Presidente Juscelino Kubitschek, 2041/2235, Vila Olímpia, São Paulo/SP', cep: '04543-011' },
  'Banrisul':                { endereco: 'Rua Capitão Montanha, 177, Centro Histórico, Porto Alegre/RS', cep: '90010-040' },
  'Banco do Nordeste':       { endereco: 'Av. Dr. Silas Munguba, 5700, Passaré, Fortaleza/CE', cep: '60743-902' },
  'Banco da Amazônia':       { endereco: 'Av. Presidente Vargas, 800, Campina, Belém/PA', cep: '66017-901' },
  'C6 Bank':                 { endereco: 'Av. Nove de Julho, 3229, Jardim Paulista, São Paulo/SP', cep: '01407-000' },
};

// Nacionalidades (com opção de digitar outra).
export const NACIONALIDADES = ['brasileiro(a)', 'brasileiro', 'brasileira', 'naturalizado(a) brasileiro(a)', 'estrangeiro(a)'];

// Gentílicos por estado (naturalidade) — o usuário pode digitar cidade/adjetivo próprio.
export const NATURALIDADES = [
  'acriano(a)', 'alagoano(a)', 'amapaense', 'amazonense', 'baiano(a)', 'cearense', 'brasiliense',
  'capixaba', 'goiano(a)', 'maranhense', 'mato-grossense', 'sul-mato-grossense', 'mineiro(a)',
  'paraense', 'paraibano(a)', 'paranaense', 'pernambucano(a)', 'piauiense', 'fluminense', 'carioca',
  'potiguar', 'gaúcho(a)', 'rondoniense', 'roraimense', 'catarinense', 'paulista', 'paulistano(a)',
  'sergipano(a)', 'tocantinense',
];

// Profissões mais frequentes no público do escritório (lista sugerida, editável).
export const PROFISSOES = [
  'aposentado(a)', 'pensionista', 'aposentado(a) por invalidez', 'servidor(a) público(a)',
  'funcionário(a) público(a)', 'autônomo(a)', 'do lar', 'agricultor(a)', 'lavrador(a)',
  'comerciante', 'microempreendedor(a) individual', 'empresário(a)', 'professor(a)', 'motorista',
  'pedreiro(a)', 'doméstica', 'diarista', 'vendedor(a)', 'costureira', 'cozinheiro(a)',
  'mecânico(a)', 'eletricista', 'pintor(a)', 'porteiro(a)', 'vigilante', 'militar',
  'enfermeiro(a)', 'técnico(a) de enfermagem', 'auxiliar administrativo(a)', 'balconista',
  'policial militar', 'policial civil', 'bombeiro(a) militar', 'motorista de aplicativo',
  'motorista de ônibus', 'motorista de caminhão', 'taxista', 'mototaxista', 'entregador(a)',
  'pescador(a)', 'pecuarista', 'garimpeiro(a)', 'artesão(ã)', 'feirante', 'ambulante',
  'zelador(a)', 'jardineiro(a)', 'faxineiro(a)', 'cuidador(a) de idosos', 'babá',
  'cabeleireiro(a)', 'manicure', 'esteticista', 'barbeiro', 'padeiro(a)', 'açougueiro(a)',
  'garçom/garçonete', 'auxiliar de cozinha', 'auxiliar de limpeza', 'operador(a) de caixa',
  'estoquista', 'operador(a) de produção', 'auxiliar de produção', 'soldador(a)', 'marceneiro(a)',
  'serralheiro(a)', 'encanador(a)', 'técnico(a) em refrigeração', 'técnico(a) em informática',
  'auxiliar de escritório', 'recepcionista', 'secretário(a)', 'corretor(a) de imóveis',
  'corretor(a) de seguros', 'contador(a)', 'advogado(a)', 'engenheiro(a)', 'arquiteto(a)',
  'médico(a)', 'dentista', 'fisioterapeuta', 'psicólogo(a)', 'nutricionista', 'farmacêutico(a)',
  'assistente social', 'bancário(a)', 'analista administrativo(a)', 'supervisor(a)',
  'gerente', 'consultor(a)', 'programador(a)', 'designer', 'jornalista', 'estudante',
  'desempregado(a)', 'trabalhador(a) rural', 'seringueiro(a)', 'ribeirinho(a)', 'indígena',
];

export interface FieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  // 'autocomplete' = input com sugestões (datalist) que permite digitar valor livre.
  type?: 'text' | 'select' | 'textarea' | 'date' | 'autocomplete';
  options?: string[];
  span?: 'full' | 'half';
  hint?: string;
  // Campo que não bloqueia avançar/gerar mesmo vazio (ex: RG — muita gente só tem
  // o CPF como documento hoje em dia).
  optional?: boolean;
}

export interface StepConfig {
  id: number;
  title: string;
  icon: React.ElementType;
  fields: FieldConfig[];
}

type DictEntry = Omit<FieldConfig, 'key'> & { group: string };

// Dicionário de campos conhecidos: rótulo, tipo e grupo (etapa) de cada marcador.
const FIELD_DICT: Record<string, DictEntry> = {
  // ── Processo ──
  vara_juizo:      { label: 'Vara / Juízo', placeholder: '1ª Vara Cível e de Acidentes de Trabalho da Comarca de Manaus/AM', span: 'full', group: 'Processo' },
  cidade_peticao:  { label: 'Cidade/UF da Petição (assinatura)', placeholder: 'Manaus/AM', group: 'Processo', hint: 'Cidade que aparece no fecho, antes da data (geralmente a mesma comarca da Vara).' },
  nome_estagiario: { label: 'Nome do Estagiário (assinatura)', placeholder: 'Nome conforme petição', group: 'Processo' },

  // ── Cliente ──
  nome_maiusculo:  { label: 'Nome Completo (MAIÚSCULAS)', placeholder: 'NOME CONFORME DOCUMENTOS', span: 'full', group: 'Cliente' },
  nome_completo:   { label: 'Nome Completo (normal)', placeholder: 'Nome conforme documentos', span: 'full', group: 'Cliente' },
  cpf:             { label: 'CPF', placeholder: '000.000.000-00', group: 'Cliente' },
  rg:              { label: 'RG', placeholder: '0000000-0 SSP/AM', group: 'Cliente', optional: true, hint: 'Opcional — o CPF já vale como documento; preencha se o cliente tiver RG.' },
  estado_civil:    { label: 'Estado Civil', type: 'select', options: ESTADOS_CIVIS, group: 'Cliente' },
  profissao:       { label: 'Profissão', type: 'autocomplete', options: PROFISSOES, placeholder: 'Ex: aposentado(a)', group: 'Cliente' },
  nacionalidade:   { label: 'Nacionalidade', type: 'autocomplete', options: NACIONALIDADES, placeholder: 'brasileiro(a)', group: 'Cliente' },
  naturalidade:    { label: 'Naturalidade', type: 'autocomplete', options: NATURALIDADES, placeholder: 'amazonense', group: 'Cliente' },
  idade_numerica:  { label: 'Idade (número)', placeholder: '68', group: 'Cliente' },
  diagnostico_prioridade: { label: 'Diagnóstico (prioridade de tramitação)', placeholder: 'Ex: Transtorno do Espectro Autista — TEA', span: 'full', group: 'Cliente', optional: true, hint: 'Só preencha se o processo pedir prioridade por doença/deficiência.' },

  // ── Representante legal (menor/incapaz) ──
  representante_legal_qualificacao:  { label: 'Qualificação do Representante', placeholder: 'sua genitora', group: 'Cliente', optional: true, hint: 'Só se o autor for menor/incapaz representado por terceiro.' },
  representante_legal_nome:          { label: 'Nome do Representante Legal', placeholder: 'Nome completo', span: 'full', group: 'Cliente', optional: true },
  representante_legal_nacionalidade: { label: 'Nacionalidade do Representante', type: 'autocomplete', options: NACIONALIDADES, group: 'Cliente', optional: true },
  representante_legal_naturalidade:  { label: 'Naturalidade do Representante', type: 'autocomplete', options: NATURALIDADES, group: 'Cliente', optional: true },
  representante_legal_estado_civil:  { label: 'Estado Civil do Representante', type: 'select', options: ESTADOS_CIVIS, group: 'Cliente', optional: true },

  // ── Endereço ──
  endereco_rua:         { label: 'Rua', placeholder: 'Rua das Flores', span: 'full', group: 'Endereço' },
  endereco_numero:      { label: 'Número', placeholder: '123', group: 'Endereço' },
  endereco_complemento: { label: 'Complemento', placeholder: 'Apto 10', group: 'Endereço' },
  endereco_bairro:      { label: 'Bairro', placeholder: 'Centro', group: 'Endereço' },
  endereco_cidade:      { label: 'Cidade', placeholder: 'Manaus', group: 'Endereço' },
  endereco_uf:          { label: 'UF', type: 'select', options: UFS, group: 'Endereço' },
  endereco_cep:         { label: 'CEP', placeholder: '69.000-000', group: 'Endereço' },

  // ── Banco (convenção antiga, ainda usada por modelos legados) ──
  banco_nome:     { label: 'Banco Réu', type: 'select', options: BANCOS, span: 'full', group: 'Banco' },
  banco_cnpj:     { label: 'CNPJ do Banco', placeholder: '00.000.000/0001-00', group: 'Banco' },
  banco_endereco: { label: 'Endereço do Banco', placeholder: 'Av. Paulista, nº 100, São Paulo/SP', span: 'full', group: 'Banco' },
  banco_cep:      { label: 'CEP do Banco', placeholder: '00.000-000', group: 'Banco' },

  // ── Réu (convenção nova, genérica p/ banco OU seguradora — CNPJ/endereço
  // preenchidos manualmente, sem autofill, conforme decisão do usuário) ──
  reu_nome:     { label: 'Nome do Réu', placeholder: 'Banco/Seguradora S/A', span: 'full', group: 'Réu' },
  reu_cnpj:     { label: 'CNPJ do Réu', placeholder: '00.000.000/0001-00', group: 'Réu' },
  reu_endereco: { label: 'Endereço do Réu', placeholder: 'Av. Paulista, nº 100, São Paulo/SP', span: 'full', group: 'Réu' },

  // ── Contrato ──
  numero_contrato:   { label: 'Número do Contrato', placeholder: '91507432', group: 'Contrato' },
  mes_contratacao:   { label: 'Mês da Contratação', type: 'select', options: MESES, group: 'Contrato' },
  ano_contratacao:   { label: 'Ano da Contratação', type: 'select', options: ANOS, group: 'Contrato' },
  data_contratacao:  { label: 'Data da Contratação', placeholder: 'janeiro de 2024', group: 'Contrato' },
  num_parcelas:      { label: 'Nº de Parcelas', placeholder: '84', group: 'Contrato' },
  valor_emprestimo:  { label: 'Valor do Empréstimo (R$)', placeholder: '1.286,33', group: 'Contrato' },
  valor_parcela:     { label: 'Valor da Parcela (R$)', placeholder: '29,10', group: 'Contrato' },
  valor_total_contrato: { label: 'Valor Total do Contrato (R$)', placeholder: '2.444,40', group: 'Contrato' },
  valor_seguro:      { label: 'Valor do Seguro/Prestamista (R$)', placeholder: '207,79', group: 'Contrato' },
  valor_encargos:    { label: 'Valor dos Encargos (R$)', placeholder: '97,63', group: 'Contrato' },
  nome_produto:      { label: 'Nome do Produto Vendido Casado', placeholder: 'Seguro / Pacote de Benefícios', hint: 'Como o contrato chama o produto embutido no empréstimo.', group: 'Contrato' },
  valor_credito_liquido: { label: 'Crédito Líquido Disponibilizado (R$)', placeholder: '1.620,05', group: 'Contrato' },
  valor_saldo_devedor:   { label: 'Valor do Saldo Devedor (R$)', placeholder: '3.494,05', group: 'Contrato' },
  valor_iof:             { label: 'Valor do IOF (R$)', placeholder: '57,09', group: 'Contrato' },
  valor_tributos:        { label: 'Valor dos Tributos (R$)', placeholder: '37,99', group: 'Contrato' },
  valor_total_emprestimo: { label: 'Valor Total do Empréstimo (R$)', placeholder: '1.804,74', group: 'Contrato' },
  valor_seguro_total:    { label: 'Total do Seguro (soma dos contratos) (R$)', placeholder: '444,58', hint: 'Some o valor do seguro de todos os contratos — o dobro é calculado automaticamente.', group: 'Contrato' },
  numero_beneficio_inss:       { label: 'Nº Benefício INSS', placeholder: '999.999.999-9', group: 'Contrato' },
  codigo_contrato_rcc:         { label: 'Código do Contrato (RCC)', placeholder: 'EMPRÉSTIMO SOBRE A RCC – CÓDIGO 000', span: 'full', group: 'Contrato' },
  codigo_contrato_rmc:         { label: 'Código do Contrato (RMC)', placeholder: 'EMPRÉSTIMO SOBRE A RMC – CÓDIGO 000', span: 'full', group: 'Contrato' },
  codigo_rubrica_consignacao:  { label: 'Código da Rubrica de Consignação', placeholder: 'CONSIGNAÇÃO – CARTÃO', span: 'full', group: 'Contrato' },
  numero_apolice:              { label: 'Número da Apólice', placeholder: '868678307230000900330006', span: 'full', group: 'Contrato' },

  // ── Descontos (RMC/RCC) ──
  mes_inicio_desconto:  { label: 'Mês Início Desconto', type: 'select', options: MESES, group: 'Descontos' },
  ano_inicio_desconto:  { label: 'Ano Início Desconto', type: 'select', options: ANOS, group: 'Descontos' },
  mes_quitacao:         { label: 'Mês Quitação', type: 'select', options: MESES, group: 'Descontos' },
  ano_quitacao:         { label: 'Ano Quitação', type: 'select', options: ANOS, group: 'Descontos' },
  mes_ultimo_desconto:  { label: 'Mês Último Desconto', type: 'select', options: MESES, group: 'Descontos' },
  ano_ultimo_desconto:  { label: 'Ano Último Desconto', type: 'select', options: ANOS, group: 'Descontos' },
  periodo_descontos_indevidos: { label: 'Período Descontos Indevidos', placeholder: 'dezembro de 2024 a fevereiro de 2026', span: 'full', group: 'Descontos' },
  num_parcelas_descontadas:    { label: 'Nº Parcelas Descontadas', placeholder: '39', group: 'Descontos' },
  valor_total_descontado:      { label: 'Total Descontado (R$)', placeholder: '3.436,86', group: 'Descontos' },
  valor_descontos_indevidos:   { label: 'Descontos Indevidos (R$)', placeholder: '1.317,90', group: 'Descontos' },
  data_inicio_descontos:            { label: 'Início dos Descontos', placeholder: 'fevereiro de 2024', group: 'Descontos' },
  data_termino_previsto:            { label: 'Término Previsto do Contrato', placeholder: 'fevereiro de 2025', group: 'Descontos' },
  data_fim_apuracao:                { label: 'Fim do Período de Apuração', placeholder: 'julho de 2026', group: 'Descontos' },
  num_parcelas_pagas_total:         { label: 'Nº Parcelas Pagas (total)', placeholder: '20', group: 'Descontos' },
  valor_total_pago_ate_ajuizamento: { label: 'Total Pago até o Ajuizamento (R$)', placeholder: '2.000,00', group: 'Descontos' },
  periodo_indevido_inicio:          { label: 'Início do Período Indevido', placeholder: 'março de 2025', group: 'Descontos' },
  periodo_indevido_fim:             { label: 'Fim do Período Indevido', placeholder: 'julho de 2026', group: 'Descontos' },

  // ── Pedidos / Valores ──
  valor_seguro_dobro:  { label: 'Seguro em Dobro (R$)', placeholder: '415,58', group: 'Valores' },
  valor_devolucao:     { label: 'Valor Devolução (R$)', placeholder: '2.635,80', group: 'Valores' },
  valor_danos_morais:  { label: 'Danos Morais (R$)', placeholder: '10.000,00', group: 'Valores' },
  valor_causa:         { label: 'Valor da Causa (R$)', placeholder: '10.415,58', group: 'Valores' },
  valor_renda_familiar: { label: 'Renda Familiar (R$)', placeholder: '2.000,00', group: 'Valores' },
  multa_diaria_cancelamento_apolice: { label: 'Multa Diária — Cancelamento de Apólice (R$)', placeholder: '500,00', group: 'Valores' },
  multa_diaria_exibicao_documentos:  { label: 'Multa Diária — Exibição de Documentos (R$)', placeholder: '300,00', group: 'Valores' },
  data_peticao:        { label: 'Data da Petição', placeholder: '03 de junho de 2026', span: 'full', hint: 'Ex: 03 de junho de 2026', group: 'Valores' },
};

const GROUP_ORDER = ['Processo', 'Cliente', 'Endereço', 'Réu', 'Banco', 'Contrato', 'Descontos', 'Valores', 'Outros'];
const GROUP_ICON: Record<string, React.ElementType> = {
  'Processo': Scale, 'Cliente': User, 'Endereço': MapPin, 'Réu': Building2, 'Banco': Building2, 'Contrato': FileText,
  'Descontos': Scale, 'Valores': DollarSign, 'Outros': List,
};

function humanize(key: string): string {
  const s = key.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Normaliza a chave do marcador para a chave do formulário: sempre minúscula,
// independente de como o autor do .docx escreveu o {{MARCADOR}}. Sem isso, um
// template com {{NOME_COMPLETO}} (maiúsculo) não batia com o dicionário de campos
// (que só tem "nome_completo") e virava um campo genérico sem label nem alias —
// o valor digitado ficava "preso" na chave maiúscula e nunca chegava ao merge
// final, que só lê a partir da chave minúscula (ver buildTemplateData).
// Ex.: {{data_petição}} (com cedilha) e {{data_peticao}} são o mesmo campo.
export function normalizeKey(key: string): string {
  const lower = key.trim().toLowerCase();
  if (lower === 'data_petição') return 'data_peticao';
  return lower;
}

/**
 * Monta as etapas do formulário a partir dos marcadores {{...}} do template.
 * Ignora os campos "por extenso" (gerados automaticamente). Sempre acrescenta
 * a etapa final de "Revisão".
 */
export function buildDynamicSteps(placeholders: string[], temPrint = false): StepConfig[] {
  const seen = new Set<string>();
  const porGrupo: Record<string, FieldConfig[]> = {};

  for (const raw of placeholders) {
    const key = normalizeKey(raw);
    if (!key || key.endsWith('_extenso')) continue; // extenso é automático
    if (seen.has(key)) continue;
    seen.add(key);

    // Modelos com múltiplos contratos (ex.: 2 empréstimos venda casada, ou os
    // 3 do Paraná Banco) usam sufixo numérico (numero_contrato_1, valor_seguro_2,
    // ...) pra repetir o mesmo conceito de campo por contrato, e valores somados
    // podem levar "_dobro" (valor_seguro_total_dobro, calculado por autoDobro).
    // Em vez de duplicar cada entrada no FIELD_DICT pra cada combinação, resolve
    // a chave "base" (sem esses sufixos) e reaproveita o rótulo dela.
    let chaveBase = key;
    let ehDobro = false;
    if (chaveBase.endsWith('_dobro')) { ehDobro = true; chaveBase = chaveBase.slice(0, -'_dobro'.length); }
    const matchNumerado = chaveBase.match(/^(.+)_(\d+)$/);
    const numeroContrato = matchNumerado ? matchNumerado[2] : null;
    if (matchNumerado) chaveBase = matchNumerado[1];

    const dict = FIELD_DICT[key] ?? FIELD_DICT[chaveBase];
    const group = dict?.group ?? 'Outros';
    let label = dict?.label ?? humanize(key);
    if (dict) {
      if (ehDobro) label = `${label} — em Dobro`;
      if (numeroContrato) label = `${label} (Contrato ${numeroContrato})`;
    }
    const field: FieldConfig = dict
      ? { key, label, placeholder: dict.placeholder, type: dict.type, options: dict.options, span: dict.span, hint: dict.hint, optional: dict.optional }
      : { key, label };

    (porGrupo[group] ??= []).push(field);
  }

  const steps: StepConfig[] = [];
  let id = 1;
  for (const group of GROUP_ORDER) {
    const fields = porGrupo[group];
    if (fields && fields.length) {
      steps.push({ id: id++, title: group, icon: GROUP_ICON[group] ?? List, fields });
    }
  }

  // Etapa dedicada para anexar o print do contrato (só quando o modelo tem imagem no corpo).
  if (temPrint) {
    steps.push({ id: id++, title: 'Print', icon: ImageIcon, fields: [] });
  }

  // Etapa final de revisão (o resumo e o botão de gerar são renderizados na página).
  steps.push({ id: id++, title: 'Revisão', icon: CheckCircle2, fields: [] });
  return steps;
}
