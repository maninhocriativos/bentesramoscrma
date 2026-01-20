import { useState, useEffect } from 'react';
import { Trash2, Search, Loader2, Users, ChevronRight, Briefcase, BadgeCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Processo, ProcessoStatus } from '@/types/processos';
import { Lead } from '@/types/leads';
import { useProcessos } from '@/hooks/useProcessos';
import { ProcessoNotificacaoConfig } from './ProcessoNotificacaoConfig';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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

interface Movimento {
  dataHora: string;
  nome: string;
  complemento?: string;
  codigo?: number;
}

interface ProcessoModalProps {
  processo: Processo | null;
  isOpen: boolean;
  onClose: () => void;
  isNew?: boolean;
  canDelete?: boolean;
  leads: Lead[];
}

const STATUSES: ProcessoStatus[] = [
  'Em Andamento',
  'Suspenso',
  'Arquivado',
  'Ganho',
  'Perdido',
];

export function ProcessoModal({ 
  processo, 
  isOpen, 
  onClose, 
  isNew = false, 
  canDelete = false,
  leads 
}: ProcessoModalProps) {
  const { createProcesso, updateProcesso, deleteProcesso, fetchProcessos } = useProcessos();
  const [formData, setFormData] = useState({
    numero_processo: '',
    titulo_acao: '',
    status: 'Em Andamento' as ProcessoStatus,
    advogado_responsavel: '',
    cliente_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  
  // Estado para dados carregados do DataJud
  const [partes, setPartes] = useState<Parte[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);

  // Buscar dados do processo automaticamente ao digitar número válido
  const fetchProcessoData = async (numeroProcesso: string) => {
    // Validar formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
    const cnjPattern = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
    if (!cnjPattern.test(numeroProcesso)) return;

    setFetchingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-processos', {
        body: { numeroProcesso }
      });

      if (error) throw error;

      if (data?.encontrado && data?.processo) {
        const proc = data.processo;
        
        // Encontrar cliente pela parte (autor) se existir
        const parteAutor = proc.partes?.find((p: any) => 
          p.tipo === 'Autor' || p.polo?.toUpperCase() === 'AT' || p.polo?.toUpperCase() === 'PA'
        );
        
        let clienteId = '';
        let nomeCliente = '';
        if (parteAutor?.nome) {
          nomeCliente = parteAutor.nome;
          const nomeAutor = parteAutor.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          // Buscar em TODOS os leads
          const leadMatch = leads.find(l => {
            const nomeLead = (l.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return nomeLead.includes(nomeAutor) || nomeAutor.includes(nomeLead);
          });
          if (leadMatch) {
            clienteId = leadMatch.id;
          }
        }

        // Extrair advogado do autor
        let advogadoResponsavel = '';
        if (parteAutor?.advogados && parteAutor.advogados.length > 0) {
          const adv = parteAutor.advogados[0];
          advogadoResponsavel = adv.oab ? `${adv.nome} (${adv.oab})` : adv.nome;
        }

        setFormData(prev => ({
          ...prev,
          titulo_acao: proc.classe || prev.titulo_acao,
          status: mapApiStatusToLocal(proc.status),
          cliente_id: clienteId || prev.cliente_id,
          advogado_responsavel: advogadoResponsavel || prev.advogado_responsavel,
        }));

        // Armazenar partes e movimentações
        if (proc.partes && Array.isArray(proc.partes)) {
          setPartes(proc.partes);
        }
        if (proc.movimentos && Array.isArray(proc.movimentos)) {
          setMovimentos(proc.movimentos.slice(0, 15)); // Limitar a 15 movimentações no modal
        }

        toast.success('Dados do processo carregados!', {
          description: nomeCliente 
            ? `${proc.classe} - Cliente: ${nomeCliente}` 
            : `${proc.classe} - ${proc.tribunal}`
        });
      } else {
        toast.error('Processo não encontrado', {
          description: 'Verifique o número do processo e tente novamente'
        });
      }
    } catch (err) {
      console.error('Erro ao buscar dados do processo:', err);
      toast.error('Erro ao buscar dados', {
        description: 'Não foi possível consultar o DataJud'
      });
    } finally {
      setFetchingData(false);
    }
  };

  // Mapear status da API para status local
  const mapApiStatusToLocal = (apiStatus: string): ProcessoStatus => {
    const statusMap: Record<string, ProcessoStatus> = {
      'Em Andamento': 'Em Andamento',
      'Arquivado': 'Arquivado',
      'Suspenso': 'Suspenso',
      'Transitado em Julgado': 'Arquivado',
      'Com Sentença': 'Em Andamento',
      'Em Grau Recursal': 'Em Andamento',
    };
    return statusMap[apiStatus] || 'Em Andamento';
  };

  // Debounce para buscar dados ao digitar número
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isNew && formData.numero_processo.length >= 25) {
        fetchProcessoData(formData.numero_processo);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.numero_processo, isNew]);

  useEffect(() => {
    if (processo) {
      setFormData({
        numero_processo: processo.numero_processo || '',
        titulo_acao: processo.titulo_acao || '',
        status: (processo.status as ProcessoStatus) || 'Em Andamento',
        advogado_responsavel: processo.advogado_responsavel || '',
        cliente_id: processo.cliente_id || '',
      });
      // Limpar dados do DataJud para processos existentes (só carrega para novos)
      setPartes([]);
      setMovimentos([]);
    } else {
      setFormData({
        numero_processo: '',
        titulo_acao: '',
        status: 'Em Andamento',
        advogado_responsavel: '',
        cliente_id: '',
      });
      setPartes([]);
      setMovimentos([]);
    }
  }, [processo, isOpen]);

  const handleSave = async () => {
    setSaving(true);
    
    const data = {
      ...formData,
      cliente_id: formData.cliente_id === '__none__' ? null : formData.cliente_id || null,
    };

    if (isNew) {
      await createProcesso(data);
    } else if (processo) {
      await updateProcesso(processo.id, data);
    }
    
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (processo) {
      await deleteProcesso(processo.id);
      onClose();
    }
  };

  // Show all leads as potential clients
  const clienteOptions = leads;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isNew ? 'Novo Processo' : 'Detalhes do Processo'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="numero_processo">Número do Processo</Label>
              <div className="relative">
                <Input
                  id="numero_processo"
                  value={formData.numero_processo}
                  onChange={(e) => setFormData({ ...formData, numero_processo: e.target.value })}
                  className="rounded-xl pr-10"
                  placeholder="0000000-00.0000.0.00.0000"
                />
                {fetchingData && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                )}
              </div>
              {isNew && (
                <p className="text-xs text-muted-foreground mt-1">
                  Digite o número completo para carregar dados automaticamente
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as ProcessoStatus })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="titulo_acao">Título da Ação</Label>
              <Input
                id="titulo_acao"
                value={formData.titulo_acao}
                onChange={(e) => setFormData({ ...formData, titulo_acao: e.target.value })}
                className="rounded-xl"
                placeholder="Ex: Ação de Indenização por Danos Morais"
              />
            </div>

            <div>
              <Label htmlFor="advogado_responsavel">Advogado Responsável</Label>
              <Input
                id="advogado_responsavel"
                value={formData.advogado_responsavel}
                onChange={(e) => setFormData({ ...formData, advogado_responsavel: e.target.value })}
                className="rounded-xl"
                placeholder="Nome do advogado"
              />
            </div>

            <div>
              <Label htmlFor="cliente_id">Cliente (Lead)</Label>
              <Select
                value={formData.cliente_id || '__none__'}
                onValueChange={(value) => setFormData({ ...formData, cliente_id: value === '__none__' ? '' : value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {clienteOptions.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Partes do Processo - Exibir quando carregado do DataJud */}
          {partes.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Partes do Processo ({partes.length})</p>
              </div>
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {partes.map((parte, i) => {
                    const tipoLower = (parte.tipo || '').toLowerCase();
                    const poloClasses = tipoLower.includes('autor')
                      ? 'bg-success/15 text-success border-success/30'
                      : tipoLower.includes('réu') || tipoLower.includes('reu')
                        ? 'bg-destructive/15 text-destructive border-destructive/30'
                        : 'bg-secondary/25 text-secondary-foreground border-secondary/30';

                    return (
                      <div key={i} className="p-2 bg-background/50 rounded border">
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-medium text-sm line-clamp-1">{parte.nome}</span>
                          <div className="flex gap-1">
                            <Badge variant="outline" className={`text-xs ${poloClasses}`}>{parte.tipo}</Badge>
                          </div>
                        </div>
                        {parte.documento && (
                          <p className="text-xs text-muted-foreground mt-1">Doc: {parte.documento}</p>
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
              </ScrollArea>
            </div>
          )}

          {/* Movimentações - Exibir quando carregado do DataJud */}
          {movimentos.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-xl">
              <p className="text-sm font-medium mb-2">Últimas Movimentações ({movimentos.length})</p>
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {movimentos.map((mov, i) => (
                    <div key={i} className="p-2 bg-background/50 rounded border-l-2 border-primary/30">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm font-medium flex-1">{mov.nome}</p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{mov.dataHora}</span>
                      </div>
                      {mov.codigo && (
                        <Badge variant="outline" className="text-xs mt-1">
                          CNJ: {mov.codigo}
                        </Badge>
                      )}
                      {mov.complemento && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {mov.complemento}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Notification Config - Only show for existing processes */}
          {!isNew && processo && (
            <ProcessoNotificacaoConfig
              processoId={processo.id}
              frequenciaDias={processo.frequencia_notificacao_dias || 7}
              notificacaoAtiva={processo.notificacao_ativa ?? true}
              ultimaNotificacao={processo.ultima_notificacao_at}
              onUpdate={() => fetchProcessos()}
            />
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            {!isNew && canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="rounded-xl">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir este processo? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDelete}
                      className="rounded-xl bg-destructive hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="rounded-xl">
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="rounded-xl"
            >
              {saving ? 'Salvando...' : isNew ? 'Criar Processo' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
