import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { AnaliseConfig, AnaliseResultado } from '@/types/extratos';

// ─── Paleta de cores Bentes Ramos ─────────────────────────────────────────────
const C = {
  marrom:    '3D2B1F',
  marromMed: '7B4F2E',
  ouro:      'C9A96E',
  ourofundo: 'F5EDD8',
  vermelho:  'C0392B',
  verde:     '1E8449',
  amarelo:   'D4AC0D',
  cinzaClaro:'F7F4F0',
  branco:    'FFFFFF',
  borda:     'D5C5B0',
};

const FONT_BASE = 'Calibri';

function corStatus(status: string): string {
  if (status === 'confirmado') return C.verde;
  if (status === 'indicio')    return C.amarelo;
  return C.marromMed;
}

function corPrioridade(p: string): string {
  if (p === 'alta')  return C.vermelho;
  if (p === 'media') return C.amarelo;
  return C.marromMed;
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Helpers de célula ────────────────────────────────────────────────────────
function headerFill(ws: ExcelJS.Worksheet, row: number, from: number, to: number, text: string, size = 13) {
  const cell = ws.getRow(row).getCell(from);
  cell.value = text;
  cell.font  = { name: FONT_BASE, bold: true, size, color: { argb: `FF${C.branco}` } };
  cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.marrom}` } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  if (to > from) ws.mergeCells(row, from, row, to);
}

function subHeader(ws: ExcelJS.Worksheet, row: number, from: number, to: number, text: string) {
  const cell = ws.getRow(row).getCell(from);
  cell.value = text;
  cell.font  = { name: FONT_BASE, bold: true, size: 11, color: { argb: `FF${C.branco}` } };
  cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.marromMed}` } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  if (to > from) ws.mergeCells(row, from, row, to);
}

function colHeader(cell: ExcelJS.Cell, text: string) {
  cell.value = text;
  cell.font  = { name: FONT_BASE, bold: true, size: 10, color: { argb: `FF${C.branco}` } };
  cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.ouro}` } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = {
    top:    { style: 'thin', color: { argb: `FF${C.marrom}` } },
    bottom: { style: 'thin', color: { argb: `FF${C.marrom}` } },
    left:   { style: 'thin', color: { argb: `FF${C.borda}` } },
    right:  { style: 'thin', color: { argb: `FF${C.borda}` } },
  };
}

function labelCell(cell: ExcelJS.Cell, text: string) {
  cell.value = text;
  cell.font  = { name: FONT_BASE, bold: true, size: 10, color: { argb: `FF${C.marrom}` } };
  cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.ourofundo}` } };
  cell.border = { bottom: { style: 'hair', color: { argb: `FF${C.borda}` } } };
}

function valueCell(cell: ExcelJS.Cell, value: string | number | null, opts?: {
  bold?: boolean; red?: boolean; currency?: boolean; center?: boolean; wrap?: boolean; color?: string;
}) {
  cell.value = value;
  const color = opts?.color ?? (opts?.red ? C.vermelho : C.marrom);
  cell.font  = { name: FONT_BASE, bold: opts?.bold ?? false, size: 10, color: { argb: `FF${color}` } };
  if (opts?.currency && typeof value === 'number') {
    cell.numFmt = '"R$"#,##0.00';
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
  } else {
    cell.alignment = {
      horizontal: opts?.center ? 'center' : 'left',
      vertical: 'middle',
      wrapText: opts?.wrap,
    };
  }
}

