import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Eye, FileText, Calendar, User, Sparkles, Scale, FileDown, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import type { PeticaoGerada } from '@/hooks/useModelosPeticaoDocx';
import jsPDF from 'jspdf';

interface PeticoesGeradasTabProps {
  peticoes: PeticaoGerada[];
  onDownload: (arquivoUrl: string, nomeCliente: string) => Promise<Blob | null>;
  onPreview: (arquivoUrl: string, nomeCliente: string) => Promise<void>;
  onNewPeticao?: () => void;
}

function gerarRelatorioPDF(peticoes: PeticaoGerada[]) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 16;
  const marginR = 16;
  const usableW = pageW - marginL - marginR;
  let y = 20;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Petições Geradas', marginL, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • ${peticoes.length} petição(ões)`, marginL, y);
  doc.setTextColor(0);
  y += 10;

  // Line
  doc.setDrawColor(200);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  peticoes.forEach((p, i) => {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }

    const clienteNome = p.nome_completo || p.cliente_nome || 'Sem nome';
    const modelo = p.modelos_peticao?.nome || '—';
    const parteContraria = p.reu_nome || p.parte_contraria || '—';
    const varaComarca = p.vara_juizo || p.vara_comarca || '—';
    const comarca = p.comarca || '—';
    const tipoAcao = p.tipo_acao || '—';
    const cpf = p.cpf || '—';
    const data = format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR });

    // Card background
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(marginL, y - 4, usableW, 42, 2, 2, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${i + 1}. ${clienteNome}`, marginL + 4, y + 3);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);

    const col1X = marginL + 4;
    const col2X = marginL + usableW / 2;
    let rowY = y + 11;

    doc.text(`Modelo: ${modelo}`, col1X, rowY);
    doc.text(`Tipo de Ação: ${tipoAcao}`, col2X, rowY);
    rowY += 5;
    doc.text(`Parte Contrária: ${parteContraria}`, col1X, rowY);
    doc.text(`CPF: ${cpf}`, col2X, rowY);
    rowY += 5;
    doc.text(`Vara/Juízo: ${varaComarca}`, col1X, rowY);
    doc.text(`Comarca: ${comarca}`, col2X, rowY);
    rowY += 5;
    doc.text(`Data de Geração: ${data}`, col1X, rowY);

    doc.setTextColor(0);
    y += 48;
  });

  doc.save(`relatorio_peticoes_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  toast.success('Relatório PDF gerado com sucesso!');
}

export default function PeticoesGeradasTab({ peticoes, onDownload, onPreview, onNewPeticao }: PeticoesGeradasTabProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const allSelected = peticoes.length > 0 && selected.size === peticoes.length;
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(peticoes.map(p => p.id)));
    }
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchReport = () => {
    const items = peticoes.filter(p => selected.has(p.id));
    if (items.length === 0) {
      toast.error('Selecione ao menos uma petição');
      return;
    }
    setGenerating(true);
    try {
      gerarRelatorioPDF(items);
    } finally {
      setGenerating(false);
    }
  };

  const handleReportAll = () => {
    setGenerating(true);
    try {
      gerarRelatorioPDF(peticoes);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (p: PeticaoGerada) => {
    if (!p.arquivo_gerado_url) return;
    const nome = p.nome_completo || p.cliente_nome || 'peticao';
    const blob = await onDownload(p.arquivo_gerado_url, nome);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nome}_${p.modelos_peticao?.nome || 'documento'}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (peticoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-5">
          <Scale className="h-7 w-7 text-muted-foreground/30" />
        </div>
        <h3 className="text-sm font-semibold text-foreground/70">Nenhuma petição gerada</h3>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-[300px]">
          Selecione um modelo e preencha os dados do cliente para gerar sua primeira petição automaticamente.
        </p>
        {onNewPeticao && (
          <Button size="sm" className="mt-5 gap-1.5" onClick={onNewPeticao}>
            <Sparkles className="h-3.5 w-3.5" />
            Gerar Primeira Petição
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label="Selecionar todas"
          />
          <span className="text-xs text-muted-foreground">
            {someSelected ? `${selected.size} selecionada(s)` : 'Selecionar'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {someSelected && (
            <Button
              size="sm" variant="default"
              className="h-7 text-xs gap-1.5"
              onClick={handleBatchReport}
              disabled={generating}
            >
              <FileDown className="h-3.5 w-3.5" />
              Relatório Selecionadas ({selected.size})
            </Button>
          )}
          <Button
            size="sm" variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={handleReportAll}
            disabled={generating}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Relatório de Todas ({peticoes.length})
          </Button>
        </div>
      </div>

      {/* List */}
      {peticoes.map(p => {
        const clienteNome = p.nome_completo || p.cliente_nome || 'Sem nome';
        const parteContraria = p.reu_nome || p.parte_contraria;
        const varaComarca = p.vara_juizo || p.vara_comarca;

        return (
          <Card
            key={p.id}
            className={`border-border/40 hover:border-border/60 transition-all duration-150 group ${selected.has(p.id) ? 'ring-1 ring-primary/30 border-primary/40' : ''}`}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <Checkbox
                checked={selected.has(p.id)}
                onCheckedChange={() => toggle(p.id)}
                aria-label={`Selecionar ${clienteNome}`}
                className="shrink-0"
              />
              <div className="h-9 w-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-primary/60" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold truncate">{clienteNome}</p>
                  {p.modelos_peticao?.nome && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-[18px] border-border/50 text-muted-foreground shrink-0">
                      {p.modelos_peticao.nome}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2.5 mt-0.5">
                  {parteContraria && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                      <User className="h-3 w-3" />
                      vs {parteContraria}
                    </span>
                  )}
                  {varaComarca && (
                    <span className="text-[11px] text-muted-foreground/60">{varaComarca}</span>
                  )}
                  <span className="text-[11px] text-muted-foreground/40 flex items-center gap-0.5">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {p.arquivo_gerado_url && (
                  <>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => onPreview(p.arquivo_gerado_url!, clienteNome)}
                      title="Visualizar"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => handleDownload(p)}
                      title="Baixar .docx"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
