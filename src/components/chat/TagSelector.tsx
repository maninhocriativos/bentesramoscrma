import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Check, Tag, MapPin, AlertCircle, Scale, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { ChatTag, SubscriberTag, TAG_COLORS } from '@/hooks/useChatTags';
import { getTagIcon } from './TagBadge';
import { cn } from '@/lib/utils';

interface TagSelectorProps {
  subscriberId: string;
  availableTags: ChatTag[];
  currentTags: SubscriberTag[];
  onAddTag: (tagId: string, reason?: string) => Promise<{ error: any }>;
  onRemoveTag: (tagId: string) => Promise<{ error: any }>;
  onCreateTag?: (name: string, color: string) => Promise<{ error: any; data: ChatTag | null }>;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  origem:  MapPin,
  triagem: AlertCircle,
  area:    Scale,
  custom:  Sparkles,
  outros:  Tag,
};

const CATEGORY_LABELS: Record<string, string> = {
  origem:  'Origem / Status',
  triagem: 'Triagem',
  area:    'Área do Direito',
  custom:  'Personalizadas',
  outros:  'Outros',
};

export function TagSelector({
  subscriberId,
  availableTags,
  currentTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [reasonDialog, setReasonDialog] = useState<{ tag: ChatTag; open: boolean }>({
    tag: null as any,
    open: false,
  });
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [newTagDialog, setNewTagDialog] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('gray');

  const currentTagIds = new Set(currentTags.map(t => t.tag_id));

  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const groupedTags = filteredTags.reduce((acc, tag) => {
    const category = tag.category || 'outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(tag);
    return acc;
  }, {} as Record<string, ChatTag[]>);

  const handleTagClick = async (tag: ChatTag) => {
    if (currentTagIds.has(tag.id)) {
      setLoading(true);
      await onRemoveTag(tag.id);
      setLoading(false);
    } else if (tag.requires_reason) {
      setReasonDialog({ tag, open: true });
    } else {
      setLoading(true);
      await onAddTag(tag.id);
      setLoading(false);
    }
  };

  const handleReasonSubmit = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    await onAddTag(reasonDialog.tag.id, reason.trim());
    setReason('');
    setReasonDialog({ tag: null as any, open: false });
    setLoading(false);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !onCreateTag) return;
    setLoading(true);
    const { data } = await onCreateTag(newTagName.trim(), newTagColor);
    if (data) await onAddTag(data.id);
    setNewTagName('');
    setNewTagColor('gray');
    setNewTagDialog(false);
    setLoading(false);
  };

  const categoryOrder = ['origem', 'triagem', 'area', 'custom', 'outros'];
  const sortedCategories = Object.keys(groupedTags).sort(
    (a, b) => (categoryOrder.indexOf(a) ?? 99) - (categoryOrder.indexOf(b) ?? 99)
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-5 px-2 text-[10px] gap-1 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 rounded-full font-semibold"
          >
            <Plus className="h-2.5 w-2.5 text-primary" />
            <span className="text-primary">Tag</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <Input
            placeholder="Buscar tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm mb-3"
            autoFocus
          />

          <div className="max-h-72 overflow-y-auto space-y-1 pr-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            {sortedCategories.map((category, catIdx) => {
              const CatIcon = CATEGORY_ICONS[category] || Tag;
              return (
                <div key={category} className={cn(catIdx > 0 && 'pt-2 mt-1 border-t border-border/60')}>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest px-0.5 pb-2">
                    <CatIcon className="h-3 w-3" />
                    {CATEGORY_LABELS[category] || category}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {groupedTags[category].map((tag) => {
                      const isSelected = currentTagIds.has(tag.id);
                      const colors = TAG_COLORS[tag.color] || TAG_COLORS.gray;
                      const Icon = getTagIcon(tag);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => handleTagClick(tag)}
                          disabled={loading}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all duration-150',
                            colors.bg,
                            colors.text,
                            colors.border,
                            isSelected
                              ? 'ring-2 ring-offset-1 ring-primary/70 shadow-sm scale-105'
                              : 'opacity-75 hover:opacity-100 hover:scale-105',
                            'disabled:opacity-40 cursor-pointer',
                          )}
                        >
                          {isSelected
                            ? <Check className="h-2.5 w-2.5 shrink-0" />
                            : <Icon className="h-2.5 w-2.5 shrink-0" />
                          }
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {sortedCategories.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma tag encontrada
              </p>
            )}
          </div>

          {onCreateTag && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-xs gap-1"
              onClick={() => setNewTagDialog(true)}
            >
              <Plus className="h-3 w-3" />
              Criar nova tag
            </Button>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={reasonDialog.open} onOpenChange={(o) => {
        if (!o) setReasonDialog({ tag: null as any, open: false });
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar motivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A tag "{reasonDialog.tag?.name}" requer um motivo.
            </p>
            <Textarea
              placeholder="Digite o motivo..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialog({ tag: null as any, open: false })}>
              Cancelar
            </Button>
            <Button onClick={handleReasonSubmit} disabled={!reason.trim() || loading}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newTagDialog} onOpenChange={setNewTagDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar nova tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tag-name">Nome da tag</Label>
              <Input
                id="tag-name"
                placeholder="Ex: Cliente Premium"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(TAG_COLORS).map(([color, classes]) => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-all',
                      classes.bg,
                      classes.border,
                      newTagColor === color && 'ring-2 ring-primary ring-offset-2 scale-110',
                    )}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTagDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTag} disabled={!newTagName.trim() || loading}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
