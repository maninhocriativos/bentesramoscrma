import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, FileText, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PeticaoGerada } from '@/hooks/useModelosPeticaoDocx';

interface PeticoesGeradasTabProps {
  peticoes: PeticaoGerada[];
  onDownload: (arquivoUrl: string, nomeCliente: string) => Promise<Blob | null>;
  onPreview: (arquivoUrl: string, nomeCliente: string) => Promise<void>;
}

export default function PeticoesGeradasTab({ peticoes, onDownload, onPreview }: PeticoesGeradasTabProps) {
  const handleDownload = async (p: PeticaoGerada) => {
    if (!p.arquivo_gerado_url) return;
    const blob = await onDownload(p.arquivo_gerado_url, p.cliente_nome || 'peticao');
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.cliente_nome || 'peticao'}_${p.modelos_peticao?.nome || 'documento'}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (peticoes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-semibold text-foreground/70">Nenhuma petição gerada</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Use o botão "Nova Petição" para gerar seu primeiro documento.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-1.5">
      {peticoes.map(p => (
        <Card key={p.id} className="border-border/40 hover:border-border/60 hover:shadow-sm transition-all duration-150 group">
          <CardContent className="p-3.5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 flex items-center justify-center shrink-0 ring-1 ring-emerald-500/10">
              <FileText className="h-4.5 w-4.5 text-emerald-600/70" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold truncate">{p.cliente_nome || 'Sem nome'}</p>
                {p.modelos_peticao?.nome && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                    {p.modelos_peticao.nome}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {p.parte_contraria && (
                  <span className="text-[11px] text-muted-foreground">
                    <User className="h-3 w-3 inline mr-0.5" />
                    vs {p.parte_contraria}
                  </span>
                )}
                {p.vara_comarca && (
                  <span className="text-[11px] text-muted-foreground">{p.vara_comarca}</span>
                )}
                <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(p.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {p.arquivo_gerado_url && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => onPreview(p.arquivo_gerado_url!, p.cliente_nome || 'Petição')}
                    title="Visualizar"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
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
      ))}
    </div>
  );
}
