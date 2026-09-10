import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, FileText, Loader2, Upload, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

interface ExportTrafegoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LeadExportRow {
  nome: string;
  telefone: string;
  email: string;
  created_at: string;
  resumo_conversas: string;
  contrato_assinado?: boolean;
  data_assinatura?: string;
}

type FilterMode = 'todos' | 'contrato_assinado';

export function ExportTrafegoModal({ open, onOpenChange }: ExportTrafegoModalProps) {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<LeadExportRow[] | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('todos');

  const fetchData = async (): Promise<LeadExportRow[]> => {
    if (!dateFrom || !dateTo) {
      toast({ title: 'Selecione o período', description: 'Informe a data inicial e final.', variant: 'destructive' });
      return [];
    }

    const from = format(dateFrom, 'yyyy-MM-dd');
    const to = format(dateTo, 'yyyy-MM-dd');

    // Fetch traffic leads in period — paginado: um período amplo facilmente
    // passa de 1000 leads de tráfego, e o PostgREST corta silenciosamente
    // qualquer select sem .range() nesse teto (mesmo bug já corrigido em
    // useLeads.ts/useProcessos.ts), perdendo os mais antigos do período sem
    // avisar — inaceitável numa exportação.
    const buildLeadsQuery = () => {
      let q = supabase
        .from('leads_juridicos')
        .select('id, nome, telefone, email, created_at, resumo_ia, contract_signed_at, status')
        .or('tipo_origem.eq.trafego,linha_whatsapp.eq.trafego_isa')
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`)
        .order('created_at', { ascending: false });
      if (filterMode === 'contrato_assinado') {
        q = q.not('contract_signed_at', 'is', null);
      }
      return q;
    };

    const PAGE = 1000;
    const leads: any[] = [];
    for (let page = 0; ; page++) {
      const { data, error } = await buildLeadsQuery().range(page * PAGE, (page + 1) * PAGE - 1);
      if (error) throw error;
      leads.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    if (leads.length === 0) return [];

    // Fetch messages for each lead — mantém o mesmo alvo de antes (~5 por lead),
    // só que agora paginado: um único .limit(leadIds.length*5) acima de 1000
    // era cortado pelo mesmo teto do PostgREST, então exportações com muitos
    // leads perdiam a prévia de mensagem justamente dos leads mais antigos.
    const leadIds = leads.map(l => l.id);
    const targetMsgCount = leadIds.length * 5;
    const messages: any[] = [];
    for (let offset = 0; offset < targetMsgCount; offset += PAGE) {
      const { data } = await supabase
        .from('manychat_mensagens')
        .select('lead_id, conteudo, direcao, created_at')
        .in('lead_id', leadIds)
        .eq('tipo', 'text')
        .order('created_at', { ascending: false })
        .range(offset, Math.min(offset + PAGE, targetMsgCount) - 1);
      messages.push(...(data || []));
      if (!data || data.length < Math.min(PAGE, targetMsgCount - offset)) break;
    }

    const msgMap = new Map<string, string[]>();
    if (messages) {
      for (const msg of messages) {
        if (!msg.lead_id) continue;
        const arr = msgMap.get(msg.lead_id) || [];
        if (arr.length < 5) {
          const prefix = msg.direcao === 'entrada' ? '👤' : '🤖';
          arr.push(`${prefix} ${msg.conteudo.substring(0, 120)}`);
          msgMap.set(msg.lead_id, arr);
        }
      }
    }

    return leads.map(l => ({
      nome: l.nome || 'Sem nome',
      telefone: l.telefone || '',
      email: l.email || '',
      created_at: l.created_at,
      resumo_conversas: msgMap.get(l.id)?.join(' | ') || l.resumo_ia || 'Sem conversas',
      contrato_assinado: !!l.contract_signed_at || l.status === 'Contrato Assinado' || l.status === 'Ganho',
      data_assinatura: l.contract_signed_at || undefined,
    }));
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const data = await fetchData();
      setPreviewData(data);
      if (data.length === 0) {
        toast({ title: 'Nenhum lead encontrado', description: 'Não há leads de tráfego nesse período.' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao buscar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    setLoading(true);
    try {
      const data = previewData || await fetchData();
      if (data.length === 0) return;

      const headers = ['Nome', 'Telefone', 'Email', 'Data Entrada', ...(filterMode === 'contrato_assinado' ? ['Data Assinatura'] : []), 'Resumo Conversas'];
      const rows = data.map(r => [
        r.nome,
        r.telefone,
        r.email,
        new Date(r.created_at).toLocaleDateString('pt-BR'),
        ...(filterMode === 'contrato_assinado' ? [r.data_assinatura ? new Date(r.data_assinatura).toLocaleDateString('pt-BR') : ''] : []),
        r.resumo_conversas,
      ]);

      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leads-trafego${filterMode === 'contrato_assinado' ? '-contrato' : ''}-${format(dateFrom!, 'dd-MM-yyyy')}_a_${format(dateTo!, 'dd-MM-yyyy')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: 'CSV exportado!', description: `${data.length} leads exportados.` });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao exportar CSV', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    setLoading(true);
    try {
      const data = previewData || await fetchData();
      if (data.length === 0) return;

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 20;

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(filterMode === 'contrato_assinado' ? 'Relatório - Leads Tráfego com Contrato Assinado' : 'Relatório de Leads de Tráfego', margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${format(dateFrom!, 'dd/MM/yyyy')} a ${format(dateTo!, 'dd/MM/yyyy')}`, margin, y);
      y += 5;
      doc.text(`Total: ${data.length} leads`, margin, y);
      y += 10;

      // Line separator
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      for (const lead of data) {
        // Check page break
        if (y > 260) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(lead.nome, margin, y);
        y += 5;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const infoArr = [`Tel: ${lead.telefone || 'N/A'}`, lead.email ? `Email: ${lead.email}` : '', `Entrada: ${new Date(lead.created_at).toLocaleDateString('pt-BR')}`];
        if (lead.data_assinatura) infoArr.push(`Assinatura: ${new Date(lead.data_assinatura).toLocaleDateString('pt-BR')}`);
        const info = infoArr.filter(Boolean).join('  |  ');
        doc.text(info, margin, y);
        y += 5;

        // Conversation summary
        doc.setFontSize(8);
        doc.setTextColor(100);
        const resumoLines = doc.splitTextToSize(`Conversas: ${lead.resumo_conversas}`, pageWidth - margin * 2);
        const maxLines = Math.min(resumoLines.length, 4);
        for (let i = 0; i < maxLines; i++) {
          doc.text(resumoLines[i], margin, y);
          y += 3.5;
        }
        doc.setTextColor(0);
        y += 3;

        // Separator
        doc.setDrawColor(230);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
      }

      doc.save(`leads-trafego${filterMode === 'contrato_assinado' ? '-contrato' : ''}-${format(dateFrom!, 'dd-MM-yyyy')}_a_${format(dateTo!, 'dd-MM-yyyy')}.pdf`);
      toast({ title: 'PDF exportado!', description: `${data.length} leads exportados.` });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao exportar PDF', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setPreviewData(null);
    setFilterMode('todos');
  };

  // Seleção rápida: mês atual + 2 anteriores, preenche Data Inicial/Final
  const quickMonths = [0, 1, 2].map(i => {
    const ref = subMonths(new Date(), i);
    return { label: format(ref, 'MMMM yyyy', { locale: ptBR }), from: startOfMonth(ref), to: endOfMonth(ref) };
  });
  const pickQuickMonth = (from: Date, to: Date) => { setDateFrom(from); setDateTo(to); setPreviewData(null); };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent hideCloseButton className="sm:max-w-[520px] p-8 gap-6 rounded-[20px] border-0 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#f5efe6] flex items-center justify-center shrink-0"><Upload className="h-[18px] w-[18px] text-[#3e2f2b]" /></div>
            <h2 className="text-lg text-[#29201e]" style={{ fontFamily: 'Lora, serif', fontWeight: 700 }}>Exportar Leads de Tráfego</h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-[#6e5e5a] hover:text-[#29201e] transition-colors shrink-0"><X className="h-[18px] w-[18px]" /></button>
        </div>

        <p className="text-sm text-[#6e5e5a] -mt-2">
          Selecione o filtro e o período dos leads de tráfego pago (WhatsApp) que deseja exportar.
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#29201e]">Filtrar por Status</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setFilterMode('todos'); setPreviewData(null); }}
                className={cn('px-3 py-2 rounded-full text-xs font-semibold transition-colors', filterMode === 'todos' ? 'bg-[#3e2f2b] text-white' : 'bg-white border border-[#efebe4] text-[#6e5e5a] hover:bg-[#f5efe6]')}>
                Todos os Leads
              </button>
              <button onClick={() => { setFilterMode('contrato_assinado'); setPreviewData(null); }}
                className={cn('px-3 py-2 rounded-full text-xs font-semibold transition-colors', filterMode === 'contrato_assinado' ? 'bg-[#3e2f2b] text-white' : 'bg-white border border-[#efebe4] text-[#6e5e5a] hover:bg-[#f5efe6]')}>
                Com Contrato Assinado
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#29201e]">Seleção Rápida</p>
            <div className="flex flex-wrap gap-2">
              {quickMonths.map(m => (
                <button key={m.label} onClick={() => pickQuickMonth(m.from, m.to)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white border border-[#efebe4] text-[#6e5e5a] hover:bg-[#f5efe6] transition-colors capitalize">
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <p className="text-xs font-semibold text-[#29201e]">Data Inicial</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#efebe4] bg-[#f9f6f0] text-sm text-left w-full">
                    <CalendarIcon className="h-4 w-4 text-[#6e5e5a] shrink-0" />
                    <span className={cn(dateFrom ? 'text-[#29201e]' : 'text-[#a89b8f]')}>{dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Selecionar'}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <p className="text-xs font-semibold text-[#29201e]">Data Final</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#efebe4] bg-[#f9f6f0] text-sm text-left w-full">
                    <CalendarIcon className="h-4 w-4 text-[#6e5e5a] shrink-0" />
                    <span className={cn(dateTo ? 'text-[#29201e]' : 'text-[#a89b8f]')}>{dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Selecionar'}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {previewData !== null && (
          <div className="rounded-xl border border-[#efebe4] bg-[#f9f6f0] p-3 max-h-48 overflow-y-auto space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#29201e]">Resultados</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f5efe6] text-[#29201e]">{previewData.length} leads</span>
            </div>
            {previewData.length === 0 ? (
              <p className="text-xs text-[#6e5e5a]">Nenhum lead de tráfego encontrado nesse período.</p>
            ) : (
              previewData.slice(0, 10).map((lead, i) => (
                <div key={i} className="text-xs border-b border-[#efebe4] pb-1.5 last:border-0">
                  <span className="font-semibold text-[#29201e]">{lead.nome}</span>
                  <span className="text-[#6e5e5a] ml-2">{lead.telefone}</span>
                  {lead.email && <span className="text-[#6e5e5a] ml-2">• {lead.email}</span>}
                </div>
              ))
            )}
            {previewData.length > 10 && <p className="text-xs text-[#6e5e5a]">... e mais {previewData.length - 10} leads</p>}
          </div>
        )}

        {!previewData || previewData.length === 0 ? (
          <div className="flex gap-3">
            <button onClick={() => onOpenChange(false)} className="flex-1 px-6 py-3.5 rounded-xl border border-[#efebe4] bg-[#f9f6f0] text-sm font-semibold text-[#6e5e5a] hover:bg-[#f5efe6] transition-colors">
              Cancelar
            </button>
            <button onClick={handlePreview} disabled={loading || !dateFrom || !dateTo}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#3e2f2b] hover:bg-[#2d211d] text-white text-sm font-semibold transition-colors disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Buscar Leads
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={exportCSV} disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-[#efebe4] bg-[#f9f6f0] text-sm font-semibold text-[#29201e] hover:bg-[#f5efe6] transition-colors disabled:opacity-60">
              <Download className="h-4 w-4" /> CSV
            </button>
            <button onClick={exportPDF} disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#3e2f2b] hover:bg-[#2d211d] text-white text-sm font-semibold transition-colors disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Exportar para Planilha
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
