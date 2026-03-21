import { useState, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Eye, Code, Save, Undo2, Loader2, Download, FileText,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignJustify,
  List, ListOrdered, Type, Heading1, Heading2, Minus,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HtmlPreviewEditorProps {
  initialHtml: string;
  onSave: (html: string) => Promise<void>;
  saving?: boolean;
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-md transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground shadow-sm"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function HtmlPreviewEditor({ initialHtml, onSave, saving }: HtmlPreviewEditorProps) {
  const [html, setHtml] = useState(initialHtml);
  const [originalHtml] = useState(initialHtml);
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview');
  const previewRef = useRef<HTMLDivElement>(null);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (previewRef.current) {
      setHtml(previewRef.current.innerHTML);
    }
  }, []);

  // Handle contenteditable changes
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

  // Sync preview when switching tabs
  useEffect(() => {
    if (activeTab === 'preview' && previewRef.current) {
      previewRef.current.innerHTML = html;
    }
  }, [activeTab]);

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

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* Premium Toolbar */}
      <div className="border-b bg-card shadow-sm">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'source')}>
            <TabsList className="h-8 bg-muted/50">
              <TabsTrigger value="preview" className="gap-1.5 text-xs px-3 h-7">
                <Eye className="h-3.5 w-3.5" />
                Editor Visual
              </TabsTrigger>
              <TabsTrigger value="source" className="gap-1.5 text-xs px-3 h-7">
                <Code className="h-3.5 w-3.5" />
                Código HTML
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Alterações não salvas
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={!hasChanges || saving}
              className="gap-1.5 h-8 text-xs"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Desfazer Tudo
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Salvar e Enviar para Revisão
            </Button>
          </div>
        </div>

        {/* Formatting toolbar - only in preview mode */}
        {activeTab === 'preview' && (
          <div className="flex items-center gap-0.5 px-4 py-1.5 overflow-x-auto">
            <ToolbarButton icon={Bold} label="Negrito (Ctrl+B)" onClick={() => execCommand('bold')} />
            <ToolbarButton icon={Italic} label="Itálico (Ctrl+I)" onClick={() => execCommand('italic')} />
            <ToolbarButton icon={Underline} label="Sublinhado (Ctrl+U)" onClick={() => execCommand('underline')} />
            
            <Separator orientation="vertical" className="mx-1.5 h-5" />
            
            <ToolbarButton icon={Heading1} label="Título 1" onClick={() => execCommand('formatBlock', 'h1')} />
            <ToolbarButton icon={Heading2} label="Título 2" onClick={() => execCommand('formatBlock', 'h2')} />
            <ToolbarButton icon={Type} label="Parágrafo" onClick={() => execCommand('formatBlock', 'p')} />
            
            <Separator orientation="vertical" className="mx-1.5 h-5" />
            
            <ToolbarButton icon={AlignLeft} label="Alinhar à esquerda" onClick={() => execCommand('justifyLeft')} />
            <ToolbarButton icon={AlignCenter} label="Centralizar" onClick={() => execCommand('justifyCenter')} />
            <ToolbarButton icon={AlignJustify} label="Justificar" onClick={() => execCommand('justifyFull')} />
            
            <Separator orientation="vertical" className="mx-1.5 h-5" />
            
            <ToolbarButton icon={List} label="Lista" onClick={() => execCommand('insertUnorderedList')} />
            <ToolbarButton icon={ListOrdered} label="Lista numerada" onClick={() => execCommand('insertOrderedList')} />
            <ToolbarButton icon={Minus} label="Linha horizontal" onClick={() => execCommand('insertHorizontalRule')} />
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'preview' ? (
          <div className="flex justify-center py-8 px-4 min-h-full bg-[#e8e8e8] dark:bg-muted/30">
            {/* A4 Page Container */}
            <div
              className="bg-white shadow-2xl rounded-sm border border-gray-300"
              style={{
                width: '210mm',
                minHeight: '297mm',
                maxWidth: '100%',
              }}
            >
              <div
                ref={previewRef}
                contentEditable
                suppressContentEditableWarning
                className="petition-editor focus:outline-none"
                dangerouslySetInnerHTML={{ __html: html }}
                style={{
                  fontFamily: '"Times New Roman", Times, serif',
                  fontSize: '12pt',
                  lineHeight: '1.8',
                  color: '#000',
                  padding: '25mm 30mm 25mm 30mm',
                  textAlign: 'justify',
                  wordBreak: 'break-word',
                }}
              />
            </div>
          </div>
        ) : (
          <Textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="h-full w-full resize-none rounded-none border-0 font-mono text-xs focus-visible:ring-0 bg-gray-950 text-green-400 p-4"
            placeholder="HTML da petição..."
          />
        )}
      </div>
    </div>
  );
}
