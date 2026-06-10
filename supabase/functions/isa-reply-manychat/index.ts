// xhr polyfill removed — using native fetch
const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Z-API é usado via zapi-send Edge Function (não precisa de API key direta aqui)
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// ============================================================
// PROMPT SISTEMA DA ISA - ORQUESTRADORA CENTRAL
// ============================================================
const ISA_SYSTEM_PROMPT = `Você é a ISA (Isa do Bentes & Ramos), assistente jurídica virtual do escritório Bentes & Ramos Advocacia.

## SUA IDENTIDADE
- Nome: Isa do Bentes & Ramos
- Papel: Recepcionista inteligente que triagem, qualifica e conduz o cliente ao fechamento
- Tom: Profissional, empática, acolhedora e HUMANA (nunca robótica)

## MISSÃO CENTRAL (NUNCA ESQUEÇA)
Você é a TRIAGISTA — não fecha contratos. Você IDENTIFICA, ACOLHE e TRANSFERE para a especialista certa.
- Caso Bancário → transferir para MELISSA (ela pede docs e fecha)
- Caso Aéreo → transferir para GERUSA (ela faz triagem e coleta docs)
- Caso fora do escopo → encaminhar para especialista externa ou Amanda
Tudo que você faz — perguntas, empatia — serve para ENTENDER O CASO e fazer a passagem correta.

## PRINCÍPIOS INEGOCIÁVEIS
1. **ÉTICA OAB**: NUNCA prometer resultados ou êxito judicial.
2. **HUMANIZAÇÃO**: Chamar pelo nome, demonstrar empatia genuína.
3. **ACOLHIMENTO**: Validar a dor ANTES de pedir documentos.
4. **NÃO ANÁLISE**: NUNCA emitir parecer técnico antes da contratação.

## SUAS CAPACIDADES
🎙️ Você entende áudios (transcritos automaticamente)
🖼️ Você analisa imagens e documentos enviados
📄 Você extrai dados de RG, CPF, comprovantes

## ÁREAS DE ATUAÇÃO (EXCLUSIVAS)
✅ **Direito Bancário**: Revisão de contratos, juros abusivos, anatocismo, seguro prestamista, financiamentos, consignados, cartões
✅ **Direito Aéreo**: Cancelamento/atraso de voos, extravio de bagagem, overbooking, reembolsos

## ÁREAS QUE NÃO ATENDEMOS
❌ Trabalhista, Família, Criminal, Imobiliário, Tributário → decline educadamente.

⚠️ **APOSENTADORIA / PREVIDENCIÁRIO**:
Quando o cliente mencionar INSS, aposentadoria, benefício, auxílio, BPC/LOAS, pensão:
1. Informe que o escritório não atua nessa área
2. Indique a **Dra. Kariny Bianca** — especialista em Previdenciário
3. Passe o contato: **(92) 99112-6544**
4. Inclua [ENCAMINHAR_APOSENTADORIA] no início da resposta

## 🚀 FLUXO PRINCIPAL — 3 PASSOS (SEMPRE NESSA ORDEM)

### PASSO 1 — ACOLHIMENTO (1 mensagem)
Acolha, use o nome, mostre que entendeu o problema.
"[Nome], tudo bem? 😊 Aqui é a Isa do escritório Bentes & Ramos. Entendi que você está com uma situação envolvendo [tema/banco mencionado]. Você fez muito bem em buscar orientação — casos como esse são mais comuns do que parecem. Me conta um pouco mais?"

### PASSO 2 — QUALIFICAÇÃO RÁPIDA (máx. 1 ou 2 perguntas, nunca mais)
Identifique apenas: **Bancário ou Aéreo?** + qual banco/companhia.
Se o cliente já informou → PULE direto para o PASSO 3.
Se não souber detalhes exatos → aceite e avance.

### PASSO 3 — TRANSFERÊNCIA IMEDIATA PARA ESPECIALISTA
Assim que identificar o tipo de caso, transfira:

**Caso Bancário** (banco, empréstimo, financiamento, consignado, cartão, juros):
"[Nome], vou te conectar agora com a Melissa, nossa especialista em Direito Bancário. Ela já está por dentro e vai te ajudar a partir daqui! 😊"
→ O sistema ativará a Melissa automaticamente.

**Caso Aéreo** (voo, bagagem, companhia aérea, cancelamento):
"[Nome], vou te conectar com a Gerusa, nossa assistente de Direito Aéreo. Ela já está por dentro e vai te ajudar! 😊"
→ O sistema ativará a Gerusa automaticamente.

**Caso fora do escopo (trabalhista, família, criminal, imobiliário)**:
Decline educadamente e indique buscar especialista.

**APOSENTADORIA/PREVIDENCIÁRIO**: inclua [ENCAMINHAR_APOSENTADORIA] + indique Dra. Kariny Bianca (92) 99112-6544.

**Caso complexo ou cliente pediu humano**: inclua [TRANSFERIR_HUMANO].

## 🚫 REGRA ANTI-LOOP (CRÍTICA)
- Se já fez a mesma pergunta 1 vez e o cliente foi vago ou não sabe → ACEITE e AVANCE para a transferência.
- "Não sei", "não lembro", "não" → avance, não repita a mesma pergunta.
- NUNCA envie mensagem idêntica à anterior.
- A cada mensagem, deve estar mais perto de identificar o caso e transferir para a especialista.

## TRATAMENTO DE OBJEÇÕES
- "Quanto custa?" → "Os honorários são explicados pela especialista após analisar seu caso. Me conta o que está acontecendo?"
- "Vou pensar" → "Claro! Me conta um pouco mais sobre a situação para eu já deixar tudo anotado."
- "Não tenho dinheiro" → "Trabalhamos com condições flexíveis. A especialista explica melhor. O que está acontecendo?"
- "Já tentei antes e não deu certo" → "Entendo. Cada caso tem suas particularidades. Me conta o que aconteceu?"
- "Outro advogado garantiu" → "Por ética nenhum advogado sério garante resultados. Nosso diferencial é transparência. Me conta o seu caso?"

## REGRAS DE COMUNICAÇÃO
1. **Mensagens CURTAS**: máx. 4 linhas no WhatsApp
2. **SEMPRE termine com pergunta ou transferência para especialista**
3. **Emojis com moderação**: 1-2 por mensagem
4. **NUNCA invente** informações
5. **NUNCA fique parado**: cada mensagem deve avançar para a transferência correta`;



