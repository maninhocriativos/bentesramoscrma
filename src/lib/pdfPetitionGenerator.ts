import jsPDF from 'jspdf';
import type { OfficeSettings } from '@/types/peticoes';

interface PdfGeneratorOptions {
  htmlContent: string;
  officeSettings: OfficeSettings | null;
  petitionId: string;
  version: number;
}

// Constantes de layout
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 30;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 35;
const MARGIN_BOTTOM = 30;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const HEADER_HEIGHT = 25;
const FOOTER_HEIGHT = 20;

// Cores do escritório (dourado/amarelo conforme identidade)
const GOLD_COLOR = { r: 200, g: 160, b: 50 };
const DARK_COLOR = { r: 30, g: 30, b: 30 };

export async function generatePetitionPdf(options: PdfGeneratorOptions): Promise<Blob> {
  const { htmlContent, officeSettings, petitionId, version } = options;
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Converter HTML para texto estruturado
  const { blocks, title } = parseHtmlContent(htmlContent);
  
  let currentY = MARGIN_TOP;
  let pageNumber = 1;

  // Desenhar cabeçalho na primeira página
  await drawHeader(doc, officeSettings, true);
  
  // Título da petição
  if (title) {
    currentY = drawTitle(doc, title, currentY);
  }

  // Renderizar blocos de conteúdo
  for (const block of blocks) {
    const blockHeight = estimateBlockHeight(doc, block);
    
    // Verificar se precisa de nova página
    if (currentY + blockHeight > PAGE_HEIGHT - MARGIN_BOTTOM - FOOTER_HEIGHT) {
      drawFooter(doc, officeSettings, pageNumber);
      doc.addPage();
      pageNumber++;
      await drawHeader(doc, officeSettings, false);
      currentY = MARGIN_TOP;
    }

    currentY = drawBlock(doc, block, currentY);
  }

  // Desenhar rodapé na última página
  drawFooter(doc, officeSettings, pageNumber);

  return doc.output('blob');
}

async function drawHeader(doc: jsPDF, settings: OfficeSettings | null, isFirstPage: boolean): Promise<void> {
  // Faixa superior dourada
  doc.setFillColor(GOLD_COLOR.r, GOLD_COLOR.g, GOLD_COLOR.b);
  doc.rect(0, 0, PAGE_WIDTH, 3, 'F');

  if (isFirstPage) {
    // Logo ou nome do escritório
    if (settings?.logo_url) {
      try {
        const img = await loadImage(settings.logo_url);
        // Logo à esquerda, altura proporcional
        const logoHeight = 15;
        const logoWidth = (img.width / img.height) * logoHeight;
        doc.addImage(img, 'PNG', MARGIN_LEFT, 8, logoWidth, logoHeight);
      } catch (e) {
        // Fallback: nome do escritório
        drawOfficeName(doc, settings);
      }
    } else {
      drawOfficeName(doc, settings);
    }

    // Informações OAB à direita
    if (settings?.oab_main || settings?.lawyer_name) {
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      
      const rightX = PAGE_WIDTH - MARGIN_RIGHT;
      let infoY = 10;
      
      if (settings.lawyer_name) {
        doc.text(settings.lawyer_name, rightX, infoY, { align: 'right' });
        infoY += 4;
      }
      
      if (settings.oab_main) {
        doc.text(settings.oab_main, rightX, infoY, { align: 'right' });
        infoY += 4;
      }
      
      if (settings.oab_secondary) {
        doc.text(settings.oab_secondary, rightX, infoY, { align: 'right' });
      }
    }

    // Linha separadora
    doc.setDrawColor(GOLD_COLOR.r, GOLD_COLOR.g, GOLD_COLOR.b);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_LEFT, 28, PAGE_WIDTH - MARGIN_RIGHT, 28);
  } else {
    // Páginas subsequentes: cabeçalho simplificado
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    
    const officeName = settings?.office_name || 'Bentes & Ramos Advocacia';
    doc.text(officeName, MARGIN_LEFT, 12);
  }
}

