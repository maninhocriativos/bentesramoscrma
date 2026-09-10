import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FileSpreadsheet, Loader2, ExternalLink, Search, X, Files } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';

interface GerarRelatorioLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
}

export function GerarRelatorioLeadsModal({ open, onOpenChange, leads }: GerarRelatorioLeadsModalProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(leads.map(l => l.id)));
      setResultUrl(null);
      setSearch('');
    }
  }, [open, leads]);

  const visibleLeads = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return leads;
    return leads.filter(l => (l.nome || '').toLowerCase().includes(q) || (l.telefone || '').includes(search));
  }, [leads, search]);

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

        <div className="flex items-center justify-between bg-[#f5efe6] rounded-2xl p-4">
          <p className="text-[13px] text-[#29201e]">Total de leads na lista filtrada:</p>
          <p className="text-lg font-bold text-[#29201e]">{leads.length} Leads</p>
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
