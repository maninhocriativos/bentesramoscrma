import jsPDF from 'jspdf';

interface ReportData {
  titulo: string;
  banco?: string;
  cliente?: string;
  dataAnalise: string;
  conteudo: string;
}

export function generateFinancialReport(data: ReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let yPosition = 20;

  // Header
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text('RELATÓRIO DE ANÁLISE FINANCEIRA', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Subtitle
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text('Bentes & Ramos Advocacia', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 12;

  // Info section
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  
  if (data.banco) {
    doc.setFont('helvetica', 'bold');
    doc.text('Banco:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(data.banco, margin + 22, yPosition);
    yPosition += 7;
  }

  if (data.cliente) {
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(data.cliente, margin + 22, yPosition);
    yPosition += 7;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Data:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.dataAnalise, margin + 22, yPosition);
  yPosition += 12;

  // Main content header
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text('ANÁLISE DETALHADA', margin, yPosition);
  yPosition += 8;

  // Clean markdown from content
  let cleanContent = data.conteudo
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/📊|⚠️|✅|📄|💰|📈|📉|🔍|💡|⏰|📋|🏦|📝|💳|🔴|🟡|🟢|⭐|❌|✔️/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/---/g, '')
    .trim();

  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');

  // Split content into lines
  const lines = doc.splitTextToSize(cleanContent, maxWidth);

  for (const line of lines) {
    if (yPosition > 275) {
      doc.addPage();
      yPosition = 20;
    }
    doc.text(line, margin, yPosition);
    yPosition += 5;
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${pageCount} | Gerado em ${new Date().toLocaleString('pt-BR')}`,
      pageWidth / 2,
      287,
      { align: 'center' }
    );
  }

  // Download PDF
  const filename = `Relatorio_${data.banco?.replace(/\s/g, '_') || 'Analise'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

export function extractBankFromMessages(messages: { role: string; content: string }[]): string | undefined {
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (!firstUserMessage) return undefined;
  
  const bankMatch = firstUserMessage.content.match(/\[Banco selecionado: ([^\]]+)\]/);
  return bankMatch ? bankMatch[1] : undefined;
}

export function hasAnalysisContent(content: string): boolean {
  const keywords = [
    'análise',
    'relatório',
    'taxa',
    'juros',
    'CET',
    'encargos',
    'cobrança',
    'valor cobrado',
    'abusivo',
    'BACEN',
    'Banco Central',
    'simulação',
    'parcelas',
    'contrato'
  ];
  
  const lowerContent = content.toLowerCase();
  const matchCount = keywords.filter(k => lowerContent.includes(k.toLowerCase())).length;
  
  // Considera análise se tiver pelo menos 3 keywords e mais de 200 caracteres
  return matchCount >= 3 && content.length > 200;
}
