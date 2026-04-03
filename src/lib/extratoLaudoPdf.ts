import jsPDF from "jspdf";
import type { AnaliseConfig, AnaliseResultado } from "@/types/extratos";

// ── Paleta de cores ──────────────────────────────────────────────
const COR = {
  azulEscuro: [15, 40, 80] as [number, number, number],
  azulMedio: [30, 80, 160] as [number, number, number],
  azulClaro: [220, 232, 250] as [number, number, number],
  vermelho: [180, 30, 30] as [number, number, number],
  vermelhoClaro: [250, 220, 220] as [number, number, number],
  verde: [20, 120, 60] as [number, number, number],
  verdeClaro: [210, 240, 220] as [number, number, number],
  amarelo: [200, 150, 20] as [number, number, number],
  amareloClaro: [255, 245, 210] as [number, number, number],
  cinzaEscuro: [60, 60, 60] as [number, number, number],
  cinzaMedio: [120, 120, 120] as [number, number, number],
  cinzaClaro: [240, 240, 240] as [number, number, number],
  branco: [255, 255, 255] as [number, number, number],
  preto: [20, 20, 20] as [number, number, number],
};

export function gerarLaudoPdf(resultado: AnaliseResultado, config: AnaliseConfig) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { resumo, cobrancas_indevidas, por_categoria, recomendacao } = resultado;
  const now = new Date();
  const laudoNum = `LAU-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const PW = 210; // page width mm
  const ML = 15; // margin left
  const MR = 15; // margin right
  const CW = PW - ML - MR; // content width
  let y = 0;

  // ── Helpers ─────────────────────────────────────────────────────
  const rgb = (c: [number, number, number]) => ({ r: c[0], g: c[1], b: c[2] });

  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
  const setTxt = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFont = (size: number, style: "normal" | "bold" = "normal") => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
  };

  const addPage = () => {
    doc.addPage();
    y = 15;
    drawPageHeader();
    drawPageFooter();
  };

  const checkPage = (needed: number) => {
    if (y + needed > 270) addPage();
  };

  const fmt = (v: number) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  // ── Cabeçalho de página interno ─────────────────────────────────
  const drawPageHeader = () => {
    setFill(COR.azulEscuro);
    doc.rect(0, 0, PW, 12, "F");
    setFont(8, "bold");
    setTxt(COR.branco);
    doc.text("BENTES & RAMOS ADVOGADOS", ML, 7.5);
    doc.text(`Laudo nº ${laudoNum}`, PW - MR, 7.5, { align: "right" });
    y = 18;
  };

  // ── Rodapé de página ────────────────────────────────────────────
  const drawPageFooter = () => {
    const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
    setFill(COR.cinzaClaro);
    doc.rect(0, 285, PW, 12, "F");
    setFont(7);
    setTxt(COR.cinzaMedio);
    doc.text("Documento gerado pelo Sistema CRM Bentes & Ramos — Uso restrito", ML, 291);
    doc.text(`Página ${pageNum}`, PW - MR, 291, { align: "right" });
  };

  // ── Seção com título ────────────────────────────────────────────
  const drawSectionTitle = (titulo: string, num: string) => {
    checkPage(16);
    setFill(COR.azulMedio);
    doc.rect(ML, y, CW, 9, "F");
    setFont(10, "bold");
    setTxt(COR.branco);
    doc.text(`${num}  ${titulo.toUpperCase()}`, ML + 4, y + 6.2);
    y += 13;
  };

  // ── Card colorido ───────────────────────────────────────────────
  const drawCard = (
    x: number,
    yPos: number,
    w: number,
    h: number,
    bgColor: [number, number, number],
    label: string,
    value: string,
    labelColor: [number, number, number],
    valueColor: [number, number, number],
  ) => {
    setFill(bgColor);
    setDraw(COR.cinzaClaro);
    doc.roundedRect(x, yPos, w, h, 2, 2, "FD");
    setFont(7);
    setTxt(labelColor);
    doc.text(label, x + w / 2, yPos + 5.5, { align: "center" });
    setFont(10, "bold");
    setTxt(valueColor);
    doc.text(value, x + w / 2, yPos + 11.5, { align: "center" });
  };

  // ── Linha de tabela ─────────────────────────────────────────────
  const drawTableRow = (
    cols: string[],
    widths: number[],
    rowY: number,
    bg: [number, number, number],
    txtColor: [number, number, number],
    bold = false,
  ) => {
    setFill(bg);
    doc.rect(ML, rowY, CW, 7, "F");
    setFont(8, bold ? "bold" : "normal");
    setTxt(txtColor);
    let x = ML + 2;
    cols.forEach((col, i) => {
      const maxW = widths[i] - 4;
      const lines = doc.splitTextToSize(col, maxW);
      doc.text(lines[0], x, rowY + 4.8);
      x += widths[i];
    });
  };

  // ════════════════════════════════════════════════════════════════
  // CAPA
  // ════════════════════════════════════════════════════════════════
  // Fundo azul escuro superior
  setFill(COR.azulEscuro);
  doc.rect(0, 0, PW, 80, "F");

  // Logo / nome do escritório
  setFont(9, "bold");
  setTxt(COR.azulClaro);
  doc.text("BENTES & RAMOS ADVOGADOS", PW / 2, 22, { align: "center" });

  setFont(7);
  setTxt(COR.cinzaClaro);
  doc.text("Direito do Consumidor — Manaus/AM", PW / 2, 28, { align: "center" });

  // Linha decorativa
  setFill(COR.azulMedio);
  doc.rect(ML, 33, CW, 1.5, "F");

  // Título do laudo
  setFont(22, "bold");
  setTxt(COR.branco);
  doc.text("LAUDO DE ANÁLISE", PW / 2, 50, { align: "center" });
  setFont(14, "bold");
  setTxt(COR.azulClaro);
  doc.text("DE COBRANÇAS BANCÁRIAS INDEVIDAS", PW / 2, 59, { align: "center" });

  // Caixa de identificação na capa
  setFill(COR.branco);
  doc.roundedRect(ML, 88, CW, 55, 3, 3, "F");

  setFont(9, "bold");
  setTxt(COR.azulEscuro);
  doc.text("DADOS DO CLIENTE", ML + 8, 97);

  setFont(8.5);
  setTxt(COR.cinzaEscuro);
  const dadosCapa = [
    ["Cliente", config.nomeCliente || "Não informado"],
    ["CPF", config.cpf || "Não informado"],
    ["Banco", config.banco || "Não informado"],
    ["Contrato", config.numeroContrato || "Não informado"],
    ["Período", `${config.dataInicial || "N/D"} a ${config.dataFinal || "N/D"}`],
  ];
  let yDados = 104;
  dadosCapa.forEach(([label, valor]) => {
    setFont(7.5, "bold");
    setTxt(COR.cinzaMedio);
    doc.text(`${label}:`, ML + 8, yDados);
    setFont(8.5);
    setTxt(COR.cinzaEscuro);
    doc.text(valor, ML + 35, yDados);
    yDados += 7.5;
  });

  // Cards de resumo na capa
  const cardW = (CW - 6) / 3;
  const cardY = 152;

  drawCard(
    ML,
    cardY,
    cardW,
    22,
    COR.azulClaro,
    "LANÇAMENTOS ANALISADOS",
    String(resumo.total_lancamentos || 0),
    COR.azulMedio,
    COR.azulEscuro,
  );

  drawCard(
    ML + cardW + 3,
    cardY,
    cardW,
    22,
    COR.vermelhoClaro,
    "IRREGULARIDADES",
    String(resumo.irregularidades_encontradas || 0),
    COR.vermelho,
    COR.vermelho,
  );

  drawCard(
    ML + (cardW + 3) * 2,
    cardY,
    cardW,
    22,
    COR.verdeClaro,
    "VALOR A RECUPERAR",
    fmt(resumo.valor_total_indevido),
    COR.verde,
    COR.verde,
  );

  // Prioridade na capa
  const prioridade = recomendacao?.prioridade?.toUpperCase() || "N/D";
  const priorCor: [number, number, number] =
    prioridade === "ALTA" ? COR.vermelho : prioridade === "MEDIA" ? COR.amarelo : COR.verde;
  const priorBg: [number, number, number] =
    prioridade === "ALTA" ? COR.vermelhoClaro : prioridade === "MEDIA" ? COR.amareloClaro : COR.verdeClaro;

  setFill(priorBg);
  doc.roundedRect(ML, 182, CW, 12, 2, 2, "F");
  setFont(9, "bold");
  setTxt(priorCor);
  doc.text(`PRIORIDADE: ${prioridade}`, PW / 2, 189.5, { align: "center" });

  // Data e número do laudo na capa
  setFont(8);
  setTxt(COR.cinzaMedio);
  doc.text(`Data de emissão: ${now.toLocaleDateString("pt-BR")}`, PW / 2, 205, { align: "center" });
  doc.text(`Laudo nº ${laudoNum}`, PW / 2, 212, { align: "center" });

  // Linha decorativa inferior capa
  setFill(COR.azulEscuro);
  doc.rect(0, 280, PW, 17, "F");
  setFont(7);
  setTxt(COR.azulClaro);
  doc.text("Documento de uso exclusivo — Sistema CRM Bentes & Ramos", PW / 2, 290, { align: "center" });

  // ════════════════════════════════════════════════════════════════
  // PÁGINA 1 — IDENTIFICAÇÃO
  // ════════════════════════════════════════════════════════════════
  addPage();
  drawSectionTitle("Identificação do Cliente e do Caso", "1.");

  // Tabela de dados
  const dadosId = [
    ["Nome Completo", config.nomeCliente || "Não informado"],
    ["CPF", config.cpf || "Não informado"],
    ["Número do Contrato", config.numeroContrato || "Não informado"],
    ["Banco Analisado", config.banco || "Não informado"],
    ["Período Analisado", `${config.dataInicial || "N/D"} a ${config.dataFinal || "N/D"}`],
    ["Extratos Enviados", `${config.arquivos?.length || 0} arquivo(s)`],
    ["Data da Análise", now.toLocaleDateString("pt-BR")],
    ["Número do Laudo", laudoNum],
  ];

  dadosId.forEach((row, i) => {
    const bg: [number, number, number] = i % 2 === 0 ? COR.cinzaClaro : COR.branco;
    setFill(bg);
    doc.rect(ML, y, CW, 8, "F");
    setFont(8, "bold");
    setTxt(COR.azulEscuro);
    doc.text(row[0], ML + 3, y + 5.3);
    setFont(8);
    setTxt(COR.cinzaEscuro);
    doc.text(row[1], ML + 65, y + 5.3);
    y += 8;
  });

  // ════════════════════════════════════════════════════════════════
  // PÁGINA 2 — RESUMO EXECUTIVO
  // ════════════════════════════════════════════════════════════════
  addPage();
  drawSectionTitle("Resumo Executivo", "2.");

  // Cards de resumo
  const cw2 = (CW - 6) / 3;
  drawCard(
    ML,
    y,
    cw2,
    22,
    COR.azulClaro,
    "LANÇAMENTOS ANALISADOS",
    String(resumo.total_lancamentos || 0),
    COR.azulMedio,
    COR.azulEscuro,
  );
  drawCard(
    ML + cw2 + 3,
    y,
    cw2,
    22,
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
    22,
    COR.verdeClaro,
    "VALOR A RECUPERAR",
    fmt(resumo.valor_total_indevido),
    COR.verde,
    COR.verde,
  );
  y += 28;

  // Período
  setFill(COR.azulClaro);
  doc.roundedRect(ML, y, CW, 10, 2, 2, "F");
  setFont(8, "bold");
  setTxt(COR.azulEscuro);
  doc.text(
    `Período analisado: ${resumo.periodo_analisado || `${config.dataInicial} a ${config.dataFinal}`}`,
    ML + 4,
    y + 6.5,
  );
  y += 16;

  // Por categoria
  if (por_categoria?.length) {
    drawSectionTitle("Cobranças por Categoria", "2.1");

    // Header da tabela
    const colsCat = ["Categoria", "Ocorrências", "Total"];
    const wCat = [100, 30, 50];
    drawTableRow(colsCat, wCat, y, COR.azulEscuro, COR.branco, true);
    y += 7;

    por_categoria.forEach((cat, i) => {
      checkPage(8);
      const bg: [number, number, number] = i % 2 === 0 ? COR.cinzaClaro : COR.branco;
      drawTableRow(
        [cat.categoria || "N/D", String(cat.ocorrencias || 0), fmt(cat.total)],
        wCat,
        y,
        bg,
        COR.cinzaEscuro,
      );
      y += 7;
    });

    // Total
    checkPage(8);
    drawTableRow(
      [
        "TOTAL GERAL",
        String(por_categoria.reduce((s, c) => s + (c.ocorrencias || 0), 0)),
        fmt(resumo.valor_total_indevido),
      ],
      wCat,
      y,
      COR.azulEscuro,
      COR.branco,
      true,
    );
    y += 12;
  }

  // ════════════════════════════════════════════════════════════════
  // PÁGINA(S) — DETALHAMENTO
  // ════════════════════════════════════════════════════════════════
  addPage();
  drawSectionTitle("Detalhamento das Cobranças Indevidas", "3.");

  if (cobrancas_indevidas?.length) {
    // Header
    const colsDet = ["#", "Data", "Descrição", "Qtd", "Unit.", "Total"];
    const wDet = [10, 22, 68, 14, 28, 28];
    drawTableRow(colsDet, wDet, y, COR.azulEscuro, COR.branco, true);
    y += 7;

    cobrancas_indevidas.forEach((c, i) => {
      checkPage(28);

      // Linha principal
      const bg: [number, number, number] = i % 2 === 0 ? COR.cinzaClaro : COR.branco;
      drawTableRow(
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
      y += 7;

      // Badge de status
      const statusCor: [number, number, number] =
        c.status === "confirmado" ? COR.verde : c.status === "indicio" ? COR.amarelo : COR.cinzaMedio;
      const statusBg: [number, number, number] =
        c.status === "confirmado" ? COR.verdeClaro : c.status === "indicio" ? COR.amareloClaro : COR.cinzaClaro;

      // Detalhes expandidos
      checkPage(18);
      setFill(COR.branco);
      doc.rect(ML, y, CW, 18, "F");

      setFont(7, "bold");
      setTxt(statusCor);
      setFill(statusBg);
      doc.roundedRect(ML + 2, y + 1, 28, 5, 1, 1, "FD");
      doc.text(`  ${(c.status || "").toUpperCase()}`, ML + 3, y + 4.5);

      setFont(7);
      setTxt(COR.cinzaMedio);
      doc.text(`Categoria: ${c.categoria || "N/D"}`, ML + 35, y + 4.5);

      setFont(7);
      setTxt(COR.azulMedio);
      const baseLegal = doc.splitTextToSize(`Base Legal: ${c.base_legal || "N/D"}`, CW - 4);
      doc.text(baseLegal[0], ML + 2, y + 10);

      setTxt(COR.cinzaEscuro);
      const justLines = doc.splitTextToSize(`Justificativa: ${c.justificativa || "N/D"}`, CW - 4);
      doc.text(justLines[0], ML + 2, y + 15.5);

      y += 20;

      // Linha separadora
      setDraw(COR.cinzaClaro);
      doc.setLineWidth(0.3);
      doc.line(ML, y, ML + CW, y);
      y += 3;
    });

    // Subtotal
    checkPage(12);
    y += 2;
    setFill(COR.verdeClaro);
    doc.rect(ML, y, CW, 10, "F");
    setFont(9, "bold");
    setTxt(COR.verde);
    doc.text("TOTAL DE COBRANÇAS INDEVIDAS IDENTIFICADAS:", ML + 4, y + 6.5);
    doc.text(fmt(resumo.valor_total_indevido), ML + CW - 4, y + 6.5, { align: "right" });
    y += 14;
  }

  // ════════════════════════════════════════════════════════════════
  // PÁGINA FINAL — RECOMENDAÇÃO JURÍDICA
  // ════════════════════════════════════════════════════════════════
  addPage();
  drawSectionTitle("Recomendação Jurídica", "4.");

  if (recomendacao) {
    // Cards de recomendação
    const cw4 = (CW - 3) / 2;

    drawCard(
      ML,
      y,
      cw4,
      22,
      COR.azulClaro,
      "TIPO DE AÇÃO RECOMENDADA",
      recomendacao.tipo_acao || "N/D",
      COR.azulMedio,
      COR.azulEscuro,
    );

    const priorCor2: [number, number, number] =
      recomendacao.prioridade === "alta" ? COR.vermelho : recomendacao.prioridade === "media" ? COR.amarelo : COR.verde;
    const priorBg2: [number, number, number] =
      recomendacao.prioridade === "alta"
        ? COR.vermelhoClaro
        : recomendacao.prioridade === "media"
          ? COR.amareloClaro
          : COR.verdeClaro;

    drawCard(
      ML + cw4 + 3,
      y,
      cw4,
      22,
      priorBg2,
      "PRIORIDADE",
      (recomendacao.prioridade || "N/D").toUpperCase(),
      priorCor2,
      priorCor2,
    );
    y += 28;

    // Estimativa e prazo
    drawCard(
      ML,
      y,
      cw4,
      22,
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
      22,
      COR.amareloClaro,
      "PRAZO PRESCRICIONAL",
      recomendacao.prazo_prescricional || "N/D",
      COR.amarelo,
      COR.cinzaEscuro,
    );
    y += 30;

    // Fundamentação
    checkPage(40);
    setFill(COR.azulClaro);
    doc.roundedRect(ML, y, CW, 8, 2, 2, "F");
    setFont(8, "bold");
    setTxt(COR.azulEscuro);
    doc.text("FUNDAMENTAÇÃO LEGAL", ML + 4, y + 5.5);
    y += 10;

    setFont(8);
    setTxt(COR.cinzaEscuro);
    const fundLines = doc.splitTextToSize(recomendacao.fundamentacao || "", CW - 4);
    fundLines.forEach((l: string) => {
      checkPage(6);
      doc.text(l, ML + 2, y);
      y += 5.5;
    });
    y += 8;

    // Aviso legal
    checkPage(25);
    setFill(COR.amareloClaro);
    setDraw(COR.amarelo);
    doc.roundedRect(ML, y, CW, 22, 2, 2, "FD");
    setFont(7.5, "bold");
    setTxt(COR.amarelo);
    doc.text("⚠  AVISO LEGAL", ML + 4, y + 6);
    setFont(7.5);
    setTxt(COR.cinzaEscuro);
    const avisoLines = doc.splitTextToSize(
      "Este laudo é um documento técnico de análise preliminar gerado pelo Sistema CRM Bentes & Ramos. " +
        "As cobranças identificadas carecem de análise jurídica aprofundada por advogado habilitado antes " +
        "de qualquer medida judicial ou extrajudicial. Os valores estimados são baseados nos documentos " +
        "fornecidos e podem ser revistos após análise completa do caso.",
      CW - 8,
    );
    avisoLines.forEach((l: string, i: number) => {
      doc.text(l, ML + 4, y + 11 + i * 4.5);
    });
    y += 28;
  }

  // ── Assinatura ──────────────────────────────────────────────────
  checkPage(35);
  y += 5;
  setDraw(COR.cinzaMedio);
  doc.setLineWidth(0.4);
  doc.line(ML + 20, y, ML + CW - 20, y);
  y += 5;
  setFont(8, "bold");
  setTxt(COR.azulEscuro);
  doc.text("BENTES & RAMOS ADVOGADOS", PW / 2, y, { align: "center" });
  y += 5;
  setFont(7);
  setTxt(COR.cinzaMedio);
  doc.text("Direito do Consumidor — Manaus/AM", PW / 2, y, { align: "center" });
  y += 5;
  doc.text(`Emitido em ${now.toLocaleString("pt-BR")} — Laudo nº ${laudoNum}`, PW / 2, y, { align: "center" });

  doc.save(`Laudo_${config.banco}_${laudoNum}.pdf`);
}
