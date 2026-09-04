import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { TITULOS_TAREFA_BASE } from '@/types/tarefas';
import { cn } from '@/lib/utils';

interface TituloTarefaComboboxProps {
  value: string;
  onChange: (titulo: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** 'shadcn' (modais Tailwind do CRM) ou 'brown' (páginas Tarefas/Agenda, paleta marrom/dourada). */
  variant?: 'shadcn' | 'brown';
  className?: string;
  id?: string;
}

const GOLD = '#c9a96e';

let cacheTitulosDb: string[] | null = null;

/**
 * Dropdown de título da tarefa, com busca: lista padrão (peças/atos) + títulos
 * já usados em tarefas reais + a opção de usar o texto digitado como título
 * novo. Substitui o campo de texto livre — pedido do usuário ("não consigo
 * escolher o título") — sem perder a liberdade de digitar qualquer coisa.
 */
export function TituloTarefaCombobox({
  value, onChange, placeholder = 'Selecione ou digite o título', disabled, variant = 'shadcn', className, id,
}: TituloTarefaComboboxProps) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [titulosDb, setTitulosDb] = useState<string[]>(cacheTitulosDb || []);

  // Títulos já usados (últimas 500 tarefas) — carrega uma vez por sessão.
  useEffect(() => {
    if (!open || cacheTitulosDb) return;
    supabase.from('tarefas').select('titulo').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => {
        if (!data) return;
        cacheTitulosDb = [...new Set(data.map(d => d.titulo).filter(Boolean))];
        setTitulosDb(cacheTitulosDb);
      });
  }, [open]);

  const opcoes = useMemo(() => {
    const base = new Set(TITULOS_TAREFA_BASE);
    const extras = titulosDb.filter(t => !base.has(t)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { base: TITULOS_TAREFA_BASE, extras };
  }, [titulosDb]);

  const buscaLimpa = busca.trim();
  const jaExiste = buscaLimpa && [...opcoes.base, ...opcoes.extras].some(t => t.toLowerCase() === buscaLimpa.toLowerCase());

  const escolher = (t: string) => {
    onChange(t);
    setBusca('');
    setOpen(false);
  };

  const triggerStyle = variant === 'brown'
    ? { height: 38, borderRadius: 10, border: `1px solid ${GOLD}35`, background: '#faf9f7', fontSize: 13, color: value ? '#1c1917' : '#9ca3af' }
    : undefined;

  return (
    <Popover modal open={open} onOpenChange={o => { setOpen(o); if (!o) setBusca(''); }}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between gap-2 text-left px-3 disabled:opacity-50',
            variant === 'shadcn' && 'h-9 rounded-xl border border-input bg-card text-sm',
            variant === 'shadcn' && !value && 'text-muted-foreground',
            className,
          )}
          style={triggerStyle}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 rounded-xl">
        <Command>
          <CommandInput placeholder="Buscar ou digitar um título novo..." value={busca} onValueChange={setBusca} />
          <CommandList className="max-h-64">
            <CommandEmpty>
              {buscaLimpa ? 'Nenhum título igual — use a opção abaixo.' : 'Nenhum título encontrado.'}
            </CommandEmpty>
            {buscaLimpa && !jaExiste && (
              <CommandGroup>
                <CommandItem value={`__novo__${buscaLimpa}`} onSelect={() => escolher(buscaLimpa)} className="gap-2">
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  Usar “{buscaLimpa}”
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Padrão">
              {opcoes.base.map(t => (
                <CommandItem key={t} value={t} onSelect={() => escolher(t)} className="gap-2">
                  <Check className={cn('h-3.5 w-3.5 shrink-0', value === t ? 'opacity-100' : 'opacity-0')} />
                  {t}
                </CommandItem>
              ))}
            </CommandGroup>
            {opcoes.extras.length > 0 && (
              <CommandGroup heading="Já usados">
                {opcoes.extras.map(t => (
                  <CommandItem key={t} value={t} onSelect={() => escolher(t)} className="gap-2">
                    <Check className={cn('h-3.5 w-3.5 shrink-0', value === t ? 'opacity-100' : 'opacity-0')} />
                    {t}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
