import { Skeleton } from '@/components/ui/skeleton';

export function PageSkeleton({ cards = 3, rows = 5 }: { cards?: number; rows?: number }) {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className={`grid grid-cols-2 gap-4 ${cards <= 3 ? 'md:grid-cols-3' : cards <= 4 ? 'md:grid-cols-4' : 'md:grid-cols-5'}`}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border/40 overflow-hidden">
            <Skeleton className="h-2 w-full" />
            <div className="p-5 space-y-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
        <div className="p-4 border-b border-border/40">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="divide-y divide-border/40">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-7 w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map(i => (
          <div key={i} className="bg-card rounded-xl border border-border/40 p-5 space-y-4">
            <Skeleton className="h-5 w-36" />
            {[1, 2, 3].map(j => (
              <div key={j} className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border/40 p-6 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="h-[220px] flex items-end gap-3 px-2">
        {[60, 85, 45, 90, 55, 75, 40, 80, 65, 95, 50, 70].map((h, i) => (
          <div key={i} className="flex-1 bg-muted rounded-t-md" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}
