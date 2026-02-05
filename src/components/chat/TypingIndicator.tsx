import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  name?: string;
  className?: string;
}

export function TypingIndicator({ name, className }: TypingIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Typing dots animation */}
      <div className="flex items-center gap-1 px-3 py-2 bg-card rounded-2xl rounded-tl-sm shadow-sm">
        <div className="flex items-center gap-[3px]">
          <span 
            className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" 
            style={{ animationDelay: '0ms', animationDuration: '0.6s' }}
          />
          <span 
            className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" 
            style={{ animationDelay: '150ms', animationDuration: '0.6s' }}
          />
          <span 
            className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" 
            style={{ animationDelay: '300ms', animationDuration: '0.6s' }}
          />
        </div>
      </div>
      
      {/* Name label */}
      {name && (
        <span className="text-xs text-muted-foreground italic">
          {name} está digitando...
        </span>
      )}
    </div>
  );
}

// Compact inline version for chat header
export function TypingIndicatorInline({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-success font-medium", className)}>
      digitando
      <span className="flex items-center gap-[2px] ml-0.5">
        <span 
          className="w-1 h-1 rounded-full bg-current animate-bounce" 
          style={{ animationDelay: '0ms', animationDuration: '0.6s' }}
        />
        <span 
          className="w-1 h-1 rounded-full bg-current animate-bounce" 
          style={{ animationDelay: '150ms', animationDuration: '0.6s' }}
        />
        <span 
          className="w-1 h-1 rounded-full bg-current animate-bounce" 
          style={{ animationDelay: '300ms', animationDuration: '0.6s' }}
        />
      </span>
    </span>
  );
}
