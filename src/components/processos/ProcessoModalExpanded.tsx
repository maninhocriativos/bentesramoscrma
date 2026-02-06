import { useState, useEffect } from 'react';
import { Trash2, Loader2, Users, Briefcase, BadgeCheck, RefreshCw, MessageSquare, Building2, Scale, Calendar, DollarSign, Gavel, MapPin } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Processo, ProcessoStatus, ProcessoParte, ProcessoMovimento } from '@/types/processos';
import { Lead } from '@/types/leads';
import { useProcessos } from '@/hooks/useProcessos';
import { ProcessoNotificacaoConfig } from './ProcessoNotificacaoConfig';
import { ProcessoNotificacoesTab } from './ProcessoNotificacoesTab';
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

interface ProcessoModalExpandedProps {
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

const CNJ_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

export function ProcessoModalExpanded({ 
  processo, 
  isOpen, 
  onClose, 
  isNew = false, 
  canDelete = false,
  leads 
}: ProcessoModalExpandedProps) {
  const { createProcesso, updateProcesso, deleteProcesso, fetchProcessos } = useProcessos();
  const [formData, setFormData] = useState({
    numero_processo: '',
    titulo_acao: '',
    status: 'Em Andamento' as ProcessoStatus,
    advogado_responsavel: '',
    cliente_id: '',
    tribunal: '',
    vara_comarca: '',
    assunto: '',
    valor_causa: '',
    orgao_julgador: '',
    grau: '',
  });
  const [saving, setSaving] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  
  const [partes, setPartes] = useState<ProcessoParte[]>([]);
  const [movimentos, setMovimentos] = useState<ProcessoMovimento[]>([]);

  const fetchProcessoData = async (numeroProcesso: string, tribunalOverride?: string) => {
    const numero = (numeroProcesso || '').trim();
    if (!CNJ_REGEX.test(numero)) return;

    setFetchingData(true);
    try {
      const tribunal = (tribunalOverride || '').trim();

      const { data, error } = await supabase.functions.invoke('consulta-processos', {
        body: {
          numeroProcesso: numero,
          tribunal: tribunal ? tribunal : undefined,
        },
      });

      if (error) throw error;

      if (data?.encontrado && data?.processo) {
        const proc = data.processo;

        const parteAutor = proc.partes?.find((p: any) =>
          p.tipo === 'Autor' || p.polo?.toUpperCase() === 'AT' || p.polo?.toUpperCase() === 'PA'
        );

        let clienteId = '';
        let nomeCliente = '';
        if (parteAutor?.nome) {
          nomeCliente = parteAutor.nome;
          const nomeAutor = parteAutor.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const leadMatch = leads.find(l => {
            const nomeLead = (l.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return nomeLead.includes(nomeAutor) || nomeAutor.includes(nomeLead);
          });
          if (leadMatch) {
            clienteId = leadMatch.id;
          }
        }

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
          tribunal: proc.tribunal || prev.tribunal || '',
          orgao_julgador: proc.orgaoJulgador || '',
          grau: proc.grau || '',
          assunto: proc.assuntos?.[0]?.nome || '',
          valor_causa: proc.valorCausa?.toString() || '',
        }));

        if (proc.partes && Array.isArray(proc.partes)) {
          setPartes(proc.partes);
        }
        if (proc.movimentos && Array.isArray(proc.movimentos)) {
          setMovimentos(proc.movimentos.slice(0, 50));
        }

        toast.success('Dados do processo carregados!', {
          description: nomeCliente
            ? `${proc.classe} - Cliente: ${nomeCliente}`
            : `${proc.classe} - ${(proc.tribunal || tribunal || 'DataJud')}`
        });
      } else {
        toast.error('Processo não encontrado', {
          description: data?.mensagem || 'Não encontramos este processo no DataJud com os parâmetros informados.'
        });
      }
    } catch (err) {
      console.error('Erro ao buscar dados do processo:', err);
      toast.error('Erro ao buscar dados do DataJud');
    } finally {
      setFetchingData(false);
    }
  };

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

  const handleRefreshStatus = async () => {
    const numero = (formData.numero_processo || '').trim();
    if (!numero) {
      toast.error('Informe o número do processo', {
        description: 'Use o formato CNJ: 0000000-00.0000.0.00.0000',
      });
      return;
    }

    if (!CNJ_REGEX.test(numero)) {
      toast.error('Número do processo inválido', {
        description: 'Use o formato CNJ: 0000000-00.0000.0.00.0000',
      });
      return;
    }

    setFetchingData(true);
    try {
      const tribunal = (formData.tribunal || '').trim();

      const { data, error } = await supabase.functions.invoke('consulta-processos', {
        body: {
          numeroProcesso: numero,
          tribunal: tribunal ? tribunal : undefined,
        },
      });

      if (error) throw error;

      if (data?.encontrado && data?.processo) {
        const proc = data.processo;

        // Extrair partes e movimentos
        const newPartes = proc.partes || [];
        const newMovimentos = (proc.movimentos || []).slice(0, 50);

        // Atualizar states locais
        setPartes(newPartes);
        setMovimentos(newMovimentos);

        // Preparar dados para atualização
        const updateData: any = {
          titulo_acao: proc.classe || formData.titulo_acao,
          status: mapApiStatusToLocal(proc.status),
          tribunal: proc.tribunal || formData.tribunal,
          orgao_julgador: proc.orgaoJulgador || formData.orgao_julgador,
          grau: proc.grau || formData.grau,
          assunto: proc.assuntos?.[0]?.nome || formData.assunto,
          valor_causa: proc.valorCausa || null,
          partes_json: newPartes.length > 0 ? newPartes : null,
          movimentos_json: newMovimentos.length > 0 ? newMovimentos : null,
          dados_datajud: proc.fonteRaw || null,
          ultima_consulta_api_at: new Date().toISOString(),
          data_ultima_atualizacao: new Date().toISOString(),
        };

        // Atualizar form local
        setFormData(prev => ({
          ...prev,
          titulo_acao: updateData.titulo_acao,
          status: updateData.status,
          tribunal: updateData.tribunal,
          orgao_julgador: updateData.orgao_julgador,
          grau: updateData.grau,
          assunto: updateData.assunto,
          valor_causa: proc.valorCausa?.toString() || '',
        }));

        // Se é um processo existente, salvar no banco imediatamente
        if (processo?.id) {
          const { error: updateError } = await supabase
            .from('processos')
            .update(updateData)
            .eq('id', processo.id);

          if (updateError) {
            console.error('Erro ao salvar no banco:', updateError);
            toast.error('Erro ao salvar movimentações');
          } else {
            await fetchProcessos(); // Atualizar lista
            toast.success('Processo atualizado!', {
              description: `${newMovimentos.length} movimentações carregadas do DataJud`
            });
          }
        } else {
          toast.success('Dados carregados!', {
            description: `${newMovimentos.length} movimentações encontradas`
          });
        }
      } else {
        toast.error('Processo não encontrado', {
          description: data?.mensagem || 'Não encontramos este processo no DataJud com os parâmetros informados.'
        });
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      toast.error('Erro ao consultar DataJud');
    } finally {
      setFetchingData(false);
    }
  };

  const handleSendNotification = async () => {
    if (!processo?.id) return;
    
    setSendingNotification(true);
    try {
      const { data, error } = await supabase.functions.invoke('processo-status-notify', {
        body: { processoId: processo.id }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Notificação enviada!', {
          description: `WhatsApp enviado para ${data.telefone}`
        });
      } else {
        throw new Error(data?.error || 'Erro ao enviar');
      }
    } catch (err: any) {
      console.error('Erro ao enviar notificação:', err);
      toast.error('Erro ao enviar notificação', {
        description: err.message || 'Verifique se o cliente possui telefone'
      });
    } finally {
      setSendingNotification(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const numero = (formData.numero_processo || '').trim();
      if (isNew && CNJ_REGEX.test(numero)) {
        fetchProcessoData(numero, formData.tribunal);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.numero_processo, formData.tribunal, isNew]);

  useEffect(() => {
    if (processo) {
      setFormData({
        numero_processo: processo.numero_processo || '',
        titulo_acao: processo.titulo_acao || '',
        status: (processo.status as ProcessoStatus) || 'Em Andamento',
        advogado_responsavel: processo.advogado_responsavel || '',
        cliente_id: processo.cliente_id || '',
        tribunal: processo.tribunal || '',
        vara_comarca: processo.vara_comarca || '',
        assunto: processo.assunto || '',
        valor_causa: processo.valor_causa?.toString() || '',
        orgao_julgador: processo.orgao_julgador || '',
        grau: processo.grau || '',
      });
      setPartes(processo.partes_json || []);
      setMovimentos(processo.movimentos_json || []);
    } else {
      setFormData({
        numero_processo: '',
        titulo_acao: '',
        status: 'Em Andamento',
        advogado_responsavel: '',
        cliente_id: '',
        tribunal: '',
        vara_comarca: '',
        assunto: '',
        valor_causa: '',
        orgao_julgador: '',
        grau: '',
      });
      setPartes([]);
      setMovimentos([]);
    }
  }, [processo, isOpen]);

  const handleSave = async () => {
    setSaving(true);
    
    const data = {
      numero_processo: formData.numero_processo || null,
      titulo_acao: formData.titulo_acao || null,
      status: formData.status,
      advogado_responsavel: formData.advogado_responsavel || null,
      cliente_id: formData.cliente_id === '__none__' ? null : formData.cliente_id || null,
      tribunal: formData.tribunal || null,
      vara_comarca: formData.vara_comarca || null,
      assunto: formData.assunto || null,
      valor_causa: formData.valor_causa ? parseFloat(formData.valor_causa) : null,
      orgao_julgador: formData.orgao_julgador || null,
      grau: formData.grau || null,
      partes_json: partes.length > 0 ? partes : null,
      movimentos_json: movimentos.length > 0 ? movimentos : null,
      ultima_consulta_api_at: partes.length > 0 || movimentos.length > 0 ? new Date().toISOString() : null,
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

  const clienteOptions = leads;
  const clienteSelecionado = leads.find(l => l.id === formData.cliente_id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl rounded-xl max-h-[95vh] overflow-hidden flex flex-col min-h-0">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            {isNew ? 'Novo Processo' : 'Detalhes do Processo'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados" className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="partes">Partes</TabsTrigger>
            <TabsTrigger value="movimentos">Movimentos</TabsTrigger>
            <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-hidden">
            {/* Tab: Dados */}
            <TabsContent value="dados" className="h-full mt-0">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4 py-4">
                  {/* Número e Status */}
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
                  </div>

                  {/* Título e Assunto */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="titulo_acao">Título / Classe da Ação</Label>
                      <Input
                        id="titulo_acao"
                        value={formData.titulo_acao}
                        onChange={(e) => setFormData({ ...formData, titulo_acao: e.target.value })}
                        className="rounded-xl"
                        placeholder="Ex: Ação de Indenização"
                      />
                    </div>
                    <div>
                      <Label htmlFor="assunto">Assunto Principal</Label>
                      <Input
                        id="assunto"
                        value={formData.assunto}
                        onChange={(e) => setFormData({ ...formData, assunto: e.target.value })}
                        className="rounded-xl"
                        placeholder="Ex: Danos Morais"
                      />
                    </div>
                  </div>

                  {/* Tribunal e Vara */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tribunal" className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> Tribunal
                      </Label>
                      <Input
                        id="tribunal"
                        value={formData.tribunal}
                        onChange={(e) => setFormData({ ...formData, tribunal: e.target.value })}
                        className="rounded-xl"
                        placeholder="Ex: TRT11, TJAM"
                      />
                    </div>
                    <div>
                      <Label htmlFor="vara_comarca" className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Vara / Comarca
                      </Label>
                      <Input
                        id="vara_comarca"
                        value={formData.vara_comarca}
                        onChange={(e) => setFormData({ ...formData, vara_comarca: e.target.value })}
                        className="rounded-xl"
                        placeholder="Ex: 1ª Vara Cível de Manaus"
                      />
                    </div>
                  </div>

                  {/* Órgão Julgador e Grau */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="orgao_julgador" className="flex items-center gap-1">
                        <Gavel className="h-3 w-3" /> Órgão Julgador
                      </Label>
                      <Input
                        id="orgao_julgador"
                        value={formData.orgao_julgador}
                        onChange={(e) => setFormData({ ...formData, orgao_julgador: e.target.value })}
                        className="rounded-xl"
                        placeholder="Ex: Juízo da 2ª Vara"
                      />
                    </div>
                    <div>
                      <Label htmlFor="grau">Grau de Jurisdição</Label>
                      <Select
                        value={formData.grau || 'G1'}
                        onValueChange={(value) => setFormData({ ...formData, grau: value })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="G1">1º Grau</SelectItem>
                          <SelectItem value="G2">2º Grau</SelectItem>
                          <SelectItem value="SUP">Superior</SelectItem>
                          <SelectItem value="JE">Juizado Especial</SelectItem>
                          <SelectItem value="TR">Turma Recursal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Valor da Causa */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="valor_causa" className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> Valor da Causa (R$)
                      </Label>
                      <Input
                        id="valor_causa"
                        type="number"
                        value={formData.valor_causa}
                        onChange={(e) => setFormData({ ...formData, valor_causa: e.target.value })}
                        className="rounded-xl"
                        placeholder="0,00"
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
                  </div>

                  {/* Cliente */}
                  <div>
                    <Label htmlFor="cliente_id">Cliente (Lead)</Label>
                    <Select
                      value={formData.cliente_id || '__none__'}
                      onValueChange={(value) =>
                        setFormData({ ...formData, cliente_id: value === '__none__' ? '' : value })
                      }
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {clienteOptions.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.nome} {lead.telefone ? `(${lead.telefone})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Atualização via DataJud disponível no rodapé do modal */}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tab: Partes */}
            <TabsContent value="partes" className="h-full mt-0">
              <ScrollArea className="h-full pr-4">
                <div className="py-4">
                  {partes.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-muted-foreground">Nenhuma parte carregada</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Use o botão “Atualizar DataJud” para buscar partes no DataJud
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {partes.map((parte, i) => {
                        const tipoLower = (parte.tipo || '').toLowerCase();
                        const poloClasses = tipoLower.includes('autor')
                          ? 'bg-success/15 text-success border-success/30'
                          : tipoLower.includes('réu') || tipoLower.includes('reu')
                            ? 'bg-destructive/15 text-destructive border-destructive/30'
                            : 'bg-secondary/25 text-secondary-foreground border-secondary/30';

                        return (
                          <Card key={i}>
                            <CardContent className="p-3">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-medium text-sm break-words">{parte.nome}</span>
                                <Badge variant="outline" className={poloClasses}>
                                  {parte.tipo}
                                </Badge>
                              </div>
                              {parte.documento && (
                                <p className="text-xs text-muted-foreground mt-1">Doc: {parte.documento}</p>
                              )}
                              {parte.advogados && parte.advogados.length > 0 && (
                                <div className="mt-2 pl-3 border-l-2 border-primary/30">
                                  <p className="text-xs text-muted-foreground mb-1 inline-flex items-center gap-1">
                                    <Briefcase className="h-3 w-3" /> Advogado(s)
                                  </p>
                                  {parte.advogados.map((adv, j) => (
                                    <div key={j} className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-medium break-words">{adv.nome}</p>
                                      {adv.oab && (
                                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                          <BadgeCheck className="h-3 w-3 text-primary" />
                                          {adv.oab}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tab: Movimentos */}
            <TabsContent value="movimentos" className="h-full mt-0">
              <ScrollArea className="h-full pr-4">
                <div className="py-4">
                  {movimentos.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-muted-foreground">Nenhuma movimentação</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Use o botão “Atualizar DataJud” para carregar movimentações
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {movimentos.map((mov, i) => (
                        <Card key={i}>
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start gap-2">
                              <p className="text-sm font-medium flex-1 break-words">{mov.nome}</p>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{mov.dataHora}</span>
                            </div>
                            {mov.codigo && (
                              <Badge variant="outline" className="text-xs mt-1">
                                CNJ: {mov.codigo}
                              </Badge>
                            )}
                            {mov.complemento && (
                              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                                {mov.complemento}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tab: Notificações */}
            <TabsContent value="notificacoes" className="h-full mt-0">
              <ScrollArea className="h-full pr-4">
                <div className="py-4 space-y-4">
                  {!isNew && processo ? (
                    <ProcessoNotificacoesTab
                      processo={processo}
                      cliente={clienteSelecionado}
                      sending={sendingNotification}
                      onSendManual={handleSendNotification}
                      config={
                        <ProcessoNotificacaoConfig
                          processoId={processo.id}
                          frequenciaDias={processo.frequencia_notificacao_dias || 7}
                          notificacaoAtiva={processo.notificacao_ativa ?? true}
                          ultimaNotificacao={processo.ultima_notificacao_at}
                          onUpdate={() => fetchProcessos()}
                        />
                      }
                      previewData={{
                        nomeCliente: clienteSelecionado?.nome,
                        numeroProcesso: formData.numero_processo || processo.numero_processo,
                        acao: formData.titulo_acao || processo.titulo_acao,
                        status: (formData.status as unknown as string) || (processo.status as unknown as string),
                        tribunal: formData.tribunal || processo.tribunal,
                        ultimaAtualizacao: processo.data_ultima_atualizacao,
                      }}
                    />
                  ) : isNew ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-muted-foreground">Salve o processo primeiro</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          As configurações de notificação estarão disponíveis após criar o processo
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        <Separator className="my-4" />

        {/* Action Buttons */}
        <div className="flex justify-between gap-2">
          <div>
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
          
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleRefreshStatus}
              disabled={fetchingData || !(formData.numero_processo || '').trim()}
              className="rounded-xl"
            >
              {fetchingData ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isNew ? 'Buscar DataJud' : 'Atualizar DataJud'}
            </Button>
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
