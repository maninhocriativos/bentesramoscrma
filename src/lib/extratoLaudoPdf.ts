import jsPDF from "jspdf";
import type { AnaliseConfig, AnaliseResultado } from "@/types/extratos";

// ── Paleta Bentes Ramos ─────────────────────────────────────────
const COR = {
  marrom: [114, 76, 50] as [number, number, number], // #724c32
  marromClaro: [160, 110, 75] as [number, number, number], // versão mais clara
  marromEscuro: [60, 35, 15] as [number, number, number], // versão escura
  bege: [245, 244, 240] as [number, number, number], // #f5f4f0
  begeEscuro: [225, 220, 210] as [number, number, number], // bege mais escuro
  dourado: [180, 140, 60] as [number, number, number], // dourado complementar
  douradoClaro: [245, 235, 200] as [number, number, number], // dourado claro
  vermelho: [160, 30, 30] as [number, number, number],
  vermelhoClaro: [250, 220, 220] as [number, number, number],
  verde: [30, 110, 60] as [number, number, number],
  verdeClaro: [210, 240, 220] as [number, number, number],
  cinzaEscuro: [60, 60, 60] as [number, number, number],
  cinzaMedio: [130, 120, 110] as [number, number, number],
  cinzaClaro: [235, 230, 225] as [number, number, number],
  branco: [255, 255, 255] as [number, number, number],
  preto: [15, 10, 5] as [number, number, number],
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

  // ── Helpers ────────────────────────────────────────────────────
  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
  const setTxt = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFont = (size: number, style: "normal" | "bold" = "normal") => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
  };

  const fmt = (v: number) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const drawPageHeader = () => {
    // Faixa superior marrom escuro
    setFill(COR.marromEscuro);
    doc.rect(0, 0, PW, 13, "F");

    // Linha dourada decorativa
    setFill(COR.dourado);
    doc.rect(0, 13, PW, 1, "F");

    setFont(8, "bold");
    setTxt(COR.dourado);
    doc.text("BENTES RAMOS  —  ADVOCACIA E CONSULTORIA JURÍDICA", ML, 8.5);
    setFont(7);
    setTxt(COR.cinzaClaro);
    doc.text(`Laudo nº ${laudoNum}`, PW - MR, 8.5, { align: "right" });
    y = 20;
  };

  const drawPageFooter = () => {
    const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
    setFill(COR.marromEscuro);
    doc.rect(0, 284, PW, 13, "F");
    setFill(COR.dourado);
    doc.rect(0, 283.5, PW, 0.8, "F");
    setFont(7);
    setTxt(COR.cinzaClaro);
    doc.text("Documento de uso exclusivo — Sistema CRM Bentes Ramos", ML, 291);
    doc.text(`Página ${pageNum}`, PW - MR, 291, { align: "right" });
  };

  const addPage = () => {
    doc.addPage();
    y = 15;
    drawPageHeader();
    drawPageFooter();
  };

  const checkPage = (needed: number) => {
    if (y + needed > 272) addPage();
  };

  const drawSectionTitle = (titulo: string, num: string) => {
    checkPage(16);
    // Fundo marrom
    setFill(COR.marrom);
    doc.rect(ML, y, CW, 9, "F");
    // Linha dourada esquerda
    setFill(COR.dourado);
    doc.rect(ML, y, 2, 9, "F");
    setFont(9, "bold");
    setTxt(COR.bege);
    doc.text(`${num}  ${titulo.toUpperCase()}`, ML + 6, y + 6);
    y += 13;
  };

  const drawCard = (
    x: number,
    yPos: number,
    w: number,
    h: number,
    bg: [number, number, number],
    label: string,
    value: string,
    labelColor: [number, number, number],
    valueColor: [number, number, number],
  ) => {
    setFill(bg);
    setDraw(COR.begeEscuro);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yPos, w, h, 2, 2, "FD");
    // Linha dourada no topo do card
    setFill(COR.marrom);
    doc.rect(x, yPos, w, 1.5, "F");
    setFont(6.5);
    setTxt(labelColor);
    doc.text(label, x + w / 2, yPos + 7, { align: "center" });
    setFont(10, "bold");
    setTxt(valueColor);
    doc.text(value, x + w / 2, yPos + 13.5, { align: "center" });
  };

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
      const lines = doc.splitTextToSize(col, widths[i] - 3);
      doc.text(lines[0], x, rowY + 4.8);
      x += widths[i];
    });
  };

  // ══════════════════════════════════════════════════════════════
  // CAPA
  // ══════════════════════════════════════════════════════════════

  // Fundo bege
  setFill(COR.bege);
  doc.rect(0, 0, PW, 297, "F");

  // Cabeçalho escuro
  setFill(COR.marromEscuro);
  doc.rect(0, 0, PW, 75, "F");

  // Linha dourada separadora
  setFill(COR.dourado);
  doc.rect(0, 75, PW, 1.5, "F");

  // Nome do escritório
  setFont(9, "bold");
  setTxt(COR.dourado);
  doc.text("BENTES RAMOS", PW / 2, 28, { align: "center" });
  setFont(7);
  setTxt(COR.begeEscuro);
  doc.text("ADVOCACIA E CONSULTORIA JURÍDICA", PW / 2, 35, { align: "center" });

  // Linha decorativa dourada
  setFill(COR.dourado);
  doc.rect(ML + 20, 40, CW - 40, 0.6, "F");

  // Título principal
  setFont(20, "bold");
  setTxt(COR.bege);
  doc.text("LAUDO DE ANÁLISE", PW / 2, 52, { align: "center" });
  setFont(11, "bold");
  setTxt(COR.marromClaro);
  doc.text("COBRANÇAS BANCÁRIAS INDEVIDAS", PW / 2, 61, { align: "center" });

  // Linha decorativa dourada inferior
  setFill(COR.dourado);
  doc.rect(ML + 20, 66, CW - 40, 0.6, "F");

  // Caixa de dados do cliente
  setFill(COR.branco);
  setDraw(COR.begeEscuro);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, 85, CW, 62, 2, 2, "FD");

  // Barra marrom topo da caixa
  setFill(COR.marrom);
  doc.roundedRect(ML, 85, CW, 8, 2, 2, "F");
  doc.rect(ML, 89, CW, 4, "F"); // fecha o arredondamento inferior
  setFont(8, "bold");
  setTxt(COR.bege);
  doc.text("DADOS DO CLIENTE", ML + 4, 90.5);

  const dadosCapa = [
    ["Cliente", config.nomeCliente || "Não informado"],
    ["CPF", config.cpf || "Não informado"],
    ["Banco", config.banco || "Não informado"],
    ["Contrato", config.numeroContrato || "Não informado"],
    ["Período", `${config.dataInicial || "N/D"} a ${config.dataFinal || "N/D"}`],
  ];

  let yDados = 100;
  dadosCapa.forEach(([label, valor], i) => {
    if (i % 2 === 0) {
      setFill(COR.bege);
      doc.rect(ML + 0.5, yDados - 3, CW - 1, 8, "F");
    }
    setFont(7.5, "bold");
    setTxt(COR.marrom);
    doc.text(`${label}:`, ML + 4, yDados + 1.5);
    setFont(8);
    setTxt(COR.cinzaEscuro);
    doc.text(valor, ML + 38, yDados + 1.5);
    yDados += 9;
  });

  // Cards de resumo
  const cw3 = (CW - 6) / 3;
  const cardY = 157;

  drawCard(
    ML,
    cardY,
    cw3,
    24,
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
    24,
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
    24,
    COR.verdeClaro,
    "VALOR A RECUPERAR",
    fmt(resumo.valor_total_indevido),
    COR.verde,
    COR.verde,
  );

  // Badge de prioridade
  const prio = (recomendacao?.prioridade || "media").toLowerCase();
  const prioCor: [number, number, number] = prio === "alta" ? COR.vermelho : prio === "media" ? COR.dourado : COR.verde;
  const prioBg: [number, number, number] =
    prio === "alta" ? COR.vermelhoClaro : prio === "media" ? COR.douradoClaro : COR.verdeClaro;

  setFill(prioBg);
  setDraw(prioCor);
  doc.setLineWidth(0.5);
  doc.roundedRect(ML, 190, CW, 11, 2, 2, "FD");
  setFont(9, "bold");
  setTxt(prioCor);
  doc.text(`PRIORIDADE: ${prio.toUpperCase()}`, PW / 2, 197, { align: "center" });

  // Data e laudo
  setFont(8);
  setTxt(COR.cinzaMedio);
  doc.text(`Emitido em ${now.toLocaleDateString("pt-BR")}`, PW / 2, 212, { align: "center" });
  setFont(7.5, "bold");
  setTxt(COR.marrom);
  doc.text(`Laudo nº ${laudoNum}`, PW / 2, 219, { align: "center" });

  // Rodapé da capa
  setFill(COR.marromEscuro);
  doc.rect(0, 280, PW, 17, "F");
  setFill(COR.dourado);
  doc.rect(0, 279.5, PW, 0.8, "F");
  setFont(7);
  setTxt(COR.cinzaClaro);
  doc.text("Documento de uso exclusivo — Sistema CRM Bentes Ramos", PW / 2, 290, { align: "center" });

  // ══════════════════════════════════════════════════════════════
  // PÁG 1 — IDENTIFICAÇÃO
  // ══════════════════════════════════════════════════════════════
  addPage();
  drawSectionTitle("Identificação do Cliente e do Caso", "1.");

  const dadosId = [
    ["Nome Completo", config.nomeCliente || "Não informado"],
    ["CPF", config.cpf || "Não informado"],
    ["Nº do Contrato", config.numeroContrato || "Não informado"],
    ["Banco Analisado", config.banco || "Não informado"],
    ["Período", `${config.dataInicial || "N/D"} a ${config.dataFinal || "N/D"}`],
    ["Arquivos enviados", `${config.arquivos?.length || 0} arquivo(s)`],
    ["Data da Análise", now.toLocaleDateString("pt-BR")],
    ["Número do Laudo", laudoNum],
  ];

  dadosId.forEach((row, i) => {
    const bg: [number, number, number] = i % 2 === 0 ? COR.bege : COR.branco;
    setFill(bg);
    doc.rect(ML, y, CW, 8, "F");
    // Borda esquerda marrom
    setFill(COR.marrom);
    doc.rect(ML, y, 1.5, 8, "F");
    setFont(8, "bold");
    setTxt(COR.marrom);
    doc.text(row[0], ML + 5, y + 5.3);
    setFont(8);
    setTxt(COR.cinzaEscuro);
    doc.text(row[1], ML + 68, y + 5.3);
    y += 8;
  });

  // ══════════════════════════════════════════════════════════════
  // PÁG 2 — RESUMO EXECUTIVO
  // ══════════════════════════════════════════════════════════════
  addPage();
  drawSectionTitle("Resumo Executivo", "2.");

  const cw2 = (CW - 6) / 3;
  drawCard(
    ML,
    y,
    cw2,
    24,
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
    24,
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
    24,
    COR.verdeClaro,
    "VALOR A RECUPERAR",
    fmt(resumo.valor_total_indevido),
    COR.verde,
    COR.verde,
  );
  y += 30;

  // Período
  setFill(COR.bege);
  setDraw(COR.begeEscuro);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, 10, 2, 2, "FD");
  setFill(COR.marrom);
  doc.rect(ML, y, 2, 10, "F");
  setFont(8, "bold");
  setTxt(COR.marrom);
  doc.text("Período analisado:", ML + 6, y + 6.5);
  setFont(8);
  setTxt(COR.cinzaEscuro);
  doc.text(resumo.periodo_analisado || `${config.dataInicial} a ${config.dataFinal}`, ML + 48, y + 6.5);
  y += 16;

  // Por categoria
  if (por_categoria?.length) {
    drawSectionTitle("Cobranças por Categoria", "2.1");
    const wCat = [98, 30, 52];
    drawTableRow(["Categoria", "Ocorrências", "Total Cobrado"], wCat, y, COR.marrom, COR.bege, true);
    y += 7;
    por_categoria.forEach((cat, i) => {
      checkPage(8);
      const bg: [number, number, number] = i % 2 === 0 ? COR.bege : COR.branco;
      drawTableRow(
        [cat.categoria || "N/D", String(cat.ocorrencias || 0), fmt(cat.total)],
        wCat,
        y,
        bg,
        COR.cinzaEscuro,
      );
      y += 7;
    });
    checkPage(8);
    drawTableRow(
      [
        "TOTAL GERAL",
        String(por_categoria.reduce((s, c) => s + (c.ocorrencias || 0), 0)),
        fmt(resumo.valor_total_indevido),
      ],
      wCat,
      y,
      COR.marromEscuro,
      COR.bege,
      true,
    );
    y += 12;
  }

  // ══════════════════════════════════════════════════════════════
  // PÁG(S) — DETALHAMENTO
  // ══════════════════════════════════════════════════════════════
  addPage();
  drawSectionTitle("Detalhamento das Cobranças Indevidas", "3.");

  if (cobrancas_indevidas?.length) {
    const wDet = [10, 22, 66, 14, 28, 30];
    drawTableRow(["#", "Data", "Descrição", "Qtd", "Unit.", "Total"], wDet, y, COR.marrom, COR.bege, true);
    y += 7;

    cobrancas_indevidas.forEach((c, i) => {
      checkPage(30);

      const bg: [number, number, number] = i % 2 === 0 ? COR.bege : COR.branco;
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

      // Detalhes
      checkPage(18);
      setFill(COR.branco);
      doc.rect(ML, y, CW, 17, "F");
      setFill(COR.begeEscuro);
      doc.rect(ML, y, CW, 17, "F");

      // Badge status
      const stCor: [number, number, number] =
        c.status === "confirmado" ? COR.verde : c.status === "indicio" ? COR.dourado : COR.cinzaMedio;
      const stBg: [number, number, number] =
        c.status === "confirmado" ? COR.verdeClaro : c.status === "indicio" ? COR.douradoClaro : COR.cinzaClaro;
      setFill(stBg);
      setDraw(stCor);
      doc.setLineWidth(0.3);
      doc.roundedRect(ML + 2, y + 1.5, 30, 5, 1, 1, "FD");
      setFont(6.5, "bold");
      setTxt(stCor);
      doc.text((c.status || "").toUpperCase(), ML + 17, y + 5, { align: "center" });

      setFont(7);
      setTxt(COR.cinzaMedio);
      doc.text(`Categoria: ${c.categoria || "N/D"}`, ML + 36, y + 5);

      setFont(7);
      setTxt(COR.marrom);
      const baseLegal = doc.splitTextToSize(`Base Legal: ${c.base_legal || "N/D"}`, CW - 4);
      doc.text(baseLegal[0], ML + 2, y + 10.5);

      setTxt(COR.cinzaEscuro);
      const justLines = doc.splitTextToSize(`Justificativa: ${c.justificativa || "N/D"}`, CW - 4);
      doc.text(justLines[0], ML + 2, y + 15.5);

      y += 19;

      // Separador
      setDraw(COR.begeEscuro);
      doc.setLineWidth(0.2);
      doc.line(ML, y, ML + CW, y);
      y += 3;
    });

    // Total geral
    checkPage(12);
    y += 2;
    setFill(COR.verdeClaro);
    setDraw(COR.verde);
    doc.setLineWidth(0.4);
    doc.roundedRect(ML, y, CW, 11, 2, 2, "FD");
    setFill(COR.verde);
    doc.rect(ML, y, 2, 11, "F");
    setFont(9, "bold");
    setTxt(COR.verde);
    doc.text("TOTAL DE COBRANÇAS INDEVIDAS IDENTIFICADAS:", ML + 6, y + 7);
    doc.text(fmt(resumo.valor_total_indevido), ML + CW - 3, y + 7, { align: "right" });
    y += 15;
  }

  // ══════════════════════════════════════════════════════════════
  // PÁG FINAL — RECOMENDAÇÃO JURÍDICA
  // ══════════════════════════════════════════════════════════════
  addPage();
  drawSectionTitle("Recomendação Jurídica", "4.");

  if (recomendacao) {
    const cw4 = (CW - 3) / 2;

    drawCard(
      ML,
      y,
      cw4,
      24,
      COR.bege,
      "TIPO DE AÇÃO RECOMENDADA",
      recomendacao.tipo_acao || "N/D",
      COR.cinzaMedio,
      COR.marromEscuro,
    );

    const p2Cor: [number, number, number] = prio === "alta" ? COR.vermelho : prio === "media" ? COR.dourado : COR.verde;
    const p2Bg: [number, number, number] =
      prio === "alta" ? COR.vermelhoClaro : prio === "media" ? COR.douradoClaro : COR.verdeClaro;
    drawCard(ML + cw4 + 3, y, cw4, 24, p2Bg, "PRIORIDADE", prio.toUpperCase(), p2Cor, p2Cor);
    y += 30;

    drawCard(
      ML,
      y,
      cw4,
      24,
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
      24,
      COR.douradoClaro,
      "PRAZO PRESCRICIONAL",
      recomendacao.prazo_prescricional || "N/D",
      COR.dourado,
      COR.cinzaEscuro,
    );
    y += 30;

    // Fundamentação
    checkPage(40);
    setFill(COR.marrom);
    doc.rect(ML, y, CW, 8, "F");
    setFill(COR.dourado);
    doc.rect(ML, y, 2, 8, "F");
    setFont(8, "bold");
    setTxt(COR.bege);
    doc.text("FUNDAMENTAÇÃO LEGAL", ML + 6, y + 5.5);
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
    checkPage(28);
    setFill(COR.douradoClaro);
    setDraw(COR.dourado);
    doc.setLineWidth(0.5);
    doc.roundedRect(ML, y, CW, 25, 2, 2, "FD");
    setFill(COR.dourado);
    doc.rect(ML, y, 2, 25, "F");
    setFont(7.5, "bold");
    setTxt(COR.marrom);
    doc.text("AVISO LEGAL", ML + 6, y + 6);
    setFont(7.5);
    setTxt(COR.cinzaEscuro);
    const avisoLines = doc.splitTextToSize(
      "Este laudo é um documento técnico de análise preliminar gerado pelo Sistema CRM Bentes Ramos. " +
        "As cobranças identificadas carecem de análise jurídica aprofundada por advogado habilitado antes " +
        "de qualquer medida judicial ou extrajudicial. Os valores estimados são baseados nos documentos " +
        "fornecidos e podem ser revistos após análise completa do caso.",
      CW - 10,
    );
    avisoLines.forEach((l: string, i: number) => {
      doc.text(l, ML + 6, y + 12 + i * 4.8);
    });
    y += 30;
  }

  // ── Assinatura final ───────────────────────────────────────────
  checkPage(30);
  y += 5;
  setDraw(COR.marromClaro);
  doc.setLineWidth(0.5);
  doc.line(ML + 30, y, ML + CW - 30, y);
  y += 6;
  setFont(9, "bold");
  setTxt(COR.marromEscuro);
  doc.text("BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA", PW / 2, y, { align: "center" });
  y += 5;
  setFont(7);
  setTxt(COR.cinzaMedio);
  doc.text("Manaus — Amazonas", PW / 2, y, { align: "center" });
  y += 5;
  doc.text(`Emitido em ${now.toLocaleString("pt-BR")} — Laudo nº ${laudoNum}`, PW / 2, y, { align: "center" });

  doc.save(`Laudo_${config.banco}_${laudoNum}.pdf`);
}
