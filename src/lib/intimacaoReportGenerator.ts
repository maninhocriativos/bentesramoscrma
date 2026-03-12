import jsPDF from 'jspdf';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface IntimacaoData {
  processo_cnj: string;
  processo_titulo: string;
  tribunal: string;
  tipo_intimacao: string;
  conteudo: string;
  data_intimacao: string | null;
  data_disponibilizacao: string | null;
  data_publicacao: string | null;
  oab_numero: string;
  oab_uf: string;
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return dateStr;
    return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

export function generateIntimacaoReport(data: IntimacaoData): void {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxW = pw - margin * 2;
  let y = 20;

  // Header
  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235);
  doc.text('RELATÓRIO DE INTIMAÇÃO / PUBLICAÇÃO', pw / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text('Bentes & Ramos Advocacia', pw / 2, y, { align: 'center' });
  y += 8;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pw - margin, y);
  y += 10;

  // Info rows
  const addField = (label: string, value: string) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '—', margin + 50, y);
    y += 7;
  };

  addField('Processo:', data.processo_cnj || '—');
  addField('Ação:', data.processo_titulo || '—');
  addField('Tribunal:', data.tribunal || '—');
  addField('Tipo:', data.tipo_intimacao || '—');
  addField('OAB:', `${data.oab_uf} ${data.oab_numero}`);
  y += 4;

  // Dates section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(37, 99, 235);
  doc.text('DATAS', margin, y);
  y += 8;

  doc.setFontSize(10);
  addField('Disponibilização:', fmtDate(data.data_disponibilizacao));
  addField('Publicação:', fmtDate(data.data_publicacao));
  addField('Intimação:', fmtDate(data.data_intimacao));
  y += 4;

  // Content
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(37, 99, 235);
  doc.text('CONTEÚDO DA PUBLICAÇÃO', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);

  const content = data.conteudo || 'Sem conteúdo detalhado disponível.';
  const lines = doc.splitTextToSize(content, maxW);

  for (const line of lines) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(line, margin, y);
    y += 5;
  }

  // Footer on all pages
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${pages} | Gerado em ${new Date().toLocaleString('pt-BR')}`,
      pw / 2, 287, { align: 'center' }
    );
  }

  const cnj = (data.processo_cnj || 'intimacao').replace(/[.\-/]/g, '_');
  doc.save(`Relatorio_Intimacao_${cnj}_${new Date().toISOString().split('T')[0]}.pdf`);
}
