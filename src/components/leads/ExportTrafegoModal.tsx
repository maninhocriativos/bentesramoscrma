import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Download, FileText, Loader2, MessageSquare, FileCheck } from 'lucide-react';
import { format } from 'date-fns';
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

    // Fetch traffic leads in period
    let query = supabase
      .from('leads_juridicos')
      .select('id, nome, telefone, email, created_at, resumo_ia, contract_signed_at, status')
      .or('tipo_origem.eq.trafego,linha_whatsapp.eq.trafego_isa')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: false });

    // Filter only signed contracts
    if (filterMode === 'contrato_assinado') {
      query = query.not('contract_signed_at', 'is', null);
    }

    const { data: leads, error } = await query;

    if (error) throw error;
    if (!leads || leads.length === 0) return [];

    // Fetch last 5 messages for each lead
    const leadIds = leads.map(l => l.id);
    const { data: messages } = await supabase
      .from('manychat_mensagens')
      .select('lead_id, conteudo, direcao, created_at')
      .in('lead_id', leadIds)
      .eq('tipo', 'text')
      .order('created_at', { ascending: false })
      .limit(leadIds.length * 5);

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
        const info = [`Tel: ${lead.telefone || 'N/A'}`, lead.email ? `Email: ${lead.email}` : '', `Entrada: ${new Date(lead.created_at).toLocaleDateString('pt-BR')}`].filter(Boolean).join('  |  ');
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

      doc.save(`leads-trafego-${format(dateFrom!, 'dd-MM-yyyy')}_a_${format(dateTo!, 'dd-MM-yyyy')}.pdf`);
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
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Exportar Leads de Tráfego
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Selecione o período para exportar leads de tráfego pago (WhatsApp) com nome, telefone, email e resumo das últimas conversas.
        </p>

        {/* Date pickers */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data inicial</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data final</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Preview button */}
        <Button variant="secondary" onClick={handlePreview} disabled={loading || !dateFrom || !dateTo} className="w-full">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Buscar Leads
        </Button>

        {/* Preview results */}
        {previewData !== null && (
          <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Resultados</span>
              <Badge variant="secondary">{previewData.length} leads</Badge>
            </div>
            {previewData.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum lead de tráfego encontrado nesse período.</p>
            ) : (
              previewData.slice(0, 10).map((lead, i) => (
                <div key={i} className="text-xs border-b border-border/50 pb-1.5 last:border-0">
                  <span className="font-medium">{lead.nome}</span>
                  <span className="text-muted-foreground ml-2">{lead.telefone}</span>
                  {lead.email && <span className="text-muted-foreground ml-2">• {lead.email}</span>}
                </div>
              ))
            )}
            {previewData.length > 10 && (
              <p className="text-xs text-muted-foreground">... e mais {previewData.length - 10} leads</p>
            )}
          </div>
        )}

        {/* Export buttons */}
        {previewData && previewData.length > 0 && (
          <div className="flex gap-2">
            <Button onClick={exportCSV} disabled={loading} className="flex-1 gap-2" variant="outline">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            <Button onClick={exportPDF} disabled={loading} className="flex-1 gap-2">
              <FileText className="h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
