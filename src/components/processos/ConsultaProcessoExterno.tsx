import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Scale, Calendar, Users, FileText, AlertCircle, User, Building, Gavel, Clock, DollarSign, Shield, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Movimento {
  dataHora: string;
  nome: string;
  complemento?: string;
  codigo?: number;
}

interface Advogado {
  nome: string;
  oab?: string;
}

interface Parte {
  nome: string;
  tipo: string;
  polo: string;
  tipoPessoa: string;
  documento?: string;
  advogados?: Advogado[];
}

interface ProcessoExterno {
  numeroProcesso: string;
  classe: string;
  assuntos: string[];
  tribunal: string;
  dataAjuizamento: string;
  // Campos detalhados
  grau: string;
  nivelSigilo: string;
  formato: string;
  sistemaProcessual: string;
  orgaoJulgador: string;
  status: string;
  ultimaAtualizacao: string;
  valorCausa: number | null;
  prioridade: string[];
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

  const formatCurrency = (value: number | null) => {
    if (!value) return null;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('arquiv') || statusLower.includes('transitado')) return 'bg-muted text-muted-foreground';
    if (statusLower.includes('suspen')) return 'bg-yellow-500/20 text-yellow-700';
    if (statusLower.includes('sentença') || statusLower.includes('concluso')) return 'bg-blue-500/20 text-blue-700';
    if (statusLower.includes('recursal')) return 'bg-purple-500/20 text-purple-700';
    if (statusLower.includes('audiência')) return 'bg-orange-500/20 text-orange-700';
    return 'bg-green-500/20 text-green-700';
  };

  const renderProcessoDetails = (proc: ProcessoExterno) => (
    <div className="space-y-4 animate-fade-in">
      {/* Header com número e status */}
      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
        <FileText className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Número do Processo</p>
          <p className="font-mono font-medium">{proc.numeroProcesso}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Badge variant="secondary">{proc.tribunal}</Badge>
          <Badge className={getStatusColor(proc.status)}>{proc.status}</Badge>
        </div>
      </div>

      {/* Informações principais em grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Gavel className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Classe Processual</p>
          </div>
          <p className="font-medium text-sm">{proc.classe}</p>
        </div>
        
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Ajuizado em</p>
          </div>
          <p className="font-medium text-sm">{proc.dataAjuizamento}</p>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Última Atualização</p>
          </div>
          <p className="font-medium text-sm">{proc.ultimaAtualizacao}</p>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Building className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Órgão Julgador</p>
          </div>
          <p className="font-medium text-sm line-clamp-2">{proc.orgaoJulgador}</p>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Grau / Formato</p>
          </div>
          <p className="font-medium text-sm">{proc.grau} • {proc.formato}</p>
        </div>

        {proc.valorCausa && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Valor da Causa</p>
            </div>
            <p className="font-medium text-sm">{formatCurrency(proc.valorCausa)}</p>
          </div>
        )}

        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Sigilo / Sistema</p>
          </div>
          <p className="font-medium text-sm">{proc.nivelSigilo} • {proc.sistemaProcessual}</p>
        </div>
      </div>

      {/* Prioridades */}
      {proc.prioridade && proc.prioridade.length > 0 && (
        <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <p className="text-xs text-amber-700 font-medium mb-1">⚡ Prioridades</p>
          <div className="flex flex-wrap gap-1">
            {proc.prioridade.map((p, i) => (
              <Badge key={i} variant="outline" className="text-xs bg-amber-500/20 border-amber-500/30">
                {p}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Assuntos */}
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

      {/* Partes */}
      {proc.partes.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Partes do Processo</p>
          </div>
          <div className="space-y-3">
            {proc.partes.slice(0, 8).map((parte, i) => (
              <div key={i} className="p-2 bg-background/50 rounded border">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-sm">{parte.nome}</span>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-xs">{parte.tipo}</Badge>
                    <Badge variant="secondary" className="text-xs">{parte.tipoPessoa}</Badge>
                  </div>
                </div>
                {parte.documento && (
                  <p className="text-xs text-muted-foreground">Doc: {parte.documento}</p>
                )}
                {parte.advogados && parte.advogados.length > 0 && (
                  <div className="mt-2 pl-3 border-l-2 border-primary/30">
                    <p className="text-xs text-muted-foreground mb-1">
                      <Briefcase className="h-3 w-3 inline mr-1" />
                      Advogado(s):
                    </p>
                    {parte.advogados.map((adv, j) => (
                      <p key={j} className="text-xs">
                        {adv.nome} {adv.oab && <span className="text-muted-foreground">({adv.oab})</span>}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimas movimentações */}
      {proc.movimentos.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Últimas Movimentações ({proc.movimentos.length})</p>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {proc.movimentos.map((mov, i) => (
              <div key={i} className="p-2 bg-muted/30 rounded-lg border-l-2 border-primary/30">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{mov.nome}</p>
                    {mov.codigo && (
                      <span className="text-xs text-muted-foreground">Código: {mov.codigo}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{mov.dataHora}</span>
                </div>
                {mov.complemento && (
                  <p className="text-xs text-muted-foreground mt-1 pl-2 border-l border-muted">
                    {mov.complemento}
                  </p>
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