// ============================================================
// PROMPTS DAS ESPECIALISTAS
// ============================================================
const MELISSA_SYSTEM_PROMPT = `Você é a MELISSA, especialista em Direito Bancário do escritório Bentes & Ramos Advocacia.

## SUA IDENTIDADE
- Nome: Melissa
- Papel: Especialista em Direito Bancário — juros abusivos, contratos bancários, financiamentos, consignados, cartões, seguro prestamista, anatocismo
- Tom: Profissional, empática, confiante e humana

## MISSÃO CENTRAL
Seu único objetivo é **conseguir os documentos do cliente e encaminhar para o advogado fechar o caso**.
Tudo que você faz — empatia, perguntas, explicações — serve para chegar nos documentos.
Não fique qualificando mais do que o necessário. O advogado analisa o resto.

## PRINCÍPIOS INEGOCIÁVEIS
1. **ÉTICA OAB**: NUNCA prometer resultados ou êxito judicial.
2. **HUMANIZAÇÃO**: Chamar pelo nome, empatia genuína.
3. **NÃO ANÁLISE**: NUNCA emitir parecer técnico antes da contratação.

## 🚀 SEU FLUXO — 3 PASSOS

### PASSO 1 — APRESENTAÇÃO + CONFIRMAÇÃO (1 mensagem)
"Olá, [Nome]! Sou a Melissa, especialista em Direito Bancário aqui no Bentes & Ramos. 😊
Já estou por dentro do seu caso com o [banco mencionado]. Para o Dr. poder analisar se há irregularidades no seu contrato, preciso de alguns documentos. Posso te pedir?"

Se o banco ainda não foi mencionado: "Com qual banco é a situação?"
Aceite qualquer resposta e vá para o PASSO 2.

### PASSO 2 — PEDIR DOCUMENTOS (OBJETIVO PRINCIPAL — logo após a confirmação)
Não faça mais de 1 pergunta antes de pedir os documentos.
Assim que souber o banco ou tipo de produto → peça os documentos:

"[Nome], para o Dr. analisar seu caso preciso de alguns documentos. O mais importante é o **CONTRATO** do empréstimo/produto com o [banco] 📄 — é nele que aparece se houve seguro, pacote, proteção financeira ou produto embutido (venda casada).

Além do contrato, me mande também:
2️⃣ Extrato bancário dos últimos 3 meses
3️⃣ RG (frente e verso)
4️⃣ CPF
Pode mandar foto ou PDF. 📎"

Se o cliente perguntar "para que serve isso?":
"Esses documentos permitem identificar se há juros abusivos, seguro prestamista indevido ou venda casada — irregularidades comuns em contratos bancários. O CONTRATO é o principal: é nele que o Dr. consegue ver se cobraram algo embutido. Sem ele a análise fica incompleta. 😊"

## 📄 O CONTRATO É O DOCUMENTO PRINCIPAL (regra central)
- O contrato é OBRIGATÓRIO e é a prioridade nº 1. Prints e extratos AJUDAM, mas NÃO substituem o contrato — é só no contrato que aparece o seguro prestamista, a venda casada e os produtos embutidos.
- NUNCA encerre/encaminhe o caso como completo sem o contrato. Se faltar o contrato, continue solicitando-o de forma gentil.
- Se o cliente não tiver o contrato em mãos, NÃO desista: siga o roteiro "🔑 COMO CONSEGUIR O CONTRATO".

## 🔑 COMO CONSEGUIR O CONTRATO (roteiro — use quando o cliente não tem o contrato em mãos)

### 1ª via — MEU INSS (a mais viável para aposentados e pensionistas)
Primeiro identifique o perfil: "Você é aposentado(a) ou pensionista do INSS?"
- Se SIM, apresente a normativa e ofereça o Meu INSS:
"Ótimo! Desde 2023 existe uma norma do INSS que **obriga os bancos a disponibilizar a cópia do contrato dentro do aplicativo Meu INSS** (no extrato de empréstimos consignados). Então o seu contrato provavelmente já está lá. 😊
Você tem a senha do Meu INSS (a senha gov.br)?"
- Se o cliente TEM a senha e topa: ofereça as duas opções, deixando ele escolher:
  (a) "Você consegue entrar no app/site Meu INSS → 'Empréstimo Consignado' → 'Extrato de Empréstimos' e baixar a cópia do contrato pra me enviar. Quer que eu te explique o passo a passo?"
  (b) "Se preferir, com a sua autorização eu posso te ajudar a localizar o contrato lá dentro — nesse caso você me passa o acesso. Como prefere fazer?"
- NUNCA pressione pela senha. É opção do cliente. Se ele não quiser passar a senha, siga com a opção (a) ou as outras vias abaixo. Trate o acesso com sigilo (LGPD).
- Se o cliente NÃO é do INSS, pule para as outras vias.

### Outras vias de conseguir o contrato
- 📧 **E-mail**: "Muitos bancos enviam o contrato por e-mail na contratação. Dá uma olhada na sua caixa de entrada (e no spam) buscando pelo nome do banco."
- 💬 **WhatsApp**: "Verifique também a conversa do WhatsApp com o banco — às vezes o contrato foi enviado por lá."
- 🏦 **Agência / 0800**: "Você também pode pedir a 2ª via na agência ou pelo telefone/0800 do banco."
- 📱 **App do banco**: "No app do [banco], procure por 'Meus Contratos', 'Empréstimos' ou 'Documentos'."

Ofereça as vias na ordem acima (Meu INSS primeiro para quem é do INSS). Conduza uma de cada vez, sem despejar tudo.

### PASSO 3 — ACOMPANHAR RECEBIMENTO (um de cada vez se precisar)
- Quando receber documentos: "Recebi! ✅ Falta só [documento pendente]. Pode mandar?"
- Quando receber tudo: "Perfeito, [Nome]! Recebi todos os documentos. Vou encaminhar agora para o Dr. responsável. Em breve nossa equipe entra em contato com o resultado da análise! 😊" → inclua [ENCAMINHAR_AMANDA]

## 🖼️ QUANDO O CLIENTE MANDA UM PRINT / SCREENSHOT — analisar e direcionar para o CONTRATO:
Você recebe a análise da imagem no contexto. Use-a assim:
1. RECONHEÇA e IDENTIFIQUE o que o cliente enviou (print do app do banco, extrato, tela de empréstimos, contrato, RG, etc).
2. VALIDE o que viu, citando algo concreto se possível: "Recebi seu print do app do [banco] ✅ Consegui ver [o empréstimo / os descontos / a parcela...]."
3. Em seguida, SOLICITE O CONTRATO, explicando o porquê: "Mas para o Dr. confirmar se houve seguro ou venda casada, preciso do **contrato** desse empréstimo — é nele que aparece tudo que foi embutido. Você consegue baixar pelo app do [banco]?"
- Print NUNCA é suficiente sozinho: sempre analise + peça o contrato. Não rejeite friamente o print; aproveite-o como gancho.

## ❌ DOCUMENTO ERRADO — quando o enviado não corresponde ao pedido:
- Selfie, foto de objeto, paisagem, nota fiscal → "Esse não é o documento que preciso 😊 Preciso do seu RG (frente) ou CNH. Pode tirar uma foto do documento de identidade?"
- Documento de identidade de outra pessoa → "Preciso do *seu* documento. Pode me enviar o seu RG ou CNH?"
- PDF não relacionado (certidão, protocolo, recibo avulso) → "Esse documento não parece ser o contrato ou extrato bancário. Preciso do contrato de empréstimo ou extrato do banco. Consegue me enviar?"
- NUNCA confirme recebimento de um documento como se fosse o contrato quando ele claramente não é.

## 🚫 REGRA ANTI-LOOP
- Se já perguntou banco/tempo/valor 1 vez e o cliente foi vago → ACEITE e vá para pedir os documentos.
- "Não sei", "não lembro", "aproximadamente" → são respostas suficientes. Avance.
- NUNCA repita a mesma pergunta duas vezes. Se o cliente não sabe, não importa — peça os documentos.
- Não fique em ciclo de qualificação. 1 pergunta de banco → direto para documentos.

## TRATAMENTO DE OBJEÇÕES
- "Quanto custa?" → "Os honorários são apresentados após a análise do Dr. Primeiro me manda os documentos para ele avaliar seu caso. 😊"
- "Vou pensar" → "Claro! Mas se quiser adiantar, pode já me mandar os documentos. A análise fica pronta e quando você decidir já temos tudo."
- "Não tenho o contrato" → NÃO desista. Siga o roteiro "🔑 COMO CONSEGUIR O CONTRATO": comece perguntando se é aposentado/pensionista do INSS (para oferecer o Meu INSS, a via mais viável) e, se não for, ofereça e-mail/WhatsApp/agência/app. Enquanto isso, pode ir recebendo o extrato e o RG/CPF.
- "Não tenho dinheiro" → "Trabalhamos com condições que se adequam a cada caso. Me manda os documentos e o Dr. avalia — aí conversamos sobre pagamento."
- Quando precisar de atendimento humano: inclua [TRANSFERIR_HUMANO] no início da resposta.

## REGRAS DE COMUNICAÇÃO
- Máximo 4 linhas por mensagem
- Sempre termine com um pedido de documento específico ou confirmação de recebimento
- Emojis com moderação (1-2 por mensagem)
- NUNCA fique parado: cada mensagem deve estar mais perto de receber os documentos`;

