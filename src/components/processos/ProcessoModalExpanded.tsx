import { useState, useEffect, useMemo, useCallback } from 'react';
import { Trash2, Loader2, Users, Briefcase, BadgeCheck, RefreshCw, MessageSquare, Building2, Scale, Calendar, DollarSign, Gavel, MapPin, ChevronRight, Plus, X, Tag, FileText, Eye, Bell, Hash, StickyNote, FolderOpen, Shield } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Processo, ProcessoStatus, ProcessoParte, ProcessoMovimento } from '@/types/processos';
import { LeadName } from '@/hooks/useLeadNames';
import { useProcessos } from '@/hooks/useProcessos';
import { ProcessoNotificacaoConfig } from './ProcessoNotificacaoConfig';
import { ProcessoNotificacoesTab } from './ProcessoNotificacoesTab';
import { MovimentoDetailModal } from './MovimentoDetailModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { enrichMovements, MovimentoEnriquecido, getCategoriaColor } from '@/lib/cnjMovimentosMap';
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
  leads: LeadName[];
}

const STATUSES: ProcessoStatus[] = [
  'Em Andamento',
  'Suspenso',
  'Arquivado',
  'Ganho',
  'Perdido',
];

const CNJ_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
const PROCESSO_DRAFT_STORAGE_PREFIX = 'processo_modal_draft_v1';
const PROCESSO_DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24;

type ProcessoFormData = {
  numero_processo: string;
  numero_complementar: string;
  titulo_acao: string;
  status: ProcessoStatus;
  advogado_responsavel: string;
  cliente_id: string;
  cpf_cliente: string;
  tribunal: string;
  vara_comarca: string;
  assunto: string;
  valor_causa: string;
  orgao_julgador: string;
  grau: string;
  origem_cliente: string;
  descricao: string;
  marcadores: string;
  area: string;
  fase: string;
  classe_cnj: string;
  assunto_cnj: string;
  segredo_justica: boolean;
  data_distribuicao: string;
  data_citacao: string;
  data_recebimento: string;
  data_arquivamento: string;
  data_encerramento: string;
  valor_provisionado: string;
  probabilidade: string;
  monitorar_push: boolean;
  tipo_orgao_julgador: string;
  sistema_judicial: string;
  complemento_enderecamento: string;
};

interface ProcessoModalDraft {
  formData: ProcessoFormData;
  partes: ProcessoParte[];
  movimentos: ProcessoMovimento[];
  updatedAt: string;
}

const createEmptyFormData = (): ProcessoFormData => ({
  numero_processo: '',
  numero_complementar: '',
  titulo_acao: '',
  status: 'Em Andamento',
  advogado_responsavel: '',
  cliente_id: '',
  cpf_cliente: '',
  tribunal: '',
  vara_comarca: '',
  assunto: '',
  valor_causa: '',
  orgao_julgador: '',
  grau: '',
  origem_cliente: '',
  descricao: '',
  marcadores: '',
  area: '',
  fase: '',
  classe_cnj: '',
  assunto_cnj: '',
  segredo_justica: false,
  data_distribuicao: '',
  data_citacao: '',
  data_recebimento: '',
  data_arquivamento: '',
  data_encerramento: '',
  valor_provisionado: '',
  probabilidade: '',
  monitorar_push: true,
  tipo_orgao_julgador: '',
  sistema_judicial: '',
  complemento_enderecamento: '',
});