function drawOfficeName(doc: jsPDF, settings: OfficeSettings | null): void {
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(DARK_COLOR.r, DARK_COLOR.g, DARK_COLOR.b);
  
  const officeName = settings?.office_name || 'BENTES & RAMOS';
  doc.text(officeName, MARGIN_LEFT, 15);
  
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Advocacia Especializada', MARGIN_LEFT, 20);
}

function drawFooter(doc: jsPDF, settings: OfficeSettings | null, pageNumber: number): void {
  const footerY = PAGE_HEIGHT - FOOTER_HEIGHT;
  
  // Linha separadora
  doc.setDrawColor(GOLD_COLOR.r, GOLD_COLOR.g, GOLD_COLOR.b);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, footerY, PAGE_WIDTH - MARGIN_RIGHT, footerY);
  
  // Informações de contato
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  
  let contactLine = '';
  if (settings?.phone) contactLine += `Tel: ${settings.phone}`;
  if (settings?.email) contactLine += contactLine ? ` | ${settings.email}` : settings.email;
  if (settings?.website) contactLine += contactLine ? ` | ${settings.website}` : settings.website;
  
  if (contactLine) {
    doc.text(contactLine, MARGIN_LEFT, footerY + 5);
  }
  
  // Endereço
  let addressLine = '';
  if (settings?.address_main) addressLine = settings.address_main;
  if (settings?.city && settings?.state) {
    addressLine += addressLine ? ` - ${settings.city}/${settings.state}` : `${settings.city}/${settings.state}`;
  }
  if (settings?.zip_code) addressLine += ` - CEP: ${settings.zip_code}`;
  
  if (addressLine) {
    doc.text(addressLine, MARGIN_LEFT, footerY + 9);
  }
  
  // OAB no rodapé
  let oabLine = '';
  if (settings?.oab_main) oabLine = settings.oab_main;
  if (settings?.oab_secondary) oabLine += ` | ${settings.oab_secondary}`;
  
  if (oabLine) {
    doc.text(oabLine, MARGIN_LEFT, footerY + 13);
  }
  
  // Número da página à direita
  doc.setFont('times', 'italic');
  doc.setFontSize(9);
  doc.text(`Página ${pageNumber}`, PAGE_WIDTH - MARGIN_RIGHT, footerY + 9, { align: 'right' });
  
  // Faixa inferior dourada
  doc.setFillColor(GOLD_COLOR.r, GOLD_COLOR.g, GOLD_COLOR.b);
  doc.rect(0, PAGE_HEIGHT - 3, PAGE_WIDTH, 3, 'F');
}

function drawTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(DARK_COLOR.r, DARK_COLOR.g, DARK_COLOR.b);
  
  // Centralizar título
  const centerX = PAGE_WIDTH / 2;
  const lines = doc.splitTextToSize(title.toUpperCase(), CONTENT_WIDTH);
  
  for (const line of lines) {
    doc.text(line, centerX, y, { align: 'center' });
    y += 6;
  }
  
  return y + 8;
}

interface ContentBlock {
  type: 'paragraph' | 'heading' | 'list' | 'signature';
  content: string;
  level?: number;
  items?: string[];
}

