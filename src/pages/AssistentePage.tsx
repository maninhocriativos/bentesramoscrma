import { useState } from 'react';
import { Bot, Calculator, ArrowLeft, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IsaChat } from '@/components/assistentes/IsaChat';
import { CalculadoraChat } from '@/components/assistentes/CalculadoraChat';

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: typeof Bot;
  color: string;
  gradient: string;
}

const agents: Agent[] = [
  {
    id: 'isa',
    name: 'Isa',
    description: 'Assistente virtual do escritório. Tire dúvidas sobre leads, processos, tarefas e muito mais.',
    icon: Bot,
    color: 'text-primary',
    gradient: 'from-primary/20 to-primary/5',
  },
  {
    id: 'calculadora',
    name: 'Calculadora de Juros',
    description: 'Analise extratos bancários e calcule juros abusivos com precisão.',
    icon: Calculator,
    color: 'text-emerald-500',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
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
              <ArrowLeft className="h-4 w-4" />
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
      
      <div className="flex-1 p-6">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Escolha um Assistente
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Nossos assistentes de IA estão prontos para ajudar você com diferentes tarefas do dia a dia.
          </p>
        </div>

        {/* Agent Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {agents.map((agent) => (
            <Card
              key={agent.id}
              className={cn(
                'group cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] border-2 hover:border-primary/30',
                'bg-gradient-to-br',
                agent.gradient
              )}
              onClick={() => setSelectedAgent(agent.id)}
            >
              <CardHeader className="pb-4">
                <div className={cn(
                  'inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-background shadow-md mb-4 transition-transform group-hover:scale-110',
                )}>
                  <agent.icon className={cn('h-7 w-7', agent.color)} />
                </div>
                <CardTitle className="text-xl">{agent.name}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {agent.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                  variant="outline"
                >
                  Iniciar conversa
                  <ArrowLeft className="h-4 w-4 rotate-180 transition-transform group-hover:translate-x-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground">
            Os assistentes utilizam inteligência artificial para processar suas solicitações.
            <br />
            Todas as conversas são privadas e seguras.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
