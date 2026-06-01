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
  const loc = `${d.cidade_uf || 'Manaus/AM'}, ${hoje()}`;

  switch (templateKey) {

    // ─── DECLARAÇÃO DE NÃO CONTRATAÇÃO ──────────────────────────────────────
    case 'declaracao-nao-contratacao':
      return CAB +
`# DECLARAÇÃO DE NÃO CONTRATAÇÃO DE EMPRÉSTIMO

Eu, ${ident(d)}, **DECLARO** para os devidos fins de direito, sob as penas da lei, que as informações prestadas e documentos que apresentei ao escritório jurídico, referente a **NÃO CONTRATAÇÃO DOS EMPRÉSTIMOS ${d.numeros_contratos}**, vinculados ao **${d.banco}**, indevidamente averbados em meu benefício previdenciário n° ${d.numero_beneficio}, são verdadeiras.

${loc}.

___________________________________________
**${d.nome_completo}**
`;

    // ─── DECLARAÇÃO FALSO ADVOGADO ───────────────────────────────────────────
    case 'declaracao-falso-advogado':
      return CAB +
`# DECLARAÇÃO DE CIÊNCIA E ORIENTAÇÃO
*(Golpe do "Falso Advogado")*

Eu, ${ident(d)}, declaro para os devidos fins que, fui informado(a) e orientado(a) pelo escritório **Bentes Ramos Advocacia e Consultoria Jurídica** sobre a existência do golpe conhecido como **"falso advogado"**, no qual terceiros se passam por advogados para solicitar valores, transferências ou dados pessoais.

**Estou ciente de que nenhum advogado do escritório solicita pagamentos, transferências, códigos, senhas ou dados pessoais por números desconhecidos ou não informados previamente.**

Fui orientado(a) de que os únicos meios oficiais de contato do escritório são:

- (92) 99160-4348;
- (92) 98223-7330;
- (92) 98588-8190
- E-mail institucional: juridico@bentesramos.adv.br

Estou ciente de que qualquer mensagem ou ligação fora desses canais deve ser desconsiderada, devendo eu informar imediatamente ao escritório para providências.

Declaro ainda que recebi todas as orientações de forma clara e compreensível.

${loc}.

___________________________________________
**${d.nome_completo}**
`;

    // ─── DECLARAÇÃO DE HIPOSSUFICIÊNCIA ─────────────────────────────────────
    case 'declaracao-hipossuficiencia':
      return CAB +
`# DECLARAÇÃO DE HIPOSSUFICIÊNCIA

Eu, ${ident(d)}, **DECLARO**, com base no artigo 5º, inciso LXXIV da CF/88 c/c art. 98 do CPC/2015 que não posso arcar com o pagamento de custas e demais despesas processuais sem o prejuízo do meu próprio sustento e de minha família, responsabilizando-me integralmente pelo conteúdo da presente declaração.

${loc}.

___________________________________________
**${d.nome_completo}**
`;

    // ─── CONTRATO DE HONORÁRIOS ──────────────────────────────────────────────
    case 'contrato-honorarios': {
      const perc = d.percentual_honorarios || '40';
      const percExt = perc === '20' ? 'vinte' : perc === '30' ? 'trinta' : perc === '50' ? 'cinquenta' : 'quarenta';
      return CAB +
`# CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS E HONORÁRIOS ADVOCATÍCIOS

Pelo presente instrumento particular, na melhor forma de direito, as partes abaixo identificadas firmam entre si o presente Contrato de Prestação de Serviços Advocatícios, nos termos do artigo 22 da Lei nº 8.906/94 (Estatuto da Advocacia e da OAB), o qual será regido pelas cláusulas e condições a seguir:

**CONTRATANTE:** ${ident(d)}.

**CONTRATADOS:** BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA, inscrito na OAB/AM sob o n° 115/2016 e no CNPJ n° 29.516.950/0001-55, com sede a Rua Salvador, n° 120, sala 708, 7° andar – Edifício Vieiralves Business Center, bairro: Adrianópolis, Manaus/AM, Cep.: 69.057-040, através de seu advogado **ANDREY AUGUSTO BENTES RAMOS**, inscrito na OAB/AM 7.526, com endereço eletrônico juridico@bentesramos.adv.br e telefone: (92) 3343-6173 / 99160-4348 / 98223-7330 / 98588-8190.

## CLÁUSULA 1ª – DO OBJETO

**1.1.** O presente contrato tem por objeto a prestação de serviços advocatícios pelo(a) CONTRATADO(a), consistentes no ajuizamento e acompanhamento de **AÇÃO JUDICIAL**, em todas as instâncias, com a adoção das medidas judiciais e extrajudiciais necessárias, visando à defesa dos interesses do(a) CONTRATANTE em face de:

**(a) ${d.reu}, referente ao contrato ${d.contrato_reu}**

Parágrafo único. O(a) CONTRATADO(a) compromete-se a desempenhar os serviços com **zelo, diligência e responsabilidade profissional**, acompanhando o feito em todas as fases e instâncias, até o seu desfecho.

## CLÁUSULA 2ª – DAS OBRIGAÇÕES

**2.1** – O CONTRATADO obriga-se, por consequência do presente contrato, a prestar seus serviços jurídicos em defesa dos direitos do CONTRATANTE, mediante a prática de todos os atos inerentes ao exercício da advocacia.

**2.2** – O CONTRATANTE fica obrigado a fornecer todos os dados, informações e documentos necessários para o bom e fiel desenvolvimento do objeto contratado, declarando por meio do presente a veracidade dos mesmos, comprometendo-se a não faltar com a verdade, sendo responsável pela idoneidade moral, legitimidade e veracidade dos documentos e informações que apresentar ao CONTRATADO, devendo informar quaisquer alterações dos fatos narrados e manter dados para contato atualizados.

**2.3** - O CONTRATANTE, nesse momento, declarar que as informações a respeito do objeto do contrato poderão ser repassados pelo telefone **${d.telefone_contato}**.

**2.4** – O CONTRATANTE fica obrigado a comparecer em audiências, perícias e demais diligências designadas, que fizer necessária sua presença, desde que previamente informadas. Ficando desde já ciente que caso que o seu não comparecimento aos atos do processo em que seja indispensável sua presença, tais como audiências, perícias, inspeções, etc, poderá acarretar no arquivamento, extinção do processo ou na improcedência da ação.

## CLÁUSULA 3ª – DA REMUNERAÇÃO

**3.1** – Em remuneração aos serviços ora avençados, o CONTRATANTE pagará ao CONTRATADO a verba honorária assim contratada:

**3.1.1** - Ao final da atuação, em caso de êxito do processo ou acordo, além dos valores estabelecidos a título de sucumbência, será devido ao CONTRATADO os honorários no percentual de **${perc}% (${percExt} por cento)**, sobre o valor da condenação.

**3.2** – **Os valores pactuados neste contrato serão devidos ao CONTRATADO independentemente dos valores eventualmente recebidos a título de sucumbência no processo, os quais se houver, pertencerão ÚNICA e EXCLUSIVAMENTE ao CONTRATADO - advogados**, em conformidade com o artigo 23 da Lei n° 8.906/94 e art. 48, do Código de Ética e Disciplina da Ordem dos Advogados do Brasil, podendo, inclusive, recebê-lo em Juízo ou fora dele, ao final da ação, ou promover a competente execução em seu próprio nome, ou em nome da CONTRATANTE, nada tendo este a reclamar ou receber.

**3.3** - Em eventual levantamento ou recebimento dos valores advindos da ação objeto do presente contrato, diretamente pelo CONTRATADO, o CONTRATANTE autoriza expressamente por meio deste a retenção dos valores pactuados e exigíveis.

**3.4** - Em eventual levantamento ou recebimento dos valores advindos da ação objeto do presente contrato, diretamente pelo CONTRATANTE, será imediatamente exigível a verba honorária a contar do efetivo recebimento pelo CONTRATANTE, correndo a partir de então os juros, cláusula penal e correção monetária.

**3.5** - **Fica desde já convencionado entre as partes que caso não haja êxito na ação nada será devido aos contratados – advogado, a título de honorários contratuais.**

## CLÁUSULA 4ª - DO PRAZO DO CONTRATO

**4.1** - O contrato tem validade até o trânsito em julgado do processo – objeto deste instrumento, podendo ser rescindido a qualquer momento sob aviso prévio de 30 dias.

**4.2** - A revogação do mandato por vontade do CONTRATANTE não o desobriga do pagamento das verbas honorárias contratadas devidas até o ato da revogação, bem como não retira o direito do CONTRATADO de receber o quanto lhe seja devido em eventual verba honorária de sucumbência, calculada proporcionalmente, em face do serviço efetivamente prestado.

## CLÁUSULA 5ª - DAS DESPESAS E CUSTAS FINAL DO PROCESSO

**5.1** - O CONTRATANTE obriga-se a pagar e/ou imediatamente ressarcir ao CONTRATADO as custas e quaisquer despesas necessárias ao bom e rápido andamento da ação e demais procedimentos judiciais ou extrajudiciais a serem implementados na defesa de seus interesses, tais como preparos recursais, custas e despesas judiciais, emolumentos, locomoção do advogado, extração de fotocópias, correios, autenticações de documentos, expedição de certidões, interurbanos e quaisquer outras que decorrerem dos serviços ora Contratados.

**5.2** - O CONTRATANTE declara plena ciência que, **se não for o caso de gratuidade de justiça**, terá a incumbência de pagamento de todas as custas e sucumbência, no caso de insucesso no processo judicial movido, envolvendo custas finais e honorários da parte adversa, que pode variar de 10% a 20% do valor da causa.

**5.3** - O CONTRATANTE declara plena ciência que, **se for deferida a gratuidade de justiça**, no caso de insucesso no processo judicial movido, as obrigações decorrentes de sua sucumbência ficarão sob condição suspensiva de exigibilidade e poderão ser executadas se, nos 5 (cinco) anos subsequentes ao trânsito em julgado da decisão que as certificou, o credor demonstrar que deixou de existir a situação de insuficiência de recursos que justificou a concessão de gratuidade, extinguindo-se, passado esse prazo, tais obrigações do beneficiário.

## CLÁUSULA 6ª - DA RESCISÃO DO CONTRATO

**6.1.** No caso de rescisão contratual sem justa causa do instrumento de procuração, desistência do processo ou qualquer outro ato do constituinte que importe em violação do presente contrato, sem culpa do CONTRATADO, serão devidos honorários na base de 20% (vinte por cento) sobre o valor da causa ou em percentual equivalente aos serviços realizados até a data da denúncia do Contrato.

**6.2** Os honorários pactuados poderão ser imediatamente exigidos se for, por qualquer razão, cassada a procuração concedida pelo(s) CONTRATANTE(s) ou contratado novo advogado sem o conhecimento e consentimento do CONTRATADO.

Parágrafo único: O CONTRATANTE por meio deste contrato declara expressamente de que não poderá celebrar qualquer composição, negócios, avenças, acordos ou contratos junto à parte adversa, seus sócios, procuradores, administradores ou pessoas físicas e jurídicas que venham a eventualmente integrar seu grupo econômico, sem o acompanhamento e concordância formal do CONTRATADO, sob pena de pagamento integral dos honorários advocatícios pactuados.

## CLÁUSULA 7ª - DA LIQUIDEZ DO CONTRATO

**7.1** - O presente contrato consiste em título executivo extrajudicial, nos termos do Art. 784, inc. III do CPC, e como tal é considerado pelas partes firmatárias.

## CLÁUSULA 8ª – DA ORIENTAÇÃO SOBRE O GOLPE DO FALSO ADVOGADO

**8.1** – O CONTRATANTE declara, por meio deste contrato, que foi devidamente orientado sobre a existência de práticas fraudulentas cometidas por terceiros que se fazem passar por advogados, servidores da Justiça ou membros do escritório, com o objetivo de obter depósitos ou transferências indevidas sob falsas alegações de custas, taxas judiciais ou acordos urgentes.

**8.2** – O CONTRATANTE se compromete a não realizar qualquer pagamento ou fornecimento de informações bancárias ou pessoais sem confirmação direta, por meio dos canais de atendimento oficiais constantes deste instrumento, com os advogados do escritório **BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA**.

**8.3** – A CONTRATADA exime-se de qualquer responsabilidade por prejuízos que eventualmente venham a ocorrer em razão do descumprimento desta cláusula de segurança, reconhecendo o CONTRATANTE que foi alertado quanto aos riscos e canais válidos de contato.

## CLÁUSULA 9ª - DA OBSERVÂNCIA À LGPD

**9.1** - O CONTRATANTE declara expresso CONSENTIMENTO que o CONTRATADO irá coletar, tratar e compartilhar os dados necessários ao cumprimento do contrato, nos termos do Art. 7º, inc. V da LGPD, os dados necessários para cumprimento de obrigações legais, nos termos do Art. 7º, inc. II da LGPD, bem como os dados, se necessários para proteção ao crédito, conforme autorizado pelo Art. 7º, inc. V da LGPD.

**9.2** - Obedecendo aos preceitos da Lei 13.709/2018 - LEI GERAL DE PROTEÇÃO DE DADOS, a CONTRATADA compromete-se a utilizar os dados do CONTRATANTE apenas para o fim específico deste contrato, qual seja: atuação na ação objeto do contrato, não operando ou compartilhando os dados pessoais do CONTRATANTE para nenhum outro fim.

**9.3** - Os dados pessoais do CONTRATANTE serão apagados após o prazo de 10 (dez) anos, após findo o processo, por ser uma obrigação legal.

**9.4** - Os dados pessoais do CONTRATANTE apenas continuarão guardados no acervo da CONTRATADA, se este concordar através de termo de consentimento.

## CLÁUSULA 10ª – DAS DISPOSIÇÕES GERAIS

**10.1** - O CONTRATANTE por meio deste contrato autoriza expressamente o CONTRATADO a não atuar ou interpor recursos que julgue incabíveis, infundados, inócuos, sem resultado prático útil e/ou meramente protelatórios.

**10.2** - O CONTRATADO não garante o resultado favorável ao(s) CONTRATANTE(s) mas, compromete-se a usar de todos os meios jurídicos, legais, morais e legítimos para defender os interesses do(s) CONTRATANTE(s).

**10.3** - O(s) CONTRATANTE(s) é totalmente responsável pelo comparecimento nos locais e horários indicados, bem como se compromete na obtenção da documentação necessária para viabilizar as ações contratadas pelo presente instrumento.

**10.4** - Em quaisquer casos de arquivamento, extinção do processo ou improcedência da ação em que tenha o CONTRATANTE dado causa por não comparecimento sem motivo justificado, inverdade das informações ou documentos, serão cobrados honorários integrais nos valores e percentuais ajustados como êxito no presente contrato.

**10.5** - Fica definido que toda e qualquer comunicação a ser feita pelo CONTRATADO aos(s) CONTRATANTE(S) ocorrerá pelo telefone e/ou e-mail informado na cláusula 2.3, sendo que a simples remessa de mensagens para tal telefone e/ou e-mail presume o recebimento da informação pelo(s) CONTRATANTE(s), o qual se obriga a informar qualquer alteração.

**10.6** - O meio de comunicação estabelecido, para contato com os profissionais contratados, será realizado exclusivamente por meio de ligações para o telefone: **(92) 3343-6173, WhatsApp (92) 99160-4348 / 98223-7330 / 98588-8190** e e-mail: juridico@bentesramos.adv.br, ficando totalmente excluída a possibilidade de contatos e consultas via redes sociais, exceto quando necessários ao esclarecimento de informações requisitados pelos profissionais contratados, exclusivamente em horário comercial (8h-17h) em dias úteis.

**10.7** - A CONTRATANTE declara já haver recebido todas as orientações preventivas, comportamentais e jurídicas para a consecução dos serviços, bem como, fornecerá ao CONTRATADO todos os documentos, dados, informações e meios necessários à comprovação processual do seu direito pretendido para instruir a causa.

**10.8** - As partes elegem o foro da comarca de Manaus/AM, para dirimir controvérsias que possam surgir do presente contrato, podendo o Advogado optar pelo foro de residência do Contratante.

E, por assim estarem justos e contratados, assinam este, em duas vias de igual forma teor.

${loc}.

___________________________________________
**${d.nome_completo} - CONTRATANTE**

___________________________________________
**ANDREY AUGUSTO BENTES RAMOS - CONTRATADO**
OAB/AM 7.526

Testemunhas:

___________________________________________

___________________________________________
`;
    }

    // ─── PROCURAÇÃO ──────────────────────────────────────────────────────────
    case 'procuracao':
      return CAB +
`# INSTRUMENTO DE PROCURAÇÃO *"AD JUDICIA ET EXTRA"*

**OUTORGANTE:** ${ident(d)}.

Nomeia e constitui seus procuradores os outorgados abaixo qualificados:

**OUTORGADO:** A presente procuração é concedida aos advogados integrantes do escritório **BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA**, inscrito na OAB/AM sob o n° 115/2016 e no CNPJ n° 29.516.950/0001-55, com sede na Rua Salvador, n° 120, sala 708, 7° andar – Edifício Vieiralves Business Center, bairro: Adrianópolis, Manaus/AM, Cep: 69.057-040, que atuará através de seus advogados **ANDREY AUGUSTO BENTES RAMOS**, inscrito na OAB/AM sob o n° 7.526 e **GUSTAVO DA SILVA GRILLO**, inscrito na OAB/AM sob o n° 7.883, ambos com endereço eletrônico juridico@bentesramos.adv.br e telefone: (92) 3343-6173 / 99160-4348 / 98223-7330 / 98588-8190.

**PODERES:** Nos termos do art. 105 do Código de Processo Civil, os contidos na cláusula "ad judicia et extra", para, em nome do outorgante, em qualquer Juízo, Instância ou Tribunal, ou fora deles, defender seus interesses, podendo propor contra quem de direito as ações competentes e defender os interesses da outorgante nas contrárias, seguindo umas e outras, até final decisão, usando dos recursos legais e acompanhando-os, conferindo-lhes, ainda, **PODERES ESPECIAIS** para confessar, desistir, transigir, firmar compromissos ou acordos, receber e dar quitação, receber alvará, reconhecer procedência de pedido, renunciar a direito no qual se funda ação agindo em conjunto ou separadamente, podendo ainda substabelecer esta em outrem, com ou sem reservas de iguais poderes, pedir o benefício da Justiça Gratuita e assinar declaração de hipossuficiência econômica, dando tudo por bom, firme e valioso, **para o fim de ingressar com ação judicial em face de ${d.reu}, referente ao contrato ${d.contrato_reu}.**

**Lei Geral de Proteção de Dados:** Considerando a Lei Geral de Proteção de Dados, o OUTORGANTE declara ter ciência da necessidade dos dados aqui coletados e dá consentimento do uso dos seus dados pelos CONTRATADOS para a finalidade exclusiva de propositura de demanda judicial, em observância ao cumprimento das regras quanto à proteção de dados, diante dos princípios da necessidade, finalidade e/ou autodeterminação informativa, inclusive no tratamento de dados pessoais sensíveis, de acordo com obrigação legal de coleta dos dados.

**Declaração de Ciência sobre Tentativas de Fraude ("Golpe do Falso Advogado"):** A OUTORGANTE declara estar ciente de que não deve realizar qualquer pagamento ou transferência bancária em nome de custas, honorários ou qualquer outra finalidade sem prévia confirmação direta com os advogados constituídos nesta procuração, exclusivamente pelos canais de contato informados neste instrumento. Está devidamente orientada a não atender solicitações por meio de WhatsApp, e-mails ou ligações telefônicas não oficiais, especialmente em casos de pessoas se passando por advogados ou servidores do Judiciário. Esta cláusula visa prevenir prejuízos decorrentes do chamado **"golpe do falso advogado"**, sendo a outorgante orientada a comunicar imediatamente o escritório em caso de tentativa suspeita.

${loc}.

___________________________________________
**${d.nome_completo}**
`;

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
