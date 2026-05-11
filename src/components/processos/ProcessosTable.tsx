import { useState, useMemo } from 'react';
import { Processo } from '@/types/processos';
import { LeadName } from '@/hooks/useLeadNames';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Scale, ChevronRight, Building2, User, Calendar,
  DollarSign, ArrowUpDown, CheckCircle2, PauseCircle,
  Archive, Trophy, XCircle, Activity, FolderOpen, GitBranch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const ITEMS_PER_PAGE = 30;

interface ProcessosTableProps {
  processos: Processo[];
  onProcessoClick: (processo: Processo) => void;
  leads: LeadName[];
}

// ── Status config with inline colors for reliability ──────────────────────────
const statusConfig: Record<string, {
  cls: string; dot: string; icon: React.ElementType; barColor: string;
}> = {
  'Em Andamento': {
    cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/40',
    dot: 'bg-blue-500', icon: CheckCircle2, barColor: '#3b82f6',
  },
  'Suspenso': {
    cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40',
    dot: 'bg-amber-500', icon: PauseCircle, barColor: '#f59e0b',
  },
  'Arquivado': {
    cls: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground', icon: Archive, barColor: '#94a3b8',
  },
  'Ganho': {
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/40',
    dot: 'bg-emerald-500', icon: Trophy, barColor: '#10b981',
  },
  'Perdido': {
    cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/40',
    dot: 'bg-red-500', icon: XCircle, barColor: '#ef4444',
  },
};