const JERUSA_SYSTEM_PROMPT = `Você é a *Gerusa*, assistente de pré-triagem de casos de Direito Aéreo do escritório Bentes & Ramos Advocacia.

QUEM VOCÊ É:
- Especialista em: atrasos, cancelamentos, perda de conexão, overbooking, bagagem extraviada
- Tom: acolhedora, clara e profissional — frases curtas, sem termos jurídicos difíceis
- Conduz a pessoa passo a passo, sem pressionar
- NUNCA promete resultado, vitória ou indenização garantida

FRASES PERMITIDAS: "seu caso pode ser analisado", "pode haver possibilidade de indenização", "nossa equipe precisa verificar os documentos", "vamos encaminhar para análise"
FRASES PROIBIDAS: "você vai ganhar", "sua indenização está garantida", "a companhia é obrigada a pagar", "seu caso é causa ganha"

MISSÃO — TRIAGEM EM 6 PASSOS:

APRESENTAÇÃO (1ª mensagem):
"Olá! Eu sou a Gerusa, assistente da equipe. Vou fazer algumas perguntas rápidas para entender o que aconteceu com seu voo e verificar se seu caso pode ser encaminhado para análise. É bem rapidinho! 😊"
Depois: "Qual foi o problema com seu voo? Pode ser: atraso, cancelamento, perda de conexão, overbooking/embarque negado, bagagem extraviada ou outro."

PASSO 1 — PROBLEMA DO VOO: Entenda o tipo de problema. Se vago, faça uma pergunta simples.

PASSO 2 — TEMPO DE ATRASO: "Você lembra quanto tempo demorou até conseguir embarcar ou chegar ao destino?"
Acolha: menos de 1h / 1-2h / 2-4h / mais de 4h / não conseguiu viajar / não lembra.

PASSO 3 — SOLUÇÃO DA COMPANHIA: "A companhia aérea ofereceu alguma solução? Como outro voo, reembolso, voucher de alimentação ou hospedagem?"

PASSO 4 — PREJUÍZO: "Você teve algum prejuízo? Por exemplo: perdeu diária de hotel, compromisso importante, gastou com alimentação, transporte ou hospedagem?"
Se houve prejuízo: "Entendi. Esses detalhes são importantes para a análise, principalmente quando há gastos extras ou perda de compromisso."

PASSO 5 — COMPROVANTES: "Você ainda tem algum comprovante? Como passagem, cartão de embarque, e-mail da companhia ou recibos de gastos?"
Se não tiver nada: "Sem problema. Mesmo assim, nossa equipe pode verificar se existe alguma forma de analisar o caso com as informações que você tiver."

DOCUMENTO ERRADO (aéreo) — quando o enviado não corresponde:
- Foto pessoal ou objeto ao invés de passagem/embarque → "Esse não é o documento que preciso 😊 Preciso da passagem ou do localizador do voo. Tem o e-mail de confirmação da compra?"
- Documento sem relação com o voo → "Esse documento não está relacionado ao voo. Preciso da [passagem / cartão de embarque / e-mail da companhia]. Tem esse documento?"

PASSO 6 — DATA: "Quando isso aconteceu? Foi recentemente, no último mês, nos últimos 6 meses ou há mais de um ano?"

CLASSIFICAÇÃO INTERNA (nunca revele ao cliente):
QUENTE: atraso >4h, cancelamento, perda de conexão, overbooking, não conseguiu viajar, teve gasto extra ou perdeu compromisso/hotel, tem qualquer comprovante.
MÉDIO: atraso 2-4h, poucos comprovantes, recebeu solução mas ainda teve transtorno.
FRIO: atraso <1h, sem prejuízo, sem comprovantes, só quer tirar dúvida.

ENCAMINHAMENTO — Lead QUENTE:
"Pelo que você informou, seu caso merece uma análise mais detalhada. Para agilizar, preciso de alguns documentos — não precisa ter tudo, envie o que tiver:
📄 Passagem, e-ticket ou localizador | 🎫 Cartão de embarque (se tiver) | 📱 Prints ou e-mails da companhia
💰 Comprovantes de gastos extras | 🪪 Documento com foto (RG ou CNH) + CPF + comprovante de residência"

ENCAMINHAMENTO — Lead MÉDIO:
"Entendi. Seu caso precisa de uma análise mais cuidadosa. Envie o que tiver: passagem ou localizador, print ou e-mail da companhia, e o horário previsto e real do voo."

ENCAMINHAMENTO — Lead FRIO:
"Pelo que você informou, vale verificar melhor se houve algum direito envolvido. Se tiver passagem, prints ou qualquer comprovante, envie para a equipe avaliar com mais segurança."

RESUMO ANTES DE ENCAMINHAR (sempre enviar):
"Perfeito. Veja o que anotei:
✈️ Problema: [tipo] | ⏱️ Atraso: [tempo] | 🤝 Companhia ofereceu: [solução]
💸 Prejuízo: [prejuízo] | 📁 Comprovantes: [comprovantes] | 📅 Data: [data]
Agora nossa equipe continua a análise!"

AÇÕES:
- Quando tudo coletado → transicionar_estado com to_state "DOCS_PENDING"
- Se precisar de humano urgente → [TRANSFERIR_HUMANO] no início da resposta
- Confirmar cada documento recebido com marcar_doc_recebido

PERGUNTAS FREQUENTES:
- "Tenho direito?" → "Pode haver possibilidade, mas a equipe precisa analisar para confirmar."
- "Quanto vou receber?" → "O valor depende da análise do caso, dos documentos, do tempo de atraso e do prejuízo."
- "Tem custo?" → "Após a análise, nossa equipe explica as condições. Primeiro vamos verificar seu caso. 😊"
- Pessoa irritada → "Entendo que foi muito difícil. Você não deveria ter passado por isso. Vou te ajudar da melhor forma possível."
- Áudio ou texto confuso → "Me diz apenas: o que aconteceu, quando aconteceu e quanto tempo demorou."

REGRAS ABSOLUTAS:
- NUNCA prometa resultado ou indenização garantida
- NUNCA peça todos os documentos logo de início — primeiro faça a triagem
- Máximo 4 linhas por mensagem | 1-2 emojis por mensagem
- Cada mensagem deve avançar a conversa`;

const AGENT_PROMPTS: Record<string, string> = {
  'isa_triagem':  ISA_SYSTEM_PROMPT,
  'isa_bancario': MELISSA_SYSTEM_PROMPT,
  'isa_aereo':    JERUSA_SYSTEM_PROMPT,
};

const AGENT_NAMES: Record<string, string> = {
  'isa_triagem':  'Isa',
  'isa_bancario': 'Melissa',
  'isa_aereo':    'Gerusa',
};

// ============================================================
// PROCESSAR MÍDIA (ÁUDIO/IMAGEM)
// ============================================================
async function processMedia(
  mediaUrl: string,
  mediaType: string,
  leadId: string | null,
  supabase: any
): Promise<{ processed: boolean; content: string; extractedData?: any }> {
  console.log('[ISA-REPLY] 📦 Processando mídia:', mediaType, mediaUrl?.substring(0, 50));

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/isa-multimodal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'process_media',
        mediaUrl,
        mediaType,
        leadId,
      }),
    });

    if (!response.ok) {
      console.error('[ISA-REPLY] Erro ao processar mídia:', response.status);
      return { processed: false, content: '' };
    }

    const result = await response.json();
    console.log('[ISA-REPLY] Resultado do processamento:', result);

    if (result.success) {
      if (result.transcription) {
        return { 
          processed: true, 
          content: `[ÁUDIO TRANSCRITO]: "${result.transcription}"` 
        };
      }
      if (result.analysis) {
        return { 
          processed: true, 
          content: result.mediaType === 'pdf' 
            ? `[PDF ANALISADO - CONTRATO/EXTRATO]: ${result.analysis}` 
            : `[IMAGEM ANALISADA]: ${result.analysis}` 
        };
      }
      if (result.documentType) {
        return {
          processed: true,
          content: `[DOCUMENTO ${result.documentType} RECEBIDO E PROCESSADO]`,
          extractedData: result.data
        };
      }
    }

    return { processed: false, content: '' };
  } catch (error) {
    console.error('[ISA-REPLY] Erro ao processar mídia:', error);
    return { processed: false, content: '' };
  }
}

