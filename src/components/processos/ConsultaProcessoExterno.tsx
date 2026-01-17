import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Scale, Calendar, Users, FileText, AlertCircle, User, Building, Gavel, Clock, DollarSign, Shield, Briefcase, ChevronRight, Save, CheckCircle2, BadgeCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MovimentoDetailModal } from './MovimentoDetailModal';
import { usePerfil } from '@/hooks/usePerfil';

interface Assunto {
  nome: string;
  codigo?: string;
}

interface Movimento {
  dataHora: string;
  dataHoraRaw?: string;
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
  classeCodigo?: string;
  assuntos: Assunto[];
  tribunal: string;
  dataAjuizamento: string;
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
  const [saving, setSaving] = useState(false);
  const [processo, setProcesso] = useState<ProcessoExterno | null>(null);
  const [processos, setProcessos] = useState<ProcessoExterno[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'numero' | 'cpf'>('numero');
  const [selectedMovimento, setSelectedMovimento] = useState<Movimento | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempoConsulta, setTempoConsulta] = useState<number | null>(null);

  const { fullName } = usePerfil();

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
    setTempoConsulta(null);

    try {
      const body = searchType === 'numero' 
        ? { numeroProcesso: query }
        : { cpf: query };

      const { data, error } = await supabase.functions.invoke('consulta-processos', { body });

      if (error) throw error;

      setTempoConsulta(data.tempoMs);

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

  const handleImportar = async (proc: ProcessoExterno) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-processos', {
        body: {
          numeroProcesso: proc.numeroProcesso,
          persistir: true,
          advogadoResponsavel: fullName,
        }
      });

      if (error) throw error;

      toast.success('Processo importado com sucesso!');
    } catch (err) {
      console.error('Erro ao importar processo:', err);
      toast.error('Erro ao importar processo');
    } finally {
      setSaving(false);
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

  const renderProcessoDetails = (proc: ProcessoExterno, showImport = true) => (
    <div className="space-y-4 animate-fade-in">
      {/* Header com número e status */}
      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
        <FileText className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Número do Processo</p>
          <p className="font-mono font-medium">{proc.numeroProcesso}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end items-center">
          <Badge variant="secondary">{proc.tribunal}</Badge>
          <Badge className={getStatusColor(proc.status)}>{proc.status}</Badge>
          {showImport && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleImportar(proc)}
              disabled={saving}
              className="gap-1"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Importar
            </Button>
          )}
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
          {proc.classeCodigo && (
            <p className="text-xs text-muted-foreground mt-0.5">Código CNJ: {proc.classeCodigo}</p>
          )}
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

      {/* Assuntos - com código CNJ */}
      {proc.assuntos.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-2">Assuntos ({proc.assuntos.length})</p>
          <div className="flex flex-wrap gap-1">
            {proc.assuntos.map((assunto, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {typeof assunto === 'string' ? assunto : assunto.nome}
                {typeof assunto !== 'string' && assunto.codigo && (
                  <span className="ml-1 opacity-60">({assunto.codigo})</span>
                )}
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
            <p className="text-sm font-medium">Partes do Processo ({proc.partes.length})</p>
          </div>
          <div className="space-y-3">
            {proc.partes.slice(0, 8).map((parte, i) => {
              const tipoLower = (parte.tipo || '').toLowerCase();
              const poloVariant = tipoLower.includes('autor')
                ? 'success'
                : tipoLower.includes('réu') || tipoLower.includes('reu')
                  ? 'destructive'
                  : 'secondary';

              const poloClasses =
                poloVariant === 'success'
                  ? 'bg-success/15 text-success border-success/30'
                  : poloVariant === 'destructive'
                    ? 'bg-destructive/15 text-destructive border-destructive/30'
                    : 'bg-secondary/25 text-secondary-foreground border-secondary/30';

              return (
                <div key={i} className="p-2 bg-background/50 rounded border">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <div className="min-w-0">
                      <span className="font-medium text-sm line-clamp-1">{parte.nome}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <Badge variant="outline" className={`text-xs ${poloClasses}`}>{parte.tipo}</Badge>
                      <Badge variant="secondary" className="text-xs">{parte.tipoPessoa}</Badge>
                    </div>
                  </div>

                  {parte.documento && (
                    <p className="text-xs text-muted-foreground">Doc: {parte.documento}</p>
                  )}

                  {parte.advogados && parte.advogados.length > 0 && (
                    <div className="mt-2 pl-3 border-l-2 border-primary/30">
                      <p className="text-xs text-muted-foreground mb-1 inline-flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        Advogado(s)
                      </p>
                      <div className="space-y-1">
                        {parte.advogados.map((adv, j) => (
                          <div key={j} className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium">{adv.nome}</p>
                            {adv.oab && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <BadgeCheck className="h-3 w-3 text-primary" />
                                {adv.oab}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Últimas movimentações - Clicáveis */}
      {proc.movimentos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Movimentações ({proc.movimentos.length})</p>
            <p className="text-xs text-muted-foreground">Clique para ver detalhes</p>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {proc.movimentos.map((mov, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedMovimento(mov);
                  setIsModalOpen(true);
                }}
                className="w-full p-3 bg-muted/30 rounded-lg border-l-2 border-primary/30 hover:bg-muted/50 hover:border-primary transition-all text-left group"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">{mov.nome}</p>
                    {mov.codigo && (
                      <Badge variant="outline" className="text-xs mt-1">
                        CNJ: {mov.codigo}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{mov.dataHora}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
                {mov.complemento && (
                  <p className="text-xs text-muted-foreground mt-1 pl-2 border-l border-muted line-clamp-2">
                    {mov.complemento}
                  </p>
                )}
              </button>
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
              Busca processos por CPF em TRT11, TJAM, TRF1-3, TJMG, TJRJ, TJSP, TJRS e TJPR
            </p>
          </TabsContent>
        </Tabs>

        {tempoConsulta && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            Consulta realizada em {tempoConsulta}ms
          </div>
        )}

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
      
      {/* Modal de detalhes da movimentação */}
      <MovimentoDetailModal
        movimento={selectedMovimento}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMovimento(null);
        }}
      />
    </Card>
  );
}
