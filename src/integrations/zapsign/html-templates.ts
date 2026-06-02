// Templates em HTML — replicam exatamente o layout dos PDFs originais
// Com logotipo, cabeçalho, rodapé e campos dinâmicos {{placeholder}}

export const HTML_TEMPLATES = {
  'contrato-honorarios': (fields: Record<string, string>) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Arial', sans-serif;
            color: #333;
            line-height: 1.6;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            background: white;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #333;
        }
        .logo {
            font-size: 12px;
            font-weight: bold;
            color: #000;
            margin-bottom: 10px;
        }
        .contact-info {
            font-size: 11px;
            color: #666;
            margin-top: 10px;
        }
        h1 {
            font-size: 18px;
            text-align: center;
            margin: 30px 0 20px;
            font-weight: bold;
            text-transform: uppercase;
        }
        h2 {
            font-size: 14px;
            margin: 25px 0 15px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
        }
        .section {
            margin: 20px 0;
            text-align: justify;
        }
        .paragraph {
            margin-bottom: 12px;
            text-align: justify;
            font-size: 12px;
            line-height: 1.8;
        }
        .field {
            font-weight: bold;
            color: #000;
        }
        .signature-section {
            margin-top: 40px;
            text-align: center;
        }
        .signature-line {
            display: inline-block;
            width: 250px;
            border-top: 1px solid #000;
            margin-top: 30px;
            margin-right: 30px;
            text-align: center;
            font-size: 12px;
            padding-top: 5px;
        }
        .footer {
            margin-top: 60px;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
        .highlight {
            background-color: #f9f9f9;
            padding: 15px;
            border-left: 3px solid #333;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA</div>
        <div class="contact-info">
            Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040<br>
            (92) 3343-6173 | (92) 98223-7330 / (92) 99160-4348<br>
            juridico@bentesramos.adv.br | www.bentesramos.com.br
        </div>
    </div>

    <h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS E HONORÁRIOS ADVOCATÍCIOS</h1>

    <div class="section">
        <p class="paragraph">
            Pelo presente instrumento particular, na melhor forma de direito, as partes abaixo identificadas firmam entre si o presente Contrato de Prestação de Serviços Advocatícios, nos termos do artigo 22 da Lei nº 8.906/94 (Estatuto da Advocacia e da OAB), o qual será regido pelas cláusulas e condições a seguir:
        </p>
    </div>

    <div class="section">
        <p class="paragraph">
            <span class="field">CONTRATANTE:</span> {{nome_completo}}, {{nacionalidade}}, {{estado_civil}}, {{profissao}}, detentor(a) da cédula de identidade nº {{rg}} {{orgao_rg}} e do CPF nº {{cpf}}, residente e domiciliado(a) na {{endereco}}, nº {{numero_end}}, bairro: {{bairro}}, {{cidade_uf}}, Cep: {{cep}}.
        </p>
    </div>

    <div class="section">
        <p class="paragraph">
            <span class="field">CONTRATADOS:</span> BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA, inscrito na OAB/AM sob o nº 115/2016 e no CNPJ nº 29.516.950/0001-55, com sede a Rua Salvador, nº 120, sala 708, 7º andar – Edifício Vieiralves Business Center, bairro: Adrianópolis, Manaus/AM, Cep.: 69.057-040, através de seu advogado ANDREY AUGUSTO BENTES RAMOS, inscrito na OAB/AM 7.526, com endereço eletrônico juridico@bentesramos.adv.br e telefone: (92) 3343-6173 / 99160-4348 / 98223-7330 / 98588-8190.
        </p>
    </div>

    <h2>CLÁUSULA 1ª – DO OBJETO</h2>
    <div class="section">
        <p class="paragraph">
            1.1. O presente contrato tem por objeto a prestação de serviços advocatícios pelo(a) CONTRATADO(a), consistentes no ajuizamento e acompanhamento de AÇÃO JUDICIAL, em todas as instâncias, com a adoção das medidas judiciais e extrajudiciais necessárias, visando à defesa dos interesses do(a) CONTRATANTE em face de:
        </p>
        <p class="paragraph">
            (a) <span class="field">{{reu}}</span> – referente ao contrato <span class="field">{{contrato_reu}}</span>
        </p>
        <p class="paragraph">
            <strong>Parágrafo único.</strong> O(a) CONTRATADO(a) compromete-se a desempenhar os serviços com zelo, diligência e responsabilidade profissional, acompanhando o feito em todas as fases e instâncias, até o seu desfecho.
        </p>
    </div>

    <h2>CLÁUSULA 2ª – DAS OBRIGAÇÕES</h2>
    <div class="section">
        <p class="paragraph">
            2.1 – O CONTRATADO obriga-se, por consequência do presente contrato, a prestar seus serviços jurídicos em defesa dos direitos do CONTRATANTE, mediante a prática de todos os atos inerentes ao exercício da advocacia.
        </p>
        <p class="paragraph">
            2.2 – O CONTRATANTE fica obrigado a fornecer todos os dados, informações e documentos necessários para o bom e fiel desenvolvimento do objeto contratado, declarando por meio do presente a veracidade dos mesmos, comprometendo-se a não faltar com a verdade, sendo responsável pela idoneidade moral, legitimidade e veracidade dos documentos e informações que apresentar ao CONTRATADO, devendo informar quaisquer alterações dos fatos narrados e manter dados para contato atualizados.
        </p>
        <p class="paragraph">
            2.3 - O CONTRATANTE, nesse momento, declara que as informações a respeito do objeto do contrato poderão ser repassadas pelo telefone {{telefone_contato}}.
        </p>
        <p class="paragraph">
            2.4 – O CONTRATANTE fica obrigado a comparecer em audiências, perícias e demais diligências designadas, que fizer necessária sua presença, desde que previamente informadas. Ficando desde já ciente que o seu não comparecimento aos atos do processo em que seja indispensável sua presença, tais como audiências, perícias, inspeções, etc, poderá acarretar no arquivamento, extinção do processo ou na improcedência da ação, o que poderá gerar inclusive a sua condenação em custas processuais e/ou multa.
        </p>
    </div>

    <h2>CLÁUSULA 3ª – DA REMUNERAÇÃO</h2>
    <div class="section">
        <p class="paragraph">
            3.1 – Em remuneração aos serviços ora avençados, o CONTRATANTE pagará ao CONTRATADO a verba honorária assim contratada:
        </p>
        <p class="paragraph highlight">
            <strong>Honorários de êxito: {{percentual_honorarios}}% ({{percentual_honorarios_extenso}} por cento) sobre o valor da condenação.</strong><br><br>
            <strong>EM CASO DE INSUCESSO, NADA SERÁ DEVIDO PELO CONTRATANTE AO ADVOGADO A TÍTULO DE HONORÁRIOS CONTRATUAIS.</strong>
        </p>
        <p class="paragraph">
            3.2 – Os valores pactuados neste contrato serão devidos ao CONTRATADO independentemente dos valores eventualmente recebidos a título de sucumbência no processo, os quais, se houver, pertencerão ÚNICA e EXCLUSIVAMENTE ao CONTRATADO - advogados, em conformidade com o artigo 23 da Lei nº 8.906/94.
        </p>
        <p class="paragraph">
            3.3 - Em eventual levantamento ou recebimento dos valores advindos da ação objeto do presente contrato, diretamente pelo CONTRATADO, o CONTRATANTE autoriza expressamente por meio deste a retenção dos valores pactuados e exigíveis.
        </p>
    </div>

    <h2>CLÁUSULA 4ª - DO PRAZO DO CONTRATO</h2>
    <div class="section">
        <p class="paragraph">
            4.1 - O contrato tem validade até o trânsito em julgado do processo – objeto deste instrumento, podendo ser rescindido a qualquer momento sob aviso prévio de 30 dias.
        </p>
        <p class="paragraph">
            4.2 - A revogação do mandato por vontade do CONTRATANTE não o desobriga do pagamento das verbas honorárias contratadas devidas até o ato da revogação, bem como não retira o direito do CONTRATADO de receber o quanto lhe seja devido em eventual verba honorária de sucumbência, calculada proporcionalmente, em face do serviço efetivamente prestado.
        </p>
    </div>

    <h2>CLÁUSULA 5ª - DAS DESPESAS E CUSTAS FINAL DO PROCESSO</h2>
    <div class="section">
        <p class="paragraph">
            5.1 - O CONTRATANTE obriga-se a pagar e/ou imediatamente ressarcir ao CONTRATADO as custas e quaisquer despesas necessárias ao bom e rápido andamento da ação e demais procedimentos judiciais ou extrajudiciais, tais como preparos recursais, custas e despesas judiciais, emolumentos, locomoção do advogado, extração de fotocópias, correios, autenticações de documentos, expedição de certidões, interurbanos e quaisquer outras que decorrerem dos serviços ora Contratados.
        </p>
        <p class="paragraph">
            5.2 - O CONTRATANTE declara plena ciência que, se não for o caso de gratuidade de justiça, terá a incumbência de pagamento de todas as custas e sucumbência, no caso de insucesso no processo judicial movido, envolvendo custas finais e honorários da parte adversa, que pode variar de 10% a 20% do valor da causa.
        </p>
    </div>

    <h2>CLÁUSULA 8ª – DA ORIENTAÇÃO SOBRE O GOLPE DO FALSO ADVOGADO</h2>
    <div class="section">
        <p class="paragraph">
            O CONTRATANTE declara que foi devidamente orientado sobre a existência de práticas fraudulentas cometidas por terceiros que se fazem passar por advogados, servidores da Justiça ou membros do escritório, com o objetivo de obter depósitos ou transferências indevidas.
        </p>
        <p class="paragraph">
            O CONTRATANTE se compromete a não realizar qualquer pagamento ou fornecimento de informações bancárias ou pessoais sem confirmação direta, por meio dos canais de atendimento oficiais: (92) 3343-6173, WhatsApp (92) 99160-4348 / 98223-7330 / 98588-8190 e e-mail: juridico@bentesramos.adv.br
        </p>
    </div>

    <h2>CLÁUSULA 9ª - DA OBSERVÂNCIA À LGPD</h2>
    <div class="section">
        <p class="paragraph">
            O CONTRATANTE declara expresso CONSENTIMENTO que o CONTRATADO irá coletar, tratar e compartilhar os dados necessários ao cumprimento do contrato, em observância à Lei Geral de Proteção de Dados (Lei 13.709/2018).
        </p>
    </div>

    <h2>CLÁUSULA 10ª – DAS DISPOSIÇÕES GERAIS</h2>
    <div class="section">
        <p class="paragraph">
            10.1 - O CONTRATANTE por meio deste contrato autoriza expressamente o CONTRATADO a não atuar ou interpor recursos que julgue incabíveis, infundados, inócuos, sem resultado prático útil e/ou meramente protelatórios.
        </p>
        <p class="paragraph">
            10.2 - O CONTRATADO não garante o resultado favorável ao(s) CONTRATANTE(s) mas, compromete-se a usar de todos os meios jurídicos, legais, morais e legítimos para defender os interesses do(s) CONTRATANTE(s).
        </p>
        <p class="paragraph">
            10.6 - O meio de comunicação estabelecido será realizado exclusivamente por: (92) 3343-6173, WhatsApp (92) 99160-4348 / 98223-7330 / 98588-8190 e e-mail: juridico@bentesramos.adv.br
        </p>
        <p class="paragraph">
            10.8 - As partes elegem o foro da comarca de Manaus/AM, para dirimir controvérsias que possam surgir do presente contrato.
        </p>
    </div>

    <div class="signature-section">
        <p style="margin-bottom: 20px;">E, por assim estarem justos e contratados, assinam este instrumento.</p>
        <p style="margin-bottom: 40px;">Manaus/AM, {{data}}</p>

        <div class="signature-line">{{nome_completo}}<br><strong>CONTRATANTE</strong></div>
        <div class="signature-line">ANDREY AUGUSTO BENTES RAMOS<br>CONTRATADO - OAB/AM 7.526</div>
    </div>

    <div class="footer">
        BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA<br>
        Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040<br>
        (92) 3343-6173 | (92) 98223-7330 / (92) 99160-4348 | juridico@bentesramos.adv.br
    </div>
</body>
</html>
  `,

  'declaracao-falso-advogado': (fields: Record<string, string>) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Arial', sans-serif;
            color: #333;
            line-height: 1.6;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            background: white;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #333;
        }
        .logo {
            font-size: 12px;
            font-weight: bold;
            color: #000;
            margin-bottom: 10px;
        }
        .contact-info {
            font-size: 11px;
            color: #666;
            margin-top: 10px;
        }
        h1 {
            font-size: 16px;
            text-align: center;
            margin: 30px 0 20px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .subtitle {
            text-align: center;
            font-size: 12px;
            margin-bottom: 20px;
            font-style: italic;
            color: #666;
        }
        .paragraph {
            margin-bottom: 15px;
            text-align: justify;
            font-size: 12px;
            line-height: 1.8;
        }
        .field {
            font-weight: bold;
            color: #000;
        }
        .signature-section {
            margin-top: 40px;
            text-align: center;
        }
        .signature-line {
            display: inline-block;
            width: 300px;
            border-top: 1px solid #000;
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            padding-top: 5px;
        }
        .footer {
            margin-top: 60px;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA</div>
        <div class="contact-info">
            Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040<br>
            (92) 3343-6173 | (92) 98223-7330 / (92) 99160-4348<br>
            juridico@bentesramos.adv.br | www.bentesramos.com.br
        </div>
    </div>

    <h1>DECLARAÇÃO DE CIÊNCIA E ORIENTAÇÃO</h1>
    <div class="subtitle">Golpe do "Falso Advogado"</div>

    <div>
        <p class="paragraph">
            Eu, <span class="field">{{nome_completo}}</span>, <span class="field">{{nacionalidade}}</span>, <span class="field">{{estado_civil}}</span>, <span class="field">{{profissao}}</span>, detentor(a) da cédula de identidade nº <span class="field">{{rg}}</span> <span class="field">{{orgao_rg}}</span> e do CPF nº <span class="field">{{cpf}}</span>, residente e domiciliado(a) na <span class="field">{{endereco}}</span>, nº <span class="field">{{numero_end}}</span>, bairro: <span class="field">{{bairro}}</span>, <span class="field">{{cidade_uf}}</span>, Cep: <span class="field">{{cep}}</span>, declaro para os devidos fins que, fui informado(a) e orientado(a) pelo escritório <strong>Bentes Ramos Advocacia e Consultoria Jurídica</strong> sobre a existência do golpe conhecido como <strong>"falso advogado"</strong>, no qual terceiros se passam por advogados para solicitar valores, transferências ou dados pessoais.
        </p>

        <p class="paragraph">
            <strong>Estou ciente de que nenhum advogado do escritório solicita pagamentos, transferências, códigos, senhas ou dados pessoais por números desconhecidos ou não informados previamente.</strong>
        </p>

        <p class="paragraph">
            Fui orientado(a) de que os únicos meios oficiais de contato do escritório são:
            <br><br>
            • (92) 99160-4348<br>
            • (92) 98223-7330<br>
            • (92) 98588-8190<br>
            • E-mail institucional: juridico@bentesramos.adv.br
        </p>

        <p class="paragraph">
            Estou ciente de que qualquer mensagem ou ligação fora desses canais deve ser desconsiderada, devendo eu informar imediatamente ao escritório para providências.
        </p>

        <p class="paragraph">
            Declaro ainda que recebi todas as orientações de forma clara e compreensível.
        </p>

        <div class="signature-section">
            <p>{{data}}.</p>
            <div class="signature-line">{{nome_completo}}</div>
        </div>
    </div>

    <div class="footer">
        BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA<br>
        Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040<br>
        (92) 3343-6173 | (92) 98223-7330 / (92) 99160-4348 | juridico@bentesramos.adv.br
    </div>
</body>
</html>
  `,

  'declaracao-hipossuficiencia': (fields: Record<string, string>) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Arial', sans-serif;
            color: #333;
            line-height: 1.6;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            background: white;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #333;
        }
        .logo {
            font-size: 12px;
            font-weight: bold;
            color: #000;
            margin-bottom: 10px;
        }
        .contact-info {
            font-size: 11px;
            color: #666;
            margin-top: 10px;
        }
        h1 {
            font-size: 16px;
            text-align: center;
            margin: 30px 0 20px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .paragraph {
            margin-bottom: 15px;
            text-align: justify;
            font-size: 12px;
            line-height: 1.8;
        }
        .field {
            font-weight: bold;
            color: #000;
        }
        .signature-section {
            margin-top: 40px;
            text-align: center;
        }
        .signature-line {
            display: inline-block;
            width: 300px;
            border-top: 1px solid #000;
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            padding-top: 5px;
        }
        .footer {
            margin-top: 60px;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA</div>
        <div class="contact-info">
            Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040<br>
            (92) 3343-6173 | (92) 98223-7330 / (92) 99160-4348<br>
            juridico@bentesramos.adv.br | www.bentesramos.com.br
        </div>
    </div>

    <h1>DECLARAÇÃO DE HIPOSSUFICIÊNCIA</h1>

    <div>
        <p class="paragraph">
            Eu, <span class="field">{{nome_completo}}</span>, <span class="field">{{nacionalidade}}</span>, <span class="field">{{estado_civil}}</span>, <span class="field">{{profissao}}</span>, detentor(a) da cédula de identidade nº <span class="field">{{rg}}</span> <span class="field">{{orgao_rg}}</span> e do CPF nº <span class="field">{{cpf}}</span>, residente e domiciliado(a) na <span class="field">{{endereco}}</span>, nº <span class="field">{{numero_end}}</span>, bairro: <span class="field">{{bairro}}</span>, <span class="field">{{cidade_uf}}</span>, Cep: <span class="field">{{cep}}</span>, <strong>DECLARO</strong>, com base no artigo 5º, inciso LXXIV da CF/88 c/c art. 98 do CPC/2015 que não posso arcar com o pagamento de custas e demais despesas processuais sem o prejuízo do meu próprio sustento e de minha família, responsabilizando-me integralmente pelo conteúdo da presente declaração.
        </p>

        <div class="signature-section">
            <p>{{data}}.</p>
            <div class="signature-line">{{nome_completo}}</div>
        </div>
    </div>

    <div class="footer">
        BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA<br>
        Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040<br>
        (92) 3343-6173 | (92) 98223-7330 / (92) 99160-4348 | juridico@bentesramos.adv.br
    </div>
</body>
</html>
  `,

  'declaracao-nao-contratacao': (fields: Record<string, string>) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Arial', sans-serif;
            color: #333;
            line-height: 1.6;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            background: white;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #333;
        }
        .logo {
            font-size: 12px;
            font-weight: bold;
            color: #000;
            margin-bottom: 10px;
        }
        .contact-info {
            font-size: 11px;
            color: #666;
            margin-top: 10px;
        }
        h1 {
            font-size: 16px;
            text-align: center;
            margin: 30px 0 20px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .paragraph {
            margin-bottom: 15px;
            text-align: justify;
            font-size: 12px;
            line-height: 1.8;
        }
        .field {
            font-weight: bold;
            color: #000;
        }
        .signature-section {
            margin-top: 40px;
            text-align: center;
        }
        .signature-line {
            display: inline-block;
            width: 300px;
            border-top: 1px solid #000;
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            padding-top: 5px;
        }
        .footer {
            margin-top: 60px;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA</div>
        <div class="contact-info">
            Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040<br>
            (92) 3343-6173 | (92) 98223-7330 / (92) 99160-4348<br>
            juridico@bentesramos.adv.br | www.bentesramos.com.br
        </div>
    </div>

    <h1>DECLARAÇÃO DE NÃO CONTRATAÇÃO DE EMPRÉSTIMO</h1>

    <div>
        <p class="paragraph">
            Eu, <span class="field">{{nome_completo}}</span>, <span class="field">{{nacionalidade}}</span>, <span class="field">{{estado_civil}}</span>, <span class="field">{{profissao}}</span>, detentor(a) da cédula de identidade nº <span class="field">{{rg}}</span> <span class="field">{{orgao_rg}}</span> e do CPF nº <span class="field">{{cpf}}</span>, residente e domiciliado(a) na <span class="field">{{endereco}}</span>, nº <span class="field">{{numero_end}}</span>, bairro: <span class="field">{{bairro}}</span>, <span class="field">{{cidade_uf}}</span>, Cep: <span class="field">{{cep}}</span>, <strong>DECLARO</strong> para os devidos fins de direito, sob as penas da lei, que as informações prestadas e documentos que apresentei ao escritório jurídico, referente a <strong>NÃO CONTRATAÇÃO DOS EMPRÉSTIMOS {{numeros_contratos}}</strong>, vinculados ao <strong>{{banco}}</strong>, indevidamente averbados em meu benefício previdenciário nº <strong>{{numero_beneficio}}</strong>, são verdadeiras.
        </p>

        <div class="signature-section">
            <p>{{data}}.</p>
            <div class="signature-line">{{nome_completo}}</div>
        </div>
    </div>

    <div class="footer">
        BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA<br>
        Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040<br>
        (92) 3343-6173 | (92) 98223-7330 / (92) 99160-4348 | juridico@bentesramos.adv.br
    </div>
</body>
</html>
  `,

  'procuracao': (fields: Record<string, string>) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Arial', sans-serif;
            color: #333;
            line-height: 1.6;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            background: white;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #333;
        }
        .logo {
            font-size: 12px;
            font-weight: bold;
            color: #000;
            margin-bottom: 10px;
        }
        .contact-info {
            font-size: 11px;
            color: #666;
            margin-top: 10px;
        }
        h1 {
            font-size: 16px;
            text-align: center;
            margin: 30px 0 20px;
            font-weight: bold;
            text-transform: uppercase;
        }
        h2 {
            font-size: 13px;
            margin: 20px 0 10px;
            font-weight: bold;
        }
        .paragraph {
            margin-bottom: 12px;
            text-align: justify;
            font-size: 12px;
            line-height: 1.8;
        }
        .field {
            font-weight: bold;
            color: #000;
        }
        .signature-section {
            margin-top: 40px;
            text-align: center;
        }
        .signature-line {
            display: inline-block;
            width: 300px;
            border-top: 1px solid #000;
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            padding-top: 5px;
        }
        .footer {
            margin-top: 60px;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA</div>
        <div class="contact-info">
            Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040<br>
            (92) 3343-6173 | (92) 98223-7330 / (92) 99160-4348<br>
            juridico@bentesramos.adv.br | www.bentesramos.com.br
        </div>
    </div>

    <h1>INSTRUMENTO DE PROCURAÇÃO "AD JUDICIA ET EXTRA"</h1>

    <h2>OUTORGANTE</h2>
    <p class="paragraph">
        <span class="field">{{nome_completo}}</span>, <span class="field">{{nacionalidade}}</span>, <span class="field">{{estado_civil}}</span>, <span class="field">{{profissao}}</span>, detentor(a) da cédula de identidade nº <span class="field">{{rg}}</span> <span class="field">{{orgao_rg}}</span> e do CPF nº <span class="field">{{cpf}}</span>, residente e domiciliado(a) na <span class="field">{{endereco}}</span>, nº <span class="field">{{numero_end}}</span>, bairro: <span class="field">{{bairro}}</span>, <span class="field">{{cidade_uf}}</span>, Cep: <span class="field">{{cep}}</span>.
    </p>

    <p class="paragraph">
        Nomeia e constitui seus procuradores os outorgados abaixo qualificados:
    </p>

    <h2>OUTORGADO</h2>
    <p class="paragraph">
        A presente procuração é concedida aos advogados integrantes do escritório <strong>BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA</strong>, inscrito na OAB/AM sob o nº 115/2016 e no CNPJ nº 29.516.950/0001-55, com sede na Rua Salvador, nº 120, sala 708, 7º andar – Edifício Vieiralves Business Center, bairro: Adrianópolis, Manaus/AM, Cep: 69.057-040, que atuará através de seus advogados <strong>ANDREY AUGUSTO BENTES RAMOS</strong>, inscrito na OAB/AM sob o nº 7.526 e <strong>GUSTAVO DA SILVA GRILLO</strong>, inscrito na OAB/AM sob o nº 7.883, ambos com endereço eletrônico juridico@bentesramos.adv.br e telefone: (92) 3343-6173 / 99160-4348 / 98223-7330 / 98588-8190.
    </p>

    <h2>PODERES</h2>
    <p class="paragraph">
        Nos termos do art. 105 do Código de Processo Civil, os contidos na cláusula "ad judicia et extra", para, em nome do outorgante, em qualquer Juízo, Instância ou Tribunal, ou fora deles, defender seus interesses, podendo propor contra quem de direito as ações competentes e defender os interesses da outorgante nas contrárias, seguindo umas e outras, até final decisão, usando dos recursos legais e acompanhando-os.
    </p>
    <p class="paragraph">
        Conferem-se ainda, <strong>PODERES ESPECIAIS</strong> para confessar, desistir, transigir, firmar compromissos ou acordos, receber e dar quitação, reconhecer procedência de pedido, renunciar a direito no qual se funda ação agindo em conjunto ou separadamente, podendo ainda substabelecer esta em outrem, com ou sem reservas de iguais poderes, pedir o benefício da Justiça Gratuita e assinar declaração de hipossuficiência econômica, dando tudo por bom, firme e valioso, <strong>para o fim de ingressar com ação judicial em face de {{reu}}, referente ao contrato {{contrato_reu}}</strong>.
    </p>

    <h2>Lei Geral de Proteção de Dados</h2>
    <p class="paragraph">
        O OUTORGANTE declara ter ciência da necessidade dos dados aqui coletados e dá consentimento do uso dos seus dados pelos CONTRATADOS para a finalidade exclusiva de propositura de demanda judicial, em observância ao cumprimento das regras quanto à proteção de dados.
    </p>

    <h2>Declaração de Ciência sobre Tentativas de Fraude</h2>
    <p class="paragraph">
        A OUTORGANTE declara estar ciente de que não deve realizar qualquer pagamento ou transferência bancária sem prévia confirmação direta com os advogados constituídos nesta procuração, exclusivamente pelos canais de contato informados neste instrumento: (92) 3343-6173, WhatsApp (92) 99160-4348 / 98223-7330 / 98588-8190 e e-mail juridico@bentesramos.adv.br.
    </p>

    <div class="signature-section">
        <p>Manaus/AM, {{data}}</p>
        <div class="signature-line">{{nome_completo}}</div>
    </div>

    <div class="footer">
        BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA<br>
        Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040<br>
        (92) 3343-6173 | (92) 98223-7330 / (92) 99160-4348 | juridico@bentesramos.adv.br
    </div>
</body>
</html>
  `,
};