// ============================================================
// BUSCAR CONTEXTO COMPLETO DO LEAD
// ============================================================
async function getLeadContext(leadId: string, supabase: any): Promise<string> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/isa-multimodal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'get_lead_context',
        leadId,
      }),
    });

    if (!response.ok) return '';

    const result = await response.json();
    if (!result.success || !result.context) return '';

    const ctx = result.context;
    const lead = ctx.lead;
    const classification = ctx.classification;
    const contractData = ctx.contractData;

    let contextStr = `
[CONTEXTO COMPLETO DO LEAD]
📋 Nome: ${lead?.nome || 'Não identificado'}
📱 Telefone: ${lead?.telefone || 'N/A'}
📧 Email: ${lead?.email || 'N/A'}
🔄 Estado atual: ${lead?.lead_state || 'NEW'}
📊 Status: ${lead?.status || 'Lead Frio'}
`;

    if (classification) {
      contextStr += `
🏷️ Classificação: ${classification.case_type || 'Não classificado'}
📝 Subtipo: ${classification.sub_type || 'N/A'}
💡 Resumo: ${classification.summary || 'N/A'}
`;
    }

    if (contractData) {
      contextStr += `
📄 Dados contratuais coletados:
- CPF: ${contractData.cpf || '❌ Pendente'}
- RG: ${contractData.rg || '❌ Pendente'}
- Endereço: ${contractData.endereco || '❌ Pendente'}
- Data nasc: ${contractData.data_nascimento || '❌ Pendente'}
`;
    }

    if (ctx.docsChecklist?.length > 0) {
      const recebidos = ctx.docsChecklist.filter((d: any) => d.received);
      const pendentes = ctx.docsChecklist.filter((d: any) => !d.received);
      contextStr += `
📑 Documentos: ${recebidos.length} recebidos, ${pendentes.length} pendentes
`;
      if (pendentes.length > 0) {
        contextStr += `   Pendentes: ${pendentes.map((d: any) => d.doc_label).join(', ')}\n`;
      }
    }

    if (ctx.compromissos?.length > 0) {
      const proximoCompromisso = ctx.compromissos.find((c: any) => new Date(c.data_inicio) > new Date());
      if (proximoCompromisso) {
        contextStr += `📅 Próximo compromisso: ${proximoCompromisso.titulo} em ${new Date(proximoCompromisso.data_inicio).toLocaleDateString('pt-BR')}\n`;
      }
    }

    contextStr += `
📊 Métricas:
- Total mensagens: ${ctx.totalMensagens}
- Dias desde contato: ${ctx.diasDesdeContato}
`;

    // Histórico das últimas mensagens
    if (ctx.mensagens?.length > 0) {
      contextStr += `
[HISTÓRICO RECENTE - Últimas ${Math.min(ctx.mensagens.length, 30)} mensagens]
`;
      const ultimasMsgs = ctx.mensagens.slice(0, 30).reverse();
      for (const msg of ultimasMsgs) {
        const origem = msg.direcao === 'entrada' ? 'CLIENTE' : 'ISA/EQUIPE';
        contextStr += `[${origem}] ${msg.conteudo?.substring(0, 150)}${msg.conteudo?.length > 150 ? '...' : ''}\n`;
      }
    }

    return contextStr;
  } catch (error) {
    console.error('[ISA-REPLY] Erro ao buscar contexto:', error);
    return '';
  }
}

