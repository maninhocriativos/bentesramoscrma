import { Badge } from '@/components/ui/badge';
import { Megaphone, Building2 } from 'lucide-react';
import { InstanceInfo, getInstanceBadgeClasses } from '@/lib/instanceUtils';

interface InstanceBadgeProps {
  instance: InstanceInfo;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export function InstanceBadge({ instance, size = 'sm', showIcon = true }: InstanceBadgeProps) {
  const colorClasses = getInstanceBadgeClasses(instance);
  const sizeClasses  = size === 'sm'
    ? 'text-[10px] px-1.5 py-0 h-[18px]'
    : 'text-xs px-2 py-0.5';

  const Icon = instance.color === 'trafego' ? Megaphone : Building2;
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <Badge
      variant="outline"
      className={`${colorClasses} ${sizeClasses} font-semibold flex items-center gap-0.5 rounded-full shrink-0`}
    >
      {showIcon && <Icon className={iconSize} strokeWidth={2.5} />}
      <span>{instance.label}</span>
    </Badge>
  );
}
