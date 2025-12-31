import { useState } from 'react';
import { ArrowLeft, ArrowRight, Bot, Sparkles, MessageSquare, Calculator, Brain, Zap } from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IsaChat } from '@/components/assistentes/IsaChat';
import { CalculadoraChat } from '@/components/assistentes/CalculadoraChat';
import { IsaAcoesPendentes } from '@/components/assistentes/IsaAcoesPendentes';
import { cn } from '@/lib/utils';
import isaAvatar from '@/assets/isa-avatar.png';

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  features: string[];
}

const agents: Agent[] = [
  {
    id: 'isa',
    name: 'Isa Assistente',
    description: 'Assistente virtual inteligente do escritório para consultas gerais.',
    icon: <MessageSquare className="h-6 w-6" />,
    gradient: 'from-violet-500 to-purple-600',
    features: ['Consultar leads', 'Ver processos', 'Buscar tarefas', 'Análise de dados'],
  },
  {
    id: 'calculadora',
    name: 'Isa Cálculo Bancário',
    description: 'Especialista em análise de contratos e cálculos financeiros.',
    icon: <Calculator className="h-6 w-6" />,
    gradient: 'from-emerald-500 to-teal-600',
    features: ['Calcular juros', 'Analisar contratos', 'Identificar abusividades', 'Gerar relatórios'],
  },
];

export default function AssistentePage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

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
        <AppHeader title={agent?.name || 'Assistente'} />
        <div className="flex-1 flex flex-col">
          <div className="px-6 py-3 border-b bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedAgent(null)}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              Voltar para assistentes
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
      
      <div className="flex-1 overflow-y-auto">
        {/* Hero Section */}
        <div className="relative bg-gradient-to-br from-primary/5 via-background to-violet-500/5 border-b">
          <div className="max-w-6xl mx-auto px-6 py-10">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full blur-xl opacity-30 animate-pulse" />
                <img 
                  src={isaAvatar} 
                  alt="Isa" 
                  className="relative h-28 w-28 rounded-full object-cover object-top border-4 border-background shadow-xl"
                />
                <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full p-2 shadow-lg">
                  <Brain className="h-4 w-4 text-white" />
                </div>
              </div>
              
              {/* Text */}
              <div className="text-center md:text-left">
                <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-violet-500/10 text-violet-600">
                    Powered by GPT-4
                  </span>
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Olá! Eu sou a <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">Isa</span>
                </h1>
                <p className="text-muted-foreground max-w-lg">
                  Sua assistente virtual inteligente. Escolha um dos meus módulos especializados para começar.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Agent Cards */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500" />
                Módulos Disponíveis
              </h2>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {agents.map((agent) => (
                  <Card
                    key={agent.id}
                    className={cn(
                      "group cursor-pointer transition-all duration-300",
                      "hover:shadow-lg hover:border-violet-500/30 hover:-translate-y-1",
                      "bg-card overflow-hidden"
                    )}
                    onClick={() => setSelectedAgent(agent.id)}
                  >
                    {/* Gradient Header */}
                    <div className={cn(
                      "h-2 w-full bg-gradient-to-r",
                      agent.gradient
                    )} />
                    
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className={cn(
                          "p-3 rounded-xl bg-gradient-to-br text-white shadow-lg",
                          agent.gradient
                        )}>
                          {agent.icon}
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                      </div>
                      <CardTitle className="text-lg mt-3">{agent.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {agent.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      {/* Features Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {agent.features.map((feature, idx) => (
                          <span 
                            key={idx}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                      
                      <Button 
                        className={cn(
                          "w-full gap-2 bg-gradient-to-r text-white shadow-md",
                          "hover:shadow-lg hover:scale-[1.02] transition-all",
                          agent.gradient
                        )}
                      >
                        Iniciar conversa
                        <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* Isa Autônoma Card */}
              <Card className="bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-red-500/5 border-amber-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shrink-0">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground mb-1">Isa Autônoma</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Eu processo automaticamente as mensagens do ManyChat, classifico leads, 
                        registro interações e sugiro ações para sua aprovação. Tudo em tempo real!
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Ativo
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Integrado com ManyChat
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Sidebar - Ações Pendentes */}
            <div className="lg:col-span-1">
              <IsaAcoesPendentes />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}