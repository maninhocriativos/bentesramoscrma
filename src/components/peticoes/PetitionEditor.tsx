import { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  Eye, Code, Save, Undo2, Loader2, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignJustify, List, ListOrdered,
  Type, Heading1, Heading2, Minus, Quote, Palette
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PetitionEditorProps {
  initialHtml: string;
  onSave: (html: string) => Promise<void>;
  saving?: boolean;
}

export function PetitionEditor({ initialHtml, onSave, saving }: PetitionEditorProps) {
  const [html, setHtml] = useState(initialHtml);
  const [originalHtml] = useState(initialHtml);
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview');
  const previewRef = useRef<HTMLDivElement>(null);

  // Handle contenteditable changes in preview mode
  useEffect(() => {
    if (activeTab === 'preview' && previewRef.current) {
      const handleInput = () => {
        if (previewRef.current) {
          setHtml(previewRef.current.innerHTML);
        }
      };
      
      previewRef.current.addEventListener('input', handleInput);
      return () => {
        previewRef.current?.removeEventListener('input', handleInput);
      };
    }
  }, [activeTab]);

  // Sync preview when switching from source to preview
  useEffect(() => {
    if (activeTab === 'preview' && previewRef.current) {
      previewRef.current.innerHTML = html;
    }
  }, [activeTab, html]);

  const hasChanges = html !== originalHtml;

  const handleReset = () => {
    setHtml(originalHtml);
    if (previewRef.current) {
      previewRef.current.innerHTML = originalHtml;
    }
  };

  const handleSave = () => {
    onSave(html);
  };

  // Formatting commands
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (previewRef.current) {
      setHtml(previewRef.current.innerHTML);
    }
  };

  const formatBlock = (tag: string) => {
    document.execCommand('formatBlock', false, tag);
    if (previewRef.current) {
      setHtml(previewRef.current.innerHTML);
    }
  };

  const insertHorizontalRule = () => {
    document.execCommand('insertHorizontalRule', false);
    if (previewRef.current) {
      setHtml(previewRef.current.innerHTML);
    }
  };

  const ToolbarButton = ({ 
    icon: Icon, 
    label, 
    onClick,
    active = false 
  }: { 
    icon: React.ComponentType<{ className?: string }>; 
    label: string; 
    onClick: () => void;
    active?: boolean;
  }) => (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={active ? "secondary" : "ghost"}
            size="sm"
            onClick={onClick}
            className="h-8 w-8 p-0"
            type="button"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between border-b p-2 bg-muted/30">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'source')}>
          <TabsList className="h-8">
            <TabsTrigger value="preview" className="gap-1.5 text-xs px-3">
              <Eye className="h-3.5 w-3.5" />
              Editar
            </TabsTrigger>
            <TabsTrigger value="source" className="gap-1.5 text-xs px-3">
              <Code className="h-3.5 w-3.5" />
              HTML
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges || saving}
            className="gap-1.5 text-xs"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Desfazer
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Formatting Toolbar (only in preview mode) */}
      {activeTab === 'preview' && (
        <div className="flex items-center gap-1 border-b p-2 bg-background flex-wrap">
          {/* Text formatting */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton icon={Bold} label="Negrito (Ctrl+B)" onClick={() => execCommand('bold')} />
            <ToolbarButton icon={Italic} label="Itálico (Ctrl+I)" onClick={() => execCommand('italic')} />
            <ToolbarButton icon={Underline} label="Sublinhado (Ctrl+U)" onClick={() => execCommand('underline')} />
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Headings */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton icon={Heading1} label="Título H1" onClick={() => formatBlock('h1')} />
            <ToolbarButton icon={Heading2} label="Título H2" onClick={() => formatBlock('h2')} />
            <ToolbarButton icon={Type} label="Parágrafo" onClick={() => formatBlock('p')} />
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Alignment */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton icon={AlignLeft} label="Alinhar à esquerda" onClick={() => execCommand('justifyLeft')} />
            <ToolbarButton icon={AlignCenter} label="Centralizar" onClick={() => execCommand('justifyCenter')} />
            <ToolbarButton icon={AlignJustify} label="Justificar" onClick={() => execCommand('justifyFull')} />
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Lists */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton icon={List} label="Lista com marcadores" onClick={() => execCommand('insertUnorderedList')} />
            <ToolbarButton icon={ListOrdered} label="Lista numerada" onClick={() => execCommand('insertOrderedList')} />
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Other */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton icon={Quote} label="Citação" onClick={() => formatBlock('blockquote')} />
            <ToolbarButton icon={Minus} label="Linha horizontal" onClick={insertHorizontalRule} />
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Font Size */}
          <Select
            defaultValue="3"
            onValueChange={(value) => execCommand('fontSize', value)}
          >
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

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'preview' ? (
          <ScrollArea className="h-full">
            <div 
              ref={previewRef}
              contentEditable
              suppressContentEditableWarning
              className="p-8 prose prose-sm max-w-none focus:outline-none min-h-full
                [&_p]:mb-4 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-4
                [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:text-primary
                [&_strong]:font-semibold [&_em]:italic
                [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6
                [&_table]:border-collapse [&_table]:w-full
                [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted
                [&_td]:border [&_td]:border-border [&_td]:p-2
                [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:bg-muted/30 [&_blockquote]:py-2
                [&_.enderecamento]:text-center [&_.enderecamento]:font-bold [&_.enderecamento]:uppercase
                [&_.titulo-acao]:bg-primary/10 [&_.titulo-acao]:border [&_.titulo-acao]:border-primary/30 [&_.titulo-acao]:rounded-lg [&_.titulo-acao]:p-4 [&_.titulo-acao]:text-center [&_.titulo-acao]:my-6
                [&_.titulo-acao_h1]:text-primary [&_.titulo-acao_h1]:m-0
                [&_.signature]:text-center [&_.signature]:mt-12
                [&_.signature-line]:border-t [&_.signature-line]:border-foreground [&_.signature-line]:w-64 [&_.signature-line]:mx-auto [&_.signature-line]:pt-2
                [&_.signature-name]:font-bold [&_.signature-name]:uppercase [&_.signature-name]:mb-0
                [&_.signature-oab]:text-sm [&_.signature-oab]:text-muted-foreground
                [&_.date-location]:text-right [&_.date-location]:italic"
              dangerouslySetInnerHTML={{ __html: html }}
              style={{ 
                fontFamily: 'Times New Roman, serif',
                fontSize: '12pt',
                lineHeight: '1.8',
              }}
            />
          </ScrollArea>
        ) : (
          <Textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="h-full w-full resize-none rounded-none border-0 font-mono text-xs focus-visible:ring-0"
            placeholder="HTML da petição..."
          />
        )}
      </div>

      {/* Status bar */}
      {hasChanges && (
        <div className="border-t bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 text-xs text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
          Alterações não salvas
        </div>
      )}
    </div>
  );
}

