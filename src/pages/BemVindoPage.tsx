import { useState } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  GraduationCap, Search, Users, Scale, CheckSquare, CalendarDays,
  DollarSign, FileText, FileSignature, FileEdit, Bot, MessageSquare,
  LayoutDashboard, Zap, Play, ChevronRight, BookOpen, ClipboardList, ArrowLeft,
  Copy, Check, AlertCircle, CheckCircle2, XCircle, Download, ExternalLink,
  TrendingUp, Maximize2, X, Target, PhoneCall, Filter, Repeat, Clock
} from 'lucide-react';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  icon: typeof LayoutDashboard;
  category: string;
  color: string;
  steps: string[];
  hasDetailedView?: boolean;
}

const tutorials: Tutorial[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Visão geral de métricas, KPIs e gráficos do escritório.',
    icon: LayoutDashboard,
    category: 'Principal',
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
    steps: [
      'Acesse o menu lateral e clique em "Dashboard".',
      'Visualize os cards de KPIs no topo (leads, processos, receita).',
      'Os gráficos mostram a evolução ao longo do tempo.',
      'Use os filtros de período para ajustar a visualização.',
    ],
  },
  {
    id: 'leads',
    title: 'CRM de Leads',
    description: 'Gerenciar leads, pipeline de vendas e acompanhamento de clientes.',
    icon: Users,
    category: 'Principal',
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
    steps: [
      'Acesse "CRM de Leads" no menu lateral.',
      'Use o Kanban para arrastar leads entre etapas do funil.',
      'Clique em um lead para ver detalhes, histórico e documentos.',
      'Use o botão "Novo Lead" para cadastrar manualmente.',
      'Filtre por status, origem ou busque por nome/telefone.',
    ],
  },
  {
    id: 'processos',
    title: 'Processos Judiciais',
    description: 'Cadastro, acompanhamento e sincronização de processos.',
    icon: Scale,
    category: 'Principal',
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30',
    steps: [
      'Acesse "Processos" no menu lateral.',
      'Veja os KPIs no topo: total, em andamento, suspensos, etc.',
      'Use a busca para encontrar por número CNJ, nome ou CPF.',
      'Clique em um processo para ver detalhes completos, partes e movimentações.',
      'Use "Sincronizar" para atualizar dados do tribunal automaticamente.',
      'A aba "Consultar CNJ" permite buscar processos externos.',
    ],
  },
  {
    id: 'tarefas',
    title: 'Tarefas',
    description: 'Controle de tarefas, prazos e aprovações da equipe.',
    icon: CheckSquare,
    category: 'Gestão',
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30',
    steps: [
      'Acesse "Tarefas" no menu lateral.',
      'Visualize no formato Kanban ou lista.',
      'Crie novas tarefas com prazo, responsável e prioridade.',
      'Entregue tarefas e aguarde aprovação do gestor.',
      'Tarefas urgentes aparecem destacadas em vermelho.',
    ],
  },
  {
    id: 'agenda',
    title: 'Agenda',
    description: 'Compromissos, audiências e integração com Google Calendar.',
    icon: CalendarDays,
    category: 'Gestão',
    color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/30',
    steps: [
      'Acesse "Agenda" no menu lateral.',
      'Veja compromissos no calendário mensal.',
      'Clique em uma data para ver os eventos do dia.',
      'Use "Novo Compromisso" para agendar audiências, reuniões, etc.',
      'Conecte o Google Calendar para sincronizar automaticamente.',
    ],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    description: 'Honorários, despesas e controle de parcelas.',
    icon: DollarSign,
    category: 'Gestão',
    color: 'text-green-600 bg-green-50 dark:bg-green-950/30',
    steps: [
      'Acesse "Financeiro" no menu lateral.',
      'Cadastre honorários vinculados a clientes e processos.',
      'Registre despesas e acompanhe parcelas.',
      'Visualize relatórios de receita e despesa.',
    ],
  },
  {
    id: 'documentos',
    title: 'Documentos',
    description: 'Upload, organização e sincronização com Google Drive.',
    icon: FileText,
    category: 'Gestão',
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
    steps: [
      'Acesse "Documentos" no menu lateral.',
      'Faça upload de arquivos vinculados a clientes ou processos.',
      'Use categorias para organizar (contrato, procuração, etc.).',
      'Conecte o Google Drive para backup automático.',
    ],
  },
  {
    id: 'contratos',
    title: 'Contratos',
    description: 'Geração, envio e assinatura digital de contratos.',
    icon: FileSignature,
    category: 'Gestão',
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30',
    steps: [
      'Acesse "Contratos" no menu lateral.',
      'Use modelos prontos para gerar contratos.',
      'Envie para assinatura digital do cliente.',
      'Acompanhe o status: enviado, assinado, expirado.',
    ],
  },
  {
    id: 'peticoes',
    title: 'Petições Iniciais',
    description: 'Gere petições a partir de modelos .docx com preenchimento automático.',
    icon: FileEdit,
    category: 'Gestão',
    color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30',
    steps: [
      'Acesse "Petições Iniciais" no menu lateral.',
      'Veja os modelos disponíveis organizados por categoria.',
      'Clique em "Nova Petição" e selecione o modelo desejado.',
      'Preencha os dados do cliente, réu e processo.',
      'Clique em "Gerar Petição" para criar o .docx final.',
      'Faça download ou visualize o documento gerado.',
    ],
  },
  {
    id: 'assistente',
    title: 'Assistentes IA',
    description: 'Use a IA para cálculos, análises e suporte jurídico.',
    icon: Bot,
    category: 'Inteligência',
    color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30',
    steps: [
      'Acesse "Assistentes IA" no menu lateral.',
      'Use a Isa para tirar dúvidas jurídicas e receber sugestões.',
      'A Calculadora Financeira analisa extratos e contratos.',
      'Visualize métricas de conversão e ações pendentes.',
    ],
  },
  {
    id: 'chat',
    title: 'Chat (WhatsApp)',
    description: 'Gerencie conversas com clientes pelo WhatsApp integrado.',
    icon: MessageSquare,
    category: 'Inteligência',
    color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/30',
    steps: [
      'Acesse "Chat" no menu lateral.',
      'Veja todas as conversas ativas do WhatsApp.',
      'Clique em uma conversa para ler e responder.',
      'Use tags para organizar conversas por assunto.',
      'A Isa pode responder automaticamente quando ativada.',
    ],
  },
  {
    id: 'isa',
    title: 'Isa Autônoma',
    description: 'Configure a assistente de IA para atender leads automaticamente.',
    icon: Zap,
    category: 'Inteligência',
    color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30',
    steps: [
      'Acesse "Isa Autônoma" no menu lateral.',
      'Configure as automações de primeiro contato.',
      'Defina regras de follow-up e horários de funcionamento.',
      'Monitore as conversas em andamento e intervenha quando necessário.',
    ],
  },
  {
    id: 'guia-venda-casada',
    title: 'Guia de Atendimento — Venda Casada',
    description: 'Scripts prontos, objeções, fluxo e cadência para leads de venda casada bancária, seguro prestamista, contrato consignado, aposentados e pensionistas. Cobrança indevida.',
    icon: ClipboardList,
    category: 'Gestão',
    color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30',
    steps: [],
    hasDetailedView: true,
  },
  {
    id: 'auditoria-comercial',
    title: 'Auditoria Comercial — Atendimento & Vendas',
    description: 'Método de atendimento em 4 etapas, números críticos (70% / 22% / 10%), perfis de leads, funil de vendas, follow-up e pós-venda. Scripts e exemplos de mensagens reais.',
    icon: TrendingUp,
    category: 'Gestão',
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
    steps: [],
    hasDetailedView: true,
  },
];

