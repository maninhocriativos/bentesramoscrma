import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Scale, Calendar, Users, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Movimento {
  dataHora: string;
  nome: string;
  complemento?: string;
}

interface Parte {
  nome: string;
  tipo: string;
}

interface ProcessoExterno {
  numeroProcesso: string;
  classe: string;
  assuntos: string[];
  tribunal: string;
  dataAjuizamento: string;
  movimentos: Movimento[];
  partes: Parte[];
}

export function ConsultaProcessoExterno() {
  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [loading, setLoading] = useState(false);
  const [processo, setProcesso] = useState<ProcessoExterno | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const handleBuscar = async () => {
    if (!numeroProcesso.trim()) {
      toast.error('Digite o número do processo');
      return;
    }

    setLoading(true);
    setErro(null);
    setProcesso(null);

    try {
      const { data, error } = await supabase.functions.invoke('consulta-processos', {
        body: { numeroProcesso: numeroProcesso.trim() }
      });

      if (error) throw error;

      if (!data.encontrado) {
        setErro(data.mensagem || 'Processo não encontrado');
        return;
      }

      setProcesso(data.processo);
      toast.success('Processo encontrado!');
    } catch (err) {
      console.error('Erro ao buscar processo:', err);
      setErro('Erro ao consultar processo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Scale className="h-5 w-5 text-primary" />
          Consulta Processos (CNJ/DataJud)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Digite o número do processo (ex: 0000000-00.0000.0.00.0000)"
            value={numeroProcesso}
            onChange={(e) => setNumeroProcesso(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            className="flex-1"
          />
          <Button onClick={handleBuscar} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {erro && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{erro}</span>
          </div>
        )}

        {processo && (
          <div className="space-y-4 animate-fade-in">
            {/* Informações principais */}
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <FileText className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Número</p>
                  <p className="font-mono font-medium">{processo.numeroProcesso}</p>
                </div>
                <Badge variant="secondary">{processo.tribunal}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Classe</p>
                  <p className="font-medium text-sm">{processo.classe}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ajuizado em</p>
                    <p className="font-medium text-sm">{formatDate(processo.dataAjuizamento)}</p>
                  </div>
                </div>
              </div>

              {processo.assuntos.length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Assuntos</p>
                  <div className="flex flex-wrap gap-1">
                    {processo.assuntos.map((assunto, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {assunto}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Partes */}
            {processo.partes.length > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Partes</p>
                </div>
                <div className="space-y-1">
                  {processo.partes.slice(0, 6).map((parte, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span>{parte.nome}</span>
                      <Badge variant="outline" className="text-xs">{parte.tipo}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Últimas movimentações */}
            {processo.movimentos.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Últimas Movimentações</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {processo.movimentos.map((mov, i) => (
                    <div key={i} className="p-2 bg-muted/30 rounded-lg border-l-2 border-primary/30">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-medium">{mov.nome}</p>
                        <span className="text-xs text-muted-foreground">{formatDate(mov.dataHora)}</span>
                      </div>
                      {mov.complemento && (
                        <p className="text-xs text-muted-foreground mt-1">{mov.complemento}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
