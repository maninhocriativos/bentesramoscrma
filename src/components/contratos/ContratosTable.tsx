import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileSignature, Clock, CheckCircle2, XCircle, AlertCircle,
  ExternalLink, FileText, MessageSquare, Loader2, AlertTriangle,
  Search, Megaphone,
} from 'lucide-react';
import { ContratoComStatus } from '@/pages/ContratosPage';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ContratoDetailModal } from './ContratoDetailModal';

interface ContratosTableProps {
  contratos: ContratoComStatus[];
}

// ─── Config de status ─────────────────────────────────────────────────────────
const statusConfig: Record<string, {
  label: string;
  dot: string;
  text: string;
  bg: string;
  border: string;
}> = {
  'Documento Enviado': {
    label: 'Enviado',
    dot: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200/60 dark:border-blue-800/60',
  },
  'Aguardando Assinatura': {
    label: 'Aguardando',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200/60 dark:border-amber-800/60',
  },
  'Assinatura Parcial': {
    label: 'Parcial',
    dot: 'bg-orange-500',
    text: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200/60 dark:border-orange-800/60',
  },
  'Assinado': {
    label: 'Assinado',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200/60 dark:border-emerald-800/60',
  },
  'Finalizado': {
    label: 'Finalizado',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200/60 dark:border-emerald-800/60',
  },
  'Prazo Expirado': {
    label: 'Expirado',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200/60 dark:border-red-800/60',
  },
  'Cancelado': {
    label: 'Cancelado',
    dot: 'bg-zinc-400',
    text: 'text-zinc-500 dark:text-zinc-400',
    bg: 'bg-zinc-100 dark:bg-zinc-800/40',
    border: 'border-zinc-200/60 dark:border-zinc-700/60',
  },
  'Recusado': {
    label: 'Recusado',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200/60 dark:border-red-800/60',
  },
};

const ITEMS_PER_PAGE = 30;