const categories = ['Todos', 'Principal', 'Gestão', 'Inteligência'];

function GuiaVendaCasadaView({ onBack }: { onBack: () => void }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    const newSections = new Set(openSections);
    if (newSections.has(sectionId)) {
      newSections.delete(sectionId);
    } else {
      newSections.add(sectionId);
    }
    setOpenSections(newSections);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  const ChevronDown = ChevronRight;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header com botão voltar - Premium */}
      <div className="flex items-center justify-between gap-4 sticky top-16 z-30 bg-gradient-to-r from-card/95 via-card/90 to-card/95 backdrop-blur-xl -mx-4 px-4 py-4 md:-mx-6 md:px-6 border-b border-border/50 shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Voltar</span>
        </button>
        <div className="text-center min-w-0 flex-1">
          <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-cyan-600 to-cyan-500 dark:from-cyan-400 dark:to-cyan-300 bg-clip-text text-transparent truncate">
            Guia de Atendimento — Venda Casada
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Protocolo operacional para atendimento bancário</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-xs rounded-md bg-cyan-600 hover:bg-cyan-700">
            Bancário
          </Badge>
          <Badge variant="secondary" className="text-xs rounded-md hidden sm:inline-flex">
            Contrato
          </Badge>
        </div>
      </div>

      {/* Bloco de destaque - Premium */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 via-cyan-500/5 to-transparent rounded-2xl blur-2xl" />
        <Card className="relative border-cyan-300/50 dark:border-cyan-700/50 bg-gradient-to-br from-cyan-50/80 via-white dark:from-cyan-950/30 dark:via-card to-white dark:to-card shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-cyan-100 dark:bg-cyan-900/40">
                <AlertCircle className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              </div>
              <div className="space-y-3">
                <p className="font-bold text-sm uppercase tracking-wider text-cyan-900 dark:text-cyan-200">
                  ⚡ Frase-âncora central
                </p>
                <p className="text-base leading-relaxed font-semibold text-foreground">
                  O contrato é o documento principal. O extrato ajuda depois, mas é no contrato que aparece se houve seguro, pacote, proteção financeira ou produto embutido.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fluxo ideal */}
      <section className="space-y-4 pt-4">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">Fluxo ideal do atendimento</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { num: 1, desc: 'Lead chegou do anúncio' },
            { num: 2, desc: 'Confirmar se é aposentado, pensionista ou beneficiário do INSS' },
            { num: 3, desc: 'Identificar o banco' },
            { num: 4, desc: 'Solicitar o contrato do empréstimo' },
            { num: 5, desc: 'Se não tiver contrato, enviar tutorial para localizar' },
            { num: 6, desc: 'Receber contrato' },
            { num: 7, desc: 'Solicitar documentos complementares' },
            { num: 8, desc: 'Análise de viabilidade' },
            { num: 9, desc: 'Formalização, se houver indícios' },
            { num: 10, desc: 'Encerramento profissional, se não houver viabilidade' },
          ].map((item) => (
            <div key={item.num} className="flex items-start gap-3">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-bold shrink-0">
                {item.num}
              </span>
              <span className="text-sm text-foreground pt-0.5">{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Mensagens prontas */}
      <section className="space-y-4 pt-4">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">Mensagens prontas por momento</h2>
        <div className="space-y-2">
          {[
            {
              id: 'msg-inicial',
              title: 'Mensagem inicial',
              when: 'Imediatamente quando o lead chega',
              text: 'Olá, tudo bem? Sou da equipe de análise do escritório. Você pediu informações sobre possíveis cobranças em empréstimos, como seguro prestamista, proteção financeira, pacote de benefícios ou venda casada. Para verificar se existe algo irregular, o documento mais importante é o contrato do empréstimo. É nele que aparece se o banco colocou algum seguro, pacote ou cobrança junto do consignado. Você tem o contrato em mãos ou consegue acessar pelo aplicativo do banco ou Meu INSS?',
            },
            {
              id: 'msg-qualificacao',
              title: 'Qualificação',
              when: 'Assim que o lead responde "quero saber", "tenho empréstimo" ou algo parecido',
              text: 'Antes de analisarmos, preciso confirmar duas informações rápidas: 1. Você é aposentado, pensionista ou recebe benefício do INSS? 2. Qual banco aparece no seu empréstimo? Com isso eu já consigo te orientar melhor sobre como localizar o contrato.',
            },
            {
              id: 'msg-pedido-direto',
              title: 'Pedido direto do contrato',
              when: 'Depois que o lead confirma que possui empréstimo ou benefício',
              text: 'Perfeito. Então o primeiro passo é enviar o contrato do empréstimo. Pode ser foto, print ou PDF. O importante é aparecer: nome do banco, valor contratado, parcelas, CET, assinatura/aceite e se existe seguro, pacote, proteção financeira ou serviço adicional. Envie o contrato por aqui para iniciarmos a análise.',
            },
            {
              id: 'msg-por-que-contrato',
              title: 'Por que precisa do contrato?',
              when: 'Quando o lead questiona ou tenta apenas contar o caso',
              text: 'Porque o contrato é onde aparece o que o banco colocou na operação. O extrato mostra o desconto. Mas o contrato mostra se havia seguro, pacote, proteção financeira, assistência ou venda casada embutida no empréstimo. Sem o contrato, a análise fica incompleta.',
            },
            {
              id: 'msg-sem-contrato',
              title: 'Lead sem contrato',
              when: 'Quando diz que perdeu, não recebeu ou não sabe localizar',
              text: 'Sem problema, muita gente não tem o contrato em mãos. Mas ele pode ser localizado pelo aplicativo do banco, Meu INSS, e-mail usado na contratação, WhatsApp onde recebeu a proposta ou atendimento/SAC do banco. Me diga qual é o banco do empréstimo que eu te oriento pelo caminho mais fácil.',
            },
            {
              id: 'msg-sem-tempo',
              title: 'Lead sem tempo',
              when: 'Quando usa falta de tempo para adiar',
              text: 'Entendo. Você não precisa resolver tudo agora. Só preciso que envie o contrato ou um print do empréstimo. Isso leva menos de 2 minutos e já permite iniciar a verificação. Pode mandar uma foto simples pelo celular.',
            },
            {
              id: 'msg-enrolado',
              title: 'Lead enrolado - versão forte',
              when: 'Depois de uma ou duas tentativas leves',
              text: 'Vou ser direto: enquanto o contrato não for enviado, seu caso não anda. Se existe seguro, pacote ou cobrança embutida, isso pode estar no contrato. Você pode deixar para depois e continuar sem resposta, ou pode enviar uma foto agora e tirar essa dúvida.',
            },
            {
              id: 'msg-medo-processo',
              title: 'Medo de processo',
              when: 'Quando o lead trava com a ideia de ação',
              text: 'Entendo. Mas nesse momento ninguém está falando em processo. Primeiro é só análise do contrato. Se houver indício de irregularidade, o escritório explica as possibilidades e você decide se quer seguir ou não. Analisar o contrato não te obriga a entrar com ação.',
            },
            {
              id: 'msg-medo-beneficio',
              title: 'Medo de perder benefício',
              when: 'Quando o lead tem receio de mexer com banco/INSS',
              text: 'Pode ficar tranquilo. Questionar uma cobrança bancária não cancela aposentadoria, pensão ou benefício. A análise é sobre o contrato do empréstimo e possíveis cobranças vinculadas a ele. O benefício continua sendo seu direito.',
            },
            {
              id: 'msg-sem-dinheiro',
              title: 'Lead sem dinheiro para advogado',
              when: 'Quando antecipa preocupação financeira',
              text: 'Entendo. Mas antes de falar sobre contratação, precisamos saber se existe viabilidade. Não faz sentido discutir valores sem analisar o contrato. Envie o contrato primeiro. Se houver indício de irregularidade, a equipe explica os próximos passos com clareza.',
            },
            {
              id: 'msg-extrato-antes',
              title: 'Lead mandou extrato antes do contrato',
              when: 'Quando envia extrato, contracheque ou print de desconto',
              text: 'Recebi, obrigado. Esse documento ajuda a identificar descontos. Agora precisamos do contrato do empréstimo, porque é nele que aparece se o banco incluiu seguro, pacote, proteção financeira ou outro produto junto da operação. Você consegue buscar no aplicativo do banco ou no Meu INSS?',
            },
            {
              id: 'msg-incompleto',
              title: 'Contrato incompleto',
              when: 'Quando faltam páginas importantes',
              text: 'Recebi, obrigado. Mas ainda preciso das páginas onde aparecem: valor total financiado, número de parcelas, CET, seguros, tarifas, pacote de benefícios, assinatura ou aceite. Envie essas páginas para a análise ficar completa.',
            },
            {
              id: 'msg-ilegivel',
              title: 'Foto ilegível',
              when: 'Quando imagem está escura, cortada ou borrada',
              text: 'Recebi, mas a imagem ficou difícil de ler. Para a análise ser correta, preciso que envie novamente com a página inteira, em local claro e sem cortar as bordas. Pode mandar uma foto simples, desde que o texto esteja legível.',
            },
            {
              id: 'msg-viavel',
              title: 'Caso com indício de viabilidade',
              when: 'Depois da análise inicial interna',
              text: 'A equipe analisou o contrato e identificou pontos que precisam de análise jurídica mais profunda. Existem indícios relacionados a seguro, pacote, proteção financeira ou tarifa. O próximo passo é formalizar o atendimento para que o escritório possa verificar as medidas cabíveis. Importante: isso não é promessa de resultado. Significa que existem elementos suficientes para avançar tecnicamente. Posso te encaminhar os próximos passos?',
            },
            {
              id: 'msg-nao-viavel',
              title: 'Caso sem viabilidade',
              when: 'Após análise negativa',
              text: 'A equipe analisou o contrato e, neste momento, não encontrou elementos suficientes para seguir com ação. Mesmo assim, recomendamos acompanhar seus contratos e descontos. Se aparecer novo empréstimo, seguro, tarifa, pacote ou cobrança que você não reconhece, pode enviar para nova verificação.',
            },
            {
              id: 'msg-final',
              title: 'Follow-up final',
              when: 'Depois de 3 a 5 dias sem resposta',
              text: 'Como ainda não recebemos o contrato, vou pausar seu atendimento por enquanto. Quando quiser retomar, envie o contrato do empréstimo ou um print do Meu INSS mostrando o consignado. Sem esse documento, não existe análise segura.',
            },
          ].map((msg) => (
            <div key={msg.id} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(msg.id)}
                className="w-full flex items-center justify-between gap-3 p-4 hover:bg-accent transition-colors"
              >
                <div className="text-left min-w-0">
                  <p className="font-semibold text-sm text-foreground">{msg.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{msg.when}</p>
                </div>
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground/40 shrink-0 transition-transform ${
                    openSections.has(msg.id) ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {openSections.has(msg.id) && (
                <div className="border-t border-border bg-muted/30 p-4 space-y-3 animate-fade-in">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{msg.text}</p>
                  <button
                    onClick={() => copyToClipboard(msg.text, msg.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      copiedId === msg.id
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md'
                        : 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-600 hover:to-cyan-700 shadow-md hover:shadow-lg hover:-translate-y-0.5'
                    }`}
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copiar mensagem
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Cadência follow-up */}
      <section className="space-y-4 pt-4">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">Cadência para leads sem resposta</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              id: 'fu-30min',
              tempo: '30 minutos',
              nivel: 'Leve',
              msg: 'Oi, só reforçando: para verificar se houve cobrança indevida, precisamos do contrato do empréstimo. Pode enviar foto, PDF ou print do contrato por aqui.',
            },
            {
              id: 'fu-3h',
              tempo: '2 a 3 horas',
              nivel: 'Médio',
              msg: 'Ainda estou aguardando o contrato. Sem ele, não conseguimos confirmar se houve seguro prestamista, proteção financeira, pacote de benefícios ou venda casada. Pode me mandar o que tiver, mesmo que seja só uma foto.',
            },
            {
              id: 'fu-6h',
              tempo: 'Fim do dia',
              nivel: 'Firme',
              msg: 'Passando para te lembrar: o contrato é o documento que mostra o que o banco colocou no seu empréstimo. Sem ele, você continua sem saber se aceitou apenas o consignado ou se veio algum seguro, pacote ou cobrança junto. Se conseguir, envie ainda hoje uma foto ou PDF.',
            },
            {
              id: 'fu-d1',
              tempo: 'Dia seguinte',
              nivel: 'Reabertura',
              msg: 'Bom dia. Ontem você pediu análise sobre possível cobrança no empréstimo. Conseguiu localizar o contrato? Esse documento é essencial para verificar se o banco colocou seguro, pacote, proteção financeira ou outro produto junto do consignado.',
            },
            {
              id: 'fu-d2',
              tempo: '48 horas',
              nivel: 'Forte',
              msg: 'Vou ser bem direto: sem o contrato, seu atendimento não avança. Se houver cobrança indevida, ela pode estar justamente nas cláusulas ou nos valores do contrato. Você quer que eu te envie o passo a passo para localizar pelo Meu INSS ou pelo aplicativo do banco?',
            },
            {
              id: 'fu-final',
              tempo: '3 a 5 dias',
              nivel: 'Encerramento',
              msg: 'Como ainda não recebemos o contrato, vou pausar seu atendimento por enquanto. Quando quiser retomar, envie o contrato do empréstimo ou um print do Meu INSS mostrando o consignado. Sem esse documento, não existe análise segura.',
            },
          ].map((item) => (
            <Card key={item.id} className="border-border">
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="font-semibold text-sm text-foreground">{item.tempo}</p>
                  <Badge variant="secondary" className="text-xs mt-1">
                    {item.nivel}
                  </Badge>
                </div>
                <p className="text-sm text-foreground">{item.msg}</p>
                <button
                  onClick={() => copyToClipboard(item.msg, item.id)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    copiedId === item.id
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md'
                      : 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-600 hover:to-cyan-700 shadow-md hover:shadow-lg hover:-translate-y-0.5'
                  }`}
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </>
                  )}
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tutoriais rápidos */}
      <section className="space-y-4 pt-4">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">Tutoriais rápidos</h2>
        <div className="space-y-2">
          {[
            {
              id: 'tut-meu-inss',
              title: 'Como buscar pelo Meu INSS',
              content: '1. Abra o aplicativo Meu INSS.\n2. Entre com CPF e senha do Gov.br.\n3. Na busca, digite "Extrato de Empréstimo".\n4. Selecione o benefício.\n5. Veja os empréstimos ativos.\n6. Tire print da tela onde aparece o banco, número do contrato, valor da parcela, prazo e data.\n7. Se aparecer opção de baixar contrato ou detalhes, envie também.',
            },
            {
              id: 'tut-app-banco',
              title: 'Como procurar no aplicativo do banco',
              content: 'No aplicativo do banco, procure por uma destas opções:\n- Empréstimos\n- Consignado\n- Meus contratos\n- Detalhes do contrato\n- Documentos\n- Comprovantes\n- Seguros\n- Proteção financeira\n\nQuando encontrar, baixe o PDF ou tire prints das telas. Precisamos ver principalmente: valor liberado, parcelas, CET, seguro, tarifas, pacote e assinatura/aceite.',
            },
            {
              id: 'tut-solicitar-banco',
              title: 'Como solicitar contrato ao banco',
              content: 'Mensagem para copiar e enviar ao banco:\n\n"Olá. Solicito a cópia integral do contrato do meu empréstimo consignado, incluindo termo de adesão, CET, eventuais seguros, proteção financeira, pacote de benefícios, gravação ou comprovante de aceite digital. Também solicito o demonstrativo completo dos valores financiados e descontos vinculados ao contrato."\n\nSe perguntarem o motivo:\n"Preciso conferir as informações do meu contrato e os produtos vinculados à operação."',
            },
            {
              id: 'tut-fotografar',
              title: 'Como fotografar contrato corretamente',
              content: '1. Coloque o contrato em local claro.\n2. Tire foto da página inteira.\n3. Não corte cabeçalho nem rodapé.\n4. Envie todas as páginas.\n5. Confira se dá para ler antes de mandar.\n6. Se tiver muitas páginas, envie primeiro as partes onde aparecem valores, seguro, tarifas, pacote, CET e assinatura.',
            },
            {
              id: 'tut-procurar-contrato',
              title: 'O que procurar dentro do contrato',
              content: 'Procure por nomes como:\n\nSeguro/proteção: seguro prestamista, seguro vida, proteção financeira, prêmio de seguro, adesão a seguro\n\nPacotes/assistências: pacote de benefícios, assistência funeral, assistência residencial, clube de vantagens, produto adicional\n\nTarifas/custos: tarifa bancária, tarifa de cadastro, tarifa de serviços, cesta de serviços, valor financiado com seguro\n\nAceite/contratação: assinatura, aceite digital, termo de adesão, gravação, autorização de desconto\n\nSe aparecer qualquer um desses nomes, tire foto dessa parte e envie agora.',
            },
          ].map((tut) => (
            <div key={tut.id} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(tut.id)}
                className="w-full flex items-center justify-between gap-3 p-4 hover:bg-accent transition-colors"
              >
                <p className="font-semibold text-sm text-foreground text-left">{tut.title}</p>
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground/40 shrink-0 transition-transform ${
                    openSections.has(tut.id) ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {openSections.has(tut.id) && (
                <div className="border-t border-border bg-muted/30 p-4 animate-fade-in">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{tut.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Checklist documentos */}
      <section className="space-y-4 pt-4">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">Checklist de documentos</h2>
        <div className="space-y-2">
          {[
            { priority: 1, name: 'Contrato do empréstimo', highlight: true },
            { priority: 2, name: 'Documento pessoal + CPF' },
            { priority: 3, name: 'Comprovante de residência' },
            { priority: 4, name: 'Extrato de empréstimo do Meu INSS' },
            { priority: 5, name: 'Extrato bancário' },
            { priority: 6, name: 'Contracheque ou extrato de pagamento do benefício' },
          ].map((doc) => (
            <div
              key={doc.priority}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                doc.highlight
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                  : 'border-border'
              }`}
            >
              <Badge variant={doc.highlight ? 'default' : 'secondary'} className="shrink-0">
                P{doc.priority}
              </Badge>
              <span className={`text-sm font-medium ${doc.highlight ? 'text-green-900 dark:text-green-100' : 'text-foreground'}`}>
                {doc.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Frases */}
      <section className="space-y-4 pt-4">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">Frases recomendadas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-green-700 dark:text-green-400">Usar ✓</h3>
            <ul className="text-sm text-foreground space-y-1">
              {[
                'pode haver cobrança indevida',
                'precisamos analisar o contrato',
                'se houver viabilidade',
                'sem o contrato não existe análise segura',
                'a análise não obriga a entrar com ação',
                'o escritório orienta os próximos passos',
              ].map((phrase, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <span>{phrase}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-red-700 dark:text-red-400">Evitar ✗</h3>
            <ul className="text-sm text-foreground space-y-1">
              {[
                'causa ganha',
                'indenização garantida',
                'você vai receber dinheiro',
                'todo aposentado tem direito',
                'o banco roubou você',
                'assine para garantir',
              ].map((phrase, i) => (
                <li key={i} className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <span>{phrase}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* PDF */}
      <section className="space-y-4 pt-4">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">Material completo em PDF</h2>
        <Card className="border-border">
          <CardContent className="p-4 md:p-6">
            <p className="text-sm text-muted-foreground mb-4">
              Baixe ou abra o guia completo para consultar offline ou compartilhar internamente com a equipe.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/tutoriais/guia-completo-atendimento-venda-casada.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-700 text-white text-sm font-semibold hover:from-cyan-700 hover:to-cyan-800 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
              >
                <FileText className="h-4 w-4" />
                <span>Abrir PDF</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="/tutoriais/guia-completo-atendimento-venda-casada.pdf"
                download
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-semibold hover:from-emerald-700 hover:to-emerald-800 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
              >
                <Download className="h-4 w-4" />
                <span>Baixar PDF</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

const AUDITORIA_SLIDES: { n: number; legenda: string }[] = [
  { n: 1, legenda: 'Capa — Auditoria de Experiência do Cliente' },
  { n: 2, legenda: 'Objetivo — Atendimento Humano, Fluxo de IA e Follow-up' },
  { n: 3, legenda: 'Problema: abordagem massiva de texto (evidências + correção)' },
  { n: 4, legenda: 'Problema: no-show em agendamentos' },
  { n: 5, legenda: 'Problema: abordagem massiva de texto (reforço)' },
  { n: 6, legenda: 'Método de atendimento em 4 etapas' },
  { n: 7, legenda: 'Números importantes do atendimento (70% / 22% / 10%)' },
  { n: 8, legenda: 'Tipos de cliente que não respondem (3 perfis)' },
  { n: 9, legenda: 'O que fazer com cada perfil' },
  { n: 10, legenda: 'Exemplo de abordagem por telefone' },
  { n: 11, legenda: 'Em que etapa do funil o cliente está' },
  { n: 12, legenda: 'Erros e acertos no pós-venda' },
  { n: 13, legenda: 'O que precisa focar: Tempo, Prioridade e Burocracia' },
  { n: 14, legenda: 'Conclusão — Boas vendas!' },
];

function AuditoriaComercialView({ onBack }: { onBack: () => void }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  const slidePath = (n: number) => `/tutoriais/auditoria-comercial/slide-${String(n).padStart(2, '0')}.png`;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 sticky top-16 z-30 bg-gradient-to-r from-card/95 via-card/90 to-card/95 backdrop-blur-xl -mx-4 px-4 py-4 md:-mx-6 md:px-6 border-b border-border/50 shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Voltar</span>
        </button>
        <div className="text-center min-w-0 flex-1">
          <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 dark:from-amber-400 dark:to-yellow-300 bg-clip-text text-transparent truncate">
            Auditoria Comercial — Atendimento &amp; Vendas
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Método de atendimento, métricas e follow-up · BackOffice Consultoria</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-xs rounded-md bg-amber-600 hover:bg-amber-700">Comercial</Badge>
          <Badge variant="secondary" className="text-xs rounded-md hidden sm:inline-flex">Vendas</Badge>
        </div>
      </div>

      {/* Frase-âncora / objetivo */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 via-yellow-500/5 to-transparent rounded-2xl blur-2xl" />
        <Card className="relative border-amber-300/50 dark:border-amber-700/50 bg-gradient-to-br from-amber-50/80 via-white dark:from-amber-950/30 dark:via-card to-white dark:to-card shadow-lg">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/40">
                <Target className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
              <div className="space-y-3">
                <p className="font-bold text-sm uppercase tracking-wider text-amber-900 dark:text-amber-200">⚡ O foco da auditoria</p>
                <p className="text-base leading-relaxed font-semibold text-foreground">
                  Melhorar a experiência do cliente em três frentes: <strong>Atendimento Humano</strong> (empatia + resolução técnica),
                  <strong> Fluxo de IA</strong> (triagem e transbordo para o especialista) e <strong>Follow-up</strong> (prazos claros e registro no CRM).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diagnóstico — problemas */}
      <section className="space-y-4 pt-2">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold">Diagnóstico — o que precisa mudar</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: MessageSquare, titulo: 'Abordagem só por texto', desc: 'Variar entre texto, áudio, imagem e vídeo. Abrir com rapport, não com pergunta direta de serviço.' },
            { icon: CalendarDays, titulo: 'No-show em agendamentos', desc: 'Gerar compromisso emocional: "já ajustei a agenda para te dar mais tempo".' },
            { icon: Repeat, titulo: 'Reforçar o CTA', desc: 'Pós-contato: enviar material em vídeo para reforçar a lembrança e a ação esperada.' },
          ].map((p) => (
            <Card key={p.titulo} className="border-border/60">
              <CardContent className="p-5 space-y-2">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 w-fit">
                  <p.icon className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">{p.titulo}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Método 4 etapas */}
      <section className="space-y-4">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold">Método de atendimento em 4 etapas</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { n: 1, t: 'Abordagem', d: 'Trazer o lead para a conversa com rapport, espelhamento e confiança.' },
            { n: 2, t: 'Sondagem', d: 'Entender o cenário completo. Só analise outros casos após fechar o primeiro. Mensagens com números funcionam melhor.' },
            { n: 3, t: 'Apresentação', d: 'Alinhar tudo que o cliente precisa saber para não esquecer nem se desconectar do profissional.' },
            { n: 4, t: 'Fechamento', d: 'Etapa crítica: contrato assinado. Criar senso de urgência após confirmar o cabimento da ação.' },
          ].map((e) => (
            <Card key={e.n} className="border-border/60 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-amber-500 to-yellow-400" />
              <CardContent className="p-5 space-y-2">
                <span className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-bold">{e.n}</span>
                <h3 className="font-semibold text-sm text-foreground">{e.t}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{e.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Números críticos */}
      <section className="space-y-4">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold">Números críticos do atendimento</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { num: '70%', label: 'abandonam na entrega de documentos', acao: 'Faça o lead assumir compromisso. Seja você a dar o prazo de retorno — nunca "fico no aguardo".' },
            { num: '22%', label: 'conversão mínima em captação', acao: 'Forneça ferramentas visuais para o cliente produzir as provas com facilidade.' },
            { num: '10%', label: 'resgate mínimo de leads frios', acao: 'Identifique o canal preferido e faça resgates semanais/mensais.' },
          ].map((m) => (
            <Card key={m.num} className="border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/20">
              <CardContent className="p-5 space-y-2">
                <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">{m.num}</p>
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{m.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-border/40">{m.acao}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Perfis de leads */}
      <section className="space-y-4">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold">Leads que não respondem — 3 perfis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { p: '1º', t: 'Lead curioso', sub: 'Manda mensagem e some', acao: 'Reenviar o mesmo material do anúncio para gerar interesse novo.' },
            { p: '2º', t: 'Some depois', sub: 'Responde de primeira, sem prioridade', acao: 'Falar o que ele perde ou deixa de ganhar por não assinar o contrato.' },
            { p: '3º', t: 'Está comparando', sub: 'Já deve ter outro advogado/processo', acao: 'Prospectar outras ações ou sugerir indicações.' },
          ].map((p) => (
            <Card key={p.p} className="border-border/60">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600">{p.p} PERFIL</span>
                </div>
                <h3 className="font-semibold text-sm text-foreground">{p.t}</h3>
                <p className="text-xs italic text-muted-foreground">"{p.sub}"</p>
                <p className="text-xs text-foreground leading-relaxed pt-1 border-t border-border/40"><span className="font-semibold text-amber-700 dark:text-amber-300">Ação: </span>{p.acao}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Funil */}
      <section className="space-y-4">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold">Em que etapa do funil o cliente está</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: Users, t: 'Topo de funil', d: 'Nunca tinham feito contato. Foco: ganhar confiança.' },
            { icon: Zap, t: 'Meio de funil', d: 'Já conhecem o escritório. Foco: gerar urgência.' },
            { icon: CheckCircle2, t: 'Fundo de funil', d: 'Clientes recorrentes. Foco: manter o relacionamento ativo.' },
          ].map((f) => (
            <Card key={f.t} className="border-border/60">
              <CardContent className="p-5 space-y-2">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 w-fit"><f.icon className="h-5 w-5 text-amber-600" /></div>
                <h3 className="font-semibold text-sm text-foreground">{f.t}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pilares de foco */}
      <section className="space-y-4">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold">Pilares de foco</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: Clock, t: 'Tempo', d: 'Vá direto ao ponto, mas amarre o cliente a um prazo. Ex: "Preciso deste documento até 12h00, ok?"' },
            { icon: Target, t: 'Prioridade', d: 'O cliente só envia documentos se reconhecer a importância. Reforce as perdas.' },
            { icon: Filter, t: 'Burocracia', d: 'Evite listas enormes. Estabeleça uma sequência lógica do que pedir e em que prazo.' },
          ].map((p) => (
            <Card key={p.t} className="border-border/60">
              <CardContent className="p-5 space-y-2">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 w-fit"><p.icon className="h-5 w-5 text-amber-600" /></div>
                <h3 className="font-semibold text-sm text-foreground">{p.t}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Script de abordagem por telefone */}
      <section className="space-y-4">
        <div className="border-t border-border/30" />
        <h2 className="text-xl font-bold">Script — abordagem por telefone</h2>
        <div className="space-y-2">
          {[
            { id: 'tel-1', fase: 'Abertura', txt: 'Bom dia {NOME}, tá tudo certo aí? Recebi seu pedido de informações e já ajudamos vários casos parecidos com o seu.' },
            { id: 'tel-2', fase: 'Condução', txt: 'Eu só preciso entender dois pontos e aí você me fala se podemos prosseguir. Combinado?' },
            { id: 'tel-3', fase: 'Fechamento', txt: 'Sem dúvidas então? Agora, em quantos minutos você envia os documentos? Vou aproveitar e já encaminhar o documento que você precisa assinar.' },
          ].map((s) => (
            <Card key={s.id} className="border-border/60">
              <CardContent className="p-4 flex items-start gap-3">
                <PhoneCall className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-1">{s.fase}</p>
                  <p className="text-sm text-foreground leading-relaxed">{s.txt}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(s.txt, s.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-700 transition-all shrink-0"
                >
                  {copiedId === s.id ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Galeria dos slides */}
      <section className="space-y-4">
        <div className="border-t border-border/30" />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-bold">Apresentação completa ({AUDITORIA_SLIDES.length} slides)</h2>
          <a
            href="/tutoriais/auditoria-comercial.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white transition-all"
          >
            <Download className="h-4 w-4" /> Baixar PDF
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {AUDITORIA_SLIDES.map((s) => (
            <button
              key={s.n}
              onClick={() => setLightbox(s.n)}
              className="group text-left rounded-xl overflow-hidden border border-border/60 hover:border-amber-300 hover:shadow-md transition-all"
            >
              <div className="relative aspect-video bg-muted overflow-hidden">
                <img
                  src={slidePath(s.n)}
                  alt={s.legenda}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">{s.n}/{AUDITORIA_SLIDES.length}</span>
              </div>
              <p className="text-xs text-muted-foreground p-2.5 leading-snug">{s.legenda}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {lightbox > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
              className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors rotate-180"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
          {lightbox < AUDITORIA_SLIDES.length && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
              className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
          <img
            src={slidePath(lightbox)}
            alt={`Slide ${lightbox}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
          />
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-black/50 px-3 py-1 rounded-full">
            {lightbox} / {AUDITORIA_SLIDES.length}
          </span>
        </div>
      )}
    </div>
  );
}

export default function BemVindoPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [expandedTutorial, setExpandedTutorial] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'list' | 'guia-venda-casada' | 'auditoria-comercial'>('list');

  const filtered = tutorials.filter((t) => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === 'Todos' || t.category === selectedCategory;
    return matchSearch && matchCat;
  });

  if (currentView === 'guia-venda-casada') {
    return (
      <AppLayout>
        <div className="flex-1 p-4 md:p-6">
          <GuiaVendaCasadaView onBack={() => setCurrentView('list')} />
        </div>
      </AppLayout>
    );
  }

  if (currentView === 'auditoria-comercial') {
    return (
      <AppLayout>
        <div className="flex-1 p-4 md:p-6">
          <AuditoriaComercialView onBack={() => setCurrentView('list')} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <header className="sticky top-0 z-40 w-full bg-card/80 backdrop-blur-md border-b border-border">
        <div className="flex h-14 md:h-16 items-center justify-between px-3 md:px-6 gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <SidebarTrigger className="md:hidden shrink-0" />
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary hidden md:block" />
              <h1 className="text-base md:text-xl font-semibold text-foreground truncate">Bem-Vindo ao Escritório</h1>
              <Badge variant="outline" className="rounded-lg text-xs hidden md:inline-flex">
                {tutorials.length} tutoriais
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 space-y-6 animate-fade-in">
        {/* Welcome banner */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-foreground mb-1">Guia de Treinamento</h2>
              <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
                Aqui você encontra tutoriais sobre todas as funcionalidades do sistema.
                Explore cada seção para aprender a usar o CRM, processos, petições e mais.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tutorial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl shadow-soft border-0"
            />
          </div>
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Tutorials grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tutorial) => {
            const isExpanded = expandedTutorial === tutorial.id;
            return (
              <Card
                key={tutorial.id}
                className={`cursor-pointer transition-all hover:shadow-md group ${
                  isExpanded ? 'ring-2 ring-primary/20 shadow-md' : ''
                }`}
                onClick={() => {
                  if (tutorial.hasDetailedView) {
                    if (tutorial.id === 'auditoria-comercial') {
                      setCurrentView('auditoria-comercial');
                    } else {
                      setCurrentView('guia-venda-casada');
                    }
                  } else {
                    setExpandedTutorial(isExpanded ? null : tutorial.id);
                  }
                }}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${tutorial.color}`}>
                      <tutorial.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-sm text-foreground">{tutorial.title}</h3>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground/40 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{tutorial.description}</p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2 animate-fade-in">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Passo a passo</p>
                      <ol className="space-y-1.5">
                        {tutorial.steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="text-xs text-foreground/80">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">Nenhum tutorial encontrado</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
