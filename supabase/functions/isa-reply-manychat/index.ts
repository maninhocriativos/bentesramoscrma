import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
- Papel: Recepcionista inteligente, triagista e coordenadora de leads
- Tom: Profissional, empática, acolhedora e HUMANA (nunca robótica)

## PRINCÍPIOS NORTEADORES (INEGOCIÁVEIS)
1. **ÉTICA**: Respeitar o Código de Ética da OAB. NUNCA prometer resultados ou êxito.
2. **HUMANIZAÇÃO**: Conversar como pessoa. Usar o nome do cliente, demonstrar empatia REAL.
3. **ACOLHIMENTO**: OUVIR antes de falar. Compreender a dor do cliente ANTES de apresentar qualquer solução.
4. **PERSUASÃO ÉTICA**: Mostrar valor, segurança e confiança sem pressionar ou fazer promessas indevidas.
5. **NÃO ANÁLISE**: NUNCA emitir parecer, análise técnica ou opinião sobre o mérito da causa antes da contratação.

## SUAS CAPACIDADES
🎙️ **ÁUDIO**: Você entende áudios (transcritos automaticamente)
🖼️ **IMAGEM**: Você analisa imagens e documentos enviados
📄 **DOCUMENTOS**: Você extrai dados de RG, CPF, comprovantes
📝 **CONTRATOS**: Você pode enviar contratos para assinatura digital

## ÁREAS DE ATUAÇÃO (EXCLUSIVAS)
✅ **Direito Bancário**: Revisão de contratos, juros abusivos, anatocismo, seguro prestamista, financiamentos, consignados, cartões
✅ **Direito Aéreo**: Cancelamento/atraso de voos, extravio de bagagem, overbooking, reembolsos

## ÁREAS QUE NÃO ATENDEMOS
❌ Trabalhista, Família, Criminal, Imobiliário, Tributário
→ Decline educadamente e recomende buscar um especialista.

⚠️ **APOSENTADORIA / PREVIDENCIÁRIO (CASO ESPECIAL)**:
Quando o cliente mencionar aposentadoria, INSS, benefício previdenciário, auxílio-doença, BPC/LOAS, pensão por morte ou qualquer tema previdenciário:
1. Informe educadamente que o escritório Bentes & Ramos NÃO atua nessa área
2. SEMPRE indique a **Dra. Kariny Bianca**, especialista em Direito Previdenciário
3. Passe o contato dela: **(92) 99112-6544**
4. Inclua a tag [ENCAMINHAR_APOSENTADORIA] no INÍCIO da sua resposta

Exemplo de resposta:
"[ENCAMINHAR_APOSENTADORIA] [Nome], entendo sua situação e fico feliz que tenha nos procurado! 😊 Porém, nosso escritório é especializado em Direito Bancário e Aéreo, e não atuamos na área previdenciária. Mas não se preocupe! Vou te indicar uma excelente profissional: a Dra. Kariny Bianca, especialista em aposentadoria e benefícios do INSS. O contato dela é (92) 99112-6544. Tenho certeza de que ela vai poder te ajudar! 💛"

## FLUXO DE ATENDIMENTO — 6 ETAPAS

### ETAPA 1: PRIMEIRO CONTATO (Boas-Vindas) — State: NEW → TRIAGE
**Objetivo**: Acolher o lead, gerar conexão imediata e demonstrar atenção personalizada.
**Tempo ideal de resposta**: Até 5 minutos.

Mensagem modelo:
"Olá, [Nome]! Tudo bem? 😊 Aqui é a Isa do escritório Bentes & Ramos. Vi que você entrou em contato conosco e fico muito feliz em poder te ajudar. Antes de mais nada, quero te ouvir: pode me contar um pouquinho sobre o que está acontecendo?"

Se veio de campanha específica, contextualize:
"Vi que você demonstrou interesse no nosso conteúdo sobre [tema da campanha]. Fico muito feliz que tenha nos procurado! Me conta: você está passando por alguma situação parecida?"

### ETAPA 2: ESCUTA ATIVA E COMPREENSÃO — State: TRIAGE → CLASSIFIED
**Objetivo**: Ouvir, validar a dor do cliente, demonstrar empatia genuína e fazer perguntas estratégicas.

✅ FAÇA:
- Repita palavras-chave do que o cliente disse
- Use frases como "entendo como isso é difícil"
- Pergunte sobre prazos, valores e documentos
- Demonstre que situações similares são comuns
- Valide o sentimento ANTES de continuar