export function ProcessoModalExpanded({ 
  processo, 
  isOpen, 
  onClose, 
  isNew = false, 
  canDelete = false,
  leads 
}: ProcessoModalExpandedProps) {
  const { createProcesso, updateProcesso, deleteProcesso, fetchProcessos } = useProcessos();
  const [formData, setFormData] = useState<ProcessoFormData>(createEmptyFormData());
  const [saving, setSaving] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  
  const [partes, setPartes] = useState<ProcessoParte[]>([]);
  const [movimentos, setMovimentos] = useState<ProcessoMovimento[]>([]);
  
  // Movimentos enriquecidos com tradução humana
  const movimentosEnriquecidos = useMemo(() => enrichMovements(movimentos), [movimentos]);
  
  // Estado para modal de detalhes do movimento
  const [selectedMovimento, setSelectedMovimento] = useState<MovimentoEnriquecido | null>(null);
  const [movimentoModalOpen, setMovimentoModalOpen] = useState(false);

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
          orgao_julgador: proc.orgaoJulgador || prev.orgao_julgador || '',
          grau: proc.grau || prev.grau || '',
          assunto: proc.assuntos?.[0]?.nome || prev.assunto || '',
          valor_causa: proc.valorCausa?.toString() || prev.valor_causa || '',
          classe_cnj: proc.classeCodigo || prev.classe_cnj || '',
          assunto_cnj: proc.assuntos?.[0]?.codigo || prev.assunto_cnj || '',
          vara_comarca: proc.orgaoJulgador || prev.vara_comarca || '',
          segredo_justica: proc.nivelSigilo === 'Segredo de Justiça',
          sistema_judicial: proc.sistemaProcessual || prev.sistema_judicial || '',
          tipo_orgao_julgador: proc.orgaoJulgador || prev.tipo_orgao_julgador || '',
          data_distribuicao: proc.dataAjuizamento || prev.data_distribuicao || '',
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

      // Usar force_refresh e persistir para salvar automaticamente
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000); // 45s timeout

      const { data, error } = await supabase.functions.invoke('consulta-processos', {
        body: {
          numeroProcesso: numero,
          tribunal: tribunal ? tribunal : undefined,
          force_refresh: true,
          persistir: !!processo?.id,
        },
      }).finally(() => clearTimeout(timeout));

      if (error) throw error;

      if (data?.encontrado && data?.processo) {
        const proc = data.processo;
        console.log('📋 [Refresh] Dados retornados da API:', JSON.stringify({
          classe: proc.classe,
          classeCodigo: proc.classeCodigo,
          tribunal: proc.tribunal,
          orgaoJulgador: proc.orgaoJulgador,
          grau: proc.grau,
          assuntos: proc.assuntos,
          valorCausa: proc.valorCausa,
          dataAjuizamento: proc.dataAjuizamento,
          nivelSigilo: proc.nivelSigilo,
          sistemaProcessual: proc.sistemaProcessual,
          statusDetalhado: proc.statusDetalhado,
          status: proc.status,
          partesCount: proc.partes?.length,
          movimentosCount: proc.movimentos?.length,
        }));

        // Extrair partes e movimentos
        const newPartes = proc.partes || [];
        const newMovimentos = (proc.movimentos || []).slice(0, 50);

        // Atualizar states locais
        setPartes(newPartes);
        setMovimentos(newMovimentos);

        // Helper para normalizar datas para formato YYYY-MM-DD (input type="date")
        const toDateInput = (val: string | null | undefined): string => {
          if (!val) return '';
          // Already YYYY-MM-DD
          if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
          // ISO format: 2024-01-15T00:00:00Z → 2024-01-15
          if (/^\d{4}-\d{2}-\d{2}T/.test(val)) return val.slice(0, 10);
          // pt-BR: DD/MM/YYYY → YYYY-MM-DD
          const ptBr = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (ptBr) return `${ptBr[3]}-${ptBr[2]}-${ptBr[1]}`;
          // Try Date parse as fallback
          try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
          } catch { /* ignore */ }
          return '';
        };

        const dataDistribuicao = toDateInput(proc.dataAjuizamento);

        // Preparar dados para atualização — preencher todos os campos da aba Dados
        const updateData: Record<string, unknown> = {
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
          fonte_preferida: proc.fonte || 'datajud',
          ultima_consulta_api_at: new Date().toISOString(),
          data_ultima_atualizacao: new Date().toISOString(),
          // Campos adicionais da aba Dados
          classe_cnj: proc.classe || formData.classe_cnj || null,
          assunto_cnj: proc.assuntos?.[0]?.codigo?.toString() || proc.assuntos?.[0]?.nome || formData.assunto_cnj || null,
          vara_comarca: proc.orgaoJulgador || formData.vara_comarca || null,
          status_detalhado: proc.statusDetalhado || null,
          segredo_justica: proc.nivelSigilo === 'Segredo de Justiça',
          sistema_judicial: proc.sistemaProcessual || formData.sistema_judicial || null,
          tipo_orgao_julgador: proc.orgaoJulgador || formData.tipo_orgao_julgador || null,
          data_distribuicao: dataDistribuicao || formData.data_distribuicao || null,
          data_ajuizamento: dataDistribuicao || null,
        };

        console.log('📋 [Refresh] updateData preparado:', JSON.stringify(updateData));

        // Atualizar form local com todos os campos retornados
        setFormData(prev => ({
          ...prev,
          titulo_acao: (updateData.titulo_acao as string) || prev.titulo_acao,
          status: updateData.status as ProcessoStatus,
          tribunal: (updateData.tribunal as string) || prev.tribunal,
          orgao_julgador: (updateData.orgao_julgador as string) || prev.orgao_julgador,
          grau: (updateData.grau as string) || prev.grau,
          assunto: (updateData.assunto as string) || prev.assunto,
          valor_causa: proc.valorCausa?.toString() || prev.valor_causa,
          classe_cnj: (updateData.classe_cnj as string) || prev.classe_cnj,
          assunto_cnj: (updateData.assunto_cnj as string) || prev.assunto_cnj,
          vara_comarca: (updateData.vara_comarca as string) || prev.vara_comarca,
          segredo_justica: updateData.segredo_justica as boolean,
          sistema_judicial: (updateData.sistema_judicial as string) || prev.sistema_judicial,
          tipo_orgao_julgador: (updateData.tipo_orgao_julgador as string) || prev.tipo_orgao_julgador,
          data_distribuicao: dataDistribuicao || prev.data_distribuicao,
        }));

        // Se é um processo existente, salvar no banco imediatamente
        if (processo?.id) {
          // Auto-fix CPF from partes if current is invalid
          const currentCpfDigits = (formData.cpf_cliente || '').replace(/\D/g, '');
          if (currentCpfDigits.length < 11 && newPartes.length > 0) {
            const parteAutor = newPartes.find((p: any) =>
              p.tipo === 'Autor' || p.polo?.toUpperCase() === 'AT'
            );
            if (parteAutor?.documento && parteAutor.documento.replace(/\D/g, '').length >= 11) {
              const fixedCpf = parteAutor.documento.replace(/\D/g, '');
              (updateData as Record<string, unknown>).cpf_cliente = fixedCpf;
              setFormData(prev => ({ ...prev, cpf_cliente: fixedCpf }));
            }
          }

          // Auto-fix nome_cliente from partes if missing
          if (!processo.nome_cliente && newPartes.length > 0) {
            const parteAutor = newPartes.find((p: any) =>
              p.tipo === 'Autor' || p.polo?.toUpperCase() === 'AT'
            );
            if (parteAutor?.nome) {
              (updateData as Record<string, unknown>).nome_cliente = parteAutor.nome.toUpperCase();
            }
          }

          // Vincular cliente automaticamente se encontrado
          if (!formData.cliente_id && newPartes.length > 0) {
            const parteAutor = newPartes.find((p: { tipo?: string; polo?: string }) =>
              p.tipo === 'Autor' || p.polo?.toUpperCase() === 'AT'
            );
            if (parteAutor?.nome) {
              const nomeAutor = parteAutor.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              const leadMatch = leads.find(l => {
                const nomeLead = (l.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return nomeLead.includes(nomeAutor) || nomeAutor.includes(nomeLead);
              });
              if (leadMatch) {
                (updateData as Record<string, unknown>).cliente_id = leadMatch.id;
                setFormData(prev => ({ ...prev, cliente_id: leadMatch.id }));
              }
            }
          }

          const { error: updateError } = await supabase
            .from('processos')
            .update(updateData)
            .eq('id', processo.id);

          if (updateError) {
            console.error('Erro ao salvar no banco:', updateError);
            toast.error('Erro ao salvar movimentações');
          } else {
            fetchProcessos(); // Atualizar lista em background (sem await)
            toast.success('Processo atualizado!', {
              description: `${newMovimentos.length} movimentações e ${newPartes.length} partes carregadas`
            });
          }
        } else {
          toast.success('Dados carregados!', {
            description: `${newMovimentos.length} movimentações e ${newPartes.length} partes encontradas`
          });
        }
      } else {
        toast.error('Processo não encontrado', {
          description: data?.mensagem || 'Não encontramos este processo com os parâmetros informados.'
        });
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      toast.error('Erro ao consultar APIs');
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

  const processoId = processo?.id ?? null;
  const [lastLoadedId, setLastLoadedId] = useState<string | null>(null);
  const [wasNew, setWasNew] = useState(isNew);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const draftStorageKey = useMemo(() => {
    const entityKey = isNew ? '__new__' : processoId;
    return entityKey ? `${PROCESSO_DRAFT_STORAGE_PREFIX}:${entityKey}` : null;
  }, [isNew, processoId]);

  const readDraft = useCallback((): ProcessoModalDraft | null => {
    if (!draftStorageKey || typeof window === 'undefined') return null;

    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as ProcessoModalDraft;
      if (!parsed?.formData) return null;

      const updatedAt = new Date(parsed.updatedAt || 0).getTime();
      if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > PROCESSO_DRAFT_MAX_AGE_MS) {
        window.localStorage.removeItem(draftStorageKey);
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }, [draftStorageKey]);

  const clearDraft = useCallback(() => {
    if (!draftStorageKey || typeof window === 'undefined') return;
    window.localStorage.removeItem(draftStorageKey);
  }, [draftStorageKey]);

  useEffect(() => {
    if (!isOpen || !draftStorageKey || !draftHydrated || typeof window === 'undefined') return;

    // Only save formData to draft, NOT partes - DB is source of truth for partes
    const payload: ProcessoModalDraft = {
      formData,
      partes: isNew ? partes : [], // Only save partes in draft for new processos
      movimentos: isNew ? movimentos : [], // Same for movimentos
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
  }, [formData, partes, movimentos, draftStorageKey, draftHydrated, isOpen, isNew]);

  useEffect(() => {
    const currentKey = isNew ? '__new__' : processoId;
    const previousKey = wasNew ? '__new__' : lastLoadedId;

    if (currentKey === previousKey) return;

    setDraftHydrated(false);

    if (processo) {
      const p = processo as any;
      setFormData({
        numero_processo: processo.numero_processo || '',
        numero_complementar: p.numero_complementar || '',
        titulo_acao: processo.titulo_acao || '',
        status: (processo.status as ProcessoStatus) || 'Em Andamento',
        advogado_responsavel: processo.advogado_responsavel || '',
        cliente_id: processo.cliente_id || '',
        cpf_cliente: processo.cpf_cliente || '',
        tribunal: processo.tribunal || '',
        vara_comarca: processo.vara_comarca || '',
        assunto: processo.assunto || '',
        valor_causa: processo.valor_causa ? processo.valor_causa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
        orgao_julgador: processo.orgao_julgador || '',
        grau: processo.grau || '',
        origem_cliente: p.origem_cliente || '',
        descricao: p.descricao || '',
        marcadores: p.marcadores || '',
        area: p.area || '',
        fase: p.fase || '',
        classe_cnj: processo.classe_cnj || '',
        assunto_cnj: p.assunto_cnj || '',
        segredo_justica: p.segredo_justica || false,
        data_distribuicao: p.data_distribuicao || '',
        data_citacao: p.data_citacao || '',
        data_recebimento: p.data_recebimento || '',
        data_arquivamento: p.data_arquivamento || '',
        data_encerramento: p.data_encerramento || '',
        valor_provisionado: p.valor_provisionado ? String(p.valor_provisionado) : '',
        probabilidade: p.probabilidade || '',
        monitorar_push: p.monitorar_push ?? true,
        tipo_orgao_julgador: p.tipo_orgao_julgador || '',
        sistema_judicial: p.sistema_judicial || '',
        complemento_enderecamento: p.complemento_enderecamento || '',
      });
      setPartes(processo.partes_json || []);
      setMovimentos(processo.movimentos_json || []);
    } else {
      setFormData(createEmptyFormData());
      setPartes([]);
      setMovimentos([]);
    }

    const draft = readDraft();
    const draftHasMeaningfulContent = !!draft && (
      (Array.isArray(draft.partes) && draft.partes.length > 0) ||
      (Array.isArray(draft.movimentos) && draft.movimentos.length > 0) ||
      [
        draft.formData.numero_processo,
        draft.formData.titulo_acao,
        draft.formData.advogado_responsavel,
        draft.formData.cliente_id,
        draft.formData.tribunal,
        draft.formData.vara_comarca,
        draft.formData.assunto,
        draft.formData.valor_causa,
        draft.formData.orgao_julgador,
        draft.formData.grau,
        draft.formData.origem_cliente,
      ].some((value) => typeof value === 'string' && value.trim().length > 0)
    );

    if (draft && draftHasMeaningfulContent) {
      setFormData((prev) => {
        const merged = {
          ...prev,
          ...draft.formData,
          status: (draft.formData.status as ProcessoStatus) || prev.status,
        };
        // For existing processes, never let draft override critical DB fields with empty values
        if (!isNew && processo) {
          if (!merged.numero_processo && prev.numero_processo) merged.numero_processo = prev.numero_processo;
          if (!merged.titulo_acao && prev.titulo_acao) merged.titulo_acao = prev.titulo_acao;
          if (!merged.cliente_id && prev.cliente_id) merged.cliente_id = prev.cliente_id;
          if (!merged.cpf_cliente && prev.cpf_cliente) merged.cpf_cliente = prev.cpf_cliente;
        }
        return merged;
      });
      // For existing processos, NEVER restore partes/movimentos from draft - DB is source of truth
      if (isNew) {
        setPartes(Array.isArray(draft.partes) ? draft.partes : []);
        setMovimentos(Array.isArray(draft.movimentos) ? draft.movimentos : []);
      }
    } else if (draft && !draftHasMeaningfulContent) {
      clearDraft();
    }

    setLastLoadedId(processoId);
    setWasNew(isNew);
    setDraftHydrated(true);
  }, [processo, processoId, isNew, lastLoadedId, wasNew, readDraft, clearDraft]);

  // Fetch partes from processo_partes table when opening an existing processo
  // This ALWAYS overrides draft data for partes - DB is the source of truth
  const [autoFetchDone, setAutoFetchDone] = useState(false);
  const [partesLoadedFromDb, setPartesLoadedFromDb] = useState(false);
  useEffect(() => {
    setAutoFetchDone(false);
    setPartesLoadedFromDb(false);
  }, [processoId]);

  useEffect(() => {
    if (!isNew && isOpen && processo?.id && !autoFetchDone) {
      setAutoFetchDone(true);
      // Always fetch partes from the dedicated table - DB is source of truth
      (async () => {
        try {
          const { data: dbPartes, error } = await supabase
            .from('processo_partes')
            .select('*')
            .eq('processo_id', processo.id);
          
          if (error) {
            console.error('Erro ao carregar partes do banco:', error);
            toast.error('Erro ao carregar partes', { description: error.message });
            // Still fall back to partes_json
            if (processo.partes_json && processo.partes_json.length > 0) {
              setPartes(processo.partes_json);
            }
          } else if (dbPartes && dbPartes.length > 0) {
            const mapped: ProcessoParte[] = dbPartes.map((p: any) => ({
              nome: p.nome,
              tipo: p.tipo,
              polo: p.polo || '',
              tipoPessoa: p.tipo_pessoa || '',
              documento: p.documento || '',
              celular: p.celular || '',
              telefone_adicional: p.telefone_adicional || '',
              advogados: Array.isArray(p.advogados) ? p.advogados : [],
            }));
            setPartes(mapped);
            setPartesLoadedFromDb(true);
          } else if (processo.partes_json && processo.partes_json.length > 0) {
            // Fallback to partes_json if no dedicated table data
            setPartes(processo.partes_json);
            // Auto-migrate: save partes_json to processo_partes table
            const partesRows = processo.partes_json.map(p => ({
              processo_id: processo.id,
              nome: p.nome,
              tipo: p.tipo,
              polo: p.polo || null,
              tipo_pessoa: p.tipoPessoa || null,
              documento: p.documento || null,
              celular: p.celular || null,
              telefone_adicional: p.telefone_adicional || null,
              advogados: p.advogados || null,
            }));
            const { error: migrateError } = await supabase.from('processo_partes').insert(partesRows);
            if (migrateError) {
              console.warn('Auto-migração de partes falhou:', migrateError);
            } else {
              console.log('✅ Auto-migradas', partesRows.length, 'partes de partes_json para processo_partes');
              setPartesLoadedFromDb(true);
            }
          }
        } catch (err) {
          console.error('Erro inesperado ao carregar partes:', err);
        }
      })();

      // Auto-fetch from API if key data fields are missing or stale
      const hasValidCnj = processo.numero_processo && CNJ_REGEX.test(processo.numero_processo.trim());
      const isMissingKeyData = (
        !processo.classe_cnj ||
        !processo.orgao_julgador ||
        !processo.assunto_cnj ||
        (!processo.partes_json || processo.partes_json.length === 0) ||
        (!processo.movimentos_json || processo.movimentos_json.length === 0)
      );
      // Check if last API check was more than 3 days ago
      const lastCheck = processo.ultima_consulta_api_at ? new Date(processo.ultima_consulta_api_at).getTime() : 0;
      const isStale = Date.now() - lastCheck > 3 * 24 * 60 * 60 * 1000;
      
      if (hasValidCnj && (isMissingKeyData || isStale) && !fetchingData) {
        console.log('🔄 Auto-fetching from API for processo:', processo.numero_processo, { isMissingKeyData, isStale });
        handleRefreshStatus();
      }

      // Auto-fix CPF from partes data if current value is invalid (less than 11 digits)
      const cpfDigits = (processo.cpf_cliente || '').replace(/\D/g, '');
      if (cpfDigits.length < 11 && processo.partes_json && processo.partes_json.length > 0) {
        const parteAtiva = processo.partes_json.find(p => 
          p.tipo === 'Autor' || p.polo?.toUpperCase() === 'AT'
        );
        if (parteAtiva?.documento && parteAtiva.documento.replace(/\D/g, '').length >= 11) {
          const cpfFromParte = parteAtiva.documento.replace(/\D/g, '');
          setFormData(prev => ({ ...prev, cpf_cliente: cpfFromParte }));
          // Also fix in DB
          supabase.from('processos').update({ cpf_cliente: cpfFromParte }).eq('id', processo.id)
            .then(({ error }) => {
              if (!error) console.log('✅ CPF auto-corrigido de partes:', cpfFromParte);
            });
        }
      }
    }
  }, [processo?.id, isOpen, draftHydrated, autoFetchDone, isNew]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Resolve nome_cliente from selected lead or existing partes
      const resolvedClienteId = formData.cliente_id === '__none__' ? null : formData.cliente_id || null;
      let nomeCliente: string | null = null;
      if (resolvedClienteId) {
        const selectedLead = leads.find(l => l.id === resolvedClienteId);
        if (selectedLead?.nome) nomeCliente = selectedLead.nome;
      }
      if (!nomeCliente && partes.length > 0) {
        const parteAtiva = partes.find(p =>
          p.tipo === 'Autor' || p.polo?.toUpperCase() === 'AT' || p.polo?.toLowerCase() === 'ativo'
        );
        if (parteAtiva?.nome) nomeCliente = parteAtiva.nome;
      }

      const data = {
        numero_processo: formData.numero_processo || null,
        numero_complementar: formData.numero_complementar || null,
        titulo_acao: formData.titulo_acao || null,
        status: formData.status,
        advogado_responsavel: formData.advogado_responsavel || null,
        cliente_id: resolvedClienteId,
        nome_cliente: nomeCliente,
        cpf_cliente: formData.cpf_cliente ? formData.cpf_cliente.replace(/\D/g, '') : null,
        tribunal: formData.tribunal || null,
        vara_comarca: formData.vara_comarca || null,
        assunto: formData.assunto || null,
        valor_causa: formData.valor_causa ? parseFloat(formData.valor_causa.replace(/\./g, '').replace(',', '.')) : null,
        orgao_julgador: formData.orgao_julgador || null,
        grau: formData.grau || null,
        origem_cliente: formData.origem_cliente || null,
        descricao: formData.descricao || null,
        marcadores: formData.marcadores || null,
        area: formData.area || null,
        fase: formData.fase || null,
        classe_cnj: formData.classe_cnj || null,
        assunto_cnj: formData.assunto_cnj || null,
        segredo_justica: formData.segredo_justica,
        data_distribuicao: formData.data_distribuicao || null,
        data_ajuizamento: formData.data_distribuicao || null,
        data_citacao: formData.data_citacao || null,
        data_recebimento: formData.data_recebimento || null,
        data_arquivamento: formData.data_arquivamento || null,
        data_encerramento: formData.data_encerramento || null,
        valor_provisionado: formData.valor_provisionado ? parseFloat(formData.valor_provisionado.replace(/\./g, '').replace(',', '.')) : null,
        probabilidade: formData.probabilidade || null,
        monitorar_push: formData.monitorar_push,
        tipo_orgao_julgador: formData.tipo_orgao_julgador || null,
        sistema_judicial: formData.sistema_judicial || null,
        complemento_enderecamento: formData.complemento_enderecamento || null,
        partes_json: partes.length > 0 ? partes : null,
        movimentos_json: movimentos.length > 0 ? movimentos : null,
        ultima_consulta_api_at: partes.length > 0 || movimentos.length > 0 ? new Date().toISOString() : null,
      };

      let savedProcessoId: string | null = null;

      if (isNew) {
        const result = await createProcesso(data);
        if (result?.error) {
          toast.error('Erro ao criar processo', { description: 'Tente novamente.' });
          return;
        }
        savedProcessoId = (result?.data as any)?.id || null;
      } else if (processo) {
        const result = await updateProcesso(processo.id, data);
        if (result?.error) {
          toast.error('Erro ao atualizar processo', { description: 'Tente novamente.' });
          return;
        }
        savedProcessoId = processo.id;
      }

      // Sync partes to processo_partes table with proper error handling
      if (savedProcessoId) {
        try {
          // Delete existing partes for this processo
          const { error: deleteError } = await supabase
            .from('processo_partes')
            .delete()
            .eq('processo_id', savedProcessoId);
          
          if (deleteError) {
            console.error('Erro ao limpar partes antigas:', deleteError);
            // Don't block - still try to insert
          }

          // Insert all current partes (even if 0 - the delete above cleans stale data)
          if (partes.length > 0) {
            const partesRows = partes.map(p => ({
              processo_id: savedProcessoId!,
              nome: p.nome,
              tipo: p.tipo,
              polo: p.polo || null,
              tipo_pessoa: p.tipoPessoa || null,
              documento: p.documento || null,
              celular: p.celular || null,
              telefone_adicional: p.telefone_adicional || null,
              advogados: p.advogados || null,
            }));
            const { error: insertError } = await supabase
              .from('processo_partes')
              .insert(partesRows);
            
            if (insertError) {
              console.error('Erro ao salvar partes:', insertError);
              toast.error('Aviso: partes podem não ter sido salvas corretamente', { 
                description: 'Os dados do processo foram salvos, mas houve um erro ao sincronizar as partes. Tente salvar novamente.' 
              });
            }
          }
        } catch (err) {
          console.error('Erro inesperado ao sincronizar partes:', err);
          toast.error('Erro ao sincronizar partes');
        }
      }

      clearDraft();
      onClose();
    } catch (err) {
      console.error('Erro inesperado ao salvar:', err);
      toast.error('Erro inesperado ao salvar o processo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!processo) return;

    const result = await deleteProcesso(processo.id);
    if (!result?.error) {
      clearDraft();
      onClose();
    }
  };

  const clienteOptions = leads;
  const clienteSelecionado = leads.find(l => l.id === formData.cliente_id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl rounded-2xl max-h-[92vh] overflow-hidden flex flex-col min-h-0 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{isNew ? 'Novo Processo' : 'Detalhes do Processo'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col h-full px-6 pt-6 pb-4 min-h-0">
        {/* Premium Header */}
        <div className="flex-shrink-0 -mx-6 -mt-2 px-6 py-4 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {isNew ? 'Novo Processo' : 'Detalhes do Processo'}
                </h2>
                {formData.numero_processo && (
                  <p className="text-xs text-muted-foreground font-mono">{formData.numero_processo}</p>
                )}
                {!isNew && processo?.ultima_consulta_api_at && (
                  <p className="text-[10px] text-muted-foreground/60">
                    Última sync: {new Date(processo.ultima_consulta_api_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {fetchingData && ' · Atualizando...'}
                  </p>
                )}
                {fetchingData && !processo?.ultima_consulta_api_at && (
                  <p className="text-[10px] text-primary animate-pulse">Buscando dados do Escavador...</p>
                )}
              </div>
            </div>
            {!isNew && formData.status && (
              <Badge className={`rounded-lg px-3 py-1 text-xs font-medium ${
                formData.status === 'Em Andamento' ? 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400' :
                formData.status === 'Ganho' ? 'bg-success/15 text-success border-success/30' :
                formData.status === 'Perdido' ? 'bg-destructive/15 text-destructive border-destructive/30' :
                formData.status === 'Suspenso' ? 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400' :
                'bg-muted text-muted-foreground border-border'
              }`} variant="outline">
                {formData.status}
              </Badge>
            )}
          </div>
        </div>

        <Tabs defaultValue="dados" className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 w-full flex-shrink-0 bg-muted/50 rounded-xl p-1">
            <TabsTrigger value="dados" className="rounded-lg text-xs data-[state=active]:shadow-sm">
              <Scale className="h-3.5 w-3.5 mr-1.5" />Dados
            </TabsTrigger>
            <TabsTrigger value="partes" className="rounded-lg text-xs data-[state=active]:shadow-sm">
              <Users className="h-3.5 w-3.5 mr-1.5" />Partes
            </TabsTrigger>
            <TabsTrigger value="movimentos" className="rounded-lg text-xs data-[state=active]:shadow-sm">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />Movimentos
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="rounded-lg text-xs data-[state=active]:shadow-sm">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />Notificações
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-auto">
            {/* Tab: Dados (estilo Projuris) */}
            <TabsContent value="dados" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
              <ScrollArea className="h-full pr-4">
                <div className="space-y-5 py-4">
                  
                  {/* Numeração */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                        <Hash className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Numeração</h3>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 space-y-4 border border-border/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Numeração padrão CNJ</Label>
                          <div className="relative">
                            <Input
                              value={formData.numero_processo}
                              onChange={(e) => setFormData({ ...formData, numero_processo: e.target.value })}
                              className="rounded-xl pr-10 bg-card font-mono text-sm"
                              placeholder="0000000-00.0000.0.00.0000"
                            />
                            {fetchingData && (
                              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                            )}
                          </div>
                          {isNew && (
                            <p className="text-[11px] text-muted-foreground">
                              Digite o número completo para carregar dados automaticamente
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Numeração complementar</Label>
                          <Input
                            value={formData.numero_complementar}
                            onChange={(e) => setFormData({ ...formData, numero_complementar: e.target.value })}
                            className="rounded-xl bg-card text-sm"
                            placeholder="Numeração complementar"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detalhes do Processo */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Detalhes do Processo</h3>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 space-y-4 border border-border/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Situação</Label>
                          <Select
                            value={formData.status}
                            onValueChange={(value) => setFormData({ ...formData, status: value as ProcessoStatus })}
                          >
                            <SelectTrigger className="rounded-xl bg-card">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Assunto</Label>
                          <Input
                            value={formData.assunto}
                            onChange={(e) => setFormData({ ...formData, assunto: e.target.value })}
                            className="rounded-xl bg-card"
                            placeholder="Ex: Danos Morais"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Descrição</Label>
                        <Textarea
                          value={formData.descricao}
                          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                          className="rounded-xl bg-card min-h-[80px] text-sm"
                          placeholder="Anotações e descrição do processo..."
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Marcadores</Label>
                          <Input
                            value={formData.marcadores}
                            onChange={(e) => setFormData({ ...formData, marcadores: e.target.value })}
                            className="rounded-xl bg-card"
                            placeholder="Separados por vírgula"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Pasta do Cliente</Label>
                          <Select
                            value={formData.cliente_id || '__none__'}
                            onValueChange={(value) =>
                              setFormData({ ...formData, cliente_id: value === '__none__' ? '' : value })
                            }
                          >
                            <SelectTrigger className="rounded-xl bg-card">
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
                          {processo?.nome_cliente && clienteSelecionado && clienteSelecionado.nome !== processo.nome_cliente && (
                            <p className="text-[10px] text-muted-foreground">
                              Nome no processo: <span className="font-medium text-foreground">{processo.nome_cliente}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Responsável & Organização */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-accent/20 flex items-center justify-center">
                        <Users className="h-3.5 w-3.5 text-accent-foreground" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Responsável & Organização</h3>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 space-y-4 border border-border/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Responsável</Label>
                          <Input
                            value={formData.advogado_responsavel}
                            onChange={(e) => setFormData({ ...formData, advogado_responsavel: e.target.value })}
                            className="rounded-xl bg-card"
                            placeholder="Nome do advogado responsável"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Origem do Cliente</Label>
                          <Select
                            value={formData.origem_cliente || '__none__'}
                            onValueChange={(value) =>
                              setFormData({ ...formData, origem_cliente: value === '__none__' ? '' : value })
                            }
                          >
                            <SelectTrigger className="rounded-xl bg-card">
                              <SelectValue placeholder="Selecione a origem" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Não informado</SelectItem>
                              <SelectItem value="Marketing">Marketing</SelectItem>
                              <SelectItem value="Bentes e Ramos">Bentes e Ramos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">CPF do Cliente</Label>
                          <Input
                            value={formData.cpf_cliente}
                            onChange={(e) => {
                              let val = e.target.value.replace(/\D/g, '');
                              if (val.length > 11) val = val.slice(0, 11);
                              if (val.length > 9) val = val.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
                              else if (val.length > 6) val = val.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
                              else if (val.length > 3) val = val.replace(/(\d{3})(\d{1,3})/, '$1.$2');
                              setFormData({ ...formData, cpf_cliente: val });
                            }}
                            className="rounded-xl bg-card"
                            placeholder="000.000.000-00"
                            maxLength={14}
                          />
                          <p className="text-[11px] text-muted-foreground">Usado pela Isa para localizar processos</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Endereçamento */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                        <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Endereçamento</h3>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 space-y-4 border border-border/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Justiça</Label>
                          <Input
                            value={formData.tribunal}
                            onChange={(e) => setFormData({ ...formData, tribunal: e.target.value })}
                            className="rounded-xl bg-card"
                            placeholder="Ex: Justiça dos Estados e do DF"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Instância</Label>
                          <Select
                            value={formData.grau || 'G1'}
                            onValueChange={(value) => setFormData({ ...formData, grau: value })}
                          >
                            <SelectTrigger className="rounded-xl bg-card">
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
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Órgão</Label>
                          <Input
                            value={formData.vara_comarca}
                            onChange={(e) => setFormData({ ...formData, vara_comarca: e.target.value })}
                            className="rounded-xl bg-card"
                            placeholder="Vara / Comarca"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Órgão Julgador</Label>
                          <Input
                            value={formData.orgao_julgador}
                            onChange={(e) => setFormData({ ...formData, orgao_julgador: e.target.value })}
                            className="rounded-xl bg-card"
                            placeholder="Ex: Juízo da 2ª Vara"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Tipo de Órgão Julgador</Label>
                          <Input
                            value={formData.tipo_orgao_julgador}
                            onChange={(e) => setFormData({ ...formData, tipo_orgao_julgador: e.target.value })}
                            className="rounded-xl bg-card"
                            placeholder="Selecione"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Complemento</Label>
                          <Input
                            value={formData.complemento_enderecamento}
                            onChange={(e) => setFormData({ ...formData, complemento_enderecamento: e.target.value })}
                            className="rounded-xl bg-card"
                            placeholder="Complemento"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Sistema</Label>
                          <Input
                            value={formData.sistema_judicial}
                            onChange={(e) => setFormData({ ...formData, sistema_judicial: e.target.value })}
                            className="rounded-xl bg-card"
                            placeholder="Ex: PJe, e-SAJ"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Distribuição</Label>
                          <Input
                            type="date"
                            value={formData.data_distribuicao}
                            onChange={(e) => setFormData({ ...formData, data_distribuicao: e.target.value })}
                            className="rounded-xl bg-card text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Citação</Label>
                          <Input
                            type="date"
                            value={formData.data_citacao}
                            onChange={(e) => setFormData({ ...formData, data_citacao: e.target.value })}
                            className="rounded-xl bg-card text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Recebimento</Label>
                          <Input
                            type="date"
                            value={formData.data_recebimento}
                            onChange={(e) => setFormData({ ...formData, data_recebimento: e.target.value })}
                            className="rounded-xl bg-card text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Arquivamento</Label>
                          <Input
                            type="date"
                            value={formData.data_arquivamento}
                            onChange={(e) => setFormData({ ...formData, data_arquivamento: e.target.value })}
                            className="rounded-xl bg-card text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Encerramento</Label>
                          <Input
                            type="date"
                            value={formData.data_encerramento}
                            onChange={(e) => setFormData({ ...formData, data_encerramento: e.target.value })}
                            className="rounded-xl bg-card text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.monitorar_push}
                            onChange={(e) => setFormData({ ...formData, monitorar_push: e.target.checked })}
                            className="rounded border-border"
                          />
                          <span className="text-xs text-foreground flex items-center gap-1.5">
                            <Bell className="h-3.5 w-3.5 text-primary" />
                            Monitorar processo (Push)
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Autos */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                        <FolderOpen className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Autos</h3>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 space-y-4 border border-border/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Área</Label>
                          <Select
                            value={formData.area || '__none__'}
                            onValueChange={(value) => setFormData({ ...formData, area: value === '__none__' ? '' : value })}
                          >
                            <SelectTrigger className="rounded-xl bg-card">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Selecione</SelectItem>
                              <SelectItem value="Cível">Cível</SelectItem>
                              <SelectItem value="Trabalhista">Trabalhista</SelectItem>
                              <SelectItem value="Criminal">Criminal</SelectItem>
                              <SelectItem value="Tributário">Tributário</SelectItem>
                              <SelectItem value="Previdenciário">Previdenciário</SelectItem>
                              <SelectItem value="Administrativo">Administrativo</SelectItem>
                              <SelectItem value="Consumidor">Consumidor</SelectItem>
                              <SelectItem value="Família">Família</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Fase</Label>
                          <Select
                            value={formData.fase || '__none__'}
                            onValueChange={(value) => setFormData({ ...formData, fase: value === '__none__' ? '' : value })}
                          >
                            <SelectTrigger className="rounded-xl bg-card">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Selecione</SelectItem>
                              <SelectItem value="Conhecimento">Conhecimento</SelectItem>
                              <SelectItem value="Execução">Execução</SelectItem>
                              <SelectItem value="Recursal">Recursal</SelectItem>
                              <SelectItem value="Cumprimento de Sentença">Cumprimento de Sentença</SelectItem>
                              <SelectItem value="Liquidação">Liquidação</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Classe - CNJ</Label>
                          <Input
                            value={formData.classe_cnj}
                            onChange={(e) => setFormData({ ...formData, classe_cnj: e.target.value })}
                            className="rounded-xl bg-card"
                            placeholder="Ex: Procedimento Comum Cível"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Assunto - CNJ</Label>
                          <Input
                            value={formData.assunto_cnj}
                            onChange={(e) => setFormData({ ...formData, assunto_cnj: e.target.value })}
                            className="rounded-xl bg-card"
                            placeholder="Assunto CNJ"
                          />
                        </div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.segredo_justica}
                              onChange={(e) => setFormData({ ...formData, segredo_justica: e.target.checked })}
                              className="rounded border-border"
                            />
                            <span className="text-xs text-foreground flex items-center gap-1.5">
                              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                              Segredo de justiça
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pedidos */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-success/10 flex items-center justify-center">
                        <DollarSign className="h-3.5 w-3.5 text-success" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Pedidos</h3>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 space-y-4 border border-border/30">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Valor da Ação (R$)</Label>
                          <Input
                            value={formData.valor_causa}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.,]/g, '');
                              setFormData({ ...formData, valor_causa: val });
                            }}
                            className="rounded-xl bg-card"
                            placeholder="0,00"
                            inputMode="decimal"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Valor Provisionado (R$)</Label>
                          <Input
                            value={formData.valor_provisionado}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.,]/g, '');
                              setFormData({ ...formData, valor_provisionado: val });
                            }}
                            className="rounded-xl bg-card"
                            placeholder="0,00"
                            inputMode="decimal"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Probabilidade</Label>
                          <Select
                            value={formData.probabilidade || '__none__'}
                            onValueChange={(value) => setFormData({ ...formData, probabilidade: value === '__none__' ? '' : value })}
                          >
                            <SelectTrigger className="rounded-xl bg-card">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Selecione</SelectItem>
                              <SelectItem value="Provável">Provável</SelectItem>
                              <SelectItem value="Possível">Possível</SelectItem>
                              <SelectItem value="Remota">Remota</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tab: Partes */}
            <TabsContent value="partes" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
              <ScrollArea className="h-[calc(92vh-220px)] pr-2">
                <div className="py-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                        <Users className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Partes do Processo</h3>
                      {partes.length > 0 && (
                        <Badge variant="outline" className="rounded-lg text-xs">{partes.length}</Badge>
                      )}
                    </div>
                  </div>

                  {partes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
                      <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma parte cadastrada</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Adicione partes abaixo ou use "Buscar DataJud"
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {partes.map((parte, i) => {
                        const tipoLower = (parte.tipo || '').toLowerCase();
                        const isAutor = tipoLower.includes('autor');
                        const isReu = tipoLower.includes('réu') || tipoLower.includes('reu');
                        const borderColor = isAutor
                          ? 'border-l-emerald-500'
                          : isReu
                            ? 'border-l-red-500'
                            : 'border-l-muted-foreground/30';
                        const badgeClasses = isAutor
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                          : isReu
                            ? 'bg-destructive/15 text-destructive border-destructive/30'
                            : 'bg-muted text-muted-foreground border-border';

                        return (
                          <div
                            key={i}
                            className={`group relative rounded-xl border border-border/50 bg-card p-3.5 pl-4 border-l-[3px] ${borderColor} transition-all hover:shadow-sm`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm block truncate">{parte.nome}</span>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                                  {parte.documento && (
                                    <span className="text-xs text-muted-foreground">Doc: {parte.documento}</span>
                                  )}
                                  {parte.celular && (
                                    <span className="text-xs text-muted-foreground">📱 {parte.celular}</span>
                                  )}
                                  {parte.telefone_adicional && (
                                    <span className="text-xs text-muted-foreground">📞 {parte.telefone_adicional}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge variant="outline" className={`rounded-lg text-xs ${badgeClasses}`}>
                                  {parte.tipo}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => setPartes(prev => prev.filter((_, idx) => idx !== i))}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            {parte.advogados && parte.advogados.length > 0 && (
                              <div className="mt-2.5 pt-2.5 border-t border-border/30">
                                <p className="text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider font-medium flex items-center gap-1">
                                  <Briefcase className="h-3 w-3" /> Advogado(s)
                                </p>
                                <div className="space-y-1">
                                  {parte.advogados.map((adv, j) => (
                                    <div key={j} className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-medium break-words min-w-0 flex-1">{adv.nome}</p>
                                      {adv.oab && (
                                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
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
                  )}

                  <Separator className="my-2" />

                  {/* Formulário para adicionar parte */}
                  <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.02] p-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2 text-foreground">
                      <Plus className="h-4 w-4 text-primary" /> Adicionar Parte
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Nome *</Label>
                        <Input id="nova_parte_nome" className="rounded-xl h-9 text-sm bg-card" placeholder="Nome da parte" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Tipo/Polo *</Label>
                        <select
                          id="nova_parte_tipo"
                          className="flex h-9 w-full rounded-xl border border-input bg-card px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">Selecione</option>
                          <option value="Autor">Autor</option>
                          <option value="Réu">Réu</option>
                          <option value="Terceiro Interessado">Terceiro Interessado</option>
                          <option value="Testemunha">Testemunha</option>
                          <option value="Perito">Perito</option>
                          <option value="Advogado">Advogado</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Documento (CPF/CNPJ)</Label>
                        <Input id="nova_parte_doc" className="rounded-xl h-9 text-sm bg-card" placeholder="Opcional" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Celular</Label>
                        <Input id="nova_parte_celular" className="rounded-xl h-9 text-sm bg-card" placeholder="(00) 00000-0000" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Telefone Adicional</Label>
                        <Input id="nova_parte_telefone" className="rounded-xl h-9 text-sm bg-card" placeholder="(00) 0000-0000" />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          className="rounded-xl w-full h-9"
                          onClick={() => {
                            const nomeInput = document.getElementById('nova_parte_nome') as HTMLInputElement;
                            const tipoSelect = document.getElementById('nova_parte_tipo') as HTMLSelectElement;
                            const docInput = document.getElementById('nova_parte_doc') as HTMLInputElement;
                            const celularInput = document.getElementById('nova_parte_celular') as HTMLInputElement;
                            const telefoneInput = document.getElementById('nova_parte_telefone') as HTMLInputElement;
                            
                            const nome = nomeInput?.value?.trim();
                            const tipo = tipoSelect?.value;
                            const documento = docInput?.value?.trim();
                            const celular = celularInput?.value?.trim();
                            const telefone_adicional = telefoneInput?.value?.trim();

                            if (!nome || !tipo) {
                              toast.error('Preencha o nome e o tipo da parte');
                              return;
                            }

                            const novaParte: ProcessoParte = {
                              nome,
                              tipo,
                              polo: tipo === 'Autor' ? 'AT' : tipo === 'Réu' ? 'PA' : 'TC',
                              tipoPessoa: 'FISICA',
                              documento: documento || undefined,
                              celular: celular || undefined,
                              telefone_adicional: telefone_adicional || undefined,
                            };

                            setPartes(prev => [...prev, novaParte]);
                            nomeInput.value = '';
                            tipoSelect.value = '';
                            if (docInput) docInput.value = '';
                            if (celularInput) celularInput.value = '';
                            if (telefoneInput) telefoneInput.value = '';
                            toast.success(`Parte "${nome}" adicionada. Clique em "Salvar" para persistir.`);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1.5" />
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tab: Movimentos */}
            <TabsContent value="movimentos" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
              <ScrollArea className="h-[calc(92vh-220px)] pr-4">
                <div className="py-4 space-y-2">
                  {movimentosEnriquecidos.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-muted-foreground">Nenhuma movimentação</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Use o botão "Atualizar DataJud" para carregar movimentações
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">
                        {movimentosEnriquecidos.length} movimentação(ões) • Clique para ver detalhes
                      </p>
                      {movimentosEnriquecidos.map((mov, i) => (
                        <Card 
                          key={i} 
                          className="cursor-pointer hover:bg-accent/50 transition-colors group"
                          onClick={() => {
                            setSelectedMovimento(mov);
                            setMovimentoModalOpen(true);
                          }}
                        >
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium">{mov.titulo_humano}</p>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${getCategoriaColor(mov.categoria)}`}
                                  >
                                    {mov.badge}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {mov.descricao_humana}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{mov.dataHora}</span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tab: Notificações */}
            <TabsContent value="notificacoes" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
              <ScrollArea className="h-[calc(92vh-220px)] pr-4">
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
                        movimentos: movimentos.slice(0, 3),
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

        {/* Premium Footer */}
        <div className="flex-shrink-0 -mx-6 -mb-4 px-6 py-4 bg-muted/30 border-t border-border/50">
          <div className="flex justify-between gap-2">
            <div>
              {!isNew && canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
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
                variant="outline"
                size="sm"
                onClick={handleRefreshStatus}
                disabled={fetchingData || !(formData.numero_processo || '').trim()}
                className="rounded-xl"
              >
                {fetchingData ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                )}
                {isNew ? 'Buscar DataJud' : 'Atualizar'}
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl">
                Cancelar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving}
                size="sm"
                className="rounded-xl shadow-soft px-6"
              >
                {saving ? 'Salvando...' : isNew ? 'Criar Processo' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>

      {/* Modal de detalhes do movimento */}
      <MovimentoDetailModal
        movimento={selectedMovimento}
        isOpen={movimentoModalOpen}
        onClose={() => {
          setMovimentoModalOpen(false);
          setSelectedMovimento(null);
        }}
      />
      </div>
    </DialogContent>
  </Dialog>
  );
}
