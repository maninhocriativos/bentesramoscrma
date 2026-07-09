import { X, Zap, MessageCircle, UserX, XCircle, FileText, UserPlus, FileCheck, Landmark, Users, Shield, Briefcase, Plane, Tag, type LucideIcon } from 'lucide-react';
import { ChatTag, TAG_COLORS } from '@/hooks/useChatTags';
import { cn } from '@/lib/utils';

const NAME_ICONS: Record<string, LucideIcon> = {
  'Tráfego Pago':        Zap,
  'Bentes Ramos':        MessageCircle,
  'Desistiu':            UserX,
  'Perdido':             XCircle,
  'Aguardando contrato': FileText,
  'Indicação':           UserPlus,
  'Enviou documentação': FileCheck,
  'Bancário':            Landmark,
  'Família':             Users,
  'Previdenciário':      Shield,
  'Trabalhista':         Briefcase,
  'Aéreo':               Plane,
};

export function getTagIcon(tag: ChatTag): LucideIcon {
  return NAME_ICONS[tag.name] || Tag;
}

interface TagBadgeProps {
  tag: ChatTag;
  reason?: string | null;
  size?: 'sm' | 'md';
  showRemove?: boolean;
  onRemove?: () => void;
}

export function TagBadge({ tag, reason, size = 'sm', showRemove, onRemove }: TagBadgeProps) {
  const colors = TAG_COLORS[tag.color] || TAG_COLORS.gray;
  const Icon = getTagIcon(tag);

  const containerCls = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 gap-1 h-5'
    : 'text-xs px-2 py-0.5 gap-1.5 h-6';

  const iconCls = size === 'sm' ? 'h-2.5 w-2.5 shrink-0' : 'h-3 w-3 shrink-0';

  return (
    <span
      className={cn(
        'group/tag inline-flex items-center rounded-full border font-medium whitespace-nowrap select-none',
        'shadow-sm transition-all duration-150 hover:shadow',
        colors.bg,
        colors.text,
        colors.border,
        containerCls,
        showRemove && 'pr-0.5',
      )}
      title={reason ? `${tag.name}: ${reason}` : tag.name}
    >
      <Icon className={iconCls} />
      {tag.name}
      {showRemove && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 rounded-full p-0.5 leading-none opacity-0 -mr-1 w-0 overflow-hidden
            group-hover/tag:opacity-100 group-hover/tag:w-auto group-hover/tag:mr-0 hover:bg-black/15 transition-all duration-150"
          aria-label={`Remover tag ${tag.name}`}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}