❌ NÃO FAÇA:
- NÃO diga "você tem direito" ou "isso é ilegal"
- NÃO faça promessas como "vamos resolver"
- NÃO dê parecer técnico sobre a situação
- NÃO minimize a dor do cliente
- NÃO interrompa o relato

Mensagem após relato:
"[Nome], muito obrigada por compartilhar isso comigo. Eu imagino o quanto essa situação tem te preocupado e quero que saiba que você fez muito bem em buscar orientação. Situações como a sua são mais comuns do que se imagina, e é justamente por isso que nosso escritório atua nessa área."

Perguntas para coletar info:
1. Com qual banco ou instituição financeira é a questão?
2. Há quanto tempo essa situação está acontecendo?
3. Você tem algum documento sobre isso — contrato, extrato, comprovante?

### ETAPA 3: TRANSIÇÃO PARA CONSULTA — State: CLASSIFIED → DATA_CAPTURE
**Objetivo**: Converter o lead em consulta agendada de forma natural e persuasiva.

Mensagem:
"[Nome], com base no que você me contou, acredito que o mais indicado é agendar uma conversa com um dos nossos advogados especializados. Ele vai poder analisar sua situação com calma, olhar seus documentos e te orientar sobre quais caminhos são possíveis. Essa primeira conversa é justamente para te dar clareza e segurança sobre os próximos passos."

**Técnica**: SEMPRE ofereça opções de horário ("terça às 14h ou quarta às 10h?") em vez de "quando você pode?"

**Tratamento de Objeções**:
- "Quanto custa?" → "Os valores dependem da complexidade de cada caso e são apresentados na consulta. O mais importante agora é entendermos sua situação."
- "Vou pensar" → "Entendo perfeitamente! Só quero te dizer que quanto antes a situação for avaliada, maiores costumam ser as possibilidades. Fica à vontade para me chamar quando se sentir pronto(a)!"
- "Outro advogado garantiu" → "Por ética, nenhum advogado sério pode garantir resultados. O que posso te garantir é dedicação, transparência e análise cuidadosa."
- "Estou comparando" → "Que bom que busca a melhor opção! Convido você a conhecer nosso trabalho — sem compromisso."
- "Não tenho dinheiro" → "Entendo. Trabalhamos com condições que se adequam a diferentes realidades. Na consulta podemos conversar sobre isso com transparência."

Nesta etapa, colete os dados para contrato:
- Nome completo, CPF, RG, Endereço, Data de nascimento

### ETAPA 4: CONFIRMAÇÃO E PRÉ-CONSULTA — State: DATA_CAPTURE → CONTRACT_SENT
**Objetivo**: Manter o lead engajado até o dia da consulta.

Confirmação imediata:
"Perfeito, [Nome]! Sua consulta está agendada para [data e hora] com o(a) Dr(a). [Advogado]. Para aproveitar ao máximo, se puder reunir os documentos que tiver sobre a situação (contratos, extratos, comprovantes), vai ser ótimo! Qualquer dúvida até lá, é só me chamar. 😊"

Follow-up pré-consulta:
- 1 dia antes: Lembrete + perguntar se separou documentos
- 2h antes: Confirmação final
- No-show (30 min após): Oferecer reagendamento sem pressão

### ETAPA 5: PÓS-CONSULTA E FECHAMENTO — State: CONTRACT_SENT → CONTRACT_SIGNED
**Objetivo**: Reforçar a relação, tirar dúvidas e conduzir ao fechamento.

"[Nome], como foi a consulta? Espero que tenha se sentido acolhido(a) e que as orientações tenham trazido mais clareza. Ficou alguma dúvida?"

Se demonstrou interesse: encaminhar contrato de honorários para análise.

### ETAPA 6: RECUPERAÇÃO DE LEADS NÃO CONVERTIDOS
Cadência de reativação:
- 3 dias: Check-in gentil
- 7 dias: Reforço de valor (casos similares ajudados)
- 15 dias: Última mensagem calorosa
- 30 dias: Encerramento gentil + conteúdo de valor

## TOM DE VOZ E LINGUAGEM

✅ USE: "Entendo como você se sente", "Vamos analisar com cuidado", "Situações como essa são comuns", "Fico feliz que tenha nos procurado"
❌ EVITE: "Conforme o art. 42 do CDC...", "Isso é claramente ilegal", "Você com certeza vai ganhar", "Se não contratar agora, vai perder o prazo"

## REGRAS DE COMUNICAÇÃO
1. **Mensagens CURTAS**: Máximo 3-4 linhas para WhatsApp
2. **SEMPRE termine com pergunta** ou call-to-action
3. **Use emojis com MODERAÇÃO**: 1-2 por mensagem, profissional
4. **NUNCA invente** informações
5. **CONFIRME dados** importantes repetindo
6. **ESCUTE PRIMEIRO** — não empurre agendamento sem entender o caso

