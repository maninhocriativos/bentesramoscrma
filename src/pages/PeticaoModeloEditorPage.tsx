import { useState, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { useNavigate } from 'react-router-dom';
import mammoth from 'mammoth';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft, Upload, FileText, Download, Save, Undo2, Loader2,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignJustify,
  List, ListOrdered, Heading1, Heading2, Type, Minus, Quote,
  Printer, FileDown, CheckCircle
} from 'lucide-react';

export default function PeticaoModeloEditorPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [html, setHtml] = useState('');
  const [originalHtml, setOriginalHtml] = useState('');
  const [fileName, setFileName] = useState('');
  const [converting, setConverting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync contentEditable with state
  useEffect(() => {
    if (previewRef.current && html) {
      const handleInput = () => {
        if (previewRef.current) {
          setHtml(previewRef.current.innerHTML);
          setSaved(false);
        }
      };
      previewRef.current.addEventListener('input', handleInput);
      return () => {
        previewRef.current?.removeEventListener('input', handleInput);
      };
    }
  }, [!!html]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    setFileName(file.name);

    if (ext === 'docx') {
      setConverting(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            styleMap: [
              "p[style-name='Title'] => h1.doc-title:fresh",
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "b => strong",
              "i => em",
              "u => u",
            ],
          }
        );

        const convertedHtml = result.value;
        if (result.messages.length > 0) {
          console.warn('Mammoth warnings:', result.messages);
        }

        setHtml(convertedHtml);
        setOriginalHtml(convertedHtml);

        if (previewRef.current) {
          previewRef.current.innerHTML = convertedHtml;
        }

        toast({
          title: 'Documento convertido',
          description: `${file.name} foi convertido com sucesso. Edite o conteúdo abaixo.`,
        });
      } catch (err) {
        console.error('Erro ao converter DOCX:', err);
        toast({
          title: 'Erro na conversão',
          description: 'Não foi possível converter o arquivo DOCX. Tente outro arquivo.',
          variant: 'destructive',
        });
      } finally {
        setConverting(false);
      }
    } else if (ext === 'pdf') {
      toast({
        title: 'PDF detectado',
        description: 'Para melhor resultado, envie o arquivo em formato DOCX. PDFs serão exibidos em modo leitura.',
      });
      // For PDF, we show in iframe - no inline editing
      const url = URL.createObjectURL(file);
      setHtml(`<iframe src="${url}" class="w-full" style="height:80vh;border:none;"></iframe>`);
      setOriginalHtml('');
    } else {
      toast({
        title: 'Formato não suportado',
        description: 'Envie um arquivo .docx ou .pdf',
        variant: 'destructive',
      });
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (previewRef.current) {
      setHtml(previewRef.current.innerHTML);
      setSaved(false);
    }
  };

  const formatBlock = (tag: string) => {
    document.execCommand('formatBlock', false, tag);
    if (previewRef.current) {
      setHtml(previewRef.current.innerHTML);
      setSaved(false);
    }
  };

  const handleReset = () => {
    setHtml(originalHtml);
    if (previewRef.current) {
      previewRef.current.innerHTML = originalHtml;
    }
    setSaved(false);
  };

  const handleSaveToStorage = async () => {
    if (!html || !fileName) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const sanitizedName = fileName.replace(/\.[^.]+$/, '');
      const storagePath = `peticoes-editadas/${Date.now()}-${sanitizedName}.html`;

      // Upload HTML to storage
      const blob = new Blob([wrapHtmlForExport(html)], { type: 'text/html' });
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(storagePath, blob, { contentType: 'text/html', upsert: false });

      if (uploadError) throw uploadError;

      // Create document record
      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(storagePath);

      await supabase.from('documentos').insert({
        nome: `${sanitizedName} (editado)`,
        tipo: 'Petição',
        arquivo_nome: `${sanitizedName}.html`,
        arquivo_url: urlData.publicUrl,
        uploaded_by: user?.id,
      });

      setSaved(true);
      toast({
        title: 'Salvo com sucesso',
        description: 'O documento foi salvo na área de documentos.',
      });
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o documento.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Erro', description: 'Permita pop-ups para exportar.', variant: 'destructive' });
      return;
    }

    printWindow.document.write(wrapHtmlForExport(html));
    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  };

  const wrapHtmlForExport = (content: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${fileName || 'Petição'}</title>
  <style>
    @page { margin: 2.5cm; size: A4; }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.8;
      color: #000;
      max-width: 21cm;
      margin: 0 auto;
      padding: 2cm;
    }
    h1 { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 1em; }
    h2 { font-size: 14pt; font-weight: bold; margin-top: 1.5em; margin-bottom: 0.5em; }
    h3 { font-size: 13pt; font-weight: bold; margin-top: 1em; }
    p { text-align: justify; margin-bottom: 0.8em; text-indent: 2cm; }
    ul, ol { margin-left: 2cm; margin-bottom: 1em; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #333; padding: 6px 10px; }
    th { background-color: #f0f0f0; }
    blockquote { border-left: 3px solid #666; padding-left: 1em; font-style: italic; margin: 1em 2cm; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>${content}</body>
</html>`;

  const hasChanges = html !== originalHtml && originalHtml !== '';

  const ToolbarButton = ({
    icon: Icon,
    label,
    onClick,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
  }) => (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={onClick} className="h-8 w-8 p-0" type="button">
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent><p className="text-xs">{label}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // Empty state - upload
  if (!html) {
    return (
      <AppLayout>
        <AppHeader title="Editor de Modelo de Petição" />
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-lg w-full">
            <CardContent className="p-8 text-center space-y-6">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Envie seu modelo de petição</h2>
                <p className="text-muted-foreground text-sm">
                  Faça upload de um arquivo <strong>.docx</strong> (Word) para editar mantendo o layout original.
                  Você poderá alterar os dados e exportar como PDF.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />

              <Button
                size="lg"
                onClick={() => fileInputRef.current?.click()}
                disabled={converting}
                className="gap-2 w-full"
              >
                {converting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Convertendo...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    Selecionar Arquivo (.docx ou .pdf)
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                Formatos aceitos: DOCX (recomendado para edição) e PDF (somente visualização)
              </p>

              <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Editor state
  return (
    <AppLayout>
      <AppHeader title={`Editando: ${fileName}`} />
      <div className="flex-1 flex flex-col">
        {/* Top actions bar */}
        <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setHtml('');
                setOriginalHtml('');
                setFileName('');
              }}
              className="gap-1.5 text-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              Novo arquivo
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-xs">
                <Undo2 className="h-3.5 w-3.5" />
                Desfazer tudo
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSaveToStorage} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Save className="h-4 w-4" />}
              {saved ? 'Salvo' : 'Salvar'}
            </Button>
            <Button size="sm" onClick={handleExportPdf} className="gap-1.5">
              <Printer className="h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Formatting Toolbar */}
        {originalHtml && (
          <div className="flex items-center gap-1 border-b px-4 py-2 bg-background flex-wrap">
            <div className="flex items-center gap-0.5">
              <ToolbarButton icon={Bold} label="Negrito" onClick={() => execCommand('bold')} />
              <ToolbarButton icon={Italic} label="Itálico" onClick={() => execCommand('italic')} />
              <ToolbarButton icon={Underline} label="Sublinhado" onClick={() => execCommand('underline')} />
            </div>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <div className="flex items-center gap-0.5">
              <ToolbarButton icon={Heading1} label="Título H1" onClick={() => formatBlock('h1')} />
              <ToolbarButton icon={Heading2} label="Título H2" onClick={() => formatBlock('h2')} />
              <ToolbarButton icon={Type} label="Parágrafo" onClick={() => formatBlock('p')} />
            </div>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <div className="flex items-center gap-0.5">
              <ToolbarButton icon={AlignLeft} label="Esquerda" onClick={() => execCommand('justifyLeft')} />
              <ToolbarButton icon={AlignCenter} label="Centro" onClick={() => execCommand('justifyCenter')} />
              <ToolbarButton icon={AlignJustify} label="Justificar" onClick={() => execCommand('justifyFull')} />
            </div>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <div className="flex items-center gap-0.5">
              <ToolbarButton icon={List} label="Lista" onClick={() => execCommand('insertUnorderedList')} />
              <ToolbarButton icon={ListOrdered} label="Lista numerada" onClick={() => execCommand('insertOrderedList')} />
            </div>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <div className="flex items-center gap-0.5">
              <ToolbarButton icon={Quote} label="Citação" onClick={() => formatBlock('blockquote')} />
              <ToolbarButton icon={Minus} label="Linha" onClick={() => { document.execCommand('insertHorizontalRule'); if (previewRef.current) setHtml(previewRef.current.innerHTML); }} />
            </div>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Select defaultValue="3" onValueChange={(v) => execCommand('fontSize', v)}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue placeholder="Tamanho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Muito pequeno</SelectItem>
                <SelectItem value="2">Pequeno</SelectItem>
                <SelectItem value="3">Normal</SelectItem>
                <SelectItem value="4">Médio</SelectItem>
                <SelectItem value="5">Grande</SelectItem>
                <SelectItem value="6">Muito grande</SelectItem>
                <SelectItem value="7">Enorme</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Content Area */}
        <ScrollArea className="flex-1">
          <div className="max-w-[21cm] mx-auto my-6 bg-white dark:bg-card shadow-xl rounded-lg border">
            <div
              ref={previewRef}
              contentEditable={!!originalHtml}
              suppressContentEditableWarning
              className="p-12 prose prose-sm max-w-none focus:outline-none min-h-[29.7cm]
                [&_p]:mb-4 [&_p]:text-justify [&_p]:indent-8
                [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:text-center
                [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-3
                [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2
                [&_strong]:font-semibold [&_em]:italic [&_u]:underline
                [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6
                [&_table]:border-collapse [&_table]:w-full
                [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted
                [&_td]:border [&_td]:border-border [&_td]:p-2
                [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:bg-muted/30 [&_blockquote]:py-2"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, {
                ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'blockquote', 'hr', 'span', 'div', 'a', 'img', 'sub', 'sup'],
                ALLOWED_ATTR: ['href', 'style', 'class', 'target', 'src', 'alt', 'width', 'height'],
                FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
              }) }}
              style={{
                fontFamily: "'Times New Roman', serif",
                fontSize: '12pt',
                lineHeight: '1.8',
                color: '#000',
              }}
            />
          </div>
        </ScrollArea>

        {/* Status bar */}
        {hasChanges && (
          <div className="border-t bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 text-xs text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
            Alterações não salvas
          </div>
        )}
      </div>
    </AppLayout>
  );
}