function dataRow(cell: ExcelJS.Cell, value: string | number | null, alt: boolean, opts?: {
  bold?: boolean; red?: boolean; currency?: boolean; center?: boolean; wrap?: boolean; color?: string;
}) {
  cell.value = value;
  if (alt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.cinzaClaro}` } };
  const color = opts?.color ?? (opts?.red ? C.vermelho : '222222');
  cell.font  = { name: FONT_BASE, bold: opts?.bold ?? false, size: 10, color: { argb: `FF${color}` } };
  if (opts?.currency && typeof value === 'number') {
    cell.numFmt = '"R$"#,##0.00';
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
  } else {
    cell.alignment = {
      horizontal: opts?.center ? 'center' : (typeof value === 'number' ? 'right' : 'left'),
      vertical: 'middle',
      wrapText: opts?.wrap,
    };
  }
  cell.border = { bottom: { style: 'hair', color: { argb: `FF${C.borda}` } } };
}

function totalRow(ws: ExcelJS.Worksheet, row: number, from: number, to: number, label: string, value: number) {
  ws.mergeCells(row, from, row, to - 1);
  const lbl = ws.getRow(row).getCell(from);
  lbl.value = label;
  lbl.font  = { name: FONT_BASE, bold: true, size: 11, color: { argb: `FF${C.branco}` } };
  lbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.marrom}` } };
  lbl.alignment = { horizontal: 'right', vertical: 'middle' };

  const val = ws.getRow(row).getCell(to);
  val.value  = value;
  val.numFmt = '"R$"#,##0.00';
  val.font   = { name: FONT_BASE, bold: true, size: 11, color: { argb: `FF${C.branco}` } };
  val.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.marrom}` } };
  val.alignment = { horizontal: 'right', vertical: 'middle' };
}

// ─── Aba 1: Resumo ────────────────────────────────────────────────────────────
function buildResumoSheet(wb: ExcelJS.Workbook, resultado: AnaliseResultado, config: AnaliseConfig) {
  const ws = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: `FF${C.marrom}` } } });
  ws.columns = [
    { width: 32 }, { width: 38 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];

  // Título principal
  headerFill(ws, 1, 1, 6, 'CONFERÊNCIA DE EXTRATOS — BENTES RAMOS ADVOCACIA', 14);
  ws.getRow(1).height = 36;

  subHeader(ws, 2, 1, 6,
    `Banco: ${resultado.resumo.banco}   |   Cliente: ${config.nomeCliente || 'N/D'}   |   Período: ${resultado.resumo.periodo_analisado}`);
  ws.getRow(2).height = 22;

  ws.getRow(3).height = 8;

  // Seção: dados da análise
  headerFill(ws, 4, 1, 6, 'RESUMO DA ANÁLISE', 12);
  ws.getRow(4).height = 26;

  const dados = [
    ['Lançamentos Analisados',      resultado.resumo.total_lancamentos,           false],
    ['Irregularidades Encontradas',  resultado.resumo.irregularidades_encontradas, false],
    ['Valor Total Indevido',         resultado.resumo.valor_total_indevido,        true ],
    ['Período Analisado',            resultado.resumo.periodo_analisado,           false],
    ['Banco',                        resultado.resumo.banco,                       false],
    ['Nome do Cliente',              config.nomeCliente   || 'Não informado',      false],
    ['CPF / CNPJ',                   config.cpf           || 'Não informado',      false],
    ['Número do Contrato',           config.numeroContrato || 'Não informado',     false],
  ] as [string, string | number, boolean][];

  dados.forEach(([label, val, isMoney], i) => {
    const r = 5 + i;
    ws.getRow(r).height = 20;
    labelCell(ws.getRow(r).getCell(1), label);
    ws.mergeCells(r, 2, r, 6);
    valueCell(ws.getRow(r).getCell(2), val, {
      bold: isMoney, red: isMoney, currency: isMoney && typeof val === 'number',
    });
  });

  ws.getRow(13).height = 12;

  // Seção: recomendação
  headerFill(ws, 14, 1, 6, 'RECOMENDAÇÃO JURÍDICA', 12);
  ws.getRow(14).height = 26;

  const rec = resultado.recomendacao;
  if (rec) {
    const recDados = [
      ['Tipo de Ação Recomendada',    rec.tipo_acao,               false],
      ['Estimativa de Recuperação',   rec.estimativa_recuperacao,  true ],
      ['Prazo Prescricional',         rec.prazo_prescricional,     false],
      ['Prioridade',                  rec.prioridade?.toUpperCase(), false],
      ['Fundamentação Legal',         rec.fundamentacao,           false],
    ] as [string, string | number, boolean][];

    recDados.forEach(([label, val, isMoney], i) => {
      const r = 15 + i;
      ws.getRow(r).height = label === 'Fundamentação Legal' ? 80 : 20;
      labelCell(ws.getRow(r).getCell(1), label);
      ws.mergeCells(r, 2, r, 6);
      const c = ws.getRow(r).getCell(2);
      if (label === 'Prioridade') {
        valueCell(c, val, { bold: true, color: corPrioridade(rec.prioridade) });
      } else {
        valueCell(c, val, {
          bold: isMoney, red: isMoney,
          currency: isMoney && typeof val === 'number',
          wrap: label === 'Fundamentação Legal',
        });
      }
    });
  }
}

// ─── Aba 2: Cobranças Indevidas ───────────────────────────────────────────────
function buildCobrancasSheet(wb: ExcelJS.Workbook, resultado: AnaliseResultado) {
  const ws = wb.addWorksheet('Cobranças Indevidas', { properties: { tabColor: { argb: `FF${C.vermelho}` } } });
  ws.columns = [
    { width: 13 }, { width: 38 }, { width: 18 }, { width: 12 }, { width: 18 },
    { width: 22 }, { width: 14 }, { width: 32 }, { width: 55 },
  ];

  headerFill(ws, 1, 1, 9, 'COBRANÇAS INDEVIDAS — DETALHAMENTO COMPLETO', 13);
  ws.getRow(1).height = 32;
  ws.getRow(2).height = 36;

  const hdrs = ['Data', 'Descrição', 'Valor Unitário (R$)', 'Ocorrências', 'Total (R$)', 'Categoria', 'Status', 'Base Legal', 'Justificativa'];
  hdrs.forEach((h, i) => colHeader(ws.getRow(2).getCell(i + 1), h));

  // Congelar cabeçalho
  ws.views = [{ state: 'frozen', ySplit: 2 }];

  const cobrancas = resultado.cobrancas_indevidas || [];
  cobrancas.forEach((c, idx) => {
    const r    = idx + 3;
    const alt  = idx % 2 !== 0;
    const row  = ws.getRow(r);
    row.height = 20;

    dataRow(row.getCell(1), c.data,                                 alt);
    dataRow(row.getCell(2), c.descricao,                            alt, { wrap: false });
    dataRow(row.getCell(3), c.valor_unitario  || 0,                 alt, { currency: true });
    dataRow(row.getCell(4), c.quantidade_ocorrencias || 1,          alt, { center: true });
    dataRow(row.getCell(5), c.valor_total     || 0,                 alt, { currency: true, red: true, bold: true });
    dataRow(row.getCell(6), c.categoria,                            alt);
    const statusCell = row.getCell(7);
    dataRow(statusCell, c.status,                                   alt, { bold: true, color: corStatus(c.status) });
    dataRow(row.getCell(8), c.base_legal,                           alt, { wrap: true });
    dataRow(row.getCell(9), c.justificativa,                        alt, { wrap: true });
  });

  // Linha de total
  const totalRow_ = cobrancas.length + 3;
  const total = cobrancas.reduce((s, c) => s + (c.valor_total || 0), 0);
  totalRow(ws, totalRow_, 1, 5, 'TOTAL GERAL', total);
  ws.getRow(totalRow_).height = 24;

  // Auto filtro nas colunas
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 9 } };
}

// ─── Aba 3: Por Categoria ─────────────────────────────────────────────────────
function buildCategoriaSheet(wb: ExcelJS.Workbook, resultado: AnaliseResultado) {
  const ws = wb.addWorksheet('Por Categoria', { properties: { tabColor: { argb: `FF${C.ouro}` } } });
  ws.columns = [{ width: 34 }, { width: 20 }, { width: 16 }, { width: 14 }];

  headerFill(ws, 1, 1, 4, 'RESUMO POR CATEGORIA', 13);
  ws.getRow(1).height = 30;
  ws.getRow(2).height = 28;

  ['Categoria', 'Total (R$)', 'Ocorrências', '% do Total'].forEach((h, i) =>
    colHeader(ws.getRow(2).getCell(i + 1), h));

  const cats       = resultado.por_categoria || [];
  const grandTotal = cats.reduce((s, c) => s + (c.total || 0), 0);

  cats.forEach((cat, idx) => {
    const r   = idx + 3;
    const alt = idx % 2 !== 0;
    const pct = grandTotal > 0 ? `${((cat.total / grandTotal) * 100).toFixed(1)}%` : '0%';
    const row = ws.getRow(r);
    row.height = 22;
    dataRow(row.getCell(1), cat.categoria,     alt);
    dataRow(row.getCell(2), cat.total || 0,    alt, { currency: true, red: true, bold: true });
    dataRow(row.getCell(3), cat.ocorrencias,   alt, { center: true });
    dataRow(row.getCell(4), pct,               alt, { center: true });
  });

  const tr = cats.length + 3;
  totalRow(ws, tr, 1, 2, 'TOTAL GERAL', grandTotal);
  ws.getRow(tr).getCell(4).value = '100%';
  ws.getRow(tr).getCell(4).font  = { name: FONT_BASE, bold: true, color: { argb: `FF${C.branco}` } };
  ws.getRow(tr).getCell(4).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.marrom}` } };
  ws.getRow(tr).getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(tr).height = 24;
}

