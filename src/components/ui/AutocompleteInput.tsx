import { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface AutocompleteInputProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  maxItems?: number;
  /** Exibe as iniciais em maiúscula (só visual — o valor gravado não muda). */
  capitalize?: boolean;
}

/**
 * Campo de texto com sugestões (autocomplete) estilizado na paleta do sistema.
 * Substitui o <datalist> nativo (que o navegador renderiza escuro/fora do tema).
 * Aceita texto livre — as opções são só sugestões.
 */
export function AutocompleteInput({
  value, onChange, options, placeholder, className, invalid, maxItems = 8, capitalize,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    const list = q ? options.filter(o => o.toLowerCase().includes(q)) : options;
    return list.slice(0, maxItems);
  }, [value, options, maxItems]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (opt: string) => { onChange(opt); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && filtered[highlight]) { e.preventDefault(); pick(filtered[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={cn('rounded-xl mt-0', invalid && 'border-destructive', capitalize && 'capitalize', className)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
          {filtered.map((opt, i) => {
            const selected = opt === value;
            return (
              <button
                key={opt}
                type="button"
                onMouseDown={e => { e.preventDefault(); pick(opt); }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm text-left transition-colors',
                  'text-popover-foreground',
                  capitalize && 'capitalize',
                  i === highlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                )}
              >
                <span className="truncate">{opt}</span>
                {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
