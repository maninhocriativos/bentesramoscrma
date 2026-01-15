import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Code, Save, Undo2, Loader2 } from 'lucide-react';

interface HtmlPreviewEditorProps {
  initialHtml: string;
  onSave: (html: string) => Promise<void>;
  saving?: boolean;
}

export function HtmlPreviewEditor({ initialHtml, onSave, saving }: HtmlPreviewEditorProps) {
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
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b p-3 bg-muted/30">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'source')}>
          <TabsList className="h-8">
            <TabsTrigger value="preview" className="gap-1.5 text-xs px-3">
              <Eye className="h-3.5 w-3.5" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="source" className="gap-1.5 text-xs px-3">
              <Code className="h-3.5 w-3.5" />
              Código
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges || saving}
            className="gap-1.5"
          >
            <Undo2 className="h-4 w-4" />
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
            Salvar Alterações
          </Button>
        </div>
      </div>

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
                [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-3
                [&_strong]:font-semibold [&_em]:italic
                [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6
                [&_table]:border-collapse [&_table]:w-full
                [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted
                [&_td]:border [&_td]:border-border [&_td]:p-2"
              dangerouslySetInnerHTML={{ __html: html }}
              style={{ 
                fontFamily: 'Times New Roman, serif',
                fontSize: '12pt',
                lineHeight: '1.5',
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
