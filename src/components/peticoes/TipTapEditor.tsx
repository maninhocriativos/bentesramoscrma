// @ts-ignore - tiptap v3 types
import { useEditor, EditorContent } from '@tiptap/react';
// @ts-ignore - tiptap v3 types
import StarterKit from '@tiptap/starter-kit';
// @ts-ignore - tiptap v3 types
import Underline from '@tiptap/extension-underline';
// @ts-ignore - tiptap v3 types
import TextAlign from '@tiptap/extension-text-align';
// @ts-ignore - tiptap v3 types
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter,
  AlignJustify, List, ListOrdered, Heading2, Undo2, Redo2, Quote,
} from 'lucide-react';
import { useEffect } from 'react';

interface TipTapEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export function TipTapEditor({ content, onChange }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'O texto gerado pela IA aparecerá aqui...' }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-8',
        style: 'font-family: "Times New Roman", serif; font-size: 12pt; line-height: 2;',
      },
    },
  });

  useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  const ToolBtn = ({ icon: Icon, label, action, isActive }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    action: () => void;
    isActive?: boolean;
  }) => (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            onClick={action}
            className="h-8 w-8 p-0"
            type="button"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent><p className="text-xs">{label}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="flex flex-col h-full border-0">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border/50 p-2 bg-muted/30 flex-wrap">
        <div className="flex items-center gap-0.5">
          <ToolBtn icon={Bold} label="Negrito" action={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} />
          <ToolBtn icon={Italic} label="Itálico" action={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} />
          <ToolBtn icon={UnderlineIcon} label="Sublinhado" action={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} />
        </div>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <div className="flex items-center gap-0.5">
          <ToolBtn icon={Heading2} label="Subtítulo" action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} />
          <ToolBtn icon={Quote} label="Citação" action={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} />
        </div>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <div className="flex items-center gap-0.5">
          <ToolBtn icon={AlignLeft} label="Esquerda" action={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} />
          <ToolBtn icon={AlignCenter} label="Centro" action={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} />
          <ToolBtn icon={AlignJustify} label="Justificar" action={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} />
        </div>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <div className="flex items-center gap-0.5">
          <ToolBtn icon={List} label="Lista" action={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} />
          <ToolBtn icon={ListOrdered} label="Lista numerada" action={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} />
        </div>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <div className="flex items-center gap-0.5">
          <ToolBtn icon={Undo2} label="Desfazer" action={() => editor.chain().focus().undo().run()} />
          <ToolBtn icon={Redo2} label="Refazer" action={() => editor.chain().focus().redo().run()} />
        </div>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-card">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
