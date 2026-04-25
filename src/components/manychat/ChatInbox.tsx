import { useMemo } from 'react';
import {
  Filter, Megaphone, MessageCircle, Bot, UserRound, Users,
  CheckCircle2, ChevronDown, X, Sparkles,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { TagFilter } from '@/components/chat/TagFilter';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ConversationFilter = 'all' | 'unread' | 'human' | 'bot' | 'mine';
export type OrigemFilter       = 'all' | 'trafego' | 'whatsapp_direto';

interface ChatFiltersBarProps {
  origemFilter:    OrigemFilter;
  atendFilter:     ConversationFilter;
  selectedTagIds:  string[];
  availableTags:   any[];
  totalCount:      number;
  unreadCount:     number;
  isDark:          boolean;
  themeClasses:    {
    sidebar:        string;
    border:         string;
    inputSearch:    string;
    secondaryText:  string;
    headerText:     string;
    hoverBtn:       string;
  };
  onOrigemChange:  (v: OrigemFilter) => void;
  onAtendChange:   (v: ConversationFilter) => void;
  onTagsChange:    (ids: string[]) => void;
  onResetAll:      () => void;
}

// ─── Configurações dos filtros ────────────────────────────────────────────────

const ORIGEM_OPTIONS: Array<{ value: OrigemFilter; label: string; icon: any; color: string }> = [
  { value: 'all',              label: 'Todas as origens', icon: Filter,        color: '#94a3b8' },
  { value: 'trafego',          label: 'Tráfego pago',     icon: Megaphone,     color: '#ef4444' },
  { value: 'whatsapp_direto',  label: 'WhatsApp direto',  icon: MessageCircle, color: '#3b82f6' },
];

const ATEND_OPTIONS: Array<{ value: ConversationFilter; label: string; icon: any; color: string }> = [
  { value: 'all',    label: 'Todos atendimentos', icon: Users,     color: '#94a3b8' },
  { value: 'unread', label: 'Não lidas',          icon: Sparkles,  color: '#f59e0b' },
  { value: 'human',  label: 'Humano',             icon: UserRound, color: '#f59e0b' },
  { value: 'bot',    label: 'Isa (Bot)',          icon: Bot,       color: '#00A884' },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export function ChatFiltersBar({
  origemFilter, atendFilter, selectedTagIds, availableTags,
  totalCount, unreadCount, isDark, themeClasses,
  onOrigemChange, onAtendChange, onTagsChange, onResetAll,
}: ChatFiltersBarProps) {

  const origemActive   = useMemo(() => ORIGEM_OPTIONS.find(o => o.value === origemFilter)!, [origemFilter]);
  const atendActive    = useMemo(() => ATEND_OPTIONS.find(a => a.value === atendFilter)!, [atendFilter]);
  const hasAnyFilter   = origemFilter !== 'all' || atendFilter !== 'all' || selectedTagIds.length > 0;
  const filtersCount   = (origemFilter !== 'all' ? 1 : 0) + (atendFilter !== 'all' ? 1 : 0) + selectedTagIds.length;

  return (
    <div className={`px-3 py-2 ${themeClasses.sidebar} border-b ${themeClasses.border}`}>
      <div className="flex items-center gap-1.5 flex-wrap">

        {/* ─── Botão "Todos" — reseta tudo ────────────────────────────── */}
        <button
          onClick={onResetAll}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all
            ${!hasAnyFilter
              ? 'bg-[#00A884] text-white shadow-sm shadow-[#00A884]/20'
              : `${themeClasses.inputSearch} ${themeClasses.secondaryText} hover:brightness-110`
            }`}
          title="Mostrar todas as conversas"
        >
          <Users className="h-3 w-3" />
          Todos
          {!hasAnyFilter && totalCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0 rounded-full bg-white/25 text-[9px] font-black tabular-nums">
              {totalCount}
            </span>
          )}
        </button>

        <div className="h-4 w-px bg-gray-500/20" />

        {/* ─── Dropdown ORIGEM ─────────────────────────────────────────── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all
                ${origemFilter !== 'all'
                  ? 'text-white shadow-sm'
                  : `${themeClasses.inputSearch} ${themeClasses.secondaryText} hover:brightness-110`
                }`}
              style={origemFilter !== 'all' ? { backgroundColor: origemActive.color } : undefined}
            >
              <origemActive.icon className="h-3 w-3" />
              <span>{origemFilter === 'all' ? 'Origem' : origemActive.label.replace('Tráfego pago', 'Tráfego').replace('WhatsApp direto', 'Direto')}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              Filtrar por origem
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ORIGEM_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const isActive = origemFilter === opt.value;
              return (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => onOrigemChange(opt.value)}
                  className="gap-2 cursor-pointer"
                >
                  <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                       style={{ backgroundColor: `${opt.color}20`, color: opt.color }}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="flex-1 text-sm">{opt.label}</span>
                  {isActive && <CheckCircle2 className="h-4 w-4 text-[#00A884]" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ─── Dropdown ATENDIMENTO ────────────────────────────────────── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all
                ${atendFilter !== 'all'
                  ? 'text-white shadow-sm'
                  : `${themeClasses.inputSearch} ${themeClasses.secondaryText} hover:brightness-110`
                }`}
              style={atendFilter !== 'all' ? { backgroundColor: atendActive.color } : undefined}
            >
              <atendActive.icon className="h-3 w-3" />
              <span>{atendFilter === 'all' ? 'Atendimento' : atendActive.label.replace('Isa (Bot)', 'Isa')}</span>
              {atendFilter === 'unread' && unreadCount > 0 && (
                <span className="px-1.5 py-0 rounded-full bg-white/25 text-[9px] font-black tabular-nums">
                  {unreadCount}
                </span>
              )}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              Filtrar por atendimento
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ATEND_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const isActive = atendFilter === opt.value;
              return (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => onAtendChange(opt.value)}
                  className="gap-2 cursor-pointer"
                >
                  <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                       style={{ backgroundColor: `${opt.color}20`, color: opt.color }}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="flex-1 text-sm">{opt.label}</span>
                  {opt.value === 'unread' && unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                  {isActive && <CheckCircle2 className="h-4 w-4 text-[#00A884]" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-px bg-gray-500/20" />

        {/* ─── Filtro de tags ──────────────────────────────────────────── */}
        <TagFilter
          availableTags={availableTags}
          selectedTagIds={selectedTagIds}
          onTagsChange={onTagsChange}
        />

        {/* ─── Indicador de filtros ativos + botão limpar ─────────────── */}
        {hasAnyFilter && (
          <button
            onClick={onResetAll}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold
              bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all"
            title={`Limpar ${filtersCount} filtro(s)`}
          >
            <X className="h-3 w-3" />
            Limpar ({filtersCount})
          </button>
        )}
      </div>
    </div>
  );
}
