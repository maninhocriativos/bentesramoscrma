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
import { Plus, Check, Tag } from 'lucide-react';
import { ChatTag, SubscriberTag, TAG_COLORS } from '@/hooks/useChatTags';
import { TagBadge } from './TagBadge';
import { cn } from '@/lib/utils';

interface TagSelectorProps {
  subscriberId: string;
  availableTags: ChatTag[];
  currentTags: SubscriberTag[];
  onAddTag: (tagId: string, reason?: string) => Promise<{ error: any }>;
  onRemoveTag: (tagId: string) => Promise<{ error: any }>;
  onCreateTag?: (name: string, color: string) => Promise<{ error: any; data: ChatTag | null }>;
}

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

  const categoryLabels: Record<string, string> = {
    origem: 'Origem/Status',
    triagem: 'Triagem',
    area: 'Área do Direito',
    custom: 'Personalizadas',
    outros: 'Outros',
  };

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
    if (data) {
      await onAddTag(data.id);
    }
    setNewTagName('');
    setNewTagColor('gray');
    setNewTagDialog(false);
    setLoading(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 px-2.5 text-xs gap-1.5 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5"
          >
            <Tag className="h-3.5 w-3.5 text-primary" />
            <span className="text-primary font-medium">+ Tag</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <Input
            placeholder="Buscar tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm mb-2"
          />
          
          <div className="max-h-64 overflow-y-auto space-y-2">
            {Object.entries(groupedTags).map(([category, categoryTags]) => (
              <div key={category}>
                <div className="text-xs font-medium text-muted-foreground px-1 py-1">
                  {categoryLabels[category] || category}
                </div>
                <div className="flex flex-wrap gap-1">
                  {categoryTags.map((tag) => {
                    const isSelected = currentTagIds.has(tag.id);
                    const colors = TAG_COLORS[tag.color] || TAG_COLORS.gray;
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleTagClick(tag)}
                        disabled={loading}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all',
                          colors.bg,
                          colors.text,
                          colors.border,
                          isSelected && 'ring-2 ring-primary ring-offset-1',
                          'hover:opacity-80 disabled:opacity-50'
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {onCreateTag && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs"
              onClick={() => setNewTagDialog(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Criar nova tag
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* Reason Dialog for tags like "Desistiu" */}
      <Dialog open={reasonDialog.open} onOpenChange={(open) => {
        if (!open) setReasonDialog({ tag: null as any, open: false });
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

      {/* Create New Tag Dialog */}
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
                      'w-8 h-8 rounded-full border-2 transition-all',
                      classes.bg,
                      classes.border,
                      newTagColor === color && 'ring-2 ring-primary ring-offset-2'
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
