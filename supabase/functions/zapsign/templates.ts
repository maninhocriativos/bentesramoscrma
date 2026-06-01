// Definição dos 5 templates do escritório Bentes Ramos
// Variáveis no formato {{NOME_VARIAVEL}}

export interface CampoTemplate {
  id: string;
  label: string;
  placeholder?: string;
  tipo: 'texto' | 'cpf' | 'telefone' | 'area' | 'data';
  obrigatorio: boolean;
  default?: string;
  origem: 'lead' | 'manual' | 'auto'; // lead=do cadastro, manual=usuário digita, auto=gerado
}

export interface TemplateDefinition {
  key: string;
  nome: string;
  campos: CampoTemplate[];
  gerarMarkdown: (dados: Record<string, string>) => string;
}

// ── Campos comuns a todos os templates ──────────────────────────────────────

export const CAMPOS_PESSOAIS: CampoTemplate[] = [
  { id: 'nome_completo',   label: 'Nome Completo',    obrigatorio: true,  tipo: 'texto',  origem: 'lead' },
  { id: 'cpf',             label: 'CPF',              obrigatorio: true,  tipo: 'cpf',    origem: 'lead' },
  { id: 'rg',              label: 'RG',               obrigatorio: true,  tipo: 'texto',  origem: 'manual', placeholder: 'Ex: 0210729-5' },
  { id: 'orgao_rg',        label: 'Órgão Emissor RG', obrigatorio: false, tipo: 'texto',  origem: 'manual', default: 'SSP/AM' },
  { id: 'nacionalidade',   label: 'Nacionalidade',    obrigatorio: false, tipo: 'texto',  origem: 'manual', default: 'brasileiro(a)' },
  { id: 'estado_civil',    label: 'Estado Civil',     obrigatorio: true,  tipo: 'texto',  origem: 'manual', placeholder: 'solteiro(a), casado(a), viúvo(a)...' },
  { id: 'profissao',       label: 'Profissão',        obrigatorio: true,  tipo: 'texto',  origem: 'manual', placeholder: 'aposentado(a), pensionista...' },
  { id: 'endereco',        label: 'Rua/Av.',          obrigatorio: true,  tipo: 'texto',  origem: 'manual', placeholder: 'Ex: Rua Iracema' },
  { id: 'numero_end',      label: 'Número',           obrigatorio: true,  tipo: 'texto',  origem: 'manual' },
  { id: 'bairro',          label: 'Bairro',           obrigatorio: true,  tipo: 'texto',  origem: 'manual' },
  { id: 'cidade_uf',       label: 'Cidade/UF',        obrigatorio: false, tipo: 'texto',  origem: 'manual', default: 'Manaus/AM' },
  { id: 'cep',             label: 'CEP',              obrigatorio: true,  tipo: 'texto',  origem: 'manual', placeholder: 'Ex: 69.048-180' },
];

