import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Filter, X } from 'lucide-react';
import { ChatTag, TAG_COLORS } from '@/hooks/useChatTags';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TagFilterProps {
  availableTags: ChatTag[];
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export function TagFilter({ availableTags, selectedTagIds, onTagsChange }: TagFilterProps) {
  const [open, setOpen] = useState(false);

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };

  const clearAll = () => {
    onTagsChange([]);
    setOpen(false);
  };

  const selectedTags = availableTags.filter(t => selectedTagIds.includes(t.id));

  const categoryLabels: Record<string, string> = {
    origem: 'Origem/Status',
    triagem: 'Triagem',
    area: 'Área do Direito',
    custom: 'Personalizadas',
  };

  const groupedTags = availableTags.reduce((acc, tag) => {
    const category = tag.category || 'outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(tag);
    return acc;
  }, {} as Record<string, ChatTag[]>);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={selectedTagIds.length > 0 ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 gap-1"
          >
            <Filter className="h-3.5 w-3.5" />
            Filtrar
            {selectedTagIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {selectedTagIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Filtrar por tags</span>
            {selectedTagIds.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearAll}>
                Limpar
              </Button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {Object.entries(groupedTags).map(([category, categoryTags]) => (
              <div key={category}>
                <div className="text-xs font-medium text-muted-foreground px-1 py-1">
                  {categoryLabels[category] || category}
                </div>
                <div className="flex flex-wrap gap-1">
                  {categoryTags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    const colors = TAG_COLORS[tag.color] || TAG_COLORS.gray;
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium border transition-all',
                          colors.bg,
                          colors.text,
                          colors.border,
                          isSelected && 'ring-2 ring-primary ring-offset-1',
                          'hover:opacity-80'
                        )}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Show selected tags as removable badges */}
      {selectedTags.map((tag) => {
        const colors = TAG_COLORS[tag.color] || TAG_COLORS.gray;
        return (
          <Badge
            key={tag.id}
            variant="outline"
            className={cn(
              colors.bg,
              colors.text,
              colors.border,
              'text-xs font-medium flex items-center gap-1 cursor-pointer'
            )}
            onClick={() => toggleTag(tag.id)}
          >
            {tag.name}
            <X className="h-3 w-3" />
          </Badge>
        );
      })}
    </div>
  );
}
