import { useState } from 'react';
import { Processo } from '@/types/processos';
import { LeadName } from '@/hooks/useLeadNames';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Scale, ChevronRight, Building2, User, Calendar,
  DollarSign, Gavel, ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ITEMS_PER_PAGE = 30;

interface ProcessosTableProps {
  processos: Processo[];
  onProcessoClick: (processo: Processo) => void;
  leads: LeadName[];
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  'Em Andamento': { bg: 'bg-blue-50 dark:bg-blue-950/30',    text: 'text-blue-700 dark:text-blue-400',    dot: 'bg-blue-500'    },
  'Suspenso':     { bg: 'bg-amber-50 dark:bg-amber-950/30',  text: 'text-amber-700 dark:text-amber-400',  dot: 'bg-amber-500'   },
  'Arquivado':    { bg: 'bg-muted',                           text: 'text-muted-foreground',               dot: 'bg-muted-foreground' },
  'Ganho':        { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Perdido':      { bg: 'bg-red-50 dark:bg-red-950/30',      text: 'text-red-700 dark:text-red-400',      dot: 'bg-red-500'     },
};

const faseConfig: Record<string, { bg: string; text: string }> = {
  'Recursal':              { bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-400' },
  'Execução':              { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400' },
  'Cumprimento de Sentença':{ bg: 'bg-teal-50 dark:bg-teal-950/30',   text: 'text-teal-700 dark:text-teal-400'   },
  'Conhecimento':          { bg: 'bg-sky-50 dark:bg-sky-950/30',      text: 'text-sky-700 dark:text-sky-400'     },
  'Liquidação':            { bg: 'bg-indigo-50 dark:bg-indigo-950/30',text: 'text-indigo-700 dark:text-indigo-400'},
};

function formatCurrency(value: number | null | undefined): string | null {
  if (!value) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const d = typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)
      ? parseISO(dateStr)
      : new Date(dateStr);
    return isValid(d) ? format(d, 'dd/MM/yy', { locale: ptBR }) : null;
  } catch { return null; }
}

type SortKey = 'cliente' | 'numero' | 'tribunal' | 'data' | 'valor' | 'status';

export function ProcessosTable({ processos, onProcessoClick, leads }: ProcessosTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey,     setSortKey]     = useState<SortKey>('cliente');
  const [sortAsc,     setSortAsc]     = useState(true);

  const getClienteName = (processo: Processo) => {
    if (processo.nome_cliente) return processo.nome_cliente;
    if (processo.cliente_id) {
      const lead = leads.find(l => l.id === processo.cliente_id);
      if (lead?.nome) return lead.nome;
    }
    const partes = processo.partes_json || [];
    const parteAtiva = partes.find(p =>
      p.polo?.toLowerCase() === 'ativo' || p.polo === 'AT' ||
      p.tipo?.toLowerCase()?.includes('autor') || p.tipo?.toLowerCase()?.includes('requerente')
    );
    return parteAtiva?.nome || null;
  };

  const sorted = [...processos].sort((a, b) => {
    let va = '', vb = '';
    if (sortKey === 'cliente') { va = getClienteName(a) || ''; vb = getClienteName(b) || ''; }
    else if (sortKey === 'numero')   { va = a.numero_processo || ''; vb = b.numero_processo || ''; }
    else if (sortKey === 'tribunal') { va = a.tribunal || ''; vb = b.tribunal || ''; }
    else if (sortKey === 'status')   { va = a.status || ''; vb = b.status || ''; }
    else if (sortKey === 'data') {
      const da = new Date(a.data_distribuicao || a.created_at || 0).getTime();
      const db = new Date(b.data_distribuicao || b.created_at || 0).getTime();
      return sortAsc ? da - db : db - da;
    } else if (sortKey === 'valor') {
      const va2 = a.valor_causa || 0;
      const vb2 = b.valor_causa || 0;
      return sortAsc ? va2 - vb2 : vb2 - va2;
    }
    return sortAsc ? va.localeCompare(vb, 'pt-BR') : vb.localeCompare(va, 'pt-BR');
  });

  const totalPages       = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginatedProcessos = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
    setCurrentPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => (
    <ArrowUpDown className={`h-3 w-3 ml-1 inline-block transition-opacity ${sortKey === col ? 'opacity-100 text-primary' : 'opacity-30'}`} />
  );