// ─── Badge de status ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig['Aguardando Assinatura'];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border',
      cfg.bg, cfg.text, cfg.border
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function ContratosTable({ contratos }: ContratosTableProps) {
  const { toast } = useToast();
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedContrato, setSelectedContrato] = useState<ContratoComStatus | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const sendContractReminder = async (contrato: ContratoComStatus, type: 'soft' | 'urgent') => {
    setSendingReminder(contrato.id);
    try {
      const { data, error } = await supabase.functions.invoke('contract-reminder', {
        body: { documentKey: contrato.key, documentName: contrato.leadNome, reminderType: type },
      });
      if (error) {
        let errorMsg = 'Não foi possível enviar.';
        try {
          const body = await (error as any)?.context?.json?.();
          if (body?.error) errorMsg = body.error;
          if (body?.details) errorMsg += ` — ${body.details}`;
        } catch {
          if (error.message) errorMsg = error.message;
        }
        toast({ title: 'Erro ao enviar cobrança', description: errorMsg, variant: 'destructive' });
        return;
      }
      if (data?.success) {
        toast({ title: 'Cobrança enviada!', description: `Mensagem enviada para ${data.lead?.nome || 'o cliente'}.` });
      } else {
        toast({ title: 'Falha ao enviar', description: data?.error || 'Erro desconhecido', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error?.message || 'Não foi possível enviar.', variant: 'destructive' });
    } finally {
      setSendingReminder(null);
    }
  };

  const isPending = (status: string) =>
    ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'].includes(status);

  const filtered = contratos.filter(c => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      c.leadNome.toLowerCase().includes(s) ||
      (c.leadEmail || '').toLowerCase().includes(s) ||
      c.status.toLowerCase().includes(s) ||
      (c.signatarioNome || '').toLowerCase().includes(s) ||
      (c.key || '').toLowerCase().includes(s)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedContratos = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  return (
    <>
      <div className="rounded-2xl border border-[#c9a96e]/20 bg-card overflow-hidden shadow-sm">

        {/* ── Barra de busca ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#c9a96e]/10 bg-[#faf8f5] dark:bg-[#2a1f14]/40">
          <Search className="h-4 w-4 text-[#c9a96e]/50 shrink-0" />
          <Input
            placeholder="Busca rápida por nome, email, status..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 px-0 text-sm placeholder:text-muted-foreground/40"
          />
          {search && (
            <button onClick={() => handleSearchChange('')} className="text-xs text-[#c9a96e] hover:underline shrink-0">
              Limpar
            </button>
          )}
          <span className="text-xs text-muted-foreground/60 whitespace-nowrap tabular-nums">
            {filtered.length} / {contratos.length}
          </span>
        </div>

        {/* ── Vazio ── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-14 w-14 rounded-2xl bg-[#c9a96e]/10 flex items-center justify-center">
              <FileText className="h-7 w-7 text-[#c9a96e]/30" />
            </div>
            <p className="text-sm font-medium">Nenhum contrato encontrado</p>
            <p className="text-xs text-muted-foreground">
              {search ? 'Tente um termo diferente' : 'Envie contratos pelo Clicksign para vê-los aqui'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Tabela Desktop ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="bg-[#3d2b1f]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#c9a96e]/70 uppercase tracking-widest w-[120px]">Status</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#c9a96e]/70 uppercase tracking-widest w-[32%]">Documento</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#c9a96e]/70 uppercase tracking-widest w-[20%]">Signatário</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#c9a96e]/70 uppercase tracking-widest w-[13%]">Categoria</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#c9a96e]/70 uppercase tracking-widest w-[14%]">Atualização</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#c9a96e]/70 uppercase tracking-widest w-[120px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedContratos.map((contrato, idx) => (
                    <tr
                      key={contrato.id}
                      onClick={() => setSelectedContrato(contrato)}
                      className={cn(
                        'border-b border-[#c9a96e]/8 cursor-pointer transition-colors group',
                        idx % 2 === 0
                          ? 'bg-white dark:bg-card hover:bg-[#faf8f5] dark:hover:bg-[#c9a96e]/5'
                          : 'bg-[#faf8f5]/60 dark:bg-[#3d2b1f]/5 hover:bg-[#f5f0e8] dark:hover:bg-[#c9a96e]/5'
                      )}
                    >
                      <td className="px-4 py-3">
                        <StatusBadge status={contrato.status} />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="font-medium text-foreground leading-snug truncate group-hover:text-[#3d2b1f] dark:group-hover:text-[#c9a96e] transition-colors"
                            title={contrato.leadNome}
                          >
                            {contrato.leadNome}
                          </span>
                          {contrato.tipoOrigem === 'trafego' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 shrink-0">
                              <Megaphone className="h-2.5 w-2.5" />
                              Tráfego
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {contrato.signatarioNome
                          ? <span className="text-xs text-foreground/70 truncate block">{contrato.signatarioNome}</span>
                          : <span className="text-muted-foreground/25 text-sm">—</span>
                        }
                      </td>

                      <td className="px-4 py-3">
                        {contrato.tipoAcao
                          ? (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#c9a96e]/12 text-[#3d2b1f] dark:text-[#c9a96e] border border-[#c9a96e]/20">
                              {contrato.tipoAcao}
                            </span>
                          )
                          : <span className="text-muted-foreground/25 text-sm">—</span>
                        }
                      </td>

                      <td className="px-4 py-3">
                        {contrato.lastUpdate
                          ? (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {new Date(contrato.lastUpdate).toLocaleDateString('pt-BR', {
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          )
                          : <span className="text-muted-foreground/25 text-sm">—</span>
                        }
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={e => e.stopPropagation()}
                        >
                          {isPending(contrato.status) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                                  disabled={sendingReminder === contrato.id}
                                >
                                  {sendingReminder === contrato.id
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <MessageSquare className="h-3 w-3" />
                                  }
                                  Cobrar
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-xs">
                                <DropdownMenuItem onSelect={() => sendContractReminder(contrato, 'soft')} className="gap-2 text-xs">
                                  <MessageSquare className="h-3.5 w-3.5" /> Lembrete amigável
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => sendContractReminder(contrato, 'urgent')} className="gap-2 text-xs text-destructive">
                                  <AlertTriangle className="h-3.5 w-3.5" /> Cobrança urgente
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-[#c9a96e]/60 hover:text-[#c9a96e] hover:bg-[#c9a96e]/10"
                          >
                            <a href={contrato.linkContrato} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Cards Mobile ── */}
            <div className="md:hidden divide-y divide-[#c9a96e]/10">
              {paginatedContratos.map(contrato => (
                <div
                  key={contrato.id}
                  onClick={() => setSelectedContrato(contrato)}
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#c9a96e]/5 transition-colors"
                >
                  <StatusBadge status={contrato.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium truncate">{contrato.leadNome}</p>
                      {contrato.tipoOrigem === 'trafego' && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-blue-100 text-blue-700">
                          <Megaphone className="h-2 w-2" />Tráfego
                        </span>
                      )}
                    </div>
                    {contrato.lastUpdate && (
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {new Date(contrato.lastUpdate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {isPending(contrato.status) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-600" disabled={sendingReminder === contrato.id}>
                            {sendingReminder === contrato.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <MessageSquare className="h-3.5 w-3.5" />
                            }
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => sendContractReminder(contrato, 'soft')} className="gap-2 text-xs">
                            <MessageSquare className="h-3.5 w-3.5" /> Lembrete
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => sendContractReminder(contrato, 'urgent')} className="gap-2 text-xs text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5" /> Urgente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#c9a96e]/60">
                      <a href={contrato.linkContrato} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Paginação ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#c9a96e]/10 bg-[#faf8f5]/60 dark:bg-[#2a1f14]/30">
            <span className="text-xs text-muted-foreground tabular-nums">
              {((safePage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="sm"
                className="h-7 px-2 text-xs hover:bg-[#c9a96e]/10"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                ← Anterior
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === 'ellipsis'
                    ? <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                    : (
                      <Button
                        key={p}
                        variant={p === safePage ? 'default' : 'ghost'}
                        size="sm"
                        className={cn(
                          'h-7 w-7 p-0 text-xs',
                          p === safePage
                            ? 'bg-[#3d2b1f] text-[#c9a96e] hover:bg-[#3d2b1f]/90'
                            : 'hover:bg-[#c9a96e]/10'
                        )}
                        onClick={() => setCurrentPage(p as number)}
                      >
                        {p}
                      </Button>
                    )
                )}
              <Button
                variant="ghost" size="sm"
                className="h-7 px-2 text-xs hover:bg-[#c9a96e]/10"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Próxima →
              </Button>
            </div>
          </div>
        )}
      </div>

      <ContratoDetailModal
        contrato={selectedContrato}
        isOpen={!!selectedContrato}
        onClose={() => setSelectedContrato(null)}
      />
    </>
  );
}
