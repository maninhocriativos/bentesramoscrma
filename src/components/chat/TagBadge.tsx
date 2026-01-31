import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { ChatTag, TAG_COLORS } from '@/hooks/useChatTags';
import { cn } from '@/lib/utils';

interface TagBadgeProps {
  tag: ChatTag;
  reason?: string | null;
  size?: 'sm' | 'md';
  showRemove?: boolean;
  onRemove?: () => void;
}

export function TagBadge({ tag, reason, size = 'sm', showRemove, onRemove }: TagBadgeProps) {
  const colors = TAG_COLORS[tag.color] || TAG_COLORS.gray;
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5';

  return (
    <Badge
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        sizeClasses,
        'font-medium flex items-center gap-1 whitespace-nowrap',
        showRemove && 'pr-0.5'
      )}
      title={reason ? `${tag.name}: ${reason}` : tag.name}
    >
      {tag.name}
      {showRemove && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:bg-black/10 rounded p-0.5"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </Badge>
  );
}
