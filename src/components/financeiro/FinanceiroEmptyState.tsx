import { LucideIcon } from 'lucide-react';

interface FinanceiroEmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}

export function FinanceiroEmptyState({ icon: Icon, title, subtitle }: FinanceiroEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="h-14 w-14 rounded-2xl bg-[#f5efe6] flex items-center justify-center">
        <Icon className="h-7 w-7 text-[#6e5e5a]/40" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#29201e]">{title}</p>
        {subtitle && <p className="text-xs text-[#6e5e5a] mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
