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

// Converte uma data "DD/MM/AAAA" (ou ISO "AAAA-MM-DD") numa chave ordenável "AAAA-MM".
function mesAnoKey(data: string): string {
  const s = (data || '').trim();
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);   // DD/MM/AAAA
  if (br) {
    const yyyy = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${yyyy}-${br[2]}`;
  }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);       // AAAA-MM-DD
  if (iso) return `${iso[1]}-${iso[2]}`;
  return '';
}

// "AAAA-MM" → "MM/AAAA" para exibição.
function mesAnoLabel(key: string): string {
  const [y, m] = key.split('-');
  return y && m ? `${m}/${y}` : key;
}

// Deriva o período (ex.: "05/2022 a 09/2025") a partir das próprias cobranças,
// usado quando o usuário não informou o período no formulário.
function periodoDasCobrancas(resultado: AnaliseResultado): string {
  const keys = (resultado.cobrancas_indevidas || [])
    .map((c) => mesAnoKey(c.data || ''))
    .filter(Boolean)
    .sort();
  if (!keys.length) return '';
  const ini = mesAnoLabel(keys[0]);
  const fim = mesAnoLabel(keys[keys.length - 1]);
  return ini === fim ? ini : `${ini} a ${fim}`;
}

// Período "humano": usa o informado; senão deriva das cobranças.
function periodoExibicao(resultado: AnaliseResultado): string {
  const p = (resultado.resumo.periodo_analisado || '').trim();
  if (p && !/não informado/i.test(p)) return p;
  return periodoDasCobrancas(resultado) || 'Não informado';
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
  ws.views = [{ showGridLines: false }];

  const periodo   = periodoExibicao(resultado);
  const emissao   = new Date().toLocaleDateString('pt-BR');

  // Título principal
  headerFill(ws, 1, 1, 6, 'CONFERÊNCIA DE EXTRATOS — BENTES RAMOS ADVOCACIA', 14);
  ws.getRow(1).height = 36;

  subHeader(ws, 2, 1, 6,
    `Banco: ${resultado.resumo.banco}   |   Cliente: ${config.nomeCliente || 'N/D'}   |   Período: ${periodo}   |   Emitido em: ${emissao}`);
  ws.getRow(2).height = 22;

  ws.getRow(3).height = 8;

  // Seção: dados da análise
  headerFill(ws, 4, 1, 6, 'RESUMO DA ANÁLISE', 12);
  ws.getRow(4).height = 26;

  const dados = [
    ['Lançamentos Analisados',      resultado.resumo.total_lancamentos,           false],
    ['Irregularidades Encontradas',  resultado.resumo.irregularidades_encontradas, false],
    ['Valor Total Indevido',         resultado.resumo.valor_total_indevido,        true ],
    ['Período Analisado',            periodo,                                       false],
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

// ─── Aba 2: Cobranças Indevidas (detalhamento INDIVIDUAL, item a item) ─────────
function buildCobrancasSheet(wb: ExcelJS.Workbook, resultado: AnaliseResultado) {
  const ws = wb.addWorksheet('Cobranças Indevidas', { properties: { tabColor: { argb: `FF${C.vermelho}` } } });
  ws.columns = [
    { width: 6 }, { width: 13 }, { width: 40 }, { width: 16 },
    { width: 22 }, { width: 14 }, { width: 30 }, { width: 60 },
  ];

  headerFill(ws, 1, 1, 8, 'COBRANÇAS INDEVIDAS — ANÁLISE INDIVIDUAL ITEM A ITEM', 13);
  ws.getRow(1).height = 32;
  ws.getRow(2).height = 36;

  const hdrs = ['#', 'Data', 'Descrição', 'Valor (R$)', 'Categoria', 'Status', 'Base Legal', 'Análise Individual'];
  hdrs.forEach((h, i) => colHeader(ws.getRow(2).getCell(i + 1), h));

  // Congelar cabeçalho + layout limpo
  ws.views = [{ state: 'frozen', ySplit: 2, showGridLines: false }];

  const cobrancas = resultado.cobrancas_indevidas || [];
  cobrancas.forEach((c, idx) => {
    const r    = idx + 3;
    const alt  = idx % 2 !== 0;
    const row  = ws.getRow(r);
    row.height = 42;

    dataRow(row.getCell(1), idx + 1,                                alt, { center: true });
    dataRow(row.getCell(2), c.data,                                 alt);
    dataRow(row.getCell(3), c.descricao,                            alt, { wrap: true });
    dataRow(row.getCell(4), c.valor_total || c.valor_unitario || 0, alt, { currency: true, red: true, bold: true });
    dataRow(row.getCell(5), c.categoria,                            alt);
    dataRow(row.getCell(6), c.status,                               alt, { bold: true, color: corStatus(c.status) });
    dataRow(row.getCell(7), c.base_legal,                           alt, { wrap: true });
    dataRow(row.getCell(8), c.justificativa,                        alt, { wrap: true });
  });

  // Linha de total (soma simples de todos os itens — não é agrupamento por categoria)
  const totalRow_ = cobrancas.length + 3;
  const total = cobrancas.reduce((s, c) => s + (c.valor_total || c.valor_unitario || 0), 0);
  totalRow(ws, totalRow_, 1, 4, 'TOTAL GERAL', total);
  ws.getRow(totalRow_).height = 24;

  // Auto filtro nas colunas
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 8 } };
}

// ─── Exportar ─────────────────────────────────────────────────────────────────
export async function gerarLaudoExcel(resultado: AnaliseResultado, config: AnaliseConfig): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Bentes Ramos Advocacia';
  wb.created  = new Date();
  wb.modified = new Date();

  buildResumoSheet(wb, resultado, config);
  buildCobrancasSheet(wb, resultado);

  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const banco = (resultado.resumo.banco || 'banco').replace(/[^a-zA-Z0-9]/g, '_');
  const data  = new Date().toISOString().slice(0, 10);
  saveAs(blob, `Laudo_Extratos_${banco}_${data}.xlsx`);
}