const faseConfig: Record<string, { cls: string }> = {
  'Recursal':          { cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400' },
  'Execução':          { cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400' },
  'Conhecimento':      { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400' },
  'Ganho I Arquivado': { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  'Perdido I Arquivado':{ cls: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
};

function formatCurrency(value: number | null | undefined): string | null {
  if (!value) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function getPartes(processo: Processo) {
  const partes = processo.partes_json || [];
  const ativo = partes.find(p =>
    p.polo === 'AT' || p.polo?.toLowerCase() === 'ativo' ||
    p.tipo?.toLowerCase()?.includes('autor') || p.tipo?.toLowerCase()?.includes('requerente')
  );
  const passivo = partes.find(p =>
    p.polo === 'PA' || p.polo === 'RE' || p.polo?.toLowerCase() === 'passivo' ||
    p.tipo?.toLowerCase()?.includes('réu') || p.tipo?.toLowerCase()?.includes('requerido') ||
    p.tipo?.toLowerCase()?.includes('reu')
  );
  return { ativo, passivo };
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const d = typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)
      ? parseISO(dateStr) : new Date(dateStr);
    return isValid(d) ? format(d, 'dd/MM/yy', { locale: ptBR }) : null;
  } catch { return null; }
}

const grauLabel = (g: string) => ({
  G1: '1º Grau', G2: '2º Grau', SUP: 'Superior',
  JE: 'Juz. Esp.', TR: 'Tur. Rec.',
}[g] || g);

type SortKey = 'cliente' | 'numero' | 'tribunal' | 'data' | 'valor' | 'status';

export function ProcessosTable({ processos, onProcessoClick, leads }: ProcessosTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey,     setSortKey]     = useState<SortKey>('cliente');
  const [sortAsc,     setSortAsc]     = useState(true);

  const parentIds = useMemo(() => {
    const s = new Set<string>();
    processos.forEach(p => { if ((p as any).processo_pai_id) s.add((p as any).processo_pai_id); });
    return s;
  }, [processos]);

  const getClienteName = (processo: Processo) => {
    // 1. nome_cliente salvo diretamente
    if (processo.nome_cliente) return processo.nome_cliente;
    // 2. lead vinculado pelo cliente_id
    if (processo.cliente_id) {
      const lead = leads.find(l => l.id === processo.cliente_id);
      if (lead?.nome) return lead.nome;
    }
    // 3. parte ativa/autor no partes_json
    const partes = processo.partes_json || [];
    const ativo = partes.find(p =>
      p.polo?.toLowerCase() === 'ativo' || p.polo === 'AT' ||
      p.tipo?.toLowerCase()?.includes('autor') || p.tipo?.toLowerCase()?.includes('requerente')
    );
    if (ativo?.nome) return ativo.nome;
    // 4. qualquer parte que nao seja advogado/juiz
    const qualquerParte = partes.find(p =>
      !['advogado', 'juiz', 'promotor', 'perito'].some(t =>
        p.tipo?.toLowerCase()?.includes(t)
      )
    );
    if (qualquerParte?.nome) return qualquerParte.nome;
    // 5. cpf como ultimo identificador
    if (processo.cpf_cliente) return `CPF: ${processo.cpf_cliente}`;
    return null;
  };

  const sorted = [...processos].sort((a, b) => {
    if (sortKey === 'data') {
      const da = new Date(a.data_distribuicao || a.created_at || 0).getTime();
      const db = new Date(b.data_distribuicao || b.created_at || 0).getTime();
      return sortAsc ? da - db : db - da;
    }
    if (sortKey === 'valor') {
      return sortAsc ? (a.valor_causa || 0) - (b.valor_causa || 0) : (b.valor_causa || 0) - (a.valor_causa || 0);
    }
    const va = sortKey === 'cliente' ? getClienteName(a) || ''
             : sortKey === 'numero'   ? a.numero_processo || ''
             : sortKey === 'tribunal' ? a.tribunal || ''
             : a.status || '';
    const vb = sortKey === 'cliente' ? getClienteName(b) || ''
             : sortKey === 'numero'   ? b.numero_processo || ''
             : sortKey === 'tribunal' ? b.tribunal || ''
             : b.status || '';
    return sortAsc ? va.localeCompare(vb, 'pt-BR') : vb.localeCompare(va, 'pt-BR');
  });

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated  = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
    setCurrentPage(1);
  };

  function SortBtn({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 transition-opacity ${active ? 'opacity-100' : 'opacity-30'}`} />
      </button>
    );
  }

  if (processos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl border-2 border-dashed border-border/40">
        <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
          <Scale className="h-8 w-8 text-muted-foreground/20" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Nenhum processo encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">Clique em "Novo" para adicionar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">

      {/* ── Desktop Table ── */}
      <div className="hidden md:block rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="w-[3px] p-0" />
              <th className="text-left px-5 py-3 w-[24%]"><SortBtn col="cliente"  label="Cliente / Partes" /></th>
              <th className="text-left px-4 py-3 w-[22%]"><SortBtn col="numero"   label="Processo" /></th>
              <th className="text-left px-3 py-3 w-[9%]"> <SortBtn col="tribunal" label="Tribunal" /></th>
              <th className="text-left px-3 py-3 w-[12%]"><SortBtn col="data"     label="Distribuição" /></th>
              <th className="text-left px-3 py-3 w-[12%]"><SortBtn col="valor"    label="Valor" /></th>
              <th className="text-left px-5 py-3 w-[21%]"><SortBtn col="status"   label="Situação" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/25">
            {paginated.map((processo) => {
              const status      = processo.status || 'Em Andamento';
              const cfg         = statusConfig[status] || statusConfig['Em Andamento'];
              const faseCfg     = faseConfig[(processo.fase || '').trim()];
              const clienteName = getClienteName(processo);
              const ultimaMov   = processo.movimentos_json?.[0];
              const dataDistrib = formatDate(processo.data_distribuicao || (processo as any).data_ajuizamento);
              const dataSync    = formatDate(processo.data_ultima_atualizacao || ultimaMov?.dataHora);
              const valor       = formatCurrency(processo.valor_causa) || formatCurrency(processo.valor_provisionado);
              const valorIsProvisionado = !processo.valor_causa && !!processo.valor_provisionado;
              const movCount    = processo.movimentos_json?.length || 0;
              const isPai       = parentIds.has(processo.id);
              const isFilho     = !!(processo as any).processo_pai_id;
              const { ativo, passivo } = getPartes(processo);

              return (
                <tr
                  key={processo.id}
                  onClick={() => onProcessoClick(processo)}
                  className="group cursor-pointer hover:bg-accent/20 transition-colors relative"
                >
                  {/* Left accent bar — faintly visible, full opacity on hover */}
                  <td className="px-0 py-0 w-[3px] p-0 relative">
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[3px] opacity-25 group-hover:opacity-100 transition-opacity rounded-r-sm"
                      style={{ background: cfg.barColor }}
                    />
                  </td>

                  {/* Cliente / Partes */}
                  <td className="px-5 py-3.5 align-top">
                    <p className={`text-sm font-bold leading-tight truncate max-w-[200px] ${clienteName ? 'text-foreground' : 'text-muted-foreground/40 font-normal'}`}>
                      {clienteName || 'Sem identificação'}
                    </p>
                    {/* Polo passivo (réu/requerido) */}
                    {passivo && passivo.nome !== clienteName && (
                      <p className="text-[10px] text-muted-foreground/55 truncate max-w-[200px] mt-0.5 flex items-center gap-1 leading-tight">
                        <span className="text-[8px] font-black text-rose-400/80 shrink-0">vs</span>
                        {passivo.nome}
                      </p>
                    )}
                    {processo.classe_cnj && (
                      <p className="text-[10px] text-muted-foreground/50 truncate max-w-[200px] mt-0.5 leading-tight">
                        {processo.classe_cnj}
                      </p>
                    )}
                    {processo.advogado_responsavel && (
                      <p className="text-[10px] text-muted-foreground/40 truncate max-w-[200px] mt-0.5 flex items-center gap-1 leading-tight">
                        <User className="h-2.5 w-2.5 shrink-0" />
                        {processo.advogado_responsavel.replace(/\s*\(OAB.*\)/i, '')}
                      </p>
                    )}
                  </td>

                  {/* Processo */}
                  <td className="px-4 py-3.5 align-top">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isFilho && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-muted-foreground/50 shrink-0">
                          <GitBranch className="h-2.5 w-2.5" /> ↳
                        </span>
                      )}
                      <p className="font-mono text-[12px] font-semibold text-foreground leading-tight">
                        {processo.numero_processo || '—'}
                      </p>
                      {isPai && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200/80 text-[9px] font-bold dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-800/40 shrink-0">
                          <FolderOpen className="h-2.5 w-2.5" /> principal
                        </span>
                      )}
                    </div>
                    {processo.assunto && (
                      <p className="text-[10px] text-muted-foreground truncate max-w-[200px] mt-0.5 leading-tight">
                        {processo.assunto}
                      </p>
                    )}
                    {processo.fase && faseCfg && (
                      <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-md text-[9px] font-bold ${faseCfg.cls}`}>
                        {processo.fase}
                      </span>
                    )}
                  </td>

                  {/* Tribunal */}
                  <td className="px-3 py-3.5 align-top">
                    {processo.tribunal ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/60 border border-border/40 text-[10px] font-bold text-foreground">
                        <Building2 className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                        {processo.tribunal}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/20 text-xs">—</span>
                    )}
                    {processo.grau && (
                      <p className="text-[9px] text-muted-foreground/40 mt-1 ml-0.5">
                        {grauLabel(processo.grau)}
                      </p>
                    )}
                  </td>

                  {/* Data */}
                  <td className="px-3 py-3.5 align-top">
                    {dataDistrib ? (
                      <div className="flex items-center gap-1 text-[11px] text-foreground font-semibold">
                        <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                        {dataDistrib}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/20 text-xs">—</span>
                    )}
                    {dataSync && dataDistrib !== dataSync && (
                      <p className="text-[9px] text-muted-foreground/35 mt-1">Sync: {dataSync}</p>
                    )}
                    {movCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded-md bg-muted/60 border border-border/30 text-[9px] font-bold text-muted-foreground">
                        <Activity className="h-2 w-2 shrink-0" />
                        {movCount}
                      </span>
                    )}
                  </td>

                  {/* Valor */}
                  <td className="px-3 py-3.5 align-top">
                    {valor ? (
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-foreground">
                          <DollarSign className="h-3 w-3 text-muted-foreground shrink-0" />
                          {valor}
                        </div>
                        {valorIsProvisionado && (
                          <p className="text-[8px] text-muted-foreground/40 mt-0.5">provisionado</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/20 text-xs">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5 align-top">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col items-start gap-1.5 flex-1 min-w-0">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${cfg.cls}`}>
                          {(() => { const StatusIcon = cfg.icon; return <StatusIcon className="h-3 w-3 shrink-0" />; })()}
                          {status}
                        </span>
                        {(ultimaMov?.nome) && (
                          <p className="text-[9px] text-muted-foreground/50 truncate max-w-[160px]" title={ultimaMov.nome}>
                            {ultimaMov.nome.length > 40 ? ultimaMov.nome.slice(0, 40) + '…' : ultimaMov.nome}
                          </p>
                        )}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 shrink-0 self-center">
                        <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold whitespace-nowrap border border-primary/20">
                          Abrir <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Cards ── */}
      <div className="md:hidden space-y-2">
        {paginated.map((processo) => {
          const status      = processo.status || 'Em Andamento';
          const cfg         = statusConfig[status] || statusConfig['Em Andamento'];
          const faseCfg     = faseConfig[(processo.fase || '').trim()];
          const clienteName = getClienteName(processo);
          const dataDistrib = formatDate(processo.data_distribuicao || (processo as any).data_ajuizamento);
          const valor       = formatCurrency(processo.valor_causa);
          const isPai       = parentIds.has(processo.id);
          const isFilho     = !!(processo as any).processo_pai_id;

          return (
            <div
              key={processo.id}
              onClick={() => onProcessoClick(processo)}
              className="group flex items-start gap-3 p-4 rounded-2xl border border-border/50 bg-card hover:bg-accent/20 hover:border-border cursor-pointer transition-all"
              style={{ borderLeftWidth: 3, borderLeftColor: cfg.barColor }}
            >
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                    {status}
                  </span>
                  {processo.tribunal && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/40">{processo.tribunal}</span>
                  )}
                  {processo.fase && faseCfg && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${faseCfg.cls}`}>{processo.fase}</span>
                  )}
                </div>
                <p className="text-sm font-bold text-foreground truncate">{clienteName || 'Sem identificação'}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isFilho && (
                    <span className="text-[9px] font-bold text-muted-foreground/50 flex items-center gap-0.5">
                      <GitBranch className="h-2.5 w-2.5" /> ↳
                    </span>
                  )}
                  <p className="font-mono text-xs text-muted-foreground">{processo.numero_processo || '—'}</p>
                  {isPai && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200/80 text-[9px] font-bold dark:bg-violet-950/20 dark:text-violet-400 shrink-0">
                      <FolderOpen className="h-2.5 w-2.5" /> principal
                    </span>
                  )}
                </div>
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
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all self-center shrink-0" />
            </div>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 py-2">
          <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 px-3 rounded-xl text-xs">
            ← Anterior
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
            .map((page, idx, arr) => {
              const prev = arr[idx - 1];
              return (
                <span key={page} className="flex items-center gap-1">
                  {prev && page - prev > 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
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
          <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 px-3 rounded-xl text-xs">
            Próxima →
          </Button>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-xs text-muted-foreground font-medium">
          {processos.length} processo{processos.length !== 1 ? 's' : ''}
          {processos.length !== sorted.length && ` · ${sorted.length} filtrado${sorted.length !== 1 ? 's' : ''}`}
        </span>
        <span className="text-[10px] text-muted-foreground/40">Sincronização automática ativa</span>
      </div>
    </div>
  );
}
