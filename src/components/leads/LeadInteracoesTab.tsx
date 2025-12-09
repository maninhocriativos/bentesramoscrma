import { useState } from 'react';
import { Plus, Phone, Mail, MessageSquare, Users, Building, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useInteracoes } from '@/hooks/useInteracoes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { InteracaoModal } from './InteracaoModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadInteracoesTabProps {
  clienteId: string;
}

const tipoIcons: Record<string, React.ReactNode> = {
  'Ligação': <Phone className="h-4 w-4" />,
  'Email': <Mail className="h-4 w-4" />,
  'WhatsApp': <MessageSquare className="h-4 w-4" />,
  'Reunião': <Users className="h-4 w-4" />,
  'Atendimento Presencial': <Building className="h-4 w-4" />,
};

const tipoColors: Record<string, string> = {
  'Ligação': 'bg-blue-500/10 text-blue-600',
  'Email': 'bg-purple-500/10 text-purple-600',
  'WhatsApp': 'bg-green-500/10 text-green-600',
  'Reunião': 'bg-amber-500/10 text-amber-600',
  'Atendimento Presencial': 'bg-slate-500/10 text-slate-600',
};

export function LeadInteracoesTab({ clienteId }: LeadInteracoesTabProps) {
  const { interacoes, loading, createInteracao } = useInteracoes(clienteId);
  const [modalOpen, setModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Histórico de Interações</h3>
        <Button onClick={() => setModalOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Interação
        </Button>
      </div>

      {interacoes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma interação registrada</p>
            <Button variant="outline" className="mt-4" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Registrar primeira interação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {interacoes.map((interacao) => (
            <Card key={interacao.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${tipoColors[interacao.tipo]}`}>
                    {tipoIcons[interacao.tipo]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{interacao.tipo}</span>
                      <Badge variant="outline" className="text-xs">
                        {interacao.direcao === 'Entrada' ? (
                          <ArrowDownLeft className="h-3 w-3 mr-1" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3 mr-1" />
                        )}
                        {interacao.direcao}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">{interacao.resumo}</p>
                    {interacao.detalhes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {interacao.detalhes}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(interacao.data_interacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <InteracaoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        clienteId={clienteId}
        onSave={createInteracao}
      />
    </div>
  );
}