// ============================================================
// DETERMINAR E ATUALIZAR ESTADO DO LEAD
// ============================================================
async function determineAndUpdateLeadState(
  leadId: string,
  currentState: string | null,
  mensagemCliente: string,
  respostaIsa: string,
  hasMedia: boolean,
  extractedData: any,
  supabase: any
): Promise<string | null> {
  const state = currentState || 'NEW';
  let newState: string | null = null;
  let reason = '';

  const msgLower = mensagemCliente.toLowerCase();
  const respostaLower = respostaIsa.toLowerCase();

  // Análise baseada em padrões e contexto
  switch (state) {
    case 'NEW':
      // Cliente respondeu pela primeira vez → TRIAGE
      if (mensagemCliente.length > 5) {
        newState = 'TRIAGE';
        reason = 'Cliente iniciou conversa - entrada em triagem';
      }
      break;

    case 'TRIAGE':
      // Detectar se classificação pode ser feita
      const indiciosBancario = /banco|financiamento|empréstimo|consignado|cartão|juros|dívida|parcela|seguro|vendas? casadas?/i;
      const indiciosAereo = /voo|avião|viagem|bagagem|aeroporto|companhia|latam|gol|azul|american/i;
      
      if (indiciosBancario.test(msgLower) || indiciosAereo.test(msgLower)) {
        newState = 'CLASSIFIED';
        reason = `Caso identificado: ${indiciosBancario.test(msgLower) ? 'Bancário' : 'Aéreo'}`;
      }
      break;

    case 'CLASSIFIED':
      // Se Isa está pedindo dados ou cliente está enviando dados → DATA_CAPTURE
      const pedindoDados = /cpf|rg|documento|endereço|nome completo|nascimento|seus dados|envie.*foto/i;
      const enviandoDados = /meu cpf|meu rg|moro em|nasci em|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11}/;
      
      if (pedindoDados.test(respostaLower) || enviandoDados.test(msgLower) || extractedData) {
        newState = 'DATA_CAPTURE';
        reason = 'Iniciando coleta de dados para contrato';
      }
      break;

    case 'DATA_CAPTURE':
      // Verificar se documento foi processado com dados extraídos
      if (extractedData || hasMedia) {
        // Checar se já temos dados suficientes para contrato
        const { data: contractData } = await supabase
          .from('lead_contract_data')
          .select('cpf, rg, nome_mae')
          .eq('lead_id', leadId)
          .maybeSingle();

        if (contractData?.cpf && contractData?.rg) {
          // Dados mínimos coletados, mas ainda não enviou contrato
          reason = 'Dados principais coletados';
        }
      }
      
      // Se mencionou envio de contrato
      if (/contrato|assinatura|clicksign|enviar.*contrato/i.test(respostaLower)) {
        newState = 'CONTRACT_SENT';
        reason = 'Contrato será enviado ao cliente';
      }
      break;

    case 'CONTRACT_SENT':
      // Detectar assinatura
      if (/assinei|assinado|assinatura|confirmado/i.test(msgLower)) {
        newState = 'CONTRACT_SIGNED';
        reason = 'Cliente confirmou assinatura do contrato';
      }
      break;

    case 'CONTRACT_SIGNED':
      // Checar documentos pendentes
      if (/documento|comprovante|enviar|pendente/i.test(respostaLower)) {
        newState = 'DOCS_PENDING';
        reason = 'Aguardando documentos adicionais';
      }
      break;

    case 'DOCS_PENDING':
      // Verificar checklist de documentos
      const { data: checklist } = await supabase
        .from('lead_docs_checklist')
        .select('received')
        .eq('lead_id', leadId)
        .eq('is_required', true);

      if (checklist && checklist.length > 0) {
        const todosRecebidos = checklist.every((d: any) => d.received);
        if (todosRecebidos) {
          newState = 'READY_FOR_LAWYER';
          reason = 'Todos documentos obrigatórios recebidos';
        }
      }
      break;
  }

  // Atualizar estado se houve mudança
  if (newState && newState !== state) {
    console.log(`[ISA-REPLY] 🔄 Transição de estado: ${state} → ${newState} (${reason})`);

    // Usar a função RPC para atualizar estado com histórico
    const { error } = await supabase.rpc('update_lead_state', {
      p_lead_id: leadId,
      p_to_state: newState,
      p_changed_by: 'isa-reply-zapi',
      p_reason: reason,
    });

    if (error) {
      console.error('[ISA-REPLY] Erro ao atualizar estado:', error);
      
      // Fallback: atualizar diretamente
      await supabase
        .from('leads_juridicos')
        .update({ 
          lead_state: newState,
          state_updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      await supabase
        .from('lead_state_history')
        .insert({
          lead_id: leadId,
          from_state: state,
          to_state: newState,
          changed_by: 'isa-reply-zapi',
          reason: reason,
        });
    }

    return newState;
  }

  return null;
}

// ============================================================
// FERRAMENTAS DOS AGENTES (FUNCTION CALLING)
// ============================================================
const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'transferir_para_especialista',
      description: 'Use quando identificar que o caso é Bancário (banco, empréstimo, financiamento, consignado, cartão, juros) ou Aéreo (voo, bagagem, companhia aérea). Transfere o atendimento para a especialista correta imediatamente.',
      parameters: {
        type: 'object',
        properties: {
          especialista: { type: 'string', enum: ['melissa', 'jerusa'], description: 'melissa = Direito Bancário | jerusa = Direito Aéreo' },
          resumo_caso: { type: 'string', description: 'Resumo do caso para briefar a especialista (banco, produto, problema relatado)' },
        },
        required: ['especialista', 'resumo_caso'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'registrar_documentos_recebidos',
      description: 'Use quando o cliente enviar um ou mais documentos (imagem, PDF). Registra quais documentos foram recebidos.',
      parameters: {
        type: 'object',
        properties: {
          documentos: {
            type: 'array',
            items: { type: 'string', enum: ['contrato', 'extrato', 'rg', 'cpf', 'bilhete', 'comprovante_problema', 'outro'] },
            description: 'Lista dos documentos recebidos nesta mensagem',
          },
        },
        required: ['documentos'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'encaminhar_para_analise',
      description: 'Use quando todos os documentos necessários foram recebidos. Encaminha o caso para a equipe fazer a análise e entrar em contato com o cliente.',
      parameters: {
        type: 'object',
        properties: {
          resumo_completo: { type: 'string', description: 'Resumo completo do caso: banco, produto, problema e documentos recebidos' },
        },
        required: ['resumo_completo'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'agendar_followup',
      description: 'Use após enviar uma pergunta importante ou pedido de documentos. Agenda follow-up automático para caso o cliente não responda.',
      parameters: {
        type: 'object',
        properties: {
          horas: { type: 'number', description: 'Horas para aguardar antes de enviar o follow-up (ex: 2, 4, 24)' },
          mensagem_followup: { type: 'string', description: 'Mensagem personalizada para o follow-up — natural, não robótica' },
        },
        required: ['horas', 'mensagem_followup'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'encaminhar_aposentadoria',
      description: 'Use quando o cliente mencionar INSS, aposentadoria, benefício, auxílio-doença, BPC/LOAS, pensão. Encaminha para Dra. Kariny Bianca.',
      parameters: {
        type: 'object',
        properties: {
          nome_cliente: { type: 'string', description: 'Nome do cliente' },
          resumo: { type: 'string', description: 'Resumo breve do que o cliente precisa' },
        },
        required: ['nome_cliente', 'resumo'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'transferir_para_humano',
      description: 'Use quando: (1) cliente pede para falar com uma pessoa, (2) situação muito complexa fora do escopo, (3) cliente demonstra insatisfação grave, (4) dúvida sobre honorários específicos.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string', description: 'Motivo detalhado da transferência' },
        },
        required: ['motivo'],
      },
    },
  },
];

// ============================================================
// EXECUTAR FERRAMENTAS
// ============================================================
async function executeTool(
  toolName: string,
  args: any,
  leadId: string | null,
  subscriberId: string,
  supabase: any,
): Promise<{ result: string; flag?: string }> {
  console.log(`[ISA-REPLY] 🔧 Tool: ${toolName}`, JSON.stringify(args).substring(0, 150));

  switch (toolName) {
    case 'transferir_para_especialista': {
      const agentMap: Record<string, string> = { melissa: 'isa_bancario', jerusa: 'isa_aereo' };
      const newAgent = agentMap[args.especialista] || 'isa_bancario';
      if (leadId) {
        await supabase.from('leads_juridicos').update({ isa_agent: newAgent }).eq('id', leadId);
        await supabase.from('interacoes').insert({
          cliente_id: leadId,
          tipo: 'WhatsApp',
          resumo: `ISA transferiu para ${args.especialista === 'melissa' ? 'Melissa (Bancário)' : 'Jerusa (Aéreo)'}`,
          detalhes: args.resumo_caso,
          direcao: 'Interna',
        });
      }
      return { result: `Transferido para ${args.especialista}. Briefing: ${args.resumo_caso}` };
    }

    case 'registrar_documentos_recebidos': {
      if (leadId && args.documentos?.length > 0) {
        for (const doc of args.documentos) {
          await supabase.from('lead_docs_checklist').upsert({
            lead_id: leadId,
            doc_label: doc,
            received: true,
            received_at: new Date().toISOString(),
          }, { onConflict: 'lead_id,doc_label' });
        }
      }
      return { result: `Documentos registrados: ${args.documentos?.join(', ')}` };
    }

    case 'encaminhar_para_analise': {
      return { result: `Encaminhando para análise: ${args.resumo_completo}`, flag: 'ENCAMINHAR_AMANDA' };
    }

    case 'agendar_followup': {
      if (leadId) {
        const followupAt = new Date(Date.now() + args.horas * 3_600_000).toISOString();
        await supabase.from('system_events').insert({
          tipo: 'followup_agendado',
          fonte: 'isa-reply-zapi',
          acao: 'followup_automatico',
          lead_id: leadId,
          dados: {
            subscriber_id: subscriberId,
            mensagem: args.mensagem_followup,
            agendado_para: followupAt,
            horas: args.horas,
          },
          processado: false,
        });
      }
      return { result: `Follow-up em ${args.horas}h: "${args.mensagem_followup}"` };
    }

    case 'encaminhar_aposentadoria': {
      return { result: `Encaminhar para Dra. Kariny: ${args.nome_cliente} — ${args.resumo}`, flag: 'ENCAMINHAR_APOSENTADORIA' };
    }

    case 'transferir_para_humano': {
      return { result: `Transferindo para humano: ${args.motivo}`, flag: 'TRANSFERIR_HUMANO' };
    }

    default:
      return { result: 'Tool desconhecida' };
  }
}

// ============================================================
// BUSCAR HISTÓRICO REAL DA CONVERSA
// ============================================================
async function getConversationHistory(
  subscriberId: string,
  supabase: any,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const { data: msgs } = await supabase
    .from('manychat_mensagens')
    .select('conteudo, direcao, created_at')
    .eq('subscriber_id', subscriberId)
    .order('created_at', { ascending: true })
    .limit(60);

  return (msgs || [])
    .filter((m: any) => m.conteudo?.trim())
    .map((m: any) => ({
      role: m.direcao === 'entrada' ? 'user' : 'assistant',
      content: (m.conteudo || '').substring(0, 800),
    }));
}

// ============================================================
// GERAR RESPOSTA COM IA — GPT-4o + FUNCTION CALLING
// ============================================================
async function generateResponse(
  newMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  leadId: string | null,
  subscriberId: string,
  supabase: any,
  leadContext: string = '',
): Promise<{
  response: string;
  toolsExecuted: string[];
  needsHandoff: boolean;
  needsAmandaEncaminhamento: boolean;
  needsAposentadoriaEncaminhamento: boolean;
}> {
  const apiKey = OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada');

  const systemFull = leadContext
    ? `${systemPrompt}\n\n---\n[CONTEXTO DO LEAD]\n${leadContext}`
    : systemPrompt;

  const messages: any[] = [
    { role: 'system', content: systemFull },
    ...conversationHistory,
    { role: 'user', content: newMessage },
  ];

  const toolsExecuted: string[] = [];
  let needsHandoff = false;
  let needsAmandaEncaminhamento = false;
  let needsAposentadoriaEncaminhamento = false;

  // Primeira chamada com tools
  const res1 = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
      max_tokens: 600,
      temperature: 0.65,
    }),
  });

  if (!res1.ok) {
    const err = await res1.text();
    throw new Error(`OpenAI API error ${res1.status}: ${err.substring(0, 200)}`);
  }

  const data1 = await res1.json();
  const choice1 = data1.choices?.[0];

  // Processar tool calls se existirem
  if (choice1?.message?.tool_calls?.length > 0) {
    const toolCallMsg = choice1.message;
    const toolResultMsgs: any[] = [];

    for (const tc of toolCallMsg.tool_calls) {
      let args: any = {};
      try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }

      const { result, flag } = await executeTool(tc.function.name, args, leadId, subscriberId, supabase);
      toolsExecuted.push(tc.function.name);

      if (flag === 'TRANSFERIR_HUMANO') needsHandoff = true;
      if (flag === 'ENCAMINHAR_AMANDA') needsAmandaEncaminhamento = true;
      if (flag === 'ENCAMINHAR_APOSENTADORIA') needsAposentadoriaEncaminhamento = true;

      toolResultMsgs.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }

    // Segunda chamada para obter resposta final em texto
    const res2 = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [...messages, toolCallMsg, ...toolResultMsgs],
        max_tokens: 500,
        temperature: 0.65,
      }),
    });

    if (!res2.ok) throw new Error(`OpenAI 2nd call error ${res2.status}`);
    const data2 = await res2.json();
    const responseText = data2.choices?.[0]?.message?.content || '';

    return { response: responseText, toolsExecuted, needsHandoff, needsAmandaEncaminhamento, needsAposentadoriaEncaminhamento };
  }

  // Sem tool calls — verificar tags legadas por compatibilidade
  const responseText = choice1?.message?.content || '';
  if (responseText.includes('[TRANSFERIR_HUMANO]')) needsHandoff = true;
  if (responseText.includes('[ENCAMINHAR_AMANDA]')) needsAmandaEncaminhamento = true;
  if (responseText.includes('[ENCAMINHAR_APOSENTADORIA]')) needsAposentadoriaEncaminhamento = true;

  return {
    response: responseText.replace(/\[TRANSFERIR_HUMANO\]|\[ENCAMINHAR_AMANDA\]|\[ENCAMINHAR_APOSENTADORIA\]/g, '').trim(),
    toolsExecuted,
    needsHandoff,
    needsAmandaEncaminhamento,
    needsAposentadoriaEncaminhamento,
  };
}

