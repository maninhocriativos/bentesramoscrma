import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface DateRange { from: Date; to: Date }

type Preset = 'mes_atual' | 'mes_passado' | 'ano_atual' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'mes_atual',   label: 'Este mês' },
  { value: 'mes_passado', label: 'Mês passado' },
  { value: 'ano_atual',   label: 'Este ano' },
  { value: 'custom',      label: 'Personalizado' },
];

function rangeForPreset(preset: Preset, current: DateRange): DateRange {
  const now = new Date();
  switch (preset) {
    case 'mes_atual':   return { from: startOfMonth(now), to: endOfDay(now) };
    case 'mes_passado': { const m = subMonths(now, 1); return { from: startOfMonth(m), to: endOfMonth(m) }; }
    case 'ano_atual':   return { from: startOfYear(now), to: endOfDay(now) };
    default:            return current;
  }
}

/**
 * Padrão de 2 Calendar+Popover (dateFrom/dateTo) já duplicado em
 * GerarRelatorioLeadsModal.tsx e ExportTrafegoModal.tsx — extraído aqui
 * pra não copiar pela 3ª vez, com os mesmos presets de período.
 */
export function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [preset, setPreset] = useState<Preset>('mes_atual');

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') onChange(rangeForPreset(p, value));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-xl bg-muted/40 p-1">
        {PRESETS.map(p => (
          <button key={p.value} onClick={() => applyPreset(p.value)}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all ${preset === p.value ? 'bg-[#3d2b1f] text-white' : 'text-muted-foreground hover:bg-muted'}`}>
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" /> {format(value.from, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={value.from} onSelect={d => d && onChange({ ...value, from: d })} locale={ptBR} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" /> {format(value.to, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={value.to} onSelect={d => d && onChange({ ...value, to: endOfDay(d) })} locale={ptBR} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

export function defaultDateRange(): DateRange {
  const now = new Date();
  return { from: startOfMonth(now), to: endOfDay(now) };
}
