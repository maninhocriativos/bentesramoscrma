import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useRef } from 'react';
import { useHonorarios } from '@/hooks/useFinanceiro';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Loader2, Search, Scale, X } from 'lucide-react';

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface ProcessoLite { id: string; nome_cliente: string | null; numero_processo: string | null; valor_causa: number | null; }

interface HonorarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId?: string;
  processoId?: string;
  onSuccess?: () => void;
}

type Tipo = 'Fixo' | 'Por Êxito' | 'Misto';
type FormaPag = 'À Vista' | 'Parcelado';

export function HonorarioModal({ open, onOpenChange, clienteId, processoId, onSuccess }: HonorarioModalProps) {
  const { createHonorario } = useHonorarios();
  const [saving, setSaving] = useState(false);

  // ── Vínculo com processo + valor da causa ──────────────────────────────────
  const [procId, setProcId]       = useState(processoId || '');
  const [procLabel, setProcLabel] = useState('');
  const [procValor, setProcValor] = useState<number | null>(null);
  const [procQuery, setProcQuery] = useState('');
  const [procResults, setProcResults] = useState<ProcessoLite[]>([]);
  const [procOpen, setProcOpen]   = useState(false);
  const procTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    tipo: 'Fixo' as Tipo,
    valor_total: '',
    valor_entrada: '',
    percentual_exito: '',
    forma_pagamento: 'À Vista' as FormaPag,
    num_parcelas: '1',
    data_contrato: today,
    observacoes: '',
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  // Busca de processo (por cliente ou nº) com debounce.
  const buscarProc = (q: string) => {
    setProcQuery(q);
    if (procTimer.current) clearTimeout(procTimer.current);
    if (q.trim().length < 2) { setProcResults([]); setProcOpen(false); return; }
    procTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('processos')
        .select('id,nome_cliente,numero_processo,valor_causa')
        .or(`nome_cliente.ilike.%${q}%,numero_processo.ilike.%${q}%`)
        .order('valor_causa', { ascending: false, nullsFirst: false })
        .limit(8);
      setProcResults((data as ProcessoLite[]) || []);
      setProcOpen(true);
    }, 250);
  };

  const pickProc = (p: ProcessoLite) => {
    setProcId(p.id);
    setProcLabel(`${p.nome_cliente || 'Sem nome'}${p.numero_processo ? ' · ' + p.numero_processo : ''}`);
    setProcValor(p.valor_causa ?? null);
    setProcOpen(false);
    setProcQuery('');
    // Puxa o valor da causa automaticamente para o Valor Total (continua editável).
    if (p.valor_causa) setForm(f => ({ ...f, valor_total: String(p.valor_causa) }));
  };

  const limparProc = () => { setProcId(''); setProcLabel(''); setProcValor(null); };

  // Se o modal abrir já vinculado a um processo (via prop), carrega e puxa o valor da causa.
  useEffect(() => {
    if (!open || !processoId) return;
    (async () => {
      const { data } = await supabase.from('processos')
        .select('id,nome_cliente,numero_processo,valor_causa').eq('id', processoId).maybeSingle();
      if (data) pickProc(data as ProcessoLite);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, processoId]);

  const showExito = form.tipo === 'Por Êxito' || form.tipo === 'Misto';
  const showParcelas = form.forma_pagamento === 'Parcelado';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.valor_total) return;
    setSaving(true);
    await createHonorario({
      tipo: form.tipo,
      valor_total: Number(form.valor_total),
      valor_entrada: form.valor_entrada ? Number(form.valor_entrada) : null,
      percentual_exito: form.percentual_exito ? Number(form.percentual_exito) : null,
      forma_pagamento: form.forma_pagamento,
      num_parcelas: showParcelas ? Number(form.num_parcelas) || 1 : 1,
      data_contrato: form.data_contrato || today,
      status: 'Ativo',
      observacoes: form.observacoes || null,
      cliente_id: clienteId || null,
      processo_id: procId || null,
    });
    setSaving(false);
    onOpenChange(false);
    setForm({ tipo: 'Fixo', valor_total: '', valor_entrada: '', percentual_exito: '', forma_pagamento: 'À Vista', num_parcelas: '1', data_contrato: today, observacoes: '' });
    limparProc();
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden rounded-2xl border border-[#c9a96e]/20 max-w-md w-full">
        {/* Header */}
        <div className="h-[3px] w-full bg-gradient-to-r from-[#c9a96e] to-[#b8922a]" />
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
          <div className="h-9 w-9 rounded-xl bg-[#c9a96e]/12 flex items-center justify-center shrink-0">
            <DollarSign className="h-4 w-4 text-[#b8922a]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Novo Honorário</h2>
            <p className="text-[11px] text-muted-foreground">Cadastro de contrato de honorários</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Processo vinculado — puxa o valor da causa automaticamente */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Processo vinculado</Label>
            {procId ? (
              <div className="flex items-center gap-2 rounded-xl border border-[#c9a96e]/25 bg-[#c9a96e]/[0.06] px-3 py-2">
                <Scale className="h-4 w-4 text-[#b8922a] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{procLabel || 'Processo selecionado'}</p>
                  <p className="text-[11px] text-muted-foreground">{procValor != null ? `Valor da causa: ${fmtBRL(procValor)}` : 'Sem valor da causa cadastrado'}</p>
                </div>
                <button type="button" onClick={limparProc} className="p-1 rounded-lg hover:bg-black/5" title="Desvincular"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={procQuery} onChange={e => buscarProc(e.target.value)} placeholder="Buscar por cliente ou nº do processo..." className="pl-10 rounded-xl h-9 text-sm" />
                {procOpen && procResults.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-border/60 bg-popover shadow-xl max-h-56 overflow-y-auto">
                    {procResults.map(p => (
                      <button key={p.id} type="button" onClick={() => pickProc(p)} className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.nome_cliente || 'Sem nome'}</p>
                        <p className="text-[11px] text-muted-foreground">{[p.numero_processo, p.valor_causa != null ? fmtBRL(p.valor_causa) : 'sem valor'].filter(Boolean).join(' · ')}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {procId && procValor == null && (
              <p className="text-[10px] text-amber-600">Este processo não tem valor da causa cadastrado — preencha o Valor Total manualmente.</p>
            )}
          </div>

          {/* Tipo + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => set('tipo', v as Tipo)}>
                <SelectTrigger className="rounded-xl h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fixo">Fixo</SelectItem>
                  <SelectItem value="Por Êxito">Por Êxito</SelectItem>
                  <SelectItem value="Misto">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Data do Contrato</Label>
              <Input
                type="date"
                value={form.data_contrato}
                onChange={e => set('data_contrato', e.target.value)}
                className="rounded-xl h-9 text-sm"
              />
            </div>
          </div>

          {/* Valor total + Valor entrada */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valor Total (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_total}
                onChange={e => set('valor_total', e.target.value)}
                placeholder="0,00"
                className="rounded-xl h-9 text-sm"
                required
              />
              {procValor != null && Number(form.valor_total || 0) !== procValor && (
                <button type="button" onClick={() => set('valor_total', String(procValor))}
                  className="text-[10px] text-[#b8922a] hover:underline">
                  Puxar valor da causa ({fmtBRL(procValor)})
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valor de Entrada (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_entrada}
                onChange={e => set('valor_entrada', e.target.value)}
                placeholder="0,00"
                className="rounded-xl h-9 text-sm"
              />
            </div>
          </div>

          {/* Percentual êxito (condicional) */}
          {showExito && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Percentual de Êxito (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.percentual_exito}
                onChange={e => set('percentual_exito', e.target.value)}
                placeholder="Ex: 30"
                className="rounded-xl h-9 text-sm"
              />
            </div>
          )}

          {/* Forma de pagamento + Parcelas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Forma de Pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={v => set('forma_pagamento', v as FormaPag)}>
                <SelectTrigger className="rounded-xl h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="À Vista">À Vista</SelectItem>
                  <SelectItem value="Parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showParcelas && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nº de Parcelas</Label>
                <Input
                  type="number"
                  min="2"
                  max="120"
                  value={form.num_parcelas}
                  onChange={e => set('num_parcelas', e.target.value)}
                  placeholder="Ex: 12"
                  className="rounded-xl h-9 text-sm"
                />
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={e => set('observacoes', e.target.value)}
              placeholder="Notas adicionais sobre o contrato..."
              className="rounded-xl text-sm resize-none min-h-[64px]"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl h-9"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.valor_total}
              className="flex-1 rounded-xl h-9 bg-[#3d2b1f] hover:bg-[#3d2b1f]/90 text-white"
            >
              {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Salvando...</> : 'Salvar Honorário'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