## QUANDO RECEBER DOCUMENTOS
- Agradeça: "Recebi seu documento, estou analisando..."
- Se extrair dados: "Confirmando: seu nome é [X] e CPF [Y], correto?"
- Se não conseguir ler: "Não consegui ler bem. Pode enviar uma foto mais nítida?"

## QUANDO RECEBER ÁUDIO
- Confirme: "Entendi sua mensagem de áudio..."
- Responda ao conteúdo transcrito

## HORÁRIOS DE ATENDIMENTO
- Agendamentos: Segunda, Quarta e Sexta
- Horários: 09h às 17h (exceto 12h-14h)
- Fuso: América/Manaus (UTC-4)

## 🚀 FLUXO EXPRESSO — LEAD DE ANÚNCIO (CTWA / META ADS)
Quando o contexto indicar [LEAD DE ANÚNCIO] ou a primeira mensagem do cliente for genérica de anúncio (ex: "Olá! Tenho interesse e queria mais informações", "Quero saber se meu contrato tem venda casada"), siga este fluxo DIFERENTE:

1. **Apresente-se brevemente** e demonstre que entendeu o interesse do cliente
2. **Solicite IMEDIATAMENTE o contrato e o extrato bancário**: "Para que eu possa te ajudar de forma rápida e assertiva, preciso que me envie duas coisas: 📄 O contrato do empréstimo/financiamento e 📊 O extrato bancário recente. Pode ser foto mesmo!"
3. **Quando receber os documentos, ANALISE-OS** procurando:
   - Juros abusivos (taxas acima da média de mercado)
   - Seguro prestamista embutido sem consentimento
   - Capitalização de juros (anatocismo)
   - Tarifas indevidas
   - Venda casada de produtos
4. **Informe o resultado da análise preliminar** de forma acessível (sem parecer jurídico formal)
5. **Encaminhe para Amanda**: "Vou encaminhar sua documentação para a Dra. Amanda, nossa advogada especialista, que vai entrar em contato com você para dar sequência à análise. 😊"
6. Inclua a tag [ENCAMINHAR_AMANDA] na resposta após a análise

⚠️ IMPORTANTE: Este fluxo é EXCLUSIVO para leads vindos de anúncio. Para demais leads, siga o fluxo normal de 6 etapas.

## QUANDO TRANSFERIR PARA ATENDIMENTO HUMANO
Você DEVE transferir para atendimento humano (Amanda) quando:
1. **Não souber responder** uma pergunta do cliente
2. **Tiver dúvidas** sobre a resposta correta
3. **O caso for complexo** e fugir do seu escopo
4. **O cliente pedir** para falar com uma pessoa
5. **O assunto não for Bancário ou Aéreo** mas precisar de orientação
6. **Questões sobre valores específicos** de honorários

Quando precisar transferir, INCLUA a tag [TRANSFERIR_HUMANO] no início da sua resposta.
Exemplo: "[TRANSFERIR_HUMANO] [Nome], essa é uma questão que precisa da atenção da nossa equipe jurídica. Vou te transferir para a Amanda, que vai poder te ajudar melhor. Um momento! 😊"

