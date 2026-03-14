import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Processo } from '@/types/processos';
import { Lead } from '@/types/leads';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Scale, ChevronRight, Building2, Gavel, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ITEMS_PER_PAGE = 30;

interface ProcessosTableProps {
  processos: Processo[];
  onProcessoClick: (processo: Processo) => void;
  leads: Lead[];
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

  const getClienteName = (clienteId: string | null) => {
    if (!clienteId) return null;
    const lead = leads.find(l => l.id === clienteId);
    return lead?.nome || null;
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
    <div className="rounded-xl border-0 bg-card shadow-enterprise overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary hover:bg-primary border-0">
              <TableHead className="font-semibold text-primary-foreground">Processo</TableHead>
              <TableHead className="font-semibold text-primary-foreground">Classe / Assunto</TableHead>
              <TableHead className="font-semibold text-primary-foreground">Órgão Julgador</TableHead>
              <TableHead className="font-semibold text-primary-foreground">Cliente</TableHead>
              <TableHead className="font-semibold text-primary-foreground">Status</TableHead>
              <TableHead className="font-semibold text-primary-foreground text-right">Última Mov.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processos.map((processo, index) => {
              const style = statusConfig[processo.status || ''] || statusConfig['Em Andamento'];
              const clienteName = getClienteName(processo.cliente_id);
              const movCount = processo.movimentos_json?.length || 0;
              
              return (
                <TableRow 
                  key={processo.id}
                  className={`cursor-pointer hover:bg-accent/30 transition-colors group ${index % 2 === 0 ? 'bg-card' : 'bg-muted/20'}`}
                  onClick={() => onProcessoClick(processo)}
                >
                  <TableCell>
                    <div className="space-y-0.5">
                      <span className="font-mono text-sm font-medium text-foreground">
                        {processo.numero_processo || '—'}
                      </span>
                      {processo.tribunal && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {processo.tribunal}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5 max-w-[220px]">
                      <p className="font-medium text-sm truncate">{processo.titulo_acao || '—'}</p>
                      {processo.assunto && (
                        <p className="text-[11px] text-muted-foreground truncate">{processo.assunto}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px]">
                      {processo.orgao_julgador && processo.orgao_julgador !== 'Não informado' ? (
                        <div className="flex items-start gap-1.5">
                          <Gavel className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="text-sm text-foreground truncate">{processo.orgao_julgador}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {clienteName ? (
                      <span className="text-sm">{clienteName}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {processo.status || 'Indefinido'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-sm text-muted-foreground">
                        {processo.data_ultima_atualizacao 
                          ? format(new Date(processo.data_ultima_atualizacao), 'dd/MM/yyyy', { locale: ptBR })
                          : processo.created_at 
                            ? format(new Date(processo.created_at), 'dd/MM/yyyy', { locale: ptBR })
                            : '—'
                        }
                      </span>
                      {movCount > 0 && (
                        <span className="text-[10px] text-muted-foreground/60">
                          {movCount} mov.
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity inline-block ml-2" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-border">
        {processos.map((processo) => {
          const style = statusConfig[processo.status || ''] || statusConfig['Em Andamento'];
          const clienteName = getClienteName(processo.cliente_id);
          
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
                  <p className="font-medium text-sm truncate">{processo.titulo_acao || 'Sem título'}</p>
                  <p className="font-mono text-xs text-muted-foreground">{processo.numero_processo || '—'}</p>
                  {processo.orgao_julgador && processo.orgao_julgador !== 'Não informado' && (
                    <p className="text-xs text-muted-foreground truncate">{processo.orgao_julgador}</p>
                  )}
                  {clienteName && (
                    <p className="text-xs text-muted-foreground">Cliente: {clienteName}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-1 shrink-0" />
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Footer */}
      <div className="px-4 py-2.5 bg-muted/30 border-t border-border flex items-center justify-between">
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