// ============================================================
// ENVIAR RESPOSTA VIA Z-API (zapi-send)
// ============================================================
async function sendViaZapi(
  telefone: string,
  message: string,
  leadId?: string | null,
  instanceId?: string | null
): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/zapi-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        to_phone: telefone,
        message,
        type: 'text',
        provider: 'zapi',
        lead_id: leadId,
        instance_id: instanceId,
      }),
    });

    const result = await response.json();
    console.log('[ISA-REPLY] Resposta Z-API:', result.success ? '✅' : '❌', JSON.stringify(result).substring(0, 200));
    return result.success === true;
  } catch (error) {
    console.error('[ISA-REPLY] Erro ao enviar via Z-API:', error);
    return false;
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    console.log('[ISA-REPLY] 📨 Payload recebido:', JSON.stringify(body).substring(0, 300));

    // Extrair dados do payload (compatível com Z-API webhook)
    const subscriberId = body.subscriber_id?.toString().replace(/^\[|\]$/g, '').trim();
    let mensagem = body.last_input_text || body.message || body.text || '';
    const nome = body.full_name || body.name || body.first_name || 'Cliente';
    const telefone = body.phone || body.wa_id || '';
    const canal = body.channel || 'whatsapp';
    
    // Dados de mídia
    const mediaUrl = body.media_url || body.attachment_url || body.file_url || '';
    const mediaType = body.media_type || body.attachment_type || '';

    if (!subscriberId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'subscriber_id obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Deduplicação: ignorar se já respondemos a mesma mensagem nos últimos 60s ──
    const dedupeWindow = new Date(Date.now() - 60_000).toISOString();
    const { data: recentReply } = await supabase
      .from('manychat_mensagens')
      .select('id')
      .eq('subscriber_id', subscriberId)
      .eq('direcao', 'saida')
      .gte('created_at', dedupeWindow)
      .limit(1)
      .maybeSingle();

    if (recentReply) {
      console.log('[ISA-REPLY] ⏭️ Deduplicação: resposta já enviada nos últimos 60s para', subscriberId);
      return new Response(JSON.stringify({
        success: true, skipped: true, reason: 'deduplicated_60s'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Buscar subscriber e lead vinculado
    const { data: subscriber } = await supabase
      .from('manychat_subscribers')
      .select('lead_id, nome, atendimento_humano')
      .eq('subscriber_id', subscriberId)
      .maybeSingle();

    // 🛑 Verificar atendimento humano
    if (subscriber?.atendimento_humano) {
      console.log('[ISA-REPLY] ⏸️ Atendimento humano ativo');
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        reason: 'atendimento_humano_ativo' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const leadId = subscriber?.lead_id;
    
    // Buscar estado atual do lead, tipo de origem e agente ativo
    let currentLeadState: string | null = null;
    let tipoOrigem: string | null = null;
    let fonteTrafego: string | null = null;
    let isaAgent: string = 'isa_triagem';

    if (leadId) {
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('lead_state, tipo_origem, fonte_trafego, isa_agent')
        .eq('id', leadId)
        .maybeSingle();
      currentLeadState = lead?.lead_state || null;
      tipoOrigem = lead?.tipo_origem || null;
      fonteTrafego = lead?.fonte_trafego || null;
      isaAgent = lead?.isa_agent || 'isa_triagem';
    }

    // 🛑 ISA só processa leads de TRÁFEGO
    // Leads "whatsapp_direto" (Bentes & Ramos antigos) não entram no fluxo automático
    if (leadId && tipoOrigem && tipoOrigem !== 'trafego') {
      console.log('[ISA-REPLY] ⏸️ Lead não é de tráfego, ignorando automação. tipo_origem:', tipoOrigem);
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        reason: 'lead_nao_trafego',
        tipo_origem: tipoOrigem
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // 📦 Processar mídia se presente
    let mediaContent = '';
    let extractedData = null;
    
    if (mediaUrl) {
      const mediaResult = await processMedia(mediaUrl, mediaType, leadId, supabase);
      if (mediaResult.processed) {
        mediaContent = mediaResult.content;
        extractedData = mediaResult.extractedData;
        console.log('[ISA-REPLY] ✅ Mídia processada:', mediaContent.substring(0, 100));
      }
    }

    // Combinar mensagem com conteúdo de mídia
    const fullMessage = mediaContent 
      ? `${mediaContent}\n\n${mensagem ? `Mensagem adicional: ${mensagem}` : ''}`
      : mensagem;

    if (!fullMessage || fullMessage.trim() === '') {
      console.log('[ISA-REPLY] Mensagem vazia, ignorando');
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        reason: 'mensagem vazia' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[ISA-REPLY] 💬 Processando:', fullMessage.substring(0, 100));

    // 📋 Contexto mínimo do lead (estado, documentos pendentes) para orientar a IA
    let leadContext = '';
    if (leadId) {
      try {
        const ctxPromise = getLeadContext(leadId, supabase);
        const timeoutPromise = new Promise<string>(r => setTimeout(() => r(''), 4000));
        leadContext = await Promise.race([ctxPromise, timeoutPromise]);
      } catch { leadContext = ''; }

      // Fluxo expresso para leads de anúncio com mensagem padrão
      if (/quero saber se meu contrato tem venda casada/i.test(mensagem)) {
        leadContext = `[LEAD DE ANÚNCIO - FLUXO EXPRESSO] Solicite IMEDIATAMENTE contrato e extrato bancário.\n\n${leadContext}`;
      }
    } else {
      leadContext = `[NOVO CONTATO]\nNome: ${nome} | Telefone: ${telefone}`;
    }

    // 📜 Histórico real da conversa
    const conversationHistory = await getConversationHistory(subscriberId, supabase);

    // Determinar prompt e nome do agente ativo
    const activePrompt = AGENT_PROMPTS[isaAgent] || ISA_SYSTEM_PROMPT;
    const activeAgentName = AGENT_NAMES[isaAgent] || 'Isa';
    console.log(`[ISA-REPLY] 🤖 Agente: ${activeAgentName} | Histórico: ${conversationHistory.length} msgs`);

    // 🤖 Gerar resposta com GPT-4o + Function Calling
    let respostaIsa = '';
    let needsHandoff = false;
    let needsAmandaEncaminhamento = false;
    let needsAposentadoriaEncaminhamento = false;
    let toolsExecuted: string[] = [];

    try {
      const aiResult = await generateResponse(
        fullMessage, conversationHistory, activePrompt,
        leadId, subscriberId, supabase, leadContext,
      );
      respostaIsa = aiResult.response;
      needsHandoff = aiResult.needsHandoff;
      needsAmandaEncaminhamento = aiResult.needsAmandaEncaminhamento;
      needsAposentadoriaEncaminhamento = aiResult.needsAposentadoriaEncaminhamento;
      toolsExecuted = aiResult.toolsExecuted;
      if (toolsExecuted.length > 0) {
        console.log('[ISA-REPLY] 🔧 Tools executadas:', toolsExecuted.join(', '));
      }
    } catch (aiError) {
      console.error('[ISA-REPLY] ❌ Erro na IA, usando fallback:', aiError);
    }

    if (!respostaIsa) {
      const primeiroNome = (subscriber?.nome || nome || 'Cliente').split(' ')[0];
      respostaIsa = `${primeiroNome}, recebi sua mensagem! 😊 Pode continuar me contando sobre sua situação?`;
    }

    // ── Suprimir se idêntica à última mensagem enviada ──
    const { data: ultimaMsgEnviada } = await supabase
      .from('manychat_mensagens')
      .select('conteudo')
      .eq('subscriber_id', subscriberId)
      .eq('direcao', 'saida')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimaMsgEnviada?.conteudo) {
      const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 120);
      if (normalize(respostaIsa) === normalize(ultimaMsgEnviada.conteudo)) {
        console.log('[ISA-REPLY] ⏭️ Resposta idêntica à anterior, suprimindo');
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'identical_suppressed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const respostaLimpa = respostaIsa.trim();

    // Truncar resposta para WhatsApp (máx 500 chars)
    const respostaFinal = respostaLimpa.length > 500 
      ? respostaLimpa.substring(0, 497) + '...' 
      : respostaLimpa;

    // 🚨 Se precisa de handoff, ativar atendimento humano e notificar Amanda
    if (needsHandoff && leadId) {
      console.log('[ISA-REPLY] 🚨 HANDOFF detectado — transferindo para Amanda');

      // Marcar subscriber como atendimento humano
      await supabase
        .from('manychat_subscribers')
        .update({ 
          atendimento_humano: true, 
          atendimento_humano_desde: new Date().toISOString() 
        })
        .eq('subscriber_id', subscriberId);

      // Desativar ISA no lead
      await supabase
        .from('leads_juridicos')
        .update({ isa_ativa: false, owner_tipo: 'humano' })
        .eq('id', leadId);

      // Registrar interação de handoff
      await supabase.from('interacoes').insert({
        cliente_id: leadId,
        tipo: 'WhatsApp',
        resumo: 'ISA transferiu para atendimento humano (Amanda)',
        detalhes: `Motivo: ISA não soube responder ou teve dúvidas.\nÚltima mensagem do cliente: ${fullMessage.substring(0, 300)}\nResposta da ISA antes do handoff: ${respostaFinal.substring(0, 300)}`,
        direcao: 'Interna',
      });

      // Notificar Amanda por e-mail via Resend
      try {
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
        if (RESEND_API_KEY) {
          const leadNome = subscriber?.nome || nome || 'Cliente';
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'ISA <noreply@bentesramos.com.br>',
              to: ['amanda@bentesramos.com.br'],
              subject: `🚨 ISA transferiu atendimento: ${leadNome}`,
              html: `
                <h2>Transferência de Atendimento</h2>
                <p><strong>Cliente:</strong> ${leadNome}</p>
                <p><strong>Telefone:</strong> ${telefone || 'N/A'}</p>
                <p><strong>Motivo:</strong> ISA não soube responder ou teve dúvidas sobre a questão.</p>
                <hr/>
                <p><strong>Última mensagem do cliente:</strong></p>
                <blockquote>${fullMessage.substring(0, 500)}</blockquote>
                <p><strong>Resposta da ISA:</strong></p>
                <blockquote>${respostaFinal.substring(0, 500)}</blockquote>
                <hr/>
                <p>Acesse o CRM para continuar o atendimento.</p>
              `,
            }),
          });
          console.log('[ISA-REPLY] 📧 E-mail de notificação enviado para Amanda');
        }
      } catch (emailErr) {
        console.error('[ISA-REPLY] Erro ao enviar e-mail de handoff:', emailErr);
      }

      // 🔔 Notificação interna no sistema para Amanda (e admins)
      try {
        const leadNomeNotif = subscriber?.nome || nome || 'Cliente';
        
        // Buscar todos os perfis com cargo Administrador ou Gerente para notificar
        const { data: admins } = await supabase
          .from('perfis')
          .select('id, email')
          .in('cargo', ['Administrador', 'Gerente']);

        // Também buscar Amanda especificamente pelo email
        const { data: amanda } = await supabase
          .from('perfis')
          .select('id')
          .eq('email', 'amanda@bentesramos.com.br')
          .maybeSingle();

        const userIds = new Set<string>();
        if (amanda?.id) userIds.add(amanda.id);
        if (admins) admins.forEach((a: any) => userIds.add(a.id));

        // Inserir notificação para cada usuário relevante
        const notificacoes = Array.from(userIds).map(uid => ({
          user_id: uid,
          titulo: `🚨 ISA transferiu: ${leadNomeNotif}`,
          mensagem: `A ISA não soube responder e transferiu o atendimento de ${leadNomeNotif}. Última mensagem: "${fullMessage.substring(0, 150)}"`,
          tipo: 'handoff',
          lead_id: leadId,
          link: '/chat',
          dados: {
            subscriber_id: subscriberId,
            mensagem_cliente: fullMessage.substring(0, 300),
            resposta_isa: respostaFinal.substring(0, 300),
          },
        }));

        if (notificacoes.length > 0) {
          await supabase.from('notificacoes_internas').insert(notificacoes);
          console.log(`[ISA-REPLY] 🔔 ${notificacoes.length} notificação(ões) interna(s) criada(s)`);
        }
      } catch (notifErr) {
        console.error('[ISA-REPLY] Erro ao criar notificação interna:', notifErr);
      }

      // Registrar evento de sistema
      await supabase.from('system_events').insert({
        tipo: 'handoff',
        fonte: 'isa-reply-zapi',
        acao: 'transferencia_humano',
        lead_id: leadId,
        dados: {
          subscriber_id: subscriberId,
          motivo: 'ISA não soube responder',
          mensagem_cliente: fullMessage.substring(0, 300),
        },
        processado: true,
      });
    }

    // 🏥 Encaminhamento para Dra. Kariny Bianca (Aposentadoria/Previdenciário)
    if (needsAposentadoriaEncaminhamento) {
      console.log('[ISA-REPLY] 🏥 Caso de aposentadoria detectado — encaminhando para Dra. Kariny Bianca');
      
      const leadNome = subscriber?.nome || nome || 'Cliente';
      const leadTelefone = telefone || 'N/A';
      
      // Montar resumo para a Dra. Kariny
      const mensagemKariny = `🔔 *Indicação do escritório Bentes & Ramos*\n\n` +
        `Olá Dra. Kariny! Aqui é a Isa, assistente do escritório Bentes & Ramos Advocacia.\n\n` +
        `Recebemos um cliente com demanda previdenciária e gostaríamos de encaminhá-lo para a senhora:\n\n` +
        `👤 *Nome:* ${leadNome}\n` +
        `📱 *Telefone:* ${leadTelefone}\n` +
        (leadId ? `📋 *Resumo da conversa:*\n${fullMessage.substring(0, 400)}\n` : '') +
        `\nFicamos à disposição para qualquer informação adicional! 🤝`;

      // Enviar mensagem para Dra. Kariny via Z-API
      const karinyPhone = '5592991126544';
      await sendViaZapi(karinyPhone, mensagemKariny, null, null);
      console.log('[ISA-REPLY] ✅ Mensagem enviada para Dra. Kariny Bianca');

      // Registrar evento
      await supabase.from('system_events').insert({
        tipo: 'encaminhamento',
        fonte: 'isa-reply-zapi',
        acao: 'encaminhamento_aposentadoria',
        lead_id: leadId,
        dados: {
          subscriber_id: subscriberId,
          nome_cliente: leadNome,
          telefone_cliente: leadTelefone,
          encaminhado_para: 'Dra. Kariny Bianca - (92) 99112-6544',
          mensagem_cliente: fullMessage.substring(0, 300),
        },
        processado: true,
      });

      // Registrar interação se lead existir
      if (leadId) {
        await supabase.from('interacoes').insert({
          cliente_id: leadId,
          tipo: 'WhatsApp',
          resumo: 'Lead encaminhado para Dra. Kariny Bianca (Previdenciário)',
          detalhes: `Cliente com demanda previdenciária encaminhado para Dra. Kariny Bianca (92) 99112-6544.\nMensagem do cliente: ${fullMessage.substring(0, 300)}`,
          direcao: 'Interna',
        });
      }
    }

    // 📄 Encaminhamento para Amanda (análise documental de lead de anúncio)
    if (needsAmandaEncaminhamento && leadId) {
      console.log('[ISA-REPLY] 📄 Análise concluída — encaminhando documentação para Amanda');

      const leadNomeAmanda = subscriber?.nome || nome || 'Cliente';

      // Ativar atendimento humano para Amanda dar sequência
      await supabase
        .from('manychat_subscribers')
        .update({ 
          atendimento_humano: true, 
          atendimento_humano_desde: new Date().toISOString() 
        })
        .eq('subscriber_id', subscriberId);

      await supabase
        .from('leads_juridicos')
        .update({ isa_ativa: false, owner_tipo: 'humano' })
        .eq('id', leadId);

      // Notificar Amanda por e-mail
      try {
        const RESEND_API_KEY_AMANDA = Deno.env.get('RESEND_API_KEY');
        if (RESEND_API_KEY_AMANDA) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY_AMANDA}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'ISA <noreply@bentesramos.com.br>',
              to: ['amanda@bentesramos.com.br'],
              subject: `📄 ISA analisou documentos: ${leadNomeAmanda}`,
              html: `
                <h2>Análise Documental Concluída</h2>
                <p><strong>Cliente:</strong> ${leadNomeAmanda}</p>
                <p><strong>Origem:</strong> Lead de anúncio Meta Ads</p>
                <p><strong>Análise da ISA:</strong></p>
                <blockquote>${respostaFinal.substring(0, 800)}</blockquote>
                <hr/>
                <p>O cliente aguarda seu contato para dar sequência. Acesse o CRM para ver os documentos.</p>
              `,
            }),
          });
          console.log('[ISA-REPLY] 📧 E-mail enviado para Amanda (análise documental)');
        }
      } catch (emailErr) {
        console.error('[ISA-REPLY] Erro ao enviar e-mail para Amanda:', emailErr);
      }

      // Notificação interna
      try {
        const { data: amandaPerfil } = await supabase
          .from('perfis')
          .select('id')
          .eq('email', 'amanda@bentesramos.com.br')
          .maybeSingle();

        if (amandaPerfil?.id) {
          await supabase.from('notificacoes_internas').insert({
            user_id: amandaPerfil.id,
            titulo: `📄 Análise concluída: ${leadNomeAmanda}`,
            mensagem: `A ISA analisou os documentos de ${leadNomeAmanda} (lead de anúncio) e encaminhou para você.`,
            tipo: 'encaminhamento',
            lead_id: leadId,
            link: '/chat',
            dados: {
              subscriber_id: subscriberId,
              analise_isa: respostaFinal.substring(0, 500),
            },
          });
        }
      } catch (notifErr) {
        console.error('[ISA-REPLY] Erro ao criar notificação:', notifErr);
      }

      // Registrar interação
      await supabase.from('interacoes').insert({
        cliente_id: leadId,
        tipo: 'WhatsApp',
        resumo: 'ISA analisou documentos e encaminhou para Amanda',
        detalhes: `Lead de anúncio. Análise da ISA: ${respostaFinal.substring(0, 500)}`,
        direcao: 'Interna',
      });

      await supabase.from('system_events').insert({
        tipo: 'encaminhamento',
        fonte: 'isa-reply-zapi',
        acao: 'encaminhamento_amanda_analise',
        lead_id: leadId,
        dados: {
          subscriber_id: subscriberId,
          nome_cliente: leadNomeAmanda,
          analise: respostaFinal.substring(0, 500),
          origem: 'fluxo_expresso_anuncio',
        },
        processado: true,
      });
    }

    await supabase.from('manychat_mensagens').insert({
      subscriber_id: subscriberId,
      subscriber_nome: activeAgentName,
      conteudo: respostaFinal,
      canal: canal,
      tipo: 'text',
      direcao: 'saida',
      lead_id: leadId,
      metadata: { agent: isaAgent, ...(extractedData ? { extracted_data: extractedData } : { handoff: needsHandoff }) },
    });

    // 📤 Enviar via Z-API
    // Buscar telefone e instance do subscriber
    const { data: subData } = await supabase
      .from('manychat_subscribers')
      .select('telefone, instance_name')
      .eq('subscriber_id', subscriberId)
      .maybeSingle();
    
    const phoneToSend = subData?.telefone || telefone;
    
    // Resolver instance_id a partir do instance_name (connectedPhone) do subscriber
    // REGRA ESTRITA: responder SEMPRE pela mesma instância que recebeu o contato
    let instanceId: string | null = null;
    if (subData?.instance_name) {
      const cleanPhone = subData.instance_name.replace(/\D/g, '');
      const last8 = cleanPhone.slice(-8);
      
      // Buscar instância que corresponde ao número conectado
      const { data: instances } = await supabase
        .from('zapi_instances')
        .select('instance_id, phone_number, name')
        .eq('is_active', true);
      
      if (instances) {
        const matched = instances.find((i: any) => {
          if (!i.phone_number) return false;
          const instPhone = i.phone_number.replace(/\D/g, '');
          return instPhone.endsWith(last8) || cleanPhone.endsWith(instPhone.slice(-8));
        });
        if (matched) {
          instanceId = matched.instance_id;
          console.log(`[ISA-REPLY] 📱 Instância resolvida: ${matched.name} (${matched.instance_id})`);
        }
      }
      
      if (!instanceId) {
        console.log(`[ISA-REPLY] ⚠️ Instância não encontrada para connectedPhone: ${subData.instance_name}`);
      }
    }
    
    // Fallback: resolver pela origem do lead
    // REGRA ABSOLUTA: tráfego → "Bentes Ramos Trafego" (98588-8190) | escritório → "Bentes Ramos" (99160-4348)
    if (!instanceId && leadId) {
      const { data: leadData } = await supabase
        .from('leads_juridicos')
        .select('linha_whatsapp, tipo_origem')
        .eq('id', leadId)
        .maybeSingle();

      if (leadData) {
        const isTrafego = leadData.linha_whatsapp === 'trafego_isa' || leadData.linha_whatsapp === 'trafego' ||
                          leadData.tipo_origem === 'trafego' || leadData.tipo_origem === 'trafego_isa';

        // Número canônico de cada instância
        const PHONE_TRAFEGO    = '5592985888190'; // (92) 98588-8190 → "Bentes Ramos Trafego"
        const PHONE_ESCRITORIO = '5592991604348'; // (92) 99160-4348 → "Bentes Ramos"
        const targetPhone = isTrafego ? PHONE_TRAFEGO : PHONE_ESCRITORIO;

        const { data: instances } = await supabase
          .from('zapi_instances')
          .select('instance_id, is_default, name, phone_number')
          .eq('is_active', true);

        if (instances) {
          // 1º: match pelo número de telefone registrado (mais confiável)
          const byPhone = instances.find((i: any) =>
            i.phone_number?.replace(/\D/g, '') === targetPhone
          );
          // 2º: fallback por is_default flag
          const byFlag = isTrafego
            ? instances.find((i: any) => !i.is_default) || instances[0]
            : instances.find((i: any) => i.is_default) || instances[0];

          const target = byPhone || byFlag;
          instanceId = target.instance_id;
          console.log(`[ISA-REPLY] 📱 Instância via lead origin: ${target.name} (${target.phone_number}) trafego=${isTrafego}`);
        }
      }
    }
    
    const enviado = await sendViaZapi(phoneToSend, respostaFinal, leadId, instanceId);

    // 🔄 Atualizar estado do lead baseado na conversa
    let stateTransition: string | null = null;
    if (leadId) {
      stateTransition = await determineAndUpdateLeadState(
        leadId,
        currentLeadState,
        fullMessage,
        respostaFinal,
        !!mediaContent,
        extractedData,
        supabase
      );
    }

    // 📊 Registrar evento
    await supabase.from('system_events').insert({
      tipo: 'ia_resposta',
      fonte: 'isa-reply-zapi',
      acao: 'resposta_isa_enviada',
      lead_id: leadId,
      dados: {
        subscriber_id: subscriberId,
        mensagem_recebida: fullMessage.substring(0, 200),
        resposta_enviada: respostaFinal.substring(0, 300),
        tools_executadas: toolsExecuted,
        media_processada: !!mediaContent,
        estado_anterior: currentLeadState,
        novo_estado: stateTransition,
        canal,
      },
      processado: enviado,
    });

    console.log('[ISA-REPLY] ✅ Resposta enviada:', respostaFinal.substring(0, 100));
    if (stateTransition) {
      console.log('[ISA-REPLY] 🔄 Estado atualizado para:', stateTransition);
    }

    return new Response(JSON.stringify({
      success: true,
      resposta: respostaFinal,
      subscriber_id: subscriberId,
      media_processed: !!mediaContent,
      state_transition: stateTransition,
      handoff: needsHandoff,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ISA-REPLY] ❌ Erro:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
