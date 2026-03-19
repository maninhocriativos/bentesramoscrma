import { useState, useEffect } from 'react';
import { Plus, Scale, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateProcessoModal } from './CreateProcessoModal';
import { useNavigate } from 'react-router-dom';

interface Processo {
  id: string;
  numero_processo: string | null;
  titulo_acao: string | null;
  status: string | null;
  advogado_responsavel: string | null;
  created_at: string | null;
}

interface LeadProcessosTabProps {
  clienteId: string;
  clienteNome?: string;
}

const statusColors: Record<string, string> = {
  'Em Andamento': 'bg-blue-500/10 text-blue-600',
  'Aguardando': 'bg-amber-500/10 text-amber-600',
  'Arquivado': 'bg-slate-500/10 text-slate-600',
  'Ganho': 'bg-green-500/10 text-green-600',
  'Perdido': 'bg-red-500/10 text-red-600',
};

export function LeadProcessosTab({ clienteId, clienteNome }: LeadProcessosTabProps) {
  const navigate = useNavigate();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchProcessos = async () => {
    const { data, error } = await supabase
      .from('processos')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProcessos(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProcessos();
  }, [clienteId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Processos Vinculados</h3>
        <Button onClick={() => setModalOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Novo Processo
        </Button>
      </div>

      {processos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Scale className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum processo vinculado</p>
            <Button variant="outline" className="mt-4" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro processo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {processos.map((processo) => (
            <Card key={processo.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate('/processos')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Scale className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{processo.titulo_acao || 'Sem título'}</span>
                      <Badge className={statusColors[processo.status || ''] || 'bg-muted'}>
                        {processo.status || 'Pendente'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Nº {processo.numero_processo || '—'}
                    </p>
                    {processo.advogado_responsavel && (
                      <p className="text-xs text-muted-foreground">
                        Responsável: {processo.advogado_responsavel}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateProcessoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        clienteId={clienteId}
        onSuccess={fetchProcessos}
      />
    </div>
  );
}