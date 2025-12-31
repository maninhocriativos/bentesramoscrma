import { useState } from 'react';
import { ArrowLeft, ArrowRight, MessageSquare, Calculator, Sparkles, Zap, Brain, CheckCircle2 } from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
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
  color: string;
}

const agents: Agent[] = [
  {
    id: 'isa',
    name: 'Assistente Geral',
    description: 'Consulte leads, processos, tarefas e obtenha análises.',
    icon: <MessageSquare className="h-5 w-5" />,
    color: 'bg-violet-500',
  },
  {
    id: 'calculadora',
    name: 'Cálculo Bancário',
    description: 'Analise contratos e calcule juros abusivos.',
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
      
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Header com Isa */}
          <div className="flex items-center gap-4 p-4 bg-card border rounded-xl">
            <img 
              src={isaAvatar} 
              alt="Isa" 
              className="h-16 w-16 rounded-full object-cover object-top border-2 border-violet-200 shadow-sm"
            />
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-foreground">Isa</h2>
              <p className="text-sm text-muted-foreground">
                Assistente virtual inteligente do escritório Bentes Ramos.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </div>
          </div>

          {/* Grid Principal */}
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Coluna da Esquerda - Info e Cards */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Status Isa Autônoma */}
              <Card className="bg-amber-50/50 border-amber-200/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-500 text-white shrink-0">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground">Modo Autônomo</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">ATIVO</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Processando mensagens do ManyChat automaticamente. Leads são classificados e ações são sugeridas para aprovação.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cards de Módulos */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Escolha um módulo para conversar
                </h3>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  {agents.map((agent) => (
                    <Card
                      key={agent.id}
                      className="group cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                      onClick={() => setSelectedAgent(agent.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={cn("p-2.5 rounded-lg text-white shrink-0", agent.color)}>
                            {agent.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground mb-0.5 group-hover:text-primary transition-colors">
                              {agent.name}
                            </h4>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {agent.description}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Recursos da Isa */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Brain className="h-4 w-4 text-violet-500" />
                    O que a Isa pode fazer
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      'Consultar informações de leads',
                      'Buscar processos e status',
                      'Listar tarefas pendentes',
                      'Analisar extratos bancários',
                      'Calcular juros abusivos',
                      'Classificar leads automaticamente',
                      'Sugerir próximas ações',
                      'Registrar interações'
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Coluna da Direita - Ações Pendentes */}
            <div className="lg:col-span-1">
              <IsaAcoesPendentes />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}