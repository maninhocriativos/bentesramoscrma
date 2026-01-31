import { Badge } from '@/components/ui/badge';
import { Phone } from 'lucide-react';
import { InstanceInfo, getInstanceBadgeClasses } from '@/lib/instanceUtils';

interface InstanceBadgeProps {
  instance: InstanceInfo;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export function InstanceBadge({ instance, size = 'sm', showIcon = false }: InstanceBadgeProps) {
  const colorClasses = getInstanceBadgeClasses(instance);
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5';
  
  return (
    <Badge 
      variant="outline" 
      className={`${colorClasses} ${sizeClasses} font-medium flex items-center gap-1`}
    >
      {showIcon && <Phone className="h-2.5 w-2.5" />}
      {instance.label}
    </Badge>
  );
}