  if (processos.length === 0) {
    return (
      <div className="text-center py-20 bg-card rounded-2xl border border-border/50">
        <Scale className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
        <p className="text-sm font-semibold text-muted-foreground">Nenhum processo encontrado</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo" para adicionar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">

      {/* ── Desktop Table ── */}
      <div className="hidden md:block rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border/50">
              <th className="text-left px-4 py-2.5 w-[22%]">
                <button onClick={() => toggleSort('cliente')} className="flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                  Cliente <SortIcon col="cliente" />
                </button>
              </th>
              <th className="text-left px-3 py-2.5 w-[22%]">
                <button onClick={() => toggleSort('numero')} className="flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                  Processo <SortIcon col="numero" />
                </button>
              </th>
              <th className="text-left px-3 py-2.5 w-[9%]">
                <button onClick={() => toggleSort('tribunal')} className="flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                  Tribunal <SortIcon col="tribunal" />
                </button>
              </th>
              <th className="text-left px-3 py-2.5 w-[12%]">
                <button onClick={() => toggleSort('data')} className="flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                  Distribuição <SortIcon col="data" />
                </button>
              </th>
              <th className="text-left px-3 py-2.5 w-[11%]">
                <button onClick={() => toggleSort('valor')} className="flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                  Valor <SortIcon col="valor" />
                </button>
              </th>
              <th className="text-right px-4 py-2.5 w-[24%]">
                <button onClick={() => toggleSort('status')} className="flex items-center ml-auto text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                  Situação <SortIcon col="status" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {paginatedProcessos.map((processo) => {
              const style        = statusConfig[processo.status || ''] || statusConfig['Em Andamento'];
              const faseStyle    = faseConfig[(processo.fase || '').trim()] || null;
              const clienteName  = getClienteName(processo);
              const ultimaMov    = processo.movimentos_json?.[0];
              const statusReal   = processo.status_detalhado || ultimaMov?.nome || null;
              const dataDistrib  = formatDate(processo.data_distribuicao || (processo as any).data_ajuizamento);
              const dataSync     = formatDate(processo.data_ultima_atualizacao || ultimaMov?.dataHora);
              const valor        = formatCurrency(processo.valor_causa);
              const advogado     = processo.advogado_responsavel;
              const movCount     = processo.movimentos_json?.length || 0;

              return (
                <tr
                  key={processo.id}
                  className="cursor-pointer hover:bg-accent/20 transition-colors group"
                  onClick={() => onProcessoClick(processo)}
                >
                  {/* Cliente */}
                  <td className="px-4 py-3 align-top">
                    <p className="text-sm font-semibold text-foreground truncate max-w-[200px] leading-tight">
                      {clienteName || <span className="text-muted-foreground/40 font-normal">Sem identificação</span>}
                    </p>
                    {processo.classe_cnj && (
                      <p className="text-[10px] text-muted-foreground/70 truncate max-w-[200px] mt-0.5 leading-tight">
                        {processo.classe_cnj}
                      </p>
                    )}
                    {advogado && (
                      <p className="text-[10px] text-muted-foreground/50 truncate max-w-[200px] mt-0.5 flex items-center gap-1 leading-tight">
                        <User className="h-2.5 w-2.5 shrink-0" />
                        {advogado.replace(/\s*\(OAB.*\)/i, '')}
                      </p>
                    )}
                  </td>

                  {/* Processo */}
                  <td className="px-3 py-3 align-top">
                    <p className="font-mono text-[12px] font-semibold text-foreground leading-tight">
                      {processo.numero_processo || '—'}
                    </p>
                    {processo.assunto && (
                      <p className="text-[10px] text-muted-foreground truncate max-w-[220px] mt-0.5 leading-tight">
                        {processo.assunto}
                      </p>
                    )}
                    {processo.fase && (
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold ${faseStyle?.bg || 'bg-muted'} ${faseStyle?.text || 'text-muted-foreground'}`}>
                          {processo.fase}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Tribunal */}
                  <td className="px-3 py-3 align-top">
                    {processo.tribunal ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/60 text-[10px] font-semibold text-foreground">
                        <Building2 className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                        {processo.tribunal}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30 text-xs">—</span>
                    )}
                    {processo.grau && (
                      <p className="text-[9px] text-muted-foreground/50 mt-1 ml-0.5">{
                        processo.grau === 'G1' ? '1º Grau' :
                        processo.grau === 'G2' ? '2º Grau' :
                        processo.grau === 'JE' ? 'Juz. Esp.' :
                        processo.grau === 'TR' ? 'Tur. Rec.' : processo.grau
                      }</p>
                    )}
                  </td>

                  {/* Data distribuição */}
                  <td className="px-3 py-3 align-top">
                    {dataDistrib ? (
                      <div className="flex items-center gap-1 text-[11px] text-foreground font-medium">
                        <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                        {dataDistrib}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/30 text-xs">—</span>
                    )}
                    {dataSync && dataDistrib !== dataSync && (
                      <p className="text-[9px] text-muted-foreground/40 mt-1">
                        Sync: {dataSync}
                      </p>
                    )}
                    {movCount > 0 && (
                      <p className="text-[9px] text-muted-foreground/40 mt-0.5">{movCount} mov.</p>
                    )}
                  </td>

                  {/* Valor */}
                  <td className="px-3 py-3 align-top">
                    {valor ? (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                        <DollarSign className="h-3 w-3 text-muted-foreground shrink-0" />
                        {valor}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/30 text-xs">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${style.bg} ${style.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} />
                        {processo.status || '—'}
                      </span>
                      {statusReal && (
                        <p className="text-[10px] text-muted-foreground/60 text-right truncate max-w-[180px]" title={statusReal}>
                          {statusReal.length > 38 ? statusReal.slice(0, 38) + '…' : statusReal}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity float-right mt-1 ml-2 shrink-0" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Cards ── */}
      <div className="md:hidden rounded-2xl border border-border/50 bg-card overflow-hidden divide-y divide-border/30">
        {paginatedProcessos.map((processo) => {
          const style       = statusConfig[processo.status || ''] || statusConfig['Em Andamento'];
          const clienteName = getClienteName(processo);
          const faseStyle   = faseConfig[(processo.fase || '').trim()] || null;
          const dataDistrib = formatDate(processo.data_distribuicao || (processo as any).data_ajuizamento);
          const valor       = formatCurrency(processo.valor_causa);

          return (
            <div
              key={processo.id}
              className="p-4 active:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => onProcessoClick(processo)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.bg} ${style.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {processo.status || '—'}
                    </span>
                    {processo.tribunal && (
                      <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md">{processo.tribunal}</span>
                    )}
                    {processo.fase && faseStyle && (
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${faseStyle.bg} ${faseStyle.text}`}>{processo.fase}</span>
                    )}
                  </div>
                  <p className="font-semibold text-sm truncate">{clienteName || 'Sem identificação'}</p>
                  <p className="font-mono text-xs text-muted-foreground">{processo.numero_processo || '—'}</p>
                  {processo.assunto && (
                    <p className="text-[11px] text-muted-foreground truncate">{processo.assunto}</p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    {dataDistrib && (
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />{dataDistrib}
                      </span>
                    )}
                    {valor && (
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <DollarSign className="h-2.5 w-2.5" />{valor}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-1 shrink-0" />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 py-2">
          <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-xs h-8 px-3 rounded-xl">
            ← Anterior
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2)
            .map((page, idx, arr) => {
              const prev          = arr[idx - 1];
              const showEllipsis  = prev && page - prev > 1;
              return (
                <span key={page} className="flex items-center gap-1">
                  {showEllipsis && <span className="text-xs text-muted-foreground px-1">…</span>}
                  <Button
                    variant={page === currentPage ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="h-8 w-8 p-0 text-xs rounded-xl"
                  >
                    {page}
                  </Button>
                </span>
              );
            })}
          <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="text-xs h-8 px-3 rounded-xl">
            Próxima →
          </Button>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-xs text-muted-foreground">
          {processos.length} processo{processos.length !== 1 ? 's' : ''}
          {processos.length !== sorted.length && ` · ${sorted.length} filtrado${sorted.length !== 1 ? 's' : ''}`}
        </span>
        <span className="text-xs text-muted-foreground/50">
          Sincronização semanal automática
        </span>
      </div>
    </div>
  );
}
