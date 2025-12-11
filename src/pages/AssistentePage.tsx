import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IsaChat } from '@/components/assistentes/IsaChat';
import { CalculadoraChat } from '@/components/assistentes/CalculadoraChat';
import isaAvatar from '@/assets/isa-avatar.png';

interface Agent {
  id: string;
  name: string;
  description: string;
  bgColor: string;
}

const agents: Agent[] = [
  {
    id: 'isa',
    name: 'Isa',
    description: 'Assistente virtual do escritório. Tire dúvidas sobre leads, processos, tarefas e muito mais.',
    bgColor: 'bg-stone-100',
  },
  {
    id: 'calculadora',
    name: 'Isa Cálculo Bancário',
    description: 'Analise extratos bancários, calcule juros abusivos e identifique cobranças indevidas.',
    bgColor: 'bg-emerald-50',
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
      
      <div className="flex-1 p-6">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <div className="inline-block mb-4">
            <img 
              src={isaAvatar} 
              alt="Isa" 
              className="h-24 w-24 rounded-full object-cover object-top border-4 border-background shadow-lg"
            />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            Escolha um Assistente
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto text-sm">
            Nossos assistentes de IA estão prontos para ajudar você com diferentes tarefas do dia a dia.
          </p>
        </div>

        {/* Agent Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {agents.map((agent) => (
            <Card
              key={agent.id}
              className={`group cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border ${agent.bgColor}`}
              onClick={() => setSelectedAgent(agent.id)}
            >
              <CardHeader className="pb-3">
                <div className="mb-3">
                  <img 
                    src={isaAvatar} 
                    alt={agent.name}
                    className="h-14 w-14 rounded-full object-cover object-top border-2 border-background shadow-sm"
                  />
                </div>
                <CardTitle className="text-lg">{agent.name}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {agent.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  className="w-full gap-2 transition-colors"
                  variant="outline"
                >
                  Iniciar conversa
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground">
            Os assistentes utilizam inteligência artificial para processar suas solicitações.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}