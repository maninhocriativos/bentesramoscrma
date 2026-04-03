import jsPDF from "jspdf";
import type { AnaliseConfig, AnaliseResultado } from "@/types/extratos";

const COR = {
  marrom: [114, 76, 50] as [number, number, number],
  marromClaro: [160, 110, 75] as [number, number, number],
  marromEscuro: [55, 30, 10] as [number, number, number],
  bege: [245, 244, 240] as [number, number, number],
  begeEscuro: [220, 215, 205] as [number, number, number],
  dourado: [180, 140, 55] as [number, number, number],
  douradoClaro: [250, 240, 200] as [number, number, number],
  vermelho: [160, 30, 30] as [number, number, number],
  vermelhoClaro: [250, 220, 220] as [number, number, number],
  verde: [30, 110, 55] as [number, number, number],
  verdeClaro: [210, 240, 220] as [number, number, number],
  cinzaEscuro: [55, 50, 45] as [number, number, number],
  cinzaMedio: [130, 120, 110] as [number, number, number],
  cinzaClaro: [235, 230, 222] as [number, number, number],
  branco: [255, 255, 255] as [number, number, number],
};

export function gerarLaudoPdf(resultado: AnaliseResultado, config: AnaliseConfig) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { resumo, cobrancas_indevidas, por_categoria, recomendacao } = resultado;
  const now = new Date();
  const laudoNum = `LAU-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const PW = 210;
  const ML = 15;
  const MR = 15;
  const CW = PW - ML - MR;
  let y = 0;

  // ── helpers ────────────────────────────────────────────────────
  const sf = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const sd = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
  const st = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const lw = (n: number) => doc.setLineWidth(n);
  const fn = (size: number, style: "normal" | "bold" = "normal") => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
  };
  const fmt = (v: number) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const hLine = (yy: number, color: [number, number, number], thickness = 0.4) => {
    sd(color);
    lw(thickness);
    doc.line(ML, yy, ML + CW, yy);
  };

  // ── cabeçalho e rodapé de página ──────────────────────────────
  const drawHeader = () => {
    sf(COR.marromEscuro);
    doc.rect(0, 0, PW, 14, "F");
    sf(COR.dourado);
    doc.rect(0, 14, PW, 0.8, "F");
    sf(COR.marrom);
    doc.rect(0, 14.8, PW, 0.3, "F");
    fn(8, "bold");
    st(COR.dourado);
    doc.text("BENTES RAMOS  —  ADVOCACIA E CONSULTORIA JURÍDICA", ML, 9);
    fn(7);
    st(COR.cinzaClaro);
    doc.text(`Laudo nº ${laudoNum}`, PW - MR, 9, { align: "right" });
    y = 22;
  };

  const drawFooter = () => {
    const pg = (doc as any).internal.getCurrentPageInfo().pageNumber;
    sf(COR.marromEscuro);
    doc.rect(0, 284, PW, 13, "F");
    sf(COR.dourado);
    doc.rect(0, 283.5, PW, 0.8, "F");
    fn(7);
    st(COR.cinzaClaro);
    doc.text("Documento de uso exclusivo — Sistema CRM Bentes Ramos", ML, 291);
    doc.text(`Página ${pg}`, PW - MR, 291, { align: "right" });
  };

  const addPage = () => {
    doc.addPage();
    y = 15;
    drawHeader();
    drawFooter();
  };

  const chk = (n: number) => {
    if (y + n > 272) addPage();
  };

  // ── título de seção ───────────────────────────────────────────
  const sectionTitle = (title: string, num: string) => {
    chk(16);
    sf(COR.marromEscuro);
    doc.rect(ML, y, CW, 10, "F");
    sf(COR.dourado);
    doc.rect(ML, y, 3, 10, "F");
    sf(COR.marrom);
    doc.rect(ML + 3, y, CW - 3, 10, "F");
    fn(9, "bold");
    st(COR.bege);
    doc.text(`${num}  ${title.toUpperCase()}`, ML + 8, y + 6.8);
    y += 14;
  };

  // ── card com texto quebrado ───────────────────────────────────
  const drawCard = (
    x: number,
    yy: number,
    w: number,
    h: number,
    bg: [number, number, number],
    label: string,
    value: string,
    lc: [number, number, number],
    vc: [number, number, number],
  ) => {
    sf(bg);
    sd(COR.begeEscuro);
    lw(0.3);
    doc.roundedRect(x, yy, w, h, 2.5, 2.5, "FD");
    // topo colorido
    sf(COR.marrom);
    doc.roundedRect(x, yy, w, 2, 2.5, 2.5, "F");
    doc.rect(x, yy + 1, w, 1.5, "F");
    // label
    fn(6.5);
    st(lc);
    doc.text(label, x + w / 2, yy + 8, { align: "center" });
    // value (quebrado)
    fn(9, "bold");
    st(vc);
    const lines = doc.splitTextToSize(value, w - 8);
    lines.slice(0, 3).forEach((l: string, i: number) => {
      doc.text(l, x + w / 2, yy + 15 + i * 5.5, { align: "center" });
    });
  };

  // ── linha de tabela ───────────────────────────────────────────
  const tableRow = (
    cols: string[],
    widths: number[],
    ry: number,
    bg: [number, number, number],
    tc: [number, number, number],
    bold = false,
  ) => {
    sf(bg);
    doc.rect(ML, ry, CW, 7.5, "F");
    fn(8, bold ? "bold" : "normal");
    st(tc);
    let x = ML + 2;
    cols.forEach((col, i) => {
      const lines = doc.splitTextToSize(col, widths[i] - 3);
      doc.text(lines[0], x, ry + 5);
      x += widths[i];
    });
  };

  // ── badge colorido ────────────────────────────────────────────
  const badge = (label: string, x: number, yy: number, bg: [number, number, number], tc: [number, number, number]) => {
    sf(bg);
    sd(tc);
    lw(0.3);
    doc.roundedRect(x, yy, 32, 5.5, 1.5, 1.5, "FD");
    fn(6.5, "bold");
    st(tc);
    doc.text(label.toUpperCase(), x + 16, yy + 3.8, { align: "center" });
  };

  // ════════════════════════════════════════════════════════════
  // CAPA
  // ════════════════════════════════════════════════════════════

  // fundo geral bege
  sf(COR.bege);
  doc.rect(0, 0, PW, 297, "F");

  // topo escuro
  sf(COR.marromEscuro);
  doc.rect(0, 0, PW, 85, "F");

  // linhas douradas decorativas
  sf(COR.dourado);
  doc.rect(0, 85, PW, 1.5, "F");
  sf(COR.marromClaro);
  doc.rect(0, 86.5, PW, 0.4, "F");

  // monograma BR simulado — retângulo dourado
  sf(COR.dourado);
  sd(COR.marromClaro);
  lw(0.5);
  doc.roundedRect(PW / 2 - 14, 12, 28, 22, 1, 1, "FD");
  sf(COR.marromEscuro);
  doc.roundedRect(PW / 2 - 12, 14, 24, 18, 0.5, 0.5, "F");
  fn(14, "bold");
  st(COR.dourado);
  doc.text("BR", PW / 2, 25.5, { align: "center" });

  // nome do escritório
  fn(11, "bold");
  st(COR.dourado);
  doc.text("BENTES RAMOS", PW / 2, 42, { align: "center" });
  fn(7);
  st(COR.begeEscuro);
  doc.text("ADVOCACIA E CONSULTORIA JURÍDICA", PW / 2, 49, { align: "center" });

  // linha divisória dourada fina
  sf(COR.dourado);
  doc.rect(PW / 2 - 25, 53, 50, 0.5, "F");

  // título do laudo
  fn(19, "bold");
  st(COR.bege);
  doc.text("LAUDO DE ANÁLISE", PW / 2, 63, { align: "center" });
  fn(10, "bold");
  st(COR.marromClaro);
  doc.text("COBRANÇAS BANCÁRIAS INDEVIDAS", PW / 2, 71, { align: "center" });

  // linha dourada
  sf(COR.dourado);
  doc.rect(PW / 2 - 30, 75.5, 60, 0.5, "F");

  // caixa dados cliente
  sf(COR.branco);
  sd(COR.begeEscuro);
  lw(0.4);
  doc.roundedRect(ML, 93, CW, 58, 3, 3, "FD");
  // header da caixa
  sf(COR.marrom);
  doc.roundedRect(ML, 93, CW, 9, 3, 3, "F");
  doc.rect(ML, 98, CW, 4, "F");
  fn(8, "bold");
  st(COR.bege);
  doc.text("IDENTIFICAÇÃO DO CLIENTE", ML + 4, 98.5);
  sd(COR.dourado);
  lw(0.3);
  doc.line(ML, 102, ML + CW, 102);

  const dadosCapa = [
    ["Cliente", config.nomeCliente || "Não informado"],
    ["CPF", config.cpf || "Não informado"],
    ["Banco", config.banco || "Não informado"],
    ["Período", `${config.dataInicial || "N/D"} a ${config.dataFinal || "N/D"}`],
    ["Contrato", config.numeroContrato || "Não informado"],
  ];
  let yd = 108;
  dadosCapa.forEach(([lbl, val], i) => {
    if (i % 2 === 0) {
      sf(COR.bege);
      doc.rect(ML + 0.5, yd - 3.5, CW - 1, 9, "F");
    }
    fn(7.5, "bold");
    st(COR.marrom);
    doc.text(`${lbl}:`, ML + 4, yd + 1);
    fn(8);
    st(COR.cinzaEscuro);
    doc.text(val, ML + 36, yd + 1);
    yd += 9.5;
  });

  // cards resumo capa
  const cw3 = (CW - 6) / 3;
  const cardY = 160;
  drawCard(
    ML,
    cardY,
    cw3,
    28,
    COR.bege,
    "LANÇAMENTOS ANALISADOS",
    String(resumo.total_lancamentos || 0),
    COR.cinzaMedio,
    COR.marromEscuro,
  );
  drawCard(
    ML + cw3 + 3,
    cardY,
    cw3,
    28,
    COR.vermelhoClaro,
    "IRREGULARIDADES",
    String(resumo.irregularidades_encontradas || 0),
    COR.vermelho,
    COR.vermelho,
  );
  drawCard(
    ML + (cw3 + 3) * 2,
    cardY,
    cw3,
    28,
    COR.verdeClaro,
    "VALOR A RECUPERAR",
    fmt(resumo.valor_total_indevido),
    COR.verde,
    COR.verde,
  );

  // badge prioridade
  const prio = (recomendacao?.prioridade || "media").toLowerCase();
  const prioCor: [number, number, number] = prio === "alta" ? COR.vermelho : prio === "media" ? COR.dourado : COR.verde;
  const prioBg: [number, number, number] =
    prio === "alta" ? COR.vermelhoClaro : prio === "media" ? COR.douradoClaro : COR.verdeClaro;
  sf(prioBg);
  sd(prioCor);
  lw(0.5);
  doc.roundedRect(ML, 197, CW, 12, 2, 2, "FD");
  sf(prioCor);
  doc.rect(ML, 197, 3, 12, "F");
  fn(9, "bold");
  st(prioCor);
  doc.text(`PRIORIDADE: ${prio.toUpperCase()}`, PW / 2, 204.5, { align: "center" });

  // data e número
  fn(7.5);
  st(COR.cinzaMedio);
  doc.text(`Emitido em ${now.toLocaleDateString("pt-BR")}  ·  Laudo nº ${laudoNum}`, PW / 2, 218, { align: "center" });

  // rodapé capa
  sf(COR.marromEscuro);
  doc.rect(0, 280, PW, 17, "F");
  sf(COR.dourado);
  doc.rect(0, 279.5, PW, 0.8, "F");
  fn(7);
  st(COR.cinzaClaro);
  doc.text("Documento de uso exclusivo — Sistema CRM Bentes Ramos", PW / 2, 290, { align: "center" });

  // ════════════════════════════════════════════════════════════
  // PÁG 1 — IDENTIFICAÇÃO
  // ════════════════════════════════════════════════════════════
  addPage();
  sectionTitle("Identificação do Cliente e do Caso", "1.");

  const dadosId = [
    ["Nome Completo", config.nomeCliente || "Não informado"],
    ["CPF", config.cpf || "Não informado"],
    ["Nº do Contrato", config.numeroContrato || "Não informado"],
    ["Banco Analisado", config.banco || "Não informado"],
    ["Período", `${config.dataInicial || "N/D"} a ${config.dataFinal || "N/D"}`],
    ["Arquivos", `${config.arquivos?.length || 0} arquivo(s) enviado(s)`],
    ["Data da Análise", now.toLocaleDateString("pt-BR")],
    ["Número do Laudo", laudoNum],
  ];

  dadosId.forEach((row, i) => {
    const bg: [number, number, number] = i % 2 === 0 ? COR.bege : COR.branco;
    sf(bg);
    doc.rect(ML, y, CW, 9, "F");
    sf(COR.dourado);
    doc.rect(ML, y, 2.5, 9, "F");
    fn(8, "bold");
    st(COR.marrom);
    doc.text(row[0], ML + 6, y + 6);
    fn(8);
    st(COR.cinzaEscuro);
    doc.text(row[1], ML + 70, y + 6);
    y += 9;
  });

  // ════════════════════════════════════════════════════════════
  // PÁG 2 — RESUMO EXECUTIVO
  // ════════════════════════════════════════════════════════════
  addPage();
  sectionTitle("Resumo Executivo", "2.");

  const cw2 = (CW - 6) / 3;
  drawCard(
    ML,
    y,
    cw2,
    28,
    COR.bege,
    "LANÇAMENTOS ANALISADOS",
    String(resumo.total_lancamentos || 0),
    COR.cinzaMedio,
    COR.marromEscuro,
  );
  drawCard(
    ML + cw2 + 3,
    y,
    cw2,
    28,
    COR.vermelhoClaro,
    "IRREGULARIDADES",
    String(resumo.irregularidades_encontradas || 0),
    COR.vermelho,
    COR.vermelho,
  );
  drawCard(
    ML + (cw2 + 3) * 2,
    y,
    cw2,
    28,
    COR.verdeClaro,
    "VALOR A RECUPERAR",
    fmt(resumo.valor_total_indevido),
    COR.verde,
    COR.verde,
  );
  y += 34;

  // período
  sf(COR.bege);
  sd(COR.begeEscuro);
  lw(0.3);
  doc.roundedRect(ML, y, CW, 11, 2, 2, "FD");
  sf(COR.dourado);
  doc.rect(ML, y, 2.5, 11, "F");
  fn(8, "bold");
  st(COR.marrom);
  doc.text("Período analisado:", ML + 6, y + 7);
  fn(8);
  st(COR.cinzaEscuro);
  doc.text(resumo.periodo_analisado || `${config.dataInicial} a ${config.dataFinal}`, ML + 50, y + 7);
  y += 17;

  // por categoria
  if (por_categoria?.length) {
    sectionTitle("Cobranças por Categoria", "2.1");
    const wCat = [98, 30, 52];
    tableRow(["Categoria", "Ocorrências", "Total Cobrado"], wCat, y, COR.marromEscuro, COR.bege, true);
    y += 7.5;
    por_categoria.forEach((cat, i) => {
      chk(8);
      tableRow(
        [cat.categoria || "N/D", String(cat.ocorrencias || 0), fmt(cat.total)],
        wCat,
        y,
        i % 2 === 0 ? COR.bege : COR.branco,
        COR.cinzaEscuro,
      );
      y += 7.5;
    });
    chk(8);
    sf(COR.marrom);
    doc.rect(ML, y, CW, 8, "F");
    fn(8, "bold");
    st(COR.bege);
    const totOc = por_categoria.reduce((s, c) => s + (c.ocorrencias || 0), 0);
    let xTot = ML + 2;
    [
      ["TOTAL GERAL", 98],
      [String(totOc), 30],
      [fmt(resumo.valor_total_indevido), 52],
    ].forEach(([txt, w]) => {
      doc.text(String(txt), xTot, y + 5.5);
      xTot += Number(w);
    });
    y += 13;
  }

  // ════════════════════════════════════════════════════════════
  // PÁG(S) — DETALHAMENTO
  // ════════════════════════════════════════════════════════════
  addPage();
  sectionTitle("Detalhamento das Cobranças Indevidas", "3.");

  if (cobrancas_indevidas?.length) {
    const wDet = [10, 22, 64, 14, 28, 32];
    tableRow(["#", "Data", "Descrição", "Qtd", "Unit.", "Total"], wDet, y, COR.marromEscuro, COR.bege, true);
    y += 7.5;

    cobrancas_indevidas.forEach((c, i) => {
      chk(32);
      const bg: [number, number, number] = i % 2 === 0 ? COR.bege : COR.branco;
      tableRow(
        [
          String(i + 1),
          c.data || "N/D",
          c.descricao || "N/D",
          String(c.quantidade_ocorrencias || 1),
          fmt(c.valor_unitario || 0),
          fmt(c.valor_total || c.valor_unitario || 0),
        ],
        wDet,
        y,
        bg,
        COR.cinzaEscuro,
      );
      y += 7.5;

      // detalhe expandido
      chk(20);
      sf(i % 2 === 0 ? COR.cinzaClaro : COR.begeEscuro);
      doc.rect(ML, y, CW, 19, "F");
      sf(COR.dourado);
      doc.rect(ML, y, 1.5, 19, "F");

      // badge status
      const stCor: [number, number, number] =
        c.status === "confirmado" ? COR.verde : c.status === "indicio" ? COR.dourado : COR.cinzaMedio;
      const stBg: [number, number, number] =
        c.status === "confirmado" ? COR.verdeClaro : c.status === "indicio" ? COR.douradoClaro : COR.cinzaClaro;
      badge(c.status || "verificar", ML + 3, y + 2, stBg, stCor);

      fn(7);
      st(COR.cinzaMedio);
      doc.text(`Categoria: ${c.categoria || "N/D"}`, ML + 38, y + 5.5);

      fn(7, "bold");
      st(COR.marrom);
      const bl = doc.splitTextToSize(`Base Legal: ${c.base_legal || "N/D"}`, CW - 6);
      doc.text(bl[0], ML + 3, y + 11);

      fn(7);
      st(COR.cinzaEscuro);
      const jl = doc.splitTextToSize(`Justificativa: ${c.justificativa || "N/D"}`, CW - 6);
      doc.text(jl[0], ML + 3, y + 16.5);

      y += 21;
      hLine(y, COR.begeEscuro, 0.2);
      y += 2;
    });

    // total geral
    chk(13);
    y += 2;
    sf(COR.verdeClaro);
    sd(COR.verde);
    lw(0.4);
    doc.roundedRect(ML, y, CW, 12, 2, 2, "FD");
    sf(COR.verde);
    doc.rect(ML, y, 3, 12, "F");
    fn(9, "bold");
    st(COR.verde);
    doc.text("TOTAL DE COBRANÇAS INDEVIDAS IDENTIFICADAS:", ML + 7, y + 7.8);
    doc.text(fmt(resumo.valor_total_indevido), ML + CW - 3, y + 7.8, { align: "right" });
    y += 16;
  }

  // ════════════════════════════════════════════════════════════
  // PÁG FINAL — RECOMENDAÇÃO JURÍDICA
  // ════════════════════════════════════════════════════════════
  addPage();
  sectionTitle("Recomendação Jurídica", "4.");

  if (recomendacao) {
    const cw4 = (CW - 3) / 2;
    const cardH = 32;

    drawCard(
      ML,
      y,
      cw4,
      cardH,
      COR.bege,
      "TIPO DE AÇÃO RECOMENDADA",
      recomendacao.tipo_acao || "N/D",
      COR.cinzaMedio,
      COR.marromEscuro,
    );

    const p2Cor: [number, number, number] = prio === "alta" ? COR.vermelho : prio === "media" ? COR.dourado : COR.verde;
    const p2Bg: [number, number, number] =
      prio === "alta" ? COR.vermelhoClaro : prio === "media" ? COR.douradoClaro : COR.verdeClaro;
    drawCard(ML + cw4 + 3, y, cw4, cardH, p2Bg, "PRIORIDADE", prio.toUpperCase(), p2Cor, p2Cor);
    y += cardH + 6;

    drawCard(
      ML,
      y,
      cw4,
      cardH,
      COR.verdeClaro,
      "ESTIMATIVA DE RECUPERAÇÃO",
      fmt(recomendacao.estimativa_recuperacao),
      COR.verde,
      COR.verde,
    );
    drawCard(
      ML + cw4 + 3,
      y,
      cw4,
      cardH,
      COR.douradoClaro,
      "PRAZO PRESCRICIONAL",
      recomendacao.prazo_prescricional || "N/D",
      COR.dourado,
      COR.cinzaEscuro,
    );
    y += cardH + 8;

    // fundamentação
    chk(16);
    sf(COR.marromEscuro);
    doc.rect(ML, y, CW, 9, "F");
    sf(COR.dourado);
    doc.rect(ML, y, 3, 9, "F");
    sf(COR.marrom);
    doc.rect(ML + 3, y, CW - 3, 9, "F");
    fn(8, "bold");
    st(COR.bege);
    doc.text("FUNDAMENTAÇÃO LEGAL", ML + 8, y + 6);
    y += 12;

    sf(COR.branco);
    sd(COR.begeEscuro);
    lw(0.3);
    doc.roundedRect(ML, y, CW, 4, 2, 2, "F");
    fn(8);
    st(COR.cinzaEscuro);
    const fundLines = doc.splitTextToSize(recomendacao.fundamentacao || "", CW - 6);
    const fundH = Math.max(fundLines.length * 5.5 + 6, 20);
    sf(COR.branco);
    sd(COR.begeEscuro);
    lw(0.3);
    doc.roundedRect(ML, y, CW, fundH, 2, 2, "FD");
    sf(COR.dourado);
    doc.rect(ML, y, 2, fundH, "F");
    fundLines.forEach((l: string, i: number) => {
      chk(6);
      doc.text(l, ML + 6, y + 6 + i * 5.5);
    });
    y += fundH + 8;

    // aviso legal
    chk(30);
    sf(COR.douradoClaro);
    sd(COR.dourado);
    lw(0.5);
    doc.roundedRect(ML, y, CW, 28, 2, 2, "FD");
    sf(COR.dourado);
    doc.rect(ML, y, 3, 28, "F");
    fn(7.5, "bold");
    st(COR.marrom);
    doc.text("⚠  AVISO LEGAL", ML + 7, y + 6.5);
    fn(7.5);
    st(COR.cinzaEscuro);
    const aviso = doc.splitTextToSize(
      "Este laudo é um documento técnico de análise preliminar gerado pelo Sistema CRM Bentes Ramos. " +
        "As cobranças identificadas carecem de análise jurídica aprofundada por advogado habilitado " +
        "antes de qualquer medida judicial ou extrajudicial. Os valores estimados são baseados nos " +
        "documentos fornecidos e podem ser revistos após análise completa do caso.",
      CW - 12,
    );
    aviso.forEach((l: string, i: number) => {
      doc.text(l, ML + 7, y + 13 + i * 5);
    });
    y += 34;
  }

  // assinatura
  chk(28);
  y += 4;
  sf(COR.bege);
  sd(COR.begeEscuro);
  lw(0.3);
  doc.roundedRect(ML, y, CW, 22, 2, 2, "FD");
  sf(COR.dourado);
  doc.rect(ML + 30, y, CW - 60, 0.5, "F");
  fn(9, "bold");
  st(COR.marromEscuro);
  doc.text("BENTES RAMOS", PW / 2, y + 9, { align: "center" });
  fn(7);
  st(COR.marromClaro);
  doc.text("ADVOCACIA E CONSULTORIA JURÍDICA — MANAUS/AM", PW / 2, y + 15, { align: "center" });
  fn(7);
  st(COR.cinzaMedio);
  doc.text(`Emitido em ${now.toLocaleString("pt-BR")} — Laudo nº ${laudoNum}`, PW / 2, y + 20, { align: "center" });

  doc.save(`Laudo_${config.banco}_${laudoNum}.pdf`);
}
