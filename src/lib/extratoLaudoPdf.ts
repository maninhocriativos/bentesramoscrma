import jsPDF from 'jspdf';
import type { AnaliseConfig, AnaliseResultado } from '@/types/extratos';

export function gerarLaudoPdf(resultado: AnaliseResultado, config: AnaliseConfig) {
  const doc = new jsPDF();
  const { resumo, cobrancas_indevidas, por_categoria, recomendacao } = resultado;
  const now = new Date();
  const laudoNum = `LAU-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  let y = 20;
  const marginLeft = 20;
  const pageWidth = 170;

  const addPage = () => { doc.addPage(); y = 20; };
  const checkPage = (needed: number) => { if (y + needed > 275) addPage(); };

  // === CAPA ===
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('BENTES & RAMOS ADVOGADOS', 105, y, { align: 'center' });
  y += 40;

  doc.setFontSize(22);
  doc.setTextColor(40);
  doc.text('Laudo de Análise de', 105, y, { align: 'center' }); y += 10;
  doc.text('Cobranças Bancárias', 105, y, { align: 'center' }); y += 20;

  doc.setFontSize(12);
  doc.setTextColor(80);
  if (config.nomeCliente) { doc.text(`Cliente: ${config.nomeCliente}`, 105, y, { align: 'center' }); y += 8; }
  doc.text(`Data: ${now.toLocaleDateString('pt-BR')}`, 105, y, { align: 'center' }); y += 8;
  doc.text(`Laudo nº ${laudoNum}`, 105, y, { align: 'center' });

  // === PÁGINA 1 — IDENTIFICAÇÃO ===
  addPage();
  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text('1. Identificação', marginLeft, y); y += 10;

  doc.setFontSize(11);
  doc.setTextColor(60);
  const idLines = [
    `Nome: ${config.nomeCliente || 'Não informado'}`,
    `CPF: ${config.cpf || 'Não informado'}`,
    `Contrato: ${config.numeroContrato || 'Não informado'}`,
    `Banco: ${config.banco}`,
    `Período: ${config.dataInicial || 'N/D'} a ${config.dataFinal || 'N/D'}`,
    `Extratos analisados: ${config.arquivos.length}`,
  ];
  idLines.forEach(l => { doc.text(l, marginLeft, y); y += 7; });

  // === PÁGINA 2 — RESUMO ===
  addPage();
  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text('2. Resumo Executivo', marginLeft, y); y += 10;

  doc.setFontSize(11);
  doc.setTextColor(60);
  const resumoLines = [
    `Total de lançamentos analisados: ${resumo.total_lancamentos}`,
    `Irregularidades encontradas: ${resumo.irregularidades_encontradas}`,
    `Valor total a recuperar: R$ ${(resumo.valor_total_indevido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    `Prioridade: ${recomendacao?.prioridade?.toUpperCase() || 'N/D'}`,
  ];
  resumoLines.forEach(l => { doc.text(l, marginLeft, y); y += 7; });

  if (por_categoria?.length) {
    y += 5;
    doc.setFontSize(13);
    doc.setTextColor(40);
    doc.text('Por Categoria:', marginLeft, y); y += 8;
    doc.setFontSize(10);
    doc.setTextColor(60);
    por_categoria.forEach(cat => {
      doc.text(`• ${cat.categoria}: R$ ${(cat.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${cat.ocorrencias} ocorrências)`, marginLeft, y);
      y += 6;
    });
  }

  // === PÁGINA 3+ — DETALHAMENTO ===
  addPage();
  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text('3. Detalhamento das Cobranças', marginLeft, y); y += 10;

  if (cobrancas_indevidas?.length) {
    cobrancas_indevidas.forEach((c, i) => {
      checkPage(35);
      doc.setFontSize(11);
      doc.setTextColor(40);
      doc.text(`${i + 1}. ${c.descricao || 'Sem descrição'}`, marginLeft, y); y += 6;
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(`Data: ${c.data || 'N/D'} | Valor: R$ ${(c.valor_total || c.valor_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Status: ${c.status}`, marginLeft, y); y += 5;
      doc.text(`Categoria: ${c.categoria} | Base Legal: ${c.base_legal || 'N/D'}`, marginLeft, y); y += 5;
      const justLines = doc.splitTextToSize(`Justificativa: ${c.justificativa || ''}`, pageWidth);
      justLines.forEach((l: string) => { checkPage(6); doc.text(l, marginLeft, y); y += 5; });
      y += 4;
    });
  }

  // === ÚLTIMA PÁGINA — RECOMENDAÇÃO ===
  addPage();
  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text('4. Recomendação Jurídica', marginLeft, y); y += 10;

  if (recomendacao) {
    doc.setFontSize(11);
    doc.setTextColor(60);
    const recLines = [
      `Tipo de Ação: ${recomendacao.tipo_acao}`,
      `Estimativa de Recuperação: R$ ${(recomendacao.estimativa_recuperacao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `Prazo Prescricional: ${recomendacao.prazo_prescricional}`,
      `Prioridade: ${recomendacao.prioridade?.toUpperCase()}`,
    ];
    recLines.forEach(l => { doc.text(l, marginLeft, y); y += 7; });

    y += 5;
    doc.setFontSize(10);
    const fundLines = doc.splitTextToSize(`Fundamentação: ${recomendacao.fundamentacao || ''}`, pageWidth);
    fundLines.forEach((l: string) => { checkPage(6); doc.text(l, marginLeft, y); y += 5; });
  }

  y += 20;
  checkPage(30);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Documento gerado automaticamente pelo sistema CRM Bentes & Ramos', 105, y, { align: 'center' }); y += 5;
  doc.text(`Laudo nº ${laudoNum} — ${now.toLocaleString('pt-BR')}`, 105, y, { align: 'center' });

  doc.save(`Laudo_Extrato_${config.banco}_${laudoNum}.pdf`);
}
