import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FileSpreadsheet, Loader2, ExternalLink, Search, X, Files, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GerarRelatorioLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
}

type PeriodoPreset = 'hora' | 'hoje' | 'semana' | 'mes' | 'mes_passado' | 'custom' | null;

export function GerarRelatorioLeadsModal({ open, onOpenChange, leads }: GerarRelatorioLeadsModalProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [periodoAtivo, setPeriodoAtivo] = useState<PeriodoPreset>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  useEffect(() => {
    if (open) {
      setResultUrl(null);
      setSearch('');
      setPeriodoAtivo(null);
      setDateFrom(undefined);
      setDateTo(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const aplicarPreset = (preset: PeriodoPreset) => {
    const now = new Date();
    setPeriodoAtivo(preset);
    if (preset === 'hora') { setDateFrom(new Date(now.getTime() - 60 * 60 * 1000)); setDateTo(now); }
    else if (preset === 'hoje') { setDateFrom(startOfDay(now)); setDateTo(endOfDay(now)); }
    else if (preset === 'semana') { setDateFrom(startOfWeek(now, { locale: ptBR })); setDateTo(endOfWeek(now, { locale: ptBR })); }
    else if (preset === 'mes') { setDateFrom(startOfMonth(now)); setDateTo(endOfMonth(now)); }
    else if (preset === 'mes_passado') { const m = subMonths(now, 1); setDateFrom(startOfMonth(m)); setDateTo(endOfMonth(m)); }
    else { setDateFrom(undefined); setDateTo(undefined); }
  };

  // Período narra o carregamento por data de entrada (created_at) — sem
  // período selecionado, usa a lista já filtrada da pipeline (comportamento
  // de antes, preservado). Com período, narrowa mais — pedido do usuário
  // pra não puxar milhares de leads de uma vez sem necessidade.
  const leadsNoPeriodo = useMemo(() => {
    if (!dateFrom || !dateTo) return leads;
    const fromMs = dateFrom.getTime();
    const toMs = dateTo.getTime();
    return leads.filter(l => {
      const t = new Date(l.created_at).getTime();
      return t >= fromMs && t <= toMs;
    });
  }, [leads, dateFrom, dateTo]);

  useEffect(() => {
    setSelectedIds(new Set(leadsNoPeriodo.map(l => l.id)));
  }, [leadsNoPeriodo]);

  const visibleLeads = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return leadsNoPeriodo;
    return leadsNoPeriodo.filter(l => (l.nome || '').toLowerCase().includes(q) || (l.telefone || '').includes(search));
  }, [leadsNoPeriodo, search]);

  const toggleLead = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = visibleLeads.length > 0 && visibleLeads.every(l => selectedIds.has(l.id));
  const toggleAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleLeads.forEach(l => next.delete(l.id));
      else visibleLeads.forEach(l => next.add(l.id));
      return next;
    });
  };

  const handleGerar = async () => {
    if (selectedIds.size === 0) {
      toast({ title: 'Selecione ao menos um lead', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('leads-relatorio-sheets', {
        body: { leadIds: Array.from(selectedIds) },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Erro ao gerar relatório', description: data.error, variant: 'destructive' });
        return;
      }
      setResultUrl(data.url);
      toast({ title: 'Planilha gerada!', description: `${data.total} lead(s) incluído(s).` });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao gerar relatório', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="sm:max-w-[560px] p-8 gap-5 rounded-[20px] border-0 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#f5efe6] flex items-center justify-center shrink-0"><Files className="h-[18px] w-[18px] text-[#3e2f2b]" /></div>
            <h2 className="text-lg font-bold text-[#29201e]">Gerar Relatório de Leads</h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-[#6e5e5a] hover:text-[#29201e] transition-colors shrink-0"><X className="h-[18px] w-[18px]" /></button>
        </div>

        <p className="text-sm text-[#6e5e5a] -mt-1">
          A lista abaixo já reflete os filtros ativos na pipeline. Marque quais leads devem entrar na planilha do Google Sheets.
        </p>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-[#29201e]">Filtrar por período de entrada (opcional)</p>
          <div className="flex flex-wrap gap-2">
            {([
              { v: 'hora', l: 'Última hora' },
              { v: 'hoje', l: 'Hoje' },
              { v: 'semana', l: 'Esta semana' },
              { v: 'mes', l: 'Este mês' },
              { v: 'mes_passado', l: 'Mês passado' },
            ] as const).map(p => (
              <button key={p.v} onClick={() => aplicarPreset(periodoAtivo === p.v ? null : p.v)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  periodoAtivo === p.v ? 'bg-[#3e2f2b] text-white' : 'bg-white border border-[#efebe4] text-[#6e5e5a] hover:bg-[#f5efe6]')}>
                {p.l}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#efebe4] bg-white text-xs text-left w-full">
                    <CalendarIcon className="h-3.5 w-3.5 text-[#6e5e5a] shrink-0" />
                    <span className={cn(dateFrom ? 'text-[#29201e]' : 'text-[#a89b8f]')}>{dateFrom ? format(dateFrom, 'dd/MM/yyyy HH:mm') : 'Data inicial'}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={d => { setDateFrom(d ? startOfDay(d) : undefined); setPeriodoAtivo('custom'); }} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1 min-w-0">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#efebe4] bg-white text-xs text-left w-full">
                    <CalendarIcon className="h-3.5 w-3.5 text-[#6e5e5a] shrink-0" />
                    <span className={cn(dateTo ? 'text-[#29201e]' : 'text-[#a89b8f]')}>{dateTo ? format(dateTo, 'dd/MM/yyyy HH:mm') : 'Data final'}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={d => { setDateTo(d ? endOfDay(d) : undefined); setPeriodoAtivo('custom'); }} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => aplicarPreset(null)} title="Limpar período" className="shrink-0 h-9 w-9 rounded-lg border border-[#efebe4] flex items-center justify-center text-[#6e5e5a] hover:bg-[#f5efe6] transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between bg-[#f5efe6] rounded-2xl p-4">
          <p className="text-[13px] text-[#29201e]">{dateFrom && dateTo ? 'Leads no período selecionado:' : 'Total de leads na lista filtrada:'}</p>
          <p className="text-lg font-bold text-[#29201e]">{leadsNoPeriodo.length} Leads</p>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6e5e5a]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por nome ou telefone..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#efebe4] bg-[#f9f6f0] text-sm text-[#29201e] placeholder:text-[#6e5e5a] outline-none focus:border-[#c5a47e] transition-colors"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#29201e]">Lista de Correspondências</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="h-[18px] w-[18px] rounded accent-[#c5a47e]" />
            <span className="text-[13px] text-[#6e5e5a]">Selecionar todos os {visibleLeads.length} resultados</span>
          </label>
        </div>

        <div className="border border-[#efebe4] rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
          {visibleLeads.length === 0 ? (
            <p className="text-xs text-[#6e5e5a] p-4">Nenhum lead encontrado.</p>
          ) : (
            visibleLeads.map(lead => (
              <label key={lead.id} className={cn('flex items-center justify-between gap-3 p-3 border-b border-[#efebe4] last:border-0 cursor-pointer hover:bg-[#f5efe6] transition-colors',
                selectedIds.has(lead.id) && 'bg-[#f9f6f0]')}>
                <div className="flex items-center gap-3 min-w-0">
                  <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleLead(lead.id)} className="h-[18px] w-[18px] rounded shrink-0 accent-[#c5a47e]" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#29201e] truncate">{lead.nome || 'Sem nome'}</p>
                    <p className="text-xs text-[#6e5e5a] truncate">{lead.telefone}</p>
                  </div>
                </div>
                <span className="text-[13px] text-[#6e5e5a] shrink-0">{lead.tipo_acao || lead.origem || ''}</span>
              </label>
            ))
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={() => onOpenChange(false)} className="w-[160px] px-6 py-3.5 rounded-xl border border-[#efebe4] bg-[#f9f6f0] text-sm font-semibold text-[#6e5e5a] hover:bg-[#f5efe6] transition-colors">
            Cancelar
          </button>
          {resultUrl ? (
            <a href={resultUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#3e2f2b] hover:bg-[#2d211d] text-white text-sm font-semibold transition-colors">
              <ExternalLink className="h-4 w-4" /> Abrir Planilha
            </a>
          ) : (
            <button onClick={handleGerar} disabled={loading || selectedIds.size === 0}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#3e2f2b] hover:bg-[#2d211d] text-white text-sm font-semibold transition-colors disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Gerar Planilha (Google Sheets)
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