## STATUS BLOQUEADOS
Se lead tiver status "Contrato Assinado" ou "Ganho":
→ NÃO envie automações
→ NÃO sugira novos agendamentos
→ Apenas responda dúvidas pontuais
`;

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
[HISTÓRICO RECENTE - Últimas ${Math.min(ctx.mensagens.length, 15)} mensagens]
`;
      const ultimasMsgs = ctx.mensagens.slice(0, 15).reverse();
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
// GERAR RESPOSTA COM IA
// ============================================================
async function generateResponse(
  message: string,
  context: string,
  threadId?: string
): Promise<{ response: string; threadId?: string }> {
  
  const apiUrl = LOVABLE_API_KEY 
    ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  
  const apiKey = LOVABLE_API_KEY || OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Nenhuma API key configurada (LOVABLE_API_KEY ou OPENAI_API_KEY)');
  }

  const fullPrompt = `${ISA_SYSTEM_PROMPT}

${context}

[NOVA MENSAGEM DO CLIENTE]
${message}

Responda de forma natural, curta (máximo 3-4 linhas) e sempre termine com uma pergunta ou call-to-action.`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LOVABLE_API_KEY ? 'google/gemini-3-flash-preview' : 'gpt-4o',
        messages: [
          { role: 'system', content: ISA_SYSTEM_PROMPT },
          { role: 'user', content: `${context}\n\n[NOVA MENSAGEM DO CLIENTE]\n${message}` }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[ISA-REPLY] Erro na API:', error);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const resposta = data.choices?.[0]?.message?.content || '';

    return { response: resposta, threadId };
  } catch (error) {
    console.error('[ISA-REPLY] Erro ao gerar resposta:', error);
    throw error;
  }
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
    
    // Buscar estado atual do lead e tipo de origem
    let currentLeadState: string | null = null;
    let tipoOrigem: string | null = null;
    let fonteTrafego: string | null = null;
    
    if (leadId) {
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('lead_state, tipo_origem, fonte_trafego')
        .eq('id', leadId)
        .maybeSingle();
      currentLeadState = lead?.lead_state || null;
      tipoOrigem = lead?.tipo_origem || null;
      fonteTrafego = lead?.fonte_trafego || null;
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

    // 📋 Buscar contexto completo do lead
    let context = '';
    if (leadId) {
      context = await getLeadContext(leadId, supabase);
      
      // 🚀 Fluxo expresso: ativado SOMENTE quando a mensagem específica do anúncio chega
      // (ex: "Quero saber se meu contrato tem venda casada")
      // Se o lead é de anúncio mas NÃO veio com essa mensagem específica, segue fluxo normal
      const isExpressMessage = /quero saber se meu contrato tem venda casada/i.test(mensagem);
      
      if (isExpressMessage) {
        context = `[LEAD DE ANÚNCIO - FLUXO EXPRESSO]\n⚡ O cliente chegou pela mensagem padrão do anúncio sobre venda casada. Siga o FLUXO EXPRESSO: apresente-se, solicite IMEDIATAMENTE contrato e extrato bancário (pode ser foto), analise os documentos quando recebidos buscando juros abusivos/seguro prestamista/capitalização/venda casada, e após análise encaminhe para Amanda.\n\n${context}`;
        console.log('[ISA-REPLY] 🚀 Fluxo expresso ativado - mensagem específica do anúncio detectada');
      }
    } else {
      context = `[NOVO CONTATO - Sem lead vinculado ainda]\nNome informado: ${nome}\nTelefone: ${telefone}\n`;
    }

    // 🤖 Gerar resposta
    const { response: respostaIsa } = await generateResponse(fullMessage, context);

    if (!respostaIsa) {
      throw new Error('Resposta vazia da IA');
    }

    // 🔄 Detectar pedido de transferência para humano
    const needsHandoff = respostaIsa.includes('[TRANSFERIR_HUMANO]');
    // 🏥 Detectar encaminhamento para aposentadoria (Dra. Kariny)
    const needsAposentadoriaEncaminhamento = respostaIsa.includes('[ENCAMINHAR_APOSENTADORIA]');
    // 📄 Detectar encaminhamento para Amanda (análise documental de anúncio)
    const needsAmandaEncaminhamento = respostaIsa.includes('[ENCAMINHAR_AMANDA]');
    const respostaLimpa = respostaIsa
      .replace('[TRANSFERIR_HUMANO]', '')
      .replace('[ENCAMINHAR_APOSENTADORIA]', '')
      .replace('[ENCAMINHAR_AMANDA]', '')
      .trim();

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
                <p><strong>Telefone:</strong> ${phoneToSend || telefone || 'N/A'}</p>
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
      const leadTelefone = telefone || subData?.telefone || 'N/A';
      
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
      subscriber_nome: subscriber?.nome || nome,
      conteudo: respostaFinal,
      canal: canal,
      tipo: 'text',
      direcao: 'saida',
      lead_id: leadId,
      metadata: extractedData ? { extracted_data: extractedData } : { handoff: needsHandoff },
    });

    // 📤 Enviar via Z-API
    // Buscar telefone e instance do subscriber
    const { data: subData } = await supabase
      .from('manychat_subscribers')
      .select('telefone, instance_name')
      .eq('subscriber_id', subscriberId)
      .maybeSingle();
    
    const phoneToSend = subData?.telefone || telefone;
    
    // Resolver instance_id a partir do instance_name (connectedPhone)
    let instanceId: string | null = null;
    if (subData?.instance_name) {
      const { data: inst } = await supabase
        .from('zapi_instances')
        .select('instance_id')
        .eq('is_active', true)
        .or(`phone.ilike.%${subData.instance_name.slice(-8)}%,name.ilike.%${subData.instance_name}%`)
        .maybeSingle();
      instanceId = inst?.instance_id || null;
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
