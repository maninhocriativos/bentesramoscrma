import jsPDF from 'jspdf';
import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tarefa } from '@/types/tarefas';

interface TarefasKpis {
  pendentes: number;
  emAndamento: number;
  concluidas: number;
  urgentes: number;
  atrasadas: number;
  hojePrazo: number;
  aguardando: number;
  totalHoras: number;
}

const APROV_LABEL: Record<string, string> = {
  aguardando_aprovacao: 'Aguardando',
  aprovada: 'Aprovada',
  devolvida: 'Devolvida',
};

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return dateStr;
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function truncate(doc: jsPDF, text: string, maxW: number): string {
  if (!text) return '—';
  const lines = doc.splitTextToSize(text, maxW) as string[];
  if (lines.length <= 1) return lines[0] ?? '—';
  return lines[0].replace(/\s+\S*$/, '') + '…';
}

export function generateTarefasReport(
  tarefas: Tarefa[],
  memberMap: Record<string, string>,
  kpis: TarefasKpis,
  filtroLabel: string,
): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxW = pw - margin * 2;
  let y = 18;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(61, 43, 31);
  doc.text('RELATÓRIO DE TAREFAS', pw / 2, y, { align: 'center' });
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text('Bentes & Ramos Advocacia', pw / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.text(`Filtro: ${filtroLabel}  |  Gerado em ${new Date().toLocaleString('pt-BR')}`, pw / 2, y, { align: 'center' });
  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pw - margin, y);
  y += 10;

  // KPI summary
  const kpiItems: [string, number | string][] = [
    ['Total', tarefas.length],
    ['Pendentes', kpis.pendentes],
    ['Em Andamento', kpis.emAndamento],
    ['Concluídas', kpis.concluidas],
    ['Urgentes', kpis.urgentes],
    ['Atrasadas', kpis.atrasadas],
    ['Vence Hoje', kpis.hojePrazo],
    ['Aguard. Aprov.', kpis.aguardando],
    ['Horas/Mês', `${kpis.totalHoras.toFixed(1)}h`],
  ];
  const kpiColW = maxW / kpiItems.length;
  doc.setFontSize(7.5);
  kpiItems.forEach(([label], i) => {
    const cx = margin + kpiColW * i + kpiColW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(150, 150, 150);
    doc.text(String(label).toUpperCase(), cx, y, { align: 'center' });
  });
  y += 7;
  kpiItems.forEach(([, value], i) => {
    const cx = margin + kpiColW * i + kpiColW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(61, 43, 31);
    doc.text(String(value), cx, y, { align: 'center' });
  });
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // Table
  const cols = [
    { key: 'titulo',       label: 'Título',      w: 95 },
    { key: 'responsavel',  label: 'Responsável', w: 42 },
    { key: 'status',       label: 'Status',      w: 28 },
    { key: 'prioridade',   label: 'Prioridade',  w: 24 },
    { key: 'prazo',        label: 'Prazo Fatal', w: 26 },
    { key: 'aprovacao',    label: 'Aprovação',   w: 0 },
  ];
  cols[cols.length - 1].w = maxW - cols.slice(0, -1).reduce((a, c) => a + c.w, 0);

  const drawHeader = () => {
    doc.setFillColor(61, 43, 31);
    doc.rect(margin, y - 5, maxW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    let x = margin + 2;
    cols.forEach(c => { doc.text(c.label, x, y); x += c.w; });
    y += 8;
  };

  drawHeader();

  if (tarefas.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text('Nenhuma tarefa encontrada para este filtro.', pw / 2, y + 4, { align: 'center' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  tarefas.forEach((t, idx) => {
    if (y > ph - 20) { doc.addPage(); y = 18; drawHeader(); }
    if (idx % 2 === 0) {
      doc.setFillColor(250, 249, 247);
      doc.rect(margin, y - 4.5, maxW, 6.5, 'F');
    }
    doc.setTextColor(30, 30, 30);
    let x = margin + 2;
    doc.text(truncate(doc, t.titulo, cols[0].w - 4), x, y); x += cols[0].w;
    doc.text(truncate(doc, t.responsavel_id ? (memberMap[t.responsavel_id] || 'Usuário') : 'Sem responsável', cols[1].w - 4), x, y); x += cols[1].w;
    doc.text(t.status, x, y); x += cols[2].w;
    doc.text(t.prioridade, x, y); x += cols[3].w;
    doc.text(fmtDate(t.prazo_fatal || t.data_limite), x, y); x += cols[4].w;
    doc.text(t.aprovacao_status ? (APROV_LABEL[t.aprovacao_status] || t.aprovacao_status) : '—', x, y);
    y += 6.5;
  });

  // Footer on all pages
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pages} | Gerado em ${new Date().toLocaleString('pt-BR')}`, pw / 2, ph - 8, { align: 'center' });
  }

  doc.save(`Relatorio_Tarefas_${new Date().toISOString().split('T')[0]}.pdf`);
}