// ─── Aba 4: Linha do Tempo ────────────────────────────────────────────────────
function buildTimelineSheet(wb: ExcelJS.Workbook, resultado: AnaliseResultado) {
  const ws = wb.addWorksheet('Linha do Tempo', { properties: { tabColor: { argb: `FF${C.marromMed}` } } });
  ws.columns = [{ width: 16 }, { width: 22 }, { width: 18 }];

  headerFill(ws, 1, 1, 3, 'LINHA DO TEMPO DE COBRANÇAS', 13);
  ws.getRow(1).height = 30;
  ws.getRow(2).height = 28;

  ['Mês/Ano', 'Total Cobrado (R$)', 'Qtd. Ocorrências'].forEach((h, i) =>
    colHeader(ws.getRow(2).getCell(i + 1), h));

  const map = new Map<string, { total: number; count: number }>();
  (resultado.cobrancas_indevidas || []).forEach((c) => {
    const m = (c.data || '').substring(0, 7);
    if (!m) return;
    const ex = map.get(m) || { total: 0, count: 0 };
    map.set(m, { total: ex.total + (c.valor_total || 0), count: ex.count + (c.quantidade_ocorrencias || 1) });
  });

  const entries = Array.from(map.entries()).sort();
  entries.forEach(([mes, d], idx) => {
    const r   = idx + 3;
    const alt = idx % 2 !== 0;
    const row = ws.getRow(r);
    row.height = 22;
    dataRow(row.getCell(1), mes,     alt, { center: true });
    dataRow(row.getCell(2), d.total, alt, { currency: true, red: true, bold: true });
    dataRow(row.getCell(3), d.count, alt, { center: true });
  });

  const tr   = entries.length + 3;
  const soma = entries.reduce((s, [, d]) => s + d.total, 0);
  totalRow(ws, tr, 1, 2, 'TOTAL', soma);
  ws.getRow(tr).height = 24;
}

// ─── Exportar ─────────────────────────────────────────────────────────────────
export async function gerarLaudoExcel(resultado: AnaliseResultado, config: AnaliseConfig): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Bentes Ramos Advocacia';
  wb.created  = new Date();
  wb.modified = new Date();

  buildResumoSheet(wb, resultado, config);
  buildCobrancasSheet(wb, resultado);
  buildCategoriaSheet(wb, resultado);
  buildTimelineSheet(wb, resultado);

  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const banco = (resultado.resumo.banco || 'banco').replace(/[^a-zA-Z0-9]/g, '_');
  const data  = new Date().toISOString().slice(0, 10);
  saveAs(blob, `Laudo_Extratos_${banco}_${data}.xlsx`);
}
