import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface FinanceiroKpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
  bg?: string;
  hint?: ReactNode;
}

export function FinanceiroKpiCard({ label, value, icon: Icon, accent, bg, hint }: FinanceiroKpiCardProps) {
  return (
    <div
      className="rounded-2xl overflow-hidden bg-white transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ border: '0.5px solid rgba(201,169,110,0.2)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      <div style={{ height: 3, background: accent }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {label}
          </p>
          <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: bg || `${accent}15` }}>
            <Icon style={{ width: 14, height: 14, color: accent }} />
          </div>
        </div>
        <p style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: '#1c1917' }}>{value}</p>
        {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}
