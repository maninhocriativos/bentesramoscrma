import { useState } from 'react';
import { ArrowLeft, ArrowRight, MessageSquare, Calculator, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IsaChat } from '@/components/assistentes/IsaChat';
import { CalculadoraChat } from '@/components/assistentes/CalculadoraChat';
import { cn } from '@/lib/utils';
import isaAvatar from '@/assets/isa-avatar.png';

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const agents: Agent[] = [
  {
    id: 'isa',
    name: 'Assistente Geral',
    description: 'Consulte leads, processos, tarefas e obtenha análises do escritório.',
    icon: <MessageSquare className="h-5 w-5" />,
    color: 'bg-violet-500',
  },
  {
    id: 'calculadora',
    name: 'Cálculo Bancário',
    description: 'Analise contratos bancários e calcule juros abusivos.',
    icon: <Calculator className="h-5 w-5" />,
    color: 'bg-emerald-500',
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
      
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="w-full max-w-2xl space-y-6">
          
          {/* Header com Isa */}
          <div className="text-center">
            <img 
              src={isaAvatar} 
              alt="Isa" 
              className="h-20 w-20 rounded-full object-cover object-top border-4 border-violet-200 shadow-lg mx-auto mb-4"
            />
            <h2 className="text-2xl font-semibold text-foreground mb-1">Olá! Eu sou a Isa</h2>
            <p className="text-muted-foreground">
              Escolha um módulo para iniciar uma conversa.
            </p>
          </div>

          {/* Cards de Módulos */}
          <div className="grid sm:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <Card
                key={agent.id}
                className="group cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all hover:-translate-y-1"
                onClick={() => setSelectedAgent(agent.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={cn("p-3 rounded-xl text-white shadow-md", agent.color)}>
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                        {agent.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {agent.description}
                      </p>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4 gap-2"
                    variant="outline"
                  >
                    Iniciar conversa
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Dica */}
          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3" />
            Para processamento automático, acesse Isa Autônoma no menu.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}