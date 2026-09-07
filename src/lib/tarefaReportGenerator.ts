import jsPDF from 'jspdf';
import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tarefa, responsaveisDe } from '@/types/tarefas';

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

export interface ProcessoInfoReport {
  numero_processo: string | null;
  titulo_acao: string | null;
  assunto: string | null;
}

export interface OfficeInfoReport {
  office_name?: string | null;
  lawyer_name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  oab_main?: string | null;
}

/** Rótulo de prioridade no estilo do relatório do AdvBox (NORMAL/ALTA/URGENTE). */
const PRIORIDADE_LABEL: Record<string, string> = {
  Baixa: 'NORMAL',
  Media: 'NORMAL',
  Alta: 'ALTA',
  Urgente: 'URGENTE',
};

const PRIORIDADE_COLOR: Record<string, [number, number, number]> = {
  Baixa: [120, 120, 120],
  Media: [120, 120, 120],
  Alta: [184, 83, 9],
  Urgente: [153, 27, 27],
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

function fmtDateTime(dateStr: string | null, horario: string | null): string {
  if (!dateStr) return '—';
  const data = fmtDate(dateStr);
  if (data === '—') return '—';
  return horario ? `${data} às ${horario.slice(0, 5)}` : data;
}

export function tarefasReportFilename(): string {
  return `Relatorio_Tarefas_${new Date().toISOString().split('T')[0]}.pdf`;
}

/**
 * Relatório de tarefas no formato "relatório de compromissos" usado por
 * sistemas jurídicos como o AdvBox: cabeçalho do escritório, uma linha por
 * compromisso com prioridade + data/prazo + descrição completa (tipo de ato,
 * processo, partes e tipo de ação), não uma grade de colunas fixas.
 */
export function buildTarefasReport(
  tarefas: Tarefa[],
  memberMap: Record<string, string>,
  kpis: TarefasKpis,
  filtroLabel: string,
  processoMap: Record<string, ProcessoInfoReport>,
  partesMap: Record<string, string>,
  office: OfficeInfoReport | null,
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxW = pw - margin * 2;
  let y = 16;

  // ── Cabeçalho do escritório ──────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text((office?.office_name || 'Bentes & Ramos Advocacia').toUpperCase(), margin, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  const linhaContato = [office?.email, office?.phone].filter(Boolean).join('  |  ');
  if (linhaContato) { doc.text(linhaContato, margin, y); y += 4.2; }
  if (office?.address) { doc.text(doc.splitTextToSize(office.address, maxW)[0], margin, y); y += 4.2; }
  if (office?.oab_main) { doc.text(office.oab_main, margin, y); y += 4.2; }

  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(`Relatório emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, y);
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pw - margin, y);
  y += 7;

  // ── Título + filtro + resumo ─────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(61, 43, 31);
  doc.text('RELATÓRIO DE TAREFAS E COMPROMISSOS', margin, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  doc.text(`Responsável: ${filtroLabel}  •  ${tarefas.length} compromisso${tarefas.length !== 1 ? 's' : ''}`, margin, y);
  y += 4.5;
  doc.text(
    `Pendentes: ${kpis.pendentes}  |  Em andamento: ${kpis.emAndamento}  |  Concluídas: ${kpis.concluidas}  |  ` +
    `Atrasadas: ${kpis.atrasadas}  |  Vencem hoje: ${kpis.hojePrazo}  |  Aguardando aprovação: ${kpis.aguardando}  |  Horas/mês: ${kpis.totalHoras.toFixed(1)}h`,
    margin, y,
  );
  y += 6;
  doc.setDrawColor(61, 43, 31);
  doc.line(margin, y, pw - margin, y);
  y += 3;

  // ── Colunas ───────────────────────────────────────────────────────────────
  const colPrioW = 22;
  const colDataW = 32;
  const colCompX = margin + colPrioW + colDataW;
  const colCompW = maxW - colPrioW - colDataW;

  const drawColumnHeaders = () => {
    doc.setFillColor(61, 43, 31);
    doc.rect(margin, y, maxW, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('PRIORIDADE', margin + 2, y + 4.5);
    doc.text('DATA / PRAZO', margin + colPrioW + 2, y + 4.5);
    doc.text('COMPROMISSO', colCompX + 2, y + 4.5);
    y += 9;
  };

  drawColumnHeaders();

  if (tarefas.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text('Nenhuma tarefa encontrada para este filtro.', pw / 2, y + 4, { align: 'center' });
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > ph - 16) {
      doc.addPage();
      y = 16;
      drawColumnHeaders();
    }
  };

  tarefas.forEach((t, idx) => {
    const processo = t.processo_id ? processoMap[t.processo_id] : undefined;
    const partes = t.processo_id ? partesMap[t.processo_id] : undefined;
    const tipoAcao = processo?.assunto || processo?.titulo_acao || null;

    // Monta as linhas de texto (com wrap) da coluna Compromisso ANTES de saber
    // a altura da linha — cada linha pode ter tamanho variável (com/sem
    // processo vinculado, com/sem partes), diferente da tabela de colunas
    // fixas anterior.
    const compLines: { text: string; bold?: boolean; color?: [number, number, number]; size?: number }[] = [];
    compLines.push({ text: t.titulo, bold: true, size: 9, color: [30, 30, 30] });

    const descComp = t.descricao
      ? t.descricao
      : `${t.tipo}${t.horario ? ` às ${t.horario.slice(0, 5)}` : ''} (Horário de Manaus)`;
    compLines.push({ text: descComp, size: 8, color: [70, 70, 70] });

    if (partes) compLines.push({ text: `PARTES: ${partes}`, size: 7.5, color: [110, 110, 110] });
    if (processo?.numero_processo) compLines.push({ text: `NÚMERO CNJ: ${processo.numero_processo}`, size: 7.5, color: [110, 110, 110] });
    if (tipoAcao) compLines.push({ text: `TIPO DE AÇÃO: ${tipoAcao}`, size: 7.5, color: [110, 110, 110] });

    const responsaveisNomes = responsaveisDe(t).map(id => memberMap[id] || 'Usuário').join(', ') || 'Sem responsável';
    compLines.push({ text: `Responsável: ${responsaveisNomes}`, size: 7.5, color: [140, 140, 140] });

    // Calcula altura real (cada campo pode quebrar em mais de 1 linha)
    const wrapped = compLines.map(l => {
      doc.setFontSize(l.size || 8);
      return { ...l, wrapped: doc.splitTextToSize(l.text, colCompW - 4) as string[] };
    });
    const lineHeight = 3.6;
    const totalLines = wrapped.reduce((a, l) => a + l.wrapped.length, 0);
    const rowHeight = Math.max(16, totalLines * lineHeight + 4);

    ensureSpace(rowHeight);

    if (idx % 2 === 0) {
      doc.setFillColor(250, 249, 247);
      doc.rect(margin, y - 3, maxW, rowHeight, 'F');
    }

    // Prioridade
    const prioLabel = PRIORIDADE_LABEL[t.prioridade] || 'NORMAL';
    const prioColor = PRIORIDADE_COLOR[t.prioridade] || PRIORIDADE_COLOR.Baixa;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...prioColor);
    doc.text(prioLabel, margin + 2, y + 2);

    // Data / Prazo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    let dy = y + 2;
    if (t.data_limite) {
      doc.text(fmtDateTime(t.data_limite, t.horario), margin + colPrioW + 2, dy, { maxWidth: colDataW - 4 });
      dy += 4;
    }
    if (t.prazo_fatal) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(153, 27, 27);
      doc.text(`Prazo fatal: ${fmtDate(t.prazo_fatal)}`, margin + colPrioW + 2, dy, { maxWidth: colDataW - 4 });
    }

    // Compromisso (multi-linha)
    let cy = y + 2;
    wrapped.forEach(l => {
      doc.setFont('helvetica', l.bold ? 'bold' : 'normal');
      doc.setFontSize(l.size || 8);
      doc.setTextColor(...(l.color || [30, 30, 30]));
      l.wrapped.forEach(line => {
        doc.text(line, colCompX + 2, cy);
        cy += lineHeight;
      });
    });

    y += rowHeight + 2;
  });

  // Footer em todas as páginas
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pages} | Gerado em ${new Date().toLocaleString('pt-BR')}`, pw / 2, ph - 8, { align: 'center' });
  }

  return doc;
}
