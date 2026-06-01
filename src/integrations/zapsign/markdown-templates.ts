// Templates em Markdown — convertidos dos PDFs originais
// Placeholders: {{nome_completo}}, {{cpf}}, {{telefone_contato}}, etc.
// A Zapsign substitui automaticamente antes de gerar o PDF

export const MARKDOWN_TEMPLATES = {
  'declaracao-nao-contratacao': (fields: Record<string, string>) => `
# DECLARAÇÃO DE NÃO CONTRATAÇÃO DE EMPRÉSTIMO

Eu, {{nome_completo}}, {{nacionalidade}}, {{estado_civil}}, {{profissao}}, detentor(a) da cédula de identidade n° {{rg}} {{orgao_rg}} e do CPF n° {{cpf}}, residente e domiciliado(a) na {{endereco}}, n° {{numero_end}}, bairro: {{bairro}}, {{cidade_uf}}, Cep: {{cep}}, **DECLARO** para os devidos fins de direito, sob as penas da lei, que as informações prestadas e documentos que apresentei ao escritório jurídico, referente a **NÃO CONTRATAÇÃO DOS EMPRÉSTIMOS {{numeros_contratos}}**, vinculados ao **{{banco}}**, indevidamente averbados em meu benefício previdenciário n° {{numero_beneficio}}, são verdadeiras.

{{data}}.

_______________________________________________
**{{nome_completo}}**
`,

  'declaracao-falso-advogado': (fields: Record<string, string>) => `
# DECLARAÇÃO DE CIÊNCIA E ORIENTAÇÃO
*(Golpe do "Falso Advogado")*

Eu, {{nome_completo}}, {{nacionalidade}}, {{estado_civil}}, {{profissao}}, detentor(a) da cédula de identidade n° {{rg}} {{orgao_rg}} e do CPF n° {{cpf}}, residente e domiciliado(a) na {{endereco}}, n° {{numero_end}}, bairro: {{bairro}}, {{cidade_uf}}, Cep: {{cep}}, declaro para os devidos fins que, fui informado(a) e orientado(a) pelo escritório **Bentes Ramos Advocacia e Consultoria Jurídica** sobre a existência do golpe conhecido como **"falso advogado"**, no qual terceiros se passam por advogados para solicitar valores, transferências ou dados pessoais.

**Estou ciente de que nenhum advogado do escritório solicita pagamentos, transferências, códigos, senhas ou dados pessoais por números desconhecidos ou não informados previamente.**

Fui orientado(a) de que os únicos meios oficiais de contato do escritório são:

- (92) 99160-4348
- (92) 98223-7330
- (92) 98588-8190
- E-mail institucional: juridico@bentesramos.adv.br

Estou ciente de que qualquer mensagem ou ligação fora desses canais deve ser desconsiderada, devendo eu informar imediatamente ao escritório para providências.

Declaro ainda que recebi todas as orientações de forma clara e compreensível.

{{data}}.

_______________________________________________
**{{nome_completo}}**
`,

  'declaracao-hipossuficiencia': (fields: Record<string, string>) => `
# DECLARAÇÃO DE HIPOSSUFICIÊNCIA

Eu, {{nome_completo}}, {{nacionalidade}}, {{estado_civil}}, {{profissao}}, detentor(a) da cédula de identidade n° {{rg}} {{orgao_rg}} e do CPF n° {{cpf}}, residente e domiciliado(a) na {{endereco}}, n° {{numero_end}}, bairro: {{bairro}}, {{cidade_uf}}, Cep: {{cep}}, **DECLARO**, com base no artigo 5°, inciso LXXIV da CF/88 c/c art. 98 do CPC/2015 que não posso arcar com o pagamento de custas e demais despesas processuais sem o prejuízo do meu próprio sustento e de minha família, responsabilizando-me integralmente pelo conteúdo da presente declaração.

{{data}}.

_______________________________________________
**{{nome_completo}}**
`,

  'contrato-honorarios': (fields: Record<string, string>) => `
# CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS E HONORÁRIOS ADVOCATÍCIOS

Pelo presente instrumento particular, na melhor forma de direito, as partes abaixo identificadas firmam entre si o presente Contrato de Prestação de Serviços Advocatícios, nos termos do artigo 22 da Lei n° 8.906/94 (Estatuto da Advocacia e da OAB), o qual será regido pelas cláusulas e condições a seguir:

**CONTRATANTE:** {{nome_completo}}, {{nacionalidade}}, {{estado_civil}}, {{profissao}}, detentor(a) da cédula de identidade n° {{rg}} {{orgao_rg}} e do CPF n° {{cpf}}, residente e domiciliado(a) na {{endereco}}, n° {{numero_end}}, bairro: {{bairro}}, {{cidade_uf}}, Cep: {{cep}}.

**CONTRATADOS:** BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA, inscrito na OAB/AM sob o n° 115/2016 e no CNPJ n° 29.516.950/0001-55, com sede a Rua Salvador, n° 120, sala 708, 7° andar – Edifício Vieiralves Business Center, bairro: Adrianópolis, Manaus/AM, Cep.: 69.057-040, através de seu advogado ANDREY AUGUSTO BENTES RAMOS, inscrito na OAB/AM 7.526, com endereço eletrônico juridico@bentesramos.adv.br e telefone: (92) 3343-6173 / 99160-4348 / 98223-7330 / 98588-8190.

## CLÁUSULA 1ª – DO OBJETO

O presente contrato tem por objeto a prestação de serviços advocatícios para ajuizamento de **AÇÃO JUDICIAL** em face de **{{reu}}**, referente ao contrato **{{contrato_reu}}**.

## CLÁUSULA 2ª – DAS OBRIGAÇÕES

O CONTRATANTE autoriza contato pelo telefone **{{telefone_contato}}**.

## CLÁUSULA 3ª – DA REMUNERAÇÃO

Honorários de êxito: **{{percentual_honorarios}}% ({{percentual_honorarios_extenso}} por cento)** sobre o valor da condenação. **Sem êxito, nada será devido.**

## CLÁUSULA 8ª – ORIENTAÇÃO SOBRE GOLPE DO FALSO ADVOGADO

O CONTRATANTE declara que foi orientado sobre práticas fraudulentas de terceiros. Confirmar qualquer pagamento pelos canais oficiais: (92) 3343-6173 / 99160-4348 / 98223-7330.

## CLÁUSULA 9ª – LGPD

O CONTRATANTE consente com coleta e tratamento de dados para fins deste contrato.

{{data}}.

_______________________________________________
**{{nome_completo}} - CONTRATANTE**

_______________________________________________
**ANDREY AUGUSTO BENTES RAMOS - CONTRATADO**
OAB/AM 7.526

**Testemunhas:**

_______________________________________________

_______________________________________________
`,

  'procuracao': (fields: Record<string, string>) => `
# INSTRUMENTO DE PROCURAÇÃO "AD JUDICIA ET EXTRA"

**OUTORGANTE:** {{nome_completo}}, {{nacionalidade}}, {{estado_civil}}, {{profissao}}, detentor(a) da cédula de identidade n° {{rg}} {{orgao_rg}} e do CPF n° {{cpf}}, residente e domiciliado(a) na {{endereco}}, n° {{numero_end}}, bairro: {{bairro}}, {{cidade_uf}}, Cep: {{cep}}.

Nomeia e constitui seus procuradores os outorgados abaixo qualificados:

**OUTORGADO:** A presente procuração é concedida aos advogados integrantes do escritório **BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA**, inscrito na OAB/AM sob o n° 115/2016 e no CNPJ n° 29.516.950/0001-55, com sede na Rua Salvador, n° 120, sala 708, 7° andar – Edifício Vieiralves Business Center, bairro: Adrianópolis, Manaus/AM, Cep: 69.057-040, que atuará através de seus advogados **ANDREY AUGUSTO BENTES RAMOS**, inscrito na OAB/AM sob o n° 7.526 e **GUSTAVO DA SILVA GRILLO**, inscrito na OAB/AM sob o n° 7.883, ambos com endereço eletrônico juridico@bentesramos.adv.br e telefone: (92) 3343-6173 / 99160-4348 / 98223-7330 / 98588-8190.

**PODERES:** Nos termos do art. 105 do Código de Processo Civil, os contidos na cláusula "ad judicia et extra", para, em nome do outorgante, em qualquer Juízo, Instância ou Tribunal, ou fora deles, defender seus interesses, podendo propor contra quem de direito as ações competentes e defender os interesses da outorgante nas contrárias, seguindo umas e outras, até final decisão, usando dos recursos legais e acompanhando-os, conferindo-lhes, ainda, **PODERES ESPECIAIS** para confessar, desistir, transigir, firmar compromissos ou acordos, receber e dar quitação, receber alvará, reconhecer procedência de pedido, renunciar a direito no qual se funda ação agindo em conjunto ou separadamente, podendo ainda substabelecer esta em outrem, com ou sem reservas de iguais poderes, pedir o benefício da Justiça Gratuita e assinar declaração de hipossuficiência econômica, dando tudo por bom, firme e valioso, **para o fim de ingressar com ação judicial em face de {{reu}}, referente ao contrato {{contrato_reu}}.**

**Lei Geral de Proteção de Dados:** O OUTORGANTE declara ter ciência da necessidade dos dados aqui coletados e dá consentimento do uso dos seus dados pelos CONTRATADOS para a finalidade exclusiva de propositura de demanda judicial.

**Declaração de Ciência sobre Tentativas de Fraude ("Golpe do Falso Advogado"):** A OUTORGANTE declara estar ciente de que não deve realizar qualquer pagamento ou transferência bancária sem prévia confirmação direta com os advogados constituídos nesta procuração, exclusivamente pelos canais de contato informados neste instrumento.

{{data}}.

_______________________________________________
**{{nome_completo}}**
`,
};
