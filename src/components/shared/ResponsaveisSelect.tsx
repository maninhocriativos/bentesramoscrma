import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Users, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface MembroEquipe {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  email: string | null;
}

export function nomeMembro(m: MembroEquipe | undefined | null): string {
  if (!m) return 'Usuário';
  return [m.nome, m.sobrenome].filter(Boolean).join(' ') || m.email || 'Usuário';
}

/** Carrega a equipe aprovada (perfis) — uma vez por montagem. */
export function useMembrosEquipe(membrosExternos?: MembroEquipe[]) {
  const [membros, setMembros] = useState<MembroEquipe[]>(membrosExternos || []);
  useEffect(() => {
    if (membrosExternos && membrosExternos.length > 0) { setMembros(membrosExternos); return; }
    let ativo = true;
    supabase.from('perfis').select('id, nome, sobrenome, email').eq('aprovado', true).order('nome')
      .then(({ data }) => { if (ativo && data) setMembros(data as MembroEquipe[]); });
    return () => { ativo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membrosExternos?.length]);
  return membros;
}

interface ResponsaveisSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Se já tiver a lista carregada (ex.: ProcessoModalExpanded), passa aqui e evita nova query. */
  membros?: MembroEquipe[];
  placeholder?: string;
  disabled?: boolean;
  /** Estilo do gatilho: 'shadcn' (Tailwind, modais do CRM) ou 'brown' (páginas Tarefas/Agenda com paleta marrom/dourada). */
  variant?: 'shadcn' | 'brown';
  className?: string;
  id?: string;
}

const GOLD = '#c9a96e';

/**
 * Seletor de VÁRIOS responsáveis (equipe). Substitui o <select> único de
 * "Responsável" nos modais de tarefa/processo/agenda — o pedido era poder
 * atribuir a mesma tarefa a mais de uma pessoa.
 *
 * O 1º da lista é o "responsável principal" (vai pra `responsavel_id`, que o
 * resto do sistema ainda usa). Clicar num nome marcado desmarca.
 */
export function ResponsaveisSelect({
  value, onChange, membros: membrosProp, placeholder = 'Sem responsável',
  disabled, variant = 'shadcn', className, id,
}: ResponsaveisSelectProps) {
  const membros = useMembrosEquipe(membrosProp);
  const [open, setOpen] = useState(false);

  const porId = useMemo(() => new Map(membros.map(m => [m.id, m])), [membros]);
  const selecionados = value.filter(Boolean);

  const toggle = (idMembro: string) => {
    if (selecionados.includes(idMembro)) onChange(selecionados.filter(v => v !== idMembro));
    else onChange([...selecionados, idMembro]);
  };

  const triggerStyle = variant === 'brown'
    ? { minHeight: 38, borderRadius: 10, border: `1px solid ${GOLD}35`, background: '#faf9f7', fontSize: 13, color: '#1c1917' }
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            'flex w-full items-center gap-1.5 text-left px-3 py-1.5 disabled:opacity-50',
            variant === 'shadcn' && 'min-h-9 rounded-xl border border-input bg-card text-sm',
            className,
          )}
          style={triggerStyle}
        >
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 flex flex-wrap gap-1 min-w-0">
            {selecionados.length === 0 ? (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            ) : selecionados.map((idSel, idx) => (
              <span
                key={idSel}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: `${GOLD}22`, color: '#6b4f2a', border: `1px solid ${GOLD}55` }}
                title={idx === 0 ? 'Responsável principal' : undefined}
              >
                {nomeMembro(porId.get(idSel))}
                <span
                  role="button"
                  aria-label={`Remover ${nomeMembro(porId.get(idSel))}`}
                  onClick={e => { e.stopPropagation(); toggle(idSel); }}
                  className="hover:opacity-60"
                >
                  <X className="h-2.5 w-2.5" />
                </span>
              </span>
            ))}
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-1 rounded-xl">
        <div className="max-h-64 overflow-y-auto">
          {membros.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Carregando equipe...</p>
          )}
          {membros.map(m => {
            const marcado = selecionados.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-muted/60',
                  marcado && 'font-semibold',
                )}
              >
                <span
                  className={cn('h-4 w-4 rounded border flex items-center justify-center shrink-0', marcado ? 'border-transparent' : 'border-border')}
                  style={marcado ? { background: '#3d2b1f' } : undefined}
                >
                  {marcado && <Check className="h-3 w-3" style={{ color: GOLD }} />}
                </span>
                <span className="truncate">{nomeMembro(m)}</span>
              </button>
            );
          })}
        </div>
        {selecionados.length > 0 && (
          <div className="border-t border-border/40 mt-1 pt-1 px-1 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground px-2">{selecionados.length} selecionado{selecionados.length > 1 ? 's' : ''}</span>
            <button type="button" onClick={() => onChange([])} className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1">
              Limpar
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