function hoje(): string {
  const d = new Date();
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function cabecalho(): string {
  return `**BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA**
Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040
(92) 3343-6173 | (92) 98223-7330 / (92) 99160-4348
juridico@bentesramos.adv.br | www.bentesramos.com.br

---
`;
}

// ── TEMPLATE 1: Declaração de Não Contratação ────────────────────────────────

const DECLARACAO_NAO_CONTRATACAO: TemplateDefinition = {
  key: 'declaracao-nao-contratacao',
  nome: 'Declaração de Não Contratação de Empréstimo',
  campos: [
    ...CAMPOS_PESSOAIS,
    { id: 'numeros_contratos', label: 'Números dos Contratos', obrigatorio: true, tipo: 'texto', origem: 'manual', placeholder: 'Ex: 444650908, 448401465 e 445501467' },
    { id: 'banco',             label: 'Banco',                 obrigatorio: true, tipo: 'texto', origem: 'manual', placeholder: 'Ex: Banco BMG S/A' },
    { id: 'numero_beneficio',  label: 'Número do Benefício',   obrigatorio: true, tipo: 'texto', origem: 'manual', placeholder: 'Ex: 100.033.537-0' },
  ],
  gerarMarkdown: (d) => `${cabecalho()}
# DECLARAÇÃO DE NÃO CONTRATAÇÃO DE EMPRÉSTIMO

Eu, **${d.nome_completo}**, ${d.nacionalidade || 'brasileiro(a)'}, ${d.estado_civil}, ${d.profissao}, detentora da cédula de identidade n° ${d.rg} ${d.orgao_rg || 'SSP/AM'} e do CPF n° ${d.cpf}, residente e domiciliada na ${d.endereco}, n° ${d.numero_end}, bairro: ${d.bairro}, ${d.cidade_uf || 'Manaus/AM'}, Cep: ${d.cep}, **DECLARO** para os devidos fins de direito, sob as penas da lei, que as informações prestadas e documentos que apresentei ao escritório jurídico, referente a **NÃO CONTRATAÇÃO DOS EMPRÉSTIMOS ${d.numeros_contratos}**, vinculados ao **${d.banco}**, indevidamente averbados em meu benefício previdenciário n° ${d.numero_beneficio}, são verdadeiras.

${d.cidade_uf || 'Manaus/AM'}, ${hoje()}.

---

___________________________________________
**${d.nome_completo}**
`,
};

// ── TEMPLATE 2: Declaração Falso Advogado ────────────────────────────────────

const DECLARACAO_FALSO_ADVOGADO: TemplateDefinition = {
  key: 'declaracao-falso-advogado',
  nome: 'Declaração de Ciência e Orientação (Golpe do Falso Advogado)',
  campos: [...CAMPOS_PESSOAIS],
  gerarMarkdown: (d) => `${cabecalho()}
# DECLARAÇÃO DE CIÊNCIA E ORIENTAÇÃO
## *(Golpe do "Falso Advogado")*

Eu, **${d.nome_completo}**, ${d.nacionalidade || 'brasileiro(a)'}, ${d.estado_civil}, ${d.profissao}, detentor(a) da cédula de identidade n° ${d.rg} ${d.orgao_rg || 'SSP/AM'} e do CPF n° ${d.cpf}, residente e domiciliado(a) na ${d.endereco}, n° ${d.numero_end}, bairro: ${d.bairro}, ${d.cidade_uf || 'Manaus/AM'}, Cep: ${d.cep}, **declaro** para os devidos fins que, fui informado(a) e orientado(a) pelo escritório **Bentes Ramos Advocacia e Consultoria Jurídica** sobre a existência do golpe conhecido como **"falso advogado"**, no qual terceiros se passam por advogados para solicitar valores, transferências ou dados pessoais.

**Estou ciente de que nenhum advogado do escritório solicita pagamentos, transferências, códigos, senhas ou dados pessoais por números desconhecidos ou não informados previamente.**

Fui orientado(a) de que os únicos meios oficiais de contato do escritório são:

- (92) 99160-4348
- (92) 98223-7330
- (92) 98588-8190
- E-mail institucional: juridico@bentesramos.adv.br

Estou ciente de que qualquer mensagem ou ligação fora desses canais deve ser desconsiderada, devendo eu informar imediatamente ao escritório para providências.

Declaro ainda que recebi todas as orientações de forma clara e compreensível.

${d.cidade_uf || 'Manaus/AM'}, ${hoje()}.

---

___________________________________________
**${d.nome_completo}**
`,
};

// ── TEMPLATE 3: Declaração de Hipossuficiência ───────────────────────────────

const DECLARACAO_HIPOSSUFICIENCIA: TemplateDefinition = {
  key: 'declaracao-hipossuficiencia',
  nome: 'Declaração de Hipossuficiência',
  campos: [...CAMPOS_PESSOAIS],
  gerarMarkdown: (d) => `${cabecalho()}
# DECLARAÇÃO DE HIPOSSUFICIÊNCIA

Eu, **${d.nome_completo}**, ${d.nacionalidade || 'brasileiro(a)'}, ${d.estado_civil}, ${d.profissao}, detentor(a) da cédula de identidade n° ${d.rg} ${d.orgao_rg || 'SSP/AM'} e do CPF n° ${d.cpf}, residente e domiciliado(a) na ${d.endereco}, n° ${d.numero_end}, bairro: ${d.bairro}, ${d.cidade_uf || 'Manaus/AM'}, Cep: ${d.cep}, **DECLARO**, com base no artigo 5º, inciso LXXIV da CF/88 c/c art. 98 do CPC/2015 que não posso arcar com o pagamento de custas e demais despesas processuais sem o prejuízo do meu próprio sustento e de minha família, responsabilizando-me integralmente pelo conteúdo da presente declaração.

${d.cidade_uf || 'Manaus/AM'}, ${hoje()}.

---

___________________________________________
**${d.nome_completo}**
`,
};

// ── TEMPLATE 4: Contrato de Honorários ──────────────────────────────────────

const CONTRATO_HONORARIOS: TemplateDefinition = {
  key: 'contrato-honorarios',
  nome: 'Contrato de Prestação de Serviços Advocatícios e Honorários',
  campos: [
    ...CAMPOS_PESSOAIS,
    { id: 'telefone_contato',      label: 'Telefone para Contato',  obrigatorio: true,  tipo: 'telefone', origem: 'lead', placeholder: 'Ex: (92) 99368-2353' },
    { id: 'reu',                   label: 'Réu / Parte Adversa',    obrigatorio: true,  tipo: 'texto',    origem: 'manual', placeholder: 'Ex: FACTA FINANCEIRA S/A' },
    { id: 'contrato_reu',          label: 'Número do Contrato/Proc',obrigatorio: true,  tipo: 'texto',    origem: 'manual', placeholder: 'Ex: 235084460003' },
    { id: 'percentual_honorarios', label: 'Honorários de Êxito (%)', obrigatorio: false, tipo: 'texto',  origem: 'manual', default: '40' },
  ],
  gerarMarkdown: (d) => `${cabecalho()}
# CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS E HONORÁRIOS ADVOCATÍCIOS

Pelo presente instrumento particular, na melhor forma de direito, as partes abaixo identificadas firmam entre si o presente Contrato de Prestação de Serviços Advocatícios, nos termos do artigo 22 da Lei nº 8.906/94 (Estatuto da Advocacia e da OAB), o qual será regido pelas cláusulas e condições a seguir:

**CONTRATANTE:** ${d.nome_completo}, ${d.nacionalidade || 'brasileiro(a)'}, ${d.estado_civil}, ${d.profissao}, detentor(a) da cédula de identidade n° ${d.rg} ${d.orgao_rg || 'SSP/AM'} e do CPF n° ${d.cpf}, residente e domiciliado(a) na ${d.endereco}, n° ${d.numero_end}, bairro: ${d.bairro}, ${d.cidade_uf || 'Manaus/AM'}, Cep: ${d.cep}.

**CONTRATADOS:** BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA, inscrito na OAB/AM sob o n° 115/2016 e no CNPJ n° 29.516.950/0001-55, com sede a Rua Salvador, n° 120, sala 708, 7° andar – Edifício Vieiralves Business Center, bairro: Adrianópolis, Manaus/AM, Cep.: 69.057-040, através de seu advogado **ANDREY AUGUSTO BENTES RAMOS**, inscrito na OAB/AM 7.526, com endereço eletrônico juridico@bentesramos.adv.br e telefone: (92) 3343-6173 / 99160-4348 / 98223-7330 / 98588-8190.

---

## CLÁUSULA 1ª – DO OBJETO

**1.1.** O presente contrato tem por objeto a prestação de serviços advocatícios pelo(a) CONTRATADO(a), consistentes no ajuizamento e acompanhamento de **AÇÃO JUDICIAL**, em todas as instâncias, com a adoção das medidas judiciais e extrajudiciais necessárias, visando à defesa dos interesses do(a) CONTRATANTE em face de:

> **(a) ${d.reu}, referente ao contrato ${d.contrato_reu}**

Parágrafo único. O(a) CONTRATADO(a) compromete-se a desempenhar os serviços com **zelo, diligência e responsabilidade profissional**, acompanhando o feito em todas as fases e instâncias, até o seu desfecho.

## CLÁUSULA 2ª – DAS OBRIGAÇÕES

**2.1** – O CONTRATADO obriga-se, por consequência do presente contrato, a prestar seus serviços jurídicos em defesa dos direitos do CONTRATANTE, mediante a prática de todos os atos inerentes ao exercício da advocacia.

**2.2** – O CONTRATANTE fica obrigado a fornecer todos os dados, informações e documentos necessários para o bom e fiel desenvolvimento do objeto contratado, declarando por meio do presente a veracidade dos mesmos, comprometendo-se a não faltar com a verdade.

**2.3** - O CONTRATANTE, nesse momento, declarar que as informações a respeito do objeto do contrato poderão ser repassados pelo telefone **${d.telefone_contato}**.

**2.4** – O CONTRATANTE fica obrigado a comparecer em audiências, perícias e demais diligências designadas, que fizer necessária sua presença, desde que previamente informadas.

## CLÁUSULA 3ª – DA REMUNERAÇÃO

**3.1** – Em remuneração aos serviços ora avençados, o CONTRATANTE pagará ao CONTRATADO a verba honorária assim contratada:

**3.1.1** - Ao final da atuação, em caso de êxito do processo ou acordo, além dos valores estabelecidos a título de sucumbência, será devido ao CONTRATADO os honorários no percentual de **${d.percentual_honorarios || '40'}% (${d.percentual_honorarios === '30' ? 'trinta' : d.percentual_honorarios === '20' ? 'vinte' : 'quarenta'} por cento)**, sobre o valor da condenação.

**3.2** – Os valores pactuados neste contrato serão devidos ao CONTRATADO independentemente dos valores eventualmente recebidos a título de sucumbência no processo, os quais se houver, pertencerão ÚNICA e EXCLUSIVAMENTE ao CONTRATADO.

**3.5** - Fica desde já convencionado entre as partes que **caso não haja êxito na ação nada será devido aos contratados – advogado, a título de honorários contratuais.**

## CLÁUSULA 4ª - DO PRAZO DO CONTRATO

**4.1** - O contrato tem validade até o trânsito em julgado do processo – objeto deste instrumento, podendo ser rescindido a qualquer momento sob aviso prévio de 30 dias.

## CLÁUSULA 5ª - DAS DESPESAS E CUSTAS FINAL DO PROCESSO

**5.1** - O CONTRATANTE obriga-se a pagar e/ou imediatamente ressarcir ao CONTRATADO as custas e quaisquer despesas necessárias ao bom e rápido andamento da ação.

**5.2** - O CONTRATANTE declara plena ciência que, se não for o caso de gratuidade de justiça, terá a incumbência de pagamento de todas as custas e sucumbência, no caso de insucesso no processo judicial movido.

## CLÁUSULA 6ª - DA RESCISÃO DO CONTRATO

**6.1.** No caso de rescisão contratual sem justa causa, serão devidos honorários na base de 20% (vinte por cento) sobre o valor da causa.

## CLÁUSULA 7ª - DA LIQUIDEZ DO CONTRATO

**7.1** - O presente contrato consiste em título executivo extrajudicial, nos termos do Art. 784, inc. III do CPC.

## CLÁUSULA 8ª – DA ORIENTAÇÃO SOBRE O GOLPE DO FALSO ADVOGADO

**8.1** – O CONTRATANTE declara que foi devidamente orientado sobre a existência de práticas fraudulentas cometidas por terceiros que se fazem passar por advogados.

**8.2** – O CONTRATANTE se compromete a não realizar qualquer pagamento sem confirmação direta com os advogados do escritório **BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA**.

## CLÁUSULA 9ª - DA OBSERVÂNCIA À LGPD

**9.1** - O CONTRATANTE declara expresso CONSENTIMENTO que o CONTRATADO irá coletar, tratar e compartilhar os dados necessários ao cumprimento do contrato, nos termos da LGPD.

## CLÁUSULA 10ª – DAS DISPOSIÇÕES GERAIS

**10.6** - O meio de comunicação estabelecido para contato será realizado exclusivamente por meio de ligações para o telefone: **(92) 3343-6173, WhatsApp (92) 99160-4348 / 98223-7330 / 98588-8190** e e-mail: juridico@bentesramos.adv.br, em horário comercial (8h-17h) em dias úteis.

**10.8** - As partes elegem o foro da comarca de Manaus/AM para dirimir controvérsias.

E, por assim estarem justos e contratados, assinam este, em duas vias de igual forma teor.

${d.cidade_uf || 'Manaus/AM'}, ${hoje()}.

---

___________________________________________
**${d.nome_completo} - CONTRATANTE**

---

___________________________________________
**ANDREY AUGUSTO BENTES RAMOS - CONTRATADO**
OAB/AM 7.526

Testemunhas:

___________________________________________

___________________________________________
`,
};

// ── TEMPLATE 5: Procuração ────────────────────────────────────────────────────

const PROCURACAO: TemplateDefinition = {
  key: 'procuracao',
  nome: 'Instrumento de Procuração Ad Judicia Et Extra',
  campos: [
    ...CAMPOS_PESSOAIS,
    { id: 'reu',          label: 'Réu / Parte Adversa',   obrigatorio: true, tipo: 'texto', origem: 'manual', placeholder: 'Ex: FACTA FINANCEIRA S/A' },
    { id: 'contrato_reu', label: 'Número do Contrato/Proc',obrigatorio: true, tipo: 'texto', origem: 'manual', placeholder: 'Ex: 235084460003' },
  ],
  gerarMarkdown: (d) => `${cabecalho()}
# INSTRUMENTO DE PROCURAÇÃO *"AD JUDICIA ET EXTRA"*

**OUTORGANTE:** ${d.nome_completo}, ${d.nacionalidade || 'brasileiro(a)'}, ${d.estado_civil}, ${d.profissao}, detentor(a) da cédula de identidade n° ${d.rg} ${d.orgao_rg || 'SSP/AM'} e do CPF n° ${d.cpf}, residente e domiciliado(a) na ${d.endereco}, n° ${d.numero_end}, bairro: ${d.bairro}, ${d.cidade_uf || 'Manaus/AM'}, Cep: ${d.cep}.

Nomeia e constitui seus procuradores os outorgados abaixo qualificados:

**OUTORGADO:** A presente procuração é concedida aos advogados integrantes do escritório **BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA**, inscrito na OAB/AM sob o n° 115/2016 e no CNPJ n° 29.516.950/0001-55, com sede na Rua Salvador, n° 120, sala 708, 7° andar – Edifício Vieiralves Business Center, bairro: Adrianópolis, Manaus/AM, Cep: 69.057-040, que atuará através de seus advogados **ANDREY AUGUSTO BENTES RAMOS**, inscrito na OAB/AM sob o n° 7.526 e **GUSTAVO DA SILVA GRILLO**, inscrito na OAB/AM sob o n° 7.883, ambos com endereço eletrônico juridico@bentesramos.adv.br e telefone: (92) 3343-6173 / 99160-4348 / 98223-7330 / 98588-8190.

**PODERES:** Nos termos do art. 105 do Código de Processo Civil, os contidos na cláusula "ad judicia et extra", para, em nome do outorgante, em qualquer Juízo, Instância ou Tribunal, ou fora deles, defender seus interesses, podendo propor contra quem de direito as ações competentes e defender os interesses da outorgante nas contrárias, seguindo umas e outras, até final decisão, usando dos recursos legais e acompanhando-os, conferindo-lhes, ainda, **PODERES ESPECIAIS** para confessar, desistir, transigir, firmar compromissos ou acordos, receber e dar quitação, receber alvará, reconhecer procedência de pedido, renunciar a direito no qual se funda ação agindo em conjunto ou separadamente, podendo ainda substabelecer esta em outrem, com ou sem reservas de iguais poderes, pedir o benefício da Justiça Gratuita e assinar declaração de hipossuficiência econômica, dando tudo por bom, firme e valioso, **para o fim de ingressar com ação judicial em face de ${d.reu}, referente ao contrato ${d.contrato_reu}.**

**Lei Geral de Proteção de Dados:** Considerando a Lei Geral de Proteção de Dados, o OUTORGANTE declara ter ciência da necessidade dos dados aqui coletados e dá consentimento do uso dos seus dados pelos CONTRATADOS para a finalidade exclusiva de propositura de demanda judicial.

**Declaração de Ciência sobre Tentativas de Fraude ("Golpe do Falso Advogado"):** A OUTORGANTE declara estar ciente de que não deve realizar qualquer pagamento ou transferência bancária em nome de custas, honorários ou qualquer outra finalidade sem prévia confirmação direta com os advogados constituídos nesta procuração. Esta cláusula visa prevenir prejuízos decorrentes do chamado **"golpe do falso advogado"**.

${d.cidade_uf || 'Manaus/AM'}, ${hoje()}.

---

___________________________________________
**${d.nome_completo}**
`,
};

// ── Registro global de templates ─────────────────────────────────────────────

export const ZAPSIGN_TEMPLATES: Record<string, TemplateDefinition> = {
  'declaracao-nao-contratacao':  DECLARACAO_NAO_CONTRATACAO,
  'declaracao-falso-advogado':   DECLARACAO_FALSO_ADVOGADO,
  'declaracao-hipossuficiencia': DECLARACAO_HIPOSSUFICIENCIA,
  'contrato-honorarios':         CONTRATO_HONORARIOS,
  'procuracao':                  PROCURACAO,
};

export function getTemplate(key: string): TemplateDefinition | null {
  return ZAPSIGN_TEMPLATES[key] || null;
}
