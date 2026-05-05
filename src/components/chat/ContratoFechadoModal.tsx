import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMetaCapi } from '@/hooks/useMetaCapi';
import {
  CheckCircle2, Loader2, AlertTriangle, FileCheck,
  User, Hash, Briefcase, MapPin,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ContratoFechadoModalProps {
  open: boolean;
  onClose: () => void;
  leadId: string | null;
  leadNome: string;
}

type AssinaturaModalidade = 'presencial' | 'online';

interface FormData {
  leadId: string;
  leadNome: string;
  quantidadeContratos: string;
  tipoContrato: string;
  modalidadeAssinatura: AssinaturaModalidade;
  observacoes: string;
}

const TIPOS_CONTRATO = [
  'Bancário - Consignado',
  'Bancário - Cartão de Crédito',
  'Bancário - Financiamento',
  'Bancário - Empréstimo Pessoal',
  'Bancário - Cheque Especial',
  'Bancário - Conta Corrente',
  'Aéreo - Cancelamento de Voo',
  'Aéreo - Atraso de Voo',
  'Aéreo - Bagagem Extraviada',
  'Aéreo - Overbooking',
  'Trabalhista',
  'Previdenciário',
  'Consumidor',
  'Cível - Outros',
  'Outro',
];

// ─── Componente ───────────────────────────────────────────────────────────────

export function ContratoFechadoModal({ open, onClose, leadId, leadNome }: ContratoFechadoModalProps) {
  const [formData, setFormData] = useState<FormData>({
    leadId: leadId || '',
    leadNome: leadNome || '',
    quantidadeContratos: '1',
    tipoContrato: '',
    modalidadeAssinatura: 'presencial',
    observacoes: '',
  });

  const [saving, setSaving]           = useState(false);
  const [checking, setChecking]       = useState(false);
  const [duplicataInfo, setDuplicata] = useState<string | null>(null);
  const [leads, setLeads]             = useState<{ id: string; nome: string }[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const { sendMetaEvent } = useMetaCapi();

  // Atualiza form quando o subscriber muda
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      leadId: leadId || '',
      leadNome: leadNome || '',
    }));
    setDuplicata(null);
  }, [leadId, leadNome, open]);

  // Carrega lista de leads para o select (quando não vem do chat)
  useEffect(() => {
    if (!open) return;
    if (leadId) return;
    setLoadingLeads(true);
    supabase
      .from('leads_juridicos')
      .select('id, nome')
      .order('nome')
      .limit(300)
      .then(({ data }) => {
        setLeads((data || []) as { id: string; nome: string }[]);
        setLoadingLeads(false);
      });
  }, [open, leadId]);

  // Verificar duplicidade quando tipo e modalidade mudam
  useEffect(() => {
    if (!formData.leadId || !formData.tipoContrato || !formData.modalidadeAssinatura) {
      setDuplicata(null);
      return;
    }
    verificarDuplicidade();
  }, [formData.leadId, formData.tipoContrato, formData.modalidadeAssinatura]);

  const verificarDuplicidade = async () => {
    if (!formData.leadId || !formData.tipoContrato) return;
    setChecking(true);
    setDuplicata(null);

    try {
      const { data: contratosLocais } = await supabase
        .from('contratos_fechados' as any)
        .select('id, tipo_contrato, modalidade_assinatura, created_at')
        .eq('lead_id', formData.leadId)
        .eq('tipo_contrato', formData.tipoContrato)
        .limit(5);

      if (contratosLocais && contratosLocais.length > 0) {
        const c = contratosLocais[0] as any;
        const dataFormatada = new Date(c.created_at).toLocaleDateString('pt-BR');
        setDuplicata(
          `⚠️ Já existe um contrato do tipo "${formData.tipoContrato}" para este lead, registrado em ${dataFormatada} (${c.modalidade_assinatura}).`
        );
        setChecking(false);
        return;
      }

      // Verificar contratos digitais (clicksign)
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('nome')
        .eq('id', formData.leadId)
        .single();

      if (lead && formData.modalidadeAssinatura === 'online') {
        try {
          const { data: contratosDigitais } = await supabase
            .from('petition_cases' as any)
            .select('id, title, status, created_at')
            .ilike('client_name', `%${(lead as any).nome}%`)
            .limit(5);

          if (contratosDigitais && contratosDigitais.length > 0) {
            const c = contratosDigitais[0] as any;
            setDuplicata(
              `ℹ️ Este lead já possui um contrato digital: "${c.title}" (Status: ${c.status}).`
            );
          }
        } catch {
          // tabela pode não existir, ignora
        }
      }
    } catch (err) {
      console.error('[ContratoFechadoModal] Erro ao verificar duplicidade:', err);
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    if (!formData.leadId) {
      toast.error('Selecione o lead');
      return;
    }
    if (!formData.tipoContrato) {
      toast.error('Selecione o tipo de contrato');
      return;
    }
    if (!formData.quantidadeContratos || parseInt(formData.quantidadeContratos) < 1) {
      toast.error('Quantidade inválida');
      return;
    }

    setSaving(true);
    try {
      const quantidade = parseInt(formData.quantidadeContratos);
      const now = new Date().toISOString();

      // 1. Salvar na tabela contratos_fechados
      const { error: insertError } = await supabase
        .from('contratos_fechados' as any)
        .insert({
          lead_id:              formData.leadId,
          tipo_contrato:        formData.tipoContrato,
          quantidade_contratos: quantidade,
          modalidade_assinatura: formData.modalidadeAssinatura,
          observacoes:          formData.observacoes || null,
          fonte:                'chat',
          meta_conversion_sent: false,
          meta_conversion_data: {
            event_name:    'Purchase',
            lead_id:       formData.leadId,
            lead_nome:     formData.leadNome,
            tipo_contrato: formData.tipoContrato,
            modalidade:    formData.modalidadeAssinatura,
            quantidade,
            timestamp:     now,
          },
        } as any);
      if (insertError) throw insertError;

      // 2. Calcular total de contratos deste lead (fonte da verdade = contratos_fechados)
      const { data: todosContratos } = await supabase
        .from('contratos_fechados' as any)
        .select('quantidade_contratos')
        .eq('lead_id', formData.leadId);
      const totalContratos = (todosContratos || []).reduce(
        (s: number, r: any) => s + (r.quantidade_contratos || 1), 0
      );
      const contratosAdicionais = Math.max(0, totalContratos - 1);

      // 3. Buscar dados do lead (reutilizado no honorário e Meta CAPI)
      const { data: leadData } = await supabase
        .from('leads_juridicos')
        .select('tipo_origem, email, telefone, facebook_lead_id, valor_causa')
        .eq('id', formData.leadId)
        .single();

      // 4. Atualizar status e nome do lead
      await supabase
        .from('leads_juridicos')
        .update({
          status:               'Contrato Assinado',
          lead_state:           'CONTRACT_SIGNED',
          contract_signed_at:   now,
          state_updated_at:     now,
          tipo_conversao:       formData.tipoContrato,
          data_conversao:       now,
          contratos_adicionais: contratosAdicionais,
          ...(formData.leadNome ? { nome: formData.leadNome } : {}),
        } as any)
        .eq('id', formData.leadId);

      // 5. Broadcast para atualização imediata do dashboard
      supabase
        .channel('app-events')
        .send({ type: 'broadcast', event: 'contrato_assinado', payload: { lead_id: formData.leadId } })
        .catch(() => {});

      // 6. Auto-criar honorário rascunho (apenas se não existir ainda e lead tem valor_causa)
      try {
        const valorCausa = (leadData as any)?.valor_causa;
        if (valorCausa > 0) {
          const { data: honorariosExistentes } = await supabase
            .from('honorarios')
            .select('id')
            .eq('cliente_id', formData.leadId)
            .limit(1);
          if (!honorariosExistentes || honorariosExistentes.length === 0) {
            await supabase.from('honorarios').insert({
              cliente_id:        formData.leadId,
              tipo:              'Fixo',
              valor_total:       valorCausa,
              valor_entrada:     null,
              percentual_exito:  null,
              forma_pagamento:   'À Vista',
              num_parcelas:      1,
              data_contrato:     now.split('T')[0],
              status:            'Ativo',
              observacoes:       `Gerado automaticamente — Contrato: ${formData.tipoContrato}`,
            });
          }
        }
      } catch {
        // Não bloquear o fluxo por erro no honorário
      }

      // 7. Log de interação
      await supabase
        .from('interacoes')
        .insert({
          cliente_id:     formData.leadId,
          tipo:           'Contrato',
          resumo:         `Contrato fechado: ${formData.tipoContrato} (${formData.modalidadeAssinatura})`,
          detalhes:       `Quantidade: ${quantidade} | Modalidade: ${formData.modalidadeAssinatura} | ${formData.observacoes || ''}`,
          direcao:        'interno',
          data_interacao: now,
        });

      // 8. Meta CAPI — para todos os leads (não só tráfego)
      try {
        const metaResult = await sendMetaEvent({
          lead_id:          formData.leadId,
          facebook_lead_id: (leadData as any)?.facebook_lead_id ?? null,
          email:            leadData?.email ?? null,
          phone:            leadData?.telefone ?? null,
          nome:             formData.leadNome || null,
          event_name:       'Purchase',
          value:            (leadData as any)?.valor_causa ?? 0,
          status:           'Contrato Assinado',
        });
        if (metaResult.success) {
          await supabase
            .from('contratos_fechados' as any)
            .update({ meta_conversion_sent: true } as any)
            .eq('lead_id', formData.leadId)
            .eq('tipo_contrato', formData.tipoContrato)
            .order('created_at', { ascending: false })
            .limit(1);
        }
      } catch (metaErr) {
        console.warn('[ContratoFechadoModal] Aviso Meta CAPI:', metaErr);
      }

      toast.success('✅ Contrato registrado com sucesso!', {
        description: `${formData.tipoContrato} · ${formData.modalidadeAssinatura}`,
      });
      setFormData(prev => ({
        ...prev,
        quantidadeContratos: '1',
        tipoContrato: '',
        modalidadeAssinatura: 'presencial',
        observacoes: '',
      }));
      setDuplicata(null);
      onClose();
    } catch (err: any) {
      console.error('[ContratoFechadoModal] Erro ao salvar:', err);
      toast.error('Erro ao registrar contrato', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Registrar Contrato Fechado</DialogTitle>
        </DialogHeader>

        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 to-emerald-400" />
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0">
              <FileCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground leading-none">Contrato Fechado</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Registrar conversão no sistema</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Lead */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <User className="h-3 w-3" /> Lead / Cliente
            </Label>
            {leadId ? (
              <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-border/60 bg-muted/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-sm font-semibold text-foreground truncate">{leadNome}</span>
              </div>
            ) : (
              <Select value={formData.leadId} onValueChange={v => update('leadId', v)}>
                <SelectTrigger className="h-10 rounded-xl border-border/60">
                  <SelectValue placeholder={loadingLeads ? 'Carregando...' : 'Selecione o lead'} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {leads.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Tipo de Contrato */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Briefcase className="h-3 w-3" /> Tipo de Contrato
            </Label>
            <Select value={formData.tipoContrato} onValueChange={v => update('tipoContrato', v)}>
              <SelectTrigger className="h-10 rounded-xl border-border/60">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {TIPOS_CONTRATO.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantidade + Modalidade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Hash className="h-3 w-3" /> Qtd. Contratos
              </Label>
              <Input
                type="number"
                min="1"
                max="99"
                value={formData.quantidadeContratos}
                onChange={e => update('quantidadeContratos', e.target.value)}
                className="h-10 rounded-xl border-border/60 text-center font-bold text-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Modalidade
              </Label>
              <Select
                value={formData.modalidadeAssinatura}
                onValueChange={v => update('modalidadeAssinatura', v as AssinaturaModalidade)}
              >
                <SelectTrigger className="h-10 rounded-xl border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">🤝 Presencial</SelectItem>
                  <SelectItem value="online">💻 Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              Observações (opcional)
            </Label>
            <Input
              value={formData.observacoes}
              onChange={e => update('observacoes', e.target.value)}
              placeholder="Ex: Consignado INSS, valor R$ 15.000..."
              className="h-10 rounded-xl border-border/60"
            />
          </div>

          {/* Alerta de duplicidade */}
          {checking && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/40">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">Verificando duplicidade...</p>
            </div>
          )}

          {!checking && duplicataInfo && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{duplicataInfo}</p>
            </div>
          )}

          {/* Info Meta Conversão */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50/60 border border-blue-200/50 dark:bg-blue-950/10 dark:border-blue-800/30">
            <span className="text-sm shrink-0">📊</span>
            <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
              Os dados desta conversão serão enviados à Meta Ads para otimização das campanhas.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <Button variant="outline" className="flex-1 rounded-xl h-10 border-border/60" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !formData.tipoContrato || !formData.leadId}
            className="flex-1 rounded-xl h-10 gap-2 font-bold shadow-sm shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
              : <><CheckCircle2 className="h-4 w-4" /> Registrar Contrato</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
