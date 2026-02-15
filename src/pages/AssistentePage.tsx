import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MessageSquare, Calculator, Sparkles, Zap, Brain, TrendingUp, FileText, BarChart3 } from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IsaChat } from '@/components/assistentes/IsaChat';
import { CalculadoraChat } from '@/components/assistentes/CalculadoraChat';
import { IsaConversionMetrics } from '@/components/assistentes/IsaConversionMetrics';
import { cn } from '@/lib/utils';
import isaAvatar from '@/assets/isa-avatar.png';

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  route?: string;
}

const agents: Agent[] = [
  {
    id: 'isa',
    name: 'Assistente Geral',
    description: 'Consulte leads, processos, tarefas e análises.',
    icon: <MessageSquare className="h-5 w-5" />,
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    id: 'calculadora',
    name: 'Cálculo Bancário',
    description: 'Analise contratos e calcule juros abusivos.',
    icon: <Calculator className="h-5 w-5" />,
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'peticoes',
    name: 'Gerador de Petições',
    description: 'Crie petições JEC em minutos com revisão da Isa.',
    icon: <FileText className="h-5 w-5" />,
    gradient: 'from-amber-500 to-orange-600',
    route: '/peticoes',
  },
  {
    id: 'modelo-editor',
    name: 'Editor de Modelos',
    description: 'Envie um modelo Word e edite mantendo o layout original.',
    icon: <FileText className="h-5 w-5" />,
    gradient: 'from-sky-500 to-blue-600',
    route: '/peticoes/modelo-editor',
  },
];

const capabilities = [
  { icon: Brain, label: 'Análise de Leads', color: 'text-violet-500' },
  { icon: TrendingUp, label: 'Métricas do Escritório', color: 'text-emerald-500' },
  { icon: Zap, label: 'Automação Inteligente', color: 'text-amber-500' },
];

export default function AssistentePage() {
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const handleAgentClick = (agent: Agent) => {
    if (agent.route) {
      navigate(agent.route);
    } else {
      setSelectedAgent(agent.id);
    }
  };

  const renderAgentChat = () => {
    switch (selectedAgent) {
      case 'isa':
        return <IsaChat />;
      case 'calculadora':
        return <CalculadoraChat />;
      default:
        return null;
    }
  };

  if (selectedAgent) {
    const agent = agents.find(a => a.id === selectedAgent);
    return (
      <AppLayout>
        <AppHeader title={`Isa - ${agent?.name}`} />
        <div className="flex-1 flex flex-col">
          <div className="px-6 py-3 border-b bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedAgent(null)}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
          {renderAgentChat()}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <AppHeader title="Assistentes IA" />
      
      <div className="flex-1 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Hero Section - Compact */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-6 text-white">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-0 w-60 h-60 bg-white rounded-full blur-3xl" />
            </div>
            
            <div className="relative flex items-center gap-5">
              <div className="relative">
                <img 
                  src={isaAvatar} 
                  alt="Isa" 
                  className="relative h-16 w-16 rounded-full object-cover object-top border-3 border-white/30 shadow-xl"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white flex items-center justify-center">
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
              
              <div className="flex-1">
                <h1 className="text-2xl font-bold">Isa - Assistente Jurídica</h1>
                <p className="text-white/80 text-sm">
                  Automação inteligente para conversão de leads
                </p>
              </div>
              
              <div className="hidden md:flex items-center gap-3">
                {capabilities.map((cap, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs">
                    <cap.icon className="w-3.5 h-3.5" />
                    {cap.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs: Módulos | Métricas */}
          <Tabs defaultValue="modulos" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="modulos" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Módulos IA
              </TabsTrigger>
              <TabsTrigger value="metricas" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Métricas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="modulos" className="mt-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <Card
                    key={agent.id}
                    className="group cursor-pointer hover:shadow-xl hover:border-primary/40 transition-all hover:-translate-y-1 overflow-hidden"
                    onClick={() => handleAgentClick(agent)}
                  >
                    <CardContent className="p-0">
                      <div className={cn("p-4 bg-gradient-to-r text-white", agent.gradient)}>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            {agent.icon}
                          </div>
                          <div>
                            <h3 className="font-semibold">{agent.name}</h3>
                            <p className="text-sm text-white/80">{agent.description}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 flex items-center justify-between bg-card">
                        <span className="text-xs text-muted-foreground">Clique para iniciar</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5 py-4">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Para processamento automático, acesse <span className="font-medium text-primary">Isa Autônoma</span> no menu.
              </p>
            </TabsContent>

            <TabsContent value="metricas" className="mt-4">
              <IsaConversionMetrics />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
