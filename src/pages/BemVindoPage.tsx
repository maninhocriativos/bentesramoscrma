import { useState } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  GraduationCap, Search, Users, Scale, CheckSquare, CalendarDays,
  DollarSign, FileText, FileSignature, FileEdit, Bot, MessageSquare,
  LayoutDashboard, Zap, Play, ChevronRight, BookOpen
} from 'lucide-react';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  icon: typeof LayoutDashboard;
  category: string;
  color: string;
  steps: string[];
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
];

const categories = ['Todos', 'Principal', 'Gestão', 'Inteligência'];

export default function BemVindoPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [expandedTutorial, setExpandedTutorial] = useState<string | null>(null);

  const filtered = tutorials.filter((t) => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === 'Todos' || t.category === selectedCategory;
    return matchSearch && matchCat;
  });

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
                onClick={() => setExpandedTutorial(isExpanded ? null : tutorial.id)}
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
