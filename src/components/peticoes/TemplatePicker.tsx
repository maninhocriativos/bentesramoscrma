import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FileText, Loader2, ArrowRight, FileType, Sparkles,
  Users, Shield, Plane, CreditCard, ShoppingCart, Ban, TrendingUp, Package, AlertTriangle,
} from 'lucide-react';
import { getTemplatesByType, type PetitionTemplate } from '@/lib/petitionTemplates';
import { cn } from '@/lib/utils';
import mammoth from 'mammoth';

interface TemplatePickerProps {
  typeSlug: string;
  typeTitle: string;
  onSelectTemplate: (template: PetitionTemplate, html: string) => void;
  onSkip: () => void;
}

const TAG_COLORS: Record<string, string> = {
  'INSS': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Idoso': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Servidor Público': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Servidor Aposentado': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'Policial Militar': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  'Tramitação Preferencial': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'Juizado Especial': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Aéreo': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
};

export function TemplatePicker({ typeSlug, typeTitle, onSelectTemplate, onSkip }: TemplatePickerProps) {
  const templates = getTemplatesByType(typeSlug);
  const [loading, setLoading] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<PetitionTemplate | null>(null);

  const handleSelectTemplate = async (template: PetitionTemplate) => {
    setLoading(template.id);
    try {
      const response = await fetch(template.filePath);
      const arrayBuffer = await response.arrayBuffer();

      let html = '';
      if (template.fileType === 'docx') {
        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            styleMap: [
              "p[style-name='Heading 1'] => h1.petition-h1:fresh",
              "p[style-name='Heading 2'] => h2.petition-h2:fresh",
              "p[style-name='Heading 3'] => h3.petition-h3:fresh",
              "b => strong",
              "i => em",
              "u => u",
            ],
          }
        );
        html = result.value;
      } else {
        // For .doc files, mammoth may still work for some formats
        try {
          const result = await mammoth.convertToHtml({ arrayBuffer });
          html = result.value;
        } catch {
          // Fallback: show a message that the file needs to be converted
          html = `<div style="text-align:center; padding:40px;">
            <h2>Modelo carregado: ${template.title}</h2>
            <p>Este modelo está no formato .doc (Word 97-2003).</p>
            <p>O conteúdo foi carregado mas pode precisar de ajustes de formatação.</p>
            <p><strong>Tipo de Ação:</strong> ${template.acaoTitulo}</p>
          </div>`;
        }
      }

      onSelectTemplate(template, html);
    } catch (error) {
      console.error('Erro ao carregar template:', error);
    } finally {
      setLoading(null);
    }
  };

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium mb-4">
          <Sparkles className="h-4 w-4" />
          Modelos Disponíveis
        </div>
        <h3 className="text-xl font-bold mb-2">
          Escolha um modelo para "{typeTitle}"
        </h3>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          Selecione um modelo pré-configurado para iniciar sua petição com toda a estrutura jurídica pronta. 
          Você poderá editar todos os dados depois.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={cn(
              "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/50",
              loading === template.id && "opacity-70 pointer-events-none"
            )}
            onClick={() => setPreviewTemplate(template)}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                    {template.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {template.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {template.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          TAG_COLORS[tag] || 'bg-muted text-muted-foreground'
                        )}
                      >
                        {tag}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase">
                      {template.fileType}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground gap-2">
          Pular e criar petição em branco
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Preview / Confirm Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {previewTemplate?.title}
            </DialogTitle>
            <DialogDescription>
              {previewTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tipo de Ação
                </span>
                <p className="text-sm font-semibold mt-1">
                  {previewTemplate?.acaoTitulo}
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Características
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {previewTemplate?.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        TAG_COLORS[tag] || 'bg-muted text-muted-foreground'
                      )}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Formato
                </span>
                <p className="text-sm mt-1">
                  {previewTemplate?.fileType === 'docx' ? 'Word (.docx) – Formatação preservada' : 'Word 97-2003 (.doc)'}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">O modelo será carregado no editor</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Você poderá substituir todos os dados do cliente, banco e valores diretamente no texto. 
                    A formatação jurídica original será preservada.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (previewTemplate) {
                  setPreviewTemplate(null);
                  handleSelectTemplate(previewTemplate);
                }
              }}
              disabled={!!loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Usar Este Modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card border shadow-2xl">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-semibold">Carregando modelo...</p>
              <p className="text-sm text-muted-foreground">Convertendo documento e preservando formatação</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