function parseHtmlContent(html: string): { blocks: ContentBlock[]; title: string | null } {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const blocks: ContentBlock[] = [];
  let title: string | null = null;
  
  // Encontrar título (primeiro H1 ou H2)
  const titleEl = tempDiv.querySelector('h1, h2');
  if (titleEl) {
    title = titleEl.textContent?.trim() || null;
  }
  
  // Processar elementos
  const processNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      
      if (tagName === 'h1' || tagName === 'h2') {
        if (el.textContent !== title) {
          blocks.push({
            type: 'heading',
            content: el.textContent?.trim() || '',
            level: tagName === 'h1' ? 1 : 2,
          });
        }
      } else if (tagName === 'h3' || tagName === 'h4' || tagName === 'h5') {
        blocks.push({
          type: 'heading',
          content: el.textContent?.trim() || '',
          level: parseInt(tagName[1]),
        });
      } else if (tagName === 'p') {
        const text = el.textContent?.trim();
        if (text) {
          blocks.push({ type: 'paragraph', content: text });
        }
      } else if (tagName === 'ul' || tagName === 'ol') {
        const items = Array.from(el.querySelectorAll('li')).map(
          li => li.textContent?.trim() || ''
        ).filter(Boolean);
        if (items.length) {
          blocks.push({ type: 'list', content: '', items });
        }
      } else if (tagName === 'div' || tagName === 'section') {
        // Processar filhos
        el.childNodes.forEach(processNode);
      } else if (tagName === 'strong' || tagName === 'b') {
        blocks.push({ type: 'paragraph', content: el.textContent?.trim() || '' });
      } else if (tagName === 'br') {
        // Ignorar
      } else {
        const text = el.textContent?.trim();
        if (text) {
          blocks.push({ type: 'paragraph', content: text });
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        blocks.push({ type: 'paragraph', content: text });
      }
    }
  };
  
  // Processar filhos do elemento raiz
  tempDiv.childNodes.forEach(processNode);
  
  // Detectar bloco de assinatura
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block.content.toLowerCase().includes('advogado') || 
        block.content.toLowerCase().includes('oab') ||
        block.content.includes('_____')) {
      block.type = 'signature';
      break;
    }
  }
  
  return { blocks, title };
}

function estimateBlockHeight(doc: jsPDF, block: ContentBlock): number {
  const lineHeight = 6;
  
  if (block.type === 'heading') {
    doc.setFontSize(block.level === 1 ? 14 : block.level === 2 ? 13 : 12);
    const lines = doc.splitTextToSize(block.content, CONTENT_WIDTH);
    return (lines.length * lineHeight) + 8;
  }
  
  if (block.type === 'list') {
    return (block.items?.length || 0) * lineHeight + 4;
  }
  
  if (block.type === 'signature') {
    return 40;
  }
  
  doc.setFontSize(12);
  const lines = doc.splitTextToSize(block.content, CONTENT_WIDTH);
  return (lines.length * lineHeight) + 4;
}

function drawBlock(doc: jsPDF, block: ContentBlock, y: number): number {
  const lineHeight = 6;
  
  if (block.type === 'heading') {
    doc.setFont('times', 'bold');
    doc.setFontSize(block.level === 1 ? 14 : block.level === 2 ? 13 : 12);
    doc.setTextColor(DARK_COLOR.r, DARK_COLOR.g, DARK_COLOR.b);
    
    const lines = doc.splitTextToSize(block.content.toUpperCase(), CONTENT_WIDTH);
    for (const line of lines) {
      doc.text(line, MARGIN_LEFT, y);
      y += lineHeight;
    }
    return y + 4;
  }
  
  if (block.type === 'list') {
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(DARK_COLOR.r, DARK_COLOR.g, DARK_COLOR.b);
    
    for (const item of block.items || []) {
      doc.text(`• ${item}`, MARGIN_LEFT + 5, y);
      y += lineHeight;
    }
    return y + 2;
  }
  
  if (block.type === 'signature') {
    y += 15;
    
    // Linha de assinatura centralizada
    const centerX = PAGE_WIDTH / 2;
    doc.setDrawColor(DARK_COLOR.r, DARK_COLOR.g, DARK_COLOR.b);
    doc.setLineWidth(0.3);
    doc.line(centerX - 40, y, centerX + 40, y);
    
    y += 5;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(DARK_COLOR.r, DARK_COLOR.g, DARK_COLOR.b);
    
    const lines = doc.splitTextToSize(block.content, 80);
    for (const line of lines) {
      doc.text(line, centerX, y, { align: 'center' });
      y += 5;
    }
    
    return y + 10;
  }
  
  // Parágrafo normal
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(DARK_COLOR.r, DARK_COLOR.g, DARK_COLOR.b);
  
  // Texto justificado (recuo na primeira linha)
  const text = block.content;
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
  
  for (let i = 0; i < lines.length; i++) {
    const xPos = i === 0 ? MARGIN_LEFT + 15 : MARGIN_LEFT; // Recuo na primeira linha
    doc.text(lines[i], xPos, y);
    y += lineHeight;
  }
  
  return y + 2;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
