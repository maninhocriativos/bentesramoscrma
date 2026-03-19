import { useState } from 'react';
import { Processo } from '@/types/processos';
import { LeadName } from '@/hooks/useLeadNames';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Scale, ChevronRight, Building2, Gavel, User, Users, FileText, Clock } from 'lucide-react';
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

const poloBadgeConfig: Record<string, { bg: string; text: string }> = {
  'ativo': { bg: 'bg-emerald-600', text: 'text-white' },
  'passivo': { bg: 'bg-purple-600', text: 'text-white' },
};

export function ProcessosTable({ processos, onProcessoClick, leads }: ProcessosTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(processos.length / ITEMS_PER_PAGE);
  const paginatedProcessos = processos.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getClienteName = (processo: Processo) => {
    if (processo.cliente_id) {
      const lead = leads.find(l => l.id === processo.cliente_id);
      if (lead?.nome) return lead.nome;
    }
    return processo.nome_cliente || null;
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
      {/* Desktop Card List */}
      <div className="hidden md:block rounded-xl border border-border bg-card shadow-soft overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-muted/40 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Número do Processo</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Órgão</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28 text-right">Status</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {paginatedProcessos.map((processo) => {
            const style = statusConfig[processo.status || ''] || statusConfig['Em Andamento'];
            const clienteName = getClienteName(processo.cliente_id);
            const partes = processo.partes_json || [];
            const parteAtiva = partes.find(p => p.polo === 'ativo');
            const partePassiva = partes.find(p => p.polo === 'passivo');
            const movCount = processo.movimentos_json?.length || 0;

            return (
              <div
                key={processo.id}
                className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-5 py-4 cursor-pointer hover:bg-accent/30 transition-colors group"
                onClick={() => onProcessoClick(processo)}
              >
                {/* Cliente / Partes */}
                <div className="space-y-1.5 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Cliente</p>
                  {clienteName ? (
                    <p className="text-sm font-semibold text-foreground truncate">{clienteName}</p>
                  ) : parteAtiva ? (
                    <p className="text-sm font-semibold text-foreground truncate">{parteAtiva.nome}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground/50">—</p>
                  )}
                  {parteAtiva && (
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${poloBadgeConfig['ativo'].bg} ${poloBadgeConfig['ativo'].text}`}>
                      Requerente
                    </span>
                  )}
                  {partePassiva && (
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-[11px] text-muted-foreground">Envolvido</p>
                      <p className="text-xs text-foreground/80 truncate">{partePassiva.nome}</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${poloBadgeConfig['passivo'].bg} ${poloBadgeConfig['passivo'].text}`}>
                        Requerido
                      </span>
                    </div>
                  )}
                </div>

                {/* Número do Processo */}
                <div className="space-y-1.5 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Número do processo</p>
                  <p className="font-mono text-sm font-semibold text-foreground truncate">
                    {processo.numero_processo || '—'}
                  </p>
                  {processo.assunto && (
                    <>
                      <p className="text-[11px] text-muted-foreground mt-1">Assunto</p>
                      <p className="text-xs text-foreground/80 truncate">{processo.assunto}</p>
                    </>
                  )}
                  {!processo.assunto && processo.titulo_acao && (
                    <>
                      <p className="text-[11px] text-muted-foreground mt-1">Classe</p>
                      <p className="text-xs text-foreground/80 truncate">{processo.titulo_acao}</p>
                    </>
                  )}
                </div>

                {/* Órgão */}
                <div className="space-y-1.5 min-w-0">
                  {processo.tribunal ? (
                    <>
                      <p className="text-xs text-muted-foreground font-medium">Tribunal</p>
                      <p className="text-sm font-medium text-foreground truncate">{processo.tribunal}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground font-medium">Órgão</p>
                      <p className="text-sm text-muted-foreground/50">—</p>
                    </>
                  )}
                  {processo.orgao_julgador && processo.orgao_julgador !== 'Não informado' && (
                    <>
                      <p className="text-[11px] text-muted-foreground mt-1">Órgão julgador</p>
                      <p className="text-xs text-foreground/80 truncate">{processo.orgao_julgador}</p>
                    </>
                  )}
                </div>

                {/* Status */}
                <div className="flex flex-col items-end justify-between w-28">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                    {processo.status || 'Indefinido'}
                  </span>
                  <div className="flex items-center gap-1 mt-auto pt-2">
                    {movCount > 0 && (
                      <span className="text-[10px] text-muted-foreground/60">{movCount} mov.</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden rounded-xl border border-border bg-card shadow-soft overflow-hidden divide-y divide-border">
        {paginatedProcessos.map((processo) => {
          const style = statusConfig[processo.status || ''] || statusConfig['Em Andamento'];
          const clienteName = getClienteName(processo.cliente_id);
          const partes = processo.partes_json || [];
          const parteAtiva = partes.find(p => p.polo === 'ativo');

          return (
            <div
              key={processo.id}
              className="p-4 active:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => onProcessoClick(processo)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${style.bg} ${style.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {processo.status || 'Indefinido'}
                    </span>
                    {processo.tribunal && (
                      <span className="text-[10px] text-muted-foreground">{processo.tribunal}</span>
                    )}
                  </div>
                  <p className="font-semibold text-sm truncate">
                    {clienteName || parteAtiva?.nome || processo.titulo_acao || 'Sem título'}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{processo.numero_processo || '—'}</p>
                  {processo.assunto && (
                    <p className="text-xs text-muted-foreground truncate">{processo.assunto}</p>
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
