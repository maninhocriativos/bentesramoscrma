import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileSearch, ListChecks, AlertTriangle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { label: 'Lendo os extratos...', icon: FileSearch },
  { label: 'Identificando lançamentos...', icon: ListChecks },
  { label: 'Analisando irregularidades...', icon: AlertTriangle },
  { label: 'Gerando laudo...', icon: FileText },
];

export function ExtratoLoading({ step }: { step: number }) {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="space-y-3 w-full max-w-sm">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={i} className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all",
                  isActive && "bg-primary/10 text-primary font-medium",
                  isDone && "text-muted-foreground line-through",
                  !isActive && !isDone && "text-muted-foreground/50"
                )}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm">{s.label}</span>
                  {isActive && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
