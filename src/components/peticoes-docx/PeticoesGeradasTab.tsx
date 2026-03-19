import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, FileText, Calendar, User, Sparkles, Scale } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PeticaoGerada } from '@/hooks/useModelosPeticaoDocx';

interface PeticoesGeradasTabProps {
  peticoes: PeticaoGerada[];
  onDownload: (arquivoUrl: string, nomeCliente: string) => Promise<Blob | null>;
  onPreview: (arquivoUrl: string, nomeCliente: string) => Promise<void>;
  onNewPeticao?: () => void;
}

export default function PeticoesGeradasTab({ peticoes, onDownload, onPreview, onNewPeticao }: PeticoesGeradasTabProps) {
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
    <div className="space-y-2">
      {peticoes.map(p => {
        const clienteNome = p.nome_completo || p.cliente_nome || 'Sem nome';
        const parteContraria = p.reu_nome || p.parte_contraria;
        const varaComarca = p.vara_juizo || p.vara_comarca;

        return (
          <Card key={p.id} className="border-border/40 hover:border-border/60 transition-all duration-150 group">
            <CardContent className="p-3 flex items-center gap-3">
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
