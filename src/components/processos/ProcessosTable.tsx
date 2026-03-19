import { useState } from 'react';
import { Processo } from '@/types/processos';
import { LeadName } from '@/hooks/useLeadNames';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Scale, ChevronRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ITEMS_PER_PAGE = 30;

interface ProcessosTableProps {
  processos: Processo[];
  onProcessoClick: (processo: Processo) => void;
  leads: LeadName[];
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  'Em Andamento': { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  'Suspenso': { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  'Arquivado': { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  'Ganho': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Perdido': { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
};

export function ProcessosTable({ processos, onProcessoClick, leads }: ProcessosTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(processos.length / ITEMS_PER_PAGE);
  const paginatedProcessos = processos.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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

  const truncateText = (text: string, max: number) => {
    if (text.length <= max) return text;
    return text.slice(0, max).trim() + '…';
  };

  if (processos.length === 0) {
    return (
      <div className="text-center py-16 bg-card rounded-xl shadow-soft">
        <Scale className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground font-medium">Nenhum processo encontrado</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Clique em "Novo Processo" para adicionar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl border border-border bg-card shadow-soft overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3 w-[25%]">Cliente</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-[28%]">Processo</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-[10%]">Tribunal</th>
              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3 w-[37%]">Situação Atual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedProcessos.map((processo) => {
              const style = statusConfig[processo.status || ''] || statusConfig['Em Andamento'];
              const clienteName = getClienteName(processo);
              const movCount = processo.movimentos_json?.length || 0;
              const ultimaMovimentacao = processo.movimentos_json?.[0];
              const statusReal = processo.status_detalhado || ultimaMovimentacao?.nome || null;
              const dataUltimaAtualizacao = processo.data_ultima_atualizacao || ultimaMovimentacao?.dataHora;

              return (
                <tr
                  key={processo.id}
                  className="cursor-pointer hover:bg-accent/30 transition-colors group"
                  onClick={() => onProcessoClick(processo)}
                >
                  {/* Cliente */}
                  <td className="px-5 py-3 align-middle">
                    <p className="text-sm font-semibold text-foreground truncate max-w-[220px]">
                      {clienteName || '—'}
                    </p>
                    {processo.classe_cnj && (
                      <p className="text-[11px] text-muted-foreground truncate max-w-[220px] mt-0.5">
                        {processo.classe_cnj}
                      </p>
                    )}
                  </td>

                  {/* Número do Processo */}
                  <td className="px-4 py-3 align-middle">
                    <p className="font-mono text-[13px] font-semibold text-foreground">
                      {processo.numero_processo || '—'}
                    </p>
                    {processo.assunto && (
                      <p className="text-[11px] text-muted-foreground truncate max-w-[260px] mt-0.5">
                        {processo.assunto}
                      </p>
                    )}
                  </td>

                  {/* Tribunal */}
                  <td className="px-4 py-3 align-middle">
                    {processo.tribunal ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-[11px] font-medium text-foreground">
                        <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                        {processo.tribunal}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* Situação Atual */}
                  <td className="px-5 py-3 align-middle">
                    <div className="flex items-center justify-end gap-3">
                      {/* Status details */}
                      <div className="flex flex-col items-end gap-0.5 min-w-0">
                        {statusReal && (
                          <p className="text-[11px] font-medium text-muted-foreground text-right truncate max-w-[200px]" title={statusReal}>
                            {truncateText(statusReal, 35)}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5">
                          {dataUltimaAtualizacao && (
                            <span className="text-[10px] text-muted-foreground/50">
                              {format(new Date(dataUltimaAtualizacao), "dd/MM/yy", { locale: ptBR })}
                            </span>
                          )}
                          {movCount > 0 && (
                            <span className="text-[10px] text-muted-foreground/40">• {movCount} mov.</span>
                          )}
                        </div>
                      </div>
                      {/* Badge */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 ${style.bg} ${style.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} />
                        {processo.status || '—'}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden rounded-xl border border-border bg-card shadow-soft overflow-hidden divide-y divide-border">
        {paginatedProcessos.map((processo) => {
          const style = statusConfig[processo.status || ''] || statusConfig['Em Andamento'];
          const clienteName = getClienteName(processo);
          const statusReal = processo.status_detalhado || processo.movimentos_json?.[0]?.nome || null;

          return (
            <div
              key={processo.id}
              className="p-4 active:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => onProcessoClick(processo)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${style.bg} ${style.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {processo.status || '—'}
                    </span>
                    {processo.tribunal && (
                      <span className="text-[10px] text-muted-foreground">{processo.tribunal}</span>
                    )}
                  </div>
                  <p className="font-semibold text-sm truncate">
                    {clienteName || 'Sem identificação'}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{processo.numero_processo || '—'}</p>
                  {statusReal && (
                    <p className="text-[11px] font-medium text-muted-foreground truncate">{truncateText(statusReal, 50)}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-1 shrink-0" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 flex items-center justify-center gap-1 mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="text-xs"
          >
            Anterior
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2)
            .map((page, idx, arr) => {
              const prev = arr[idx - 1];
              const showEllipsis = prev && page - prev > 1;
              return (
                <span key={page} className="flex items-center">
                  {showEllipsis && <span className="px-1 text-xs text-muted-foreground">…</span>}
                  <Button
                    variant={page === currentPage ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="h-8 w-8 p-0 text-xs"
                  >
                    {page}
                  </Button>
                </span>
              );
            })}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="text-xs"
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {processos.length} processo{processos.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-muted-foreground">
          Sincronização semanal automática
        </span>
      </div>
    </div>
  );
}
