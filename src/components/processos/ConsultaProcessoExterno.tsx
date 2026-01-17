import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Scale, Calendar, Users, FileText, AlertCircle, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [processo, setProcesso] = useState<ProcessoExterno | null>(null);
  const [processos, setProcessos] = useState<ProcessoExterno[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'numero' | 'cpf'>('numero');

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleBuscar = async () => {
    const query = searchType === 'numero' ? numeroProcesso.trim() : cpf.replace(/\D/g, '');
    
    if (!query) {
      toast.error(searchType === 'numero' ? 'Digite o número do processo' : 'Digite o CPF');
      return;
    }

    if (searchType === 'cpf' && query.length !== 11) {
      toast.error('CPF deve conter 11 dígitos');
      return;
    }

    setLoading(true);
    setErro(null);
    setProcesso(null);
    setProcessos([]);

    try {
      const body = searchType === 'numero' 
        ? { numeroProcesso: query }
        : { cpf: query };

      const { data, error } = await supabase.functions.invoke('consulta-processos', { body });

      if (error) throw error;

      if (!data.encontrado) {
        setErro(data.mensagem || 'Processo não encontrado');
        return;
      }

      if (data.multiplos && data.processos) {
        setProcessos(data.processos);
        toast.success(`${data.processos.length} processo(s) encontrado(s)!`);
      } else if (data.processo) {
        setProcesso(data.processo);
        toast.success('Processo encontrado!');
      }
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

  const renderProcessoDetails = (proc: ProcessoExterno) => (
    <div className="space-y-4 animate-fade-in">
      {/* Informações principais */}
      <div className="grid gap-3">
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <FileText className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Número</p>
            <p className="font-mono font-medium">{proc.numeroProcesso}</p>
          </div>
          <Badge variant="secondary">{proc.tribunal}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Classe</p>
            <p className="font-medium text-sm">{proc.classe}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Ajuizado em</p>
              <p className="font-medium text-sm">{formatDate(proc.dataAjuizamento)}</p>
            </div>
          </div>
        </div>

        {proc.assuntos.length > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">Assuntos</p>
            <div className="flex flex-wrap gap-1">
              {proc.assuntos.map((assunto, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {assunto}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Partes */}
      {proc.partes.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Partes</p>
          </div>
          <div className="space-y-1">
            {proc.partes.slice(0, 6).map((parte, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span>{parte.nome}</span>
                <Badge variant="outline" className="text-xs">{parte.tipo}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimas movimentações */}
      {proc.movimentos.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Últimas Movimentações</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {proc.movimentos.map((mov, i) => (
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
  );

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Scale className="h-5 w-5 text-primary" />
          Consulta Processos (CNJ/DataJud)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={searchType} onValueChange={(v) => setSearchType(v as 'numero' | 'cpf')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="numero" className="gap-2">
              <FileText className="h-4 w-4" />
              Por Número
            </TabsTrigger>
            <TabsTrigger value="cpf" className="gap-2">
              <User className="h-4 w-4" />
              Por CPF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="numero" className="mt-4">
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
          </TabsContent>

          <TabsContent value="cpf" className="mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="Digite o CPF (ex: 000.000.000-00)"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
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
            <p className="text-xs text-muted-foreground mt-2">
              Busca processos por CPF em TRT11, TJAM e TRF1
            </p>
          </TabsContent>
        </Tabs>

        {erro && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{erro}</span>
          </div>
        )}

        {/* Múltiplos processos (busca por CPF) */}
        {processos.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">
              {processos.length} processo(s) encontrado(s)
            </p>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {processos.map((proc, index) => (
                <div key={index} className="border rounded-lg p-4">
                  {renderProcessoDetails(proc)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processo único */}
        {processo && renderProcessoDetails(processo)}
      </CardContent>
    </Card>
  );
}
