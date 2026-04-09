import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileSignature, Clock, CheckCircle2, XCircle, AlertCircle,
  ExternalLink, FileText, MessageSquare,
  Loader2, AlertTriangle, Search, Megaphone
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

const statusConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
  icon: React.ReactNode;
}> = {
  'Documento Enviado': {
    label: 'Enviado',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800',
    dotColor: 'bg-blue-500',
    icon: <FileSignature className="h-3 w-3" />,
  },
  'Aguardando Assinatura': {
    label: 'Aguardando',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-500',
    icon: <Clock className="h-3 w-3" />,
  },
  'Assinatura Parcial': {
    label: 'Parcial',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800',
    dotColor: 'bg-orange-500',
    icon: <AlertCircle className="h-3 w-3" />,
  },
  'Assinado': {
    label: 'Assinado',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  'Finalizado': {
    label: 'Finalizado',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  'Prazo Expirado': {
    label: 'Expirado',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
    icon: <XCircle className="h-3 w-3" />,
  },
  'Cancelado': {
    label: 'Cancelado',
    color: 'text-zinc-500 dark:text-zinc-400',
    bgColor: 'bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700',
    dotColor: 'bg-zinc-400',
    icon: <XCircle className="h-3 w-3" />,
  },
  'Recusado': {
    label: 'Recusado',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
    icon: <XCircle className="h-3 w-3" />,
  },
};

const ITEMS_PER_PAGE = 30;

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
        toast({ title: 'Cobrança enviada!', description: `Mensagem ${type === 'urgent' ? 'urgente' : 'de lembrete'} enviada para ${data.lead?.nome || 'o cliente'}.` });
      } else {
        const details = data?.details ? ` — ${data.details}` : '';
        toast({ title: 'Falha ao enviar', description: (data?.error || 'Erro desconhecido') + details, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Erro ao enviar cobrança', description: error?.message || 'Não foi possível enviar.', variant: 'destructive' });
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
      <div className="rounded-xl border border-[#c9a96e]/20 bg-card overflow-hidden shadow-sm">
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#c9a96e]/15 bg-[#3d2b1f]/3">
          <Search className="h-4 w-4 text-[#c9a96e]/60 shrink-0" />
          <Input
            placeholder="Busca rápida por nome, email, status..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 px-0 text-sm placeholder:text-muted-foreground/50"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
            {filtered.length} de {contratos.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-14 w-14 rounded-full bg-[#c9a96e]/10 flex items-center justify-center mb-3">
              <FileText className="h-7 w-7 text-[#c9a96e]/40" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhum contrato encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? 'Tente ajustar a busca' : 'Envie contratos pelo Clicksign para vê-los aqui'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-[#c9a96e]/20 bg-[#3d2b1f]">
                    <th className="text-left px-4 py-3 font-medium text-xs text-[#c9a96e]/80 uppercase tracking-wider w-[115px]">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-[#c9a96e]/80 uppercase tracking-wider w-[30%]">Documento</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-[#c9a96e]/80 uppercase tracking-wider w-[20%]">Signatário</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-[#c9a96e]/80 uppercase tracking-wider w-[12%]">Categoria</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-[#c9a96e]/80 uppercase tracking-wider w-[15%]">Atualização</th>
                    <th className="text-right px-4 py-3 font-medium text-xs text-[#c9a96e]/80 uppercase tracking-wider w-[130px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedContratos.map((contrato, idx) => {
                    const config = statusConfig[contrato.status] || statusConfig['Aguardando Assinatura'];
                    return (
                      <tr
                        key={contrato.id}
                        onClick={() => setSelectedContrato(contrato)}
                        className={cn(
                          'border-b border-[#c9a96e]/8 transition-colors group cursor-pointer',
                          idx % 2 === 0
                            ? 'bg-card hover:bg-[#c9a96e]/5'
                            : 'bg-[#3d2b1f]/[0.02] hover:bg-[#c9a96e]/5'
                        )}
                      >
                        <td className="px-4 py-2.5">
                          <span className={cn(
                            'inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md',
                            config.bgColor,
                            config.color
                          )}>
                            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dotColor)} />
                            {config.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground leading-snug break-words" title={contrato.leadNome}>
                              {contrato.leadNome}
                            </span>
                            {contrato.tipoOrigem === 'trafego' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 shrink-0">
                                <Megaphone className="h-2.5 w-2.5" />
                                Tráfego
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {contrato.signatarioNome ? (
                            <span className="text-foreground/70 text-xs block break-words leading-snug">
                              {contrato.signatarioNome}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {contrato.tipoAcao ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#c9a96e]/10 text-[#3d2b1f] dark:text-[#c9a96e] border border-[#c9a96e]/20">
                              {contrato.tipoAcao}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {contrato.lastUpdate ? (
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {new Date(contrato.lastUpdate).toLocaleDateString('pt-BR', {
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {isPending(contrato.status) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs gap-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                                    disabled={sendingReminder === contrato.id}
                                  >
                                    {sendingReminder === contrato.id
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <MessageSquare className="h-3 w-3" />
                                    }
                                    Cobrar
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
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
                              className="h-7 w-7 p-0 text-[#c9a96e] hover:text-[#3d2b1f] hover:bg-[#c9a96e]/10"
                            >
                              <a href={contrato.linkContrato} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-[#c9a96e]/10">
              {paginatedContratos.map((contrato) => {
                const config = statusConfig[contrato.status] || statusConfig['Aguardando Assinatura'];
                return (
                  <div
                    key={contrato.id}
                    onClick={() => setSelectedContrato(contrato)}
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#c9a96e]/5 transition-colors"
                  >
                    <div className={cn("h-2 w-2 rounded-full shrink-0", config.dotColor)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{contrato.leadNome || contrato.key}</p>
                      <p className="text-xs text-muted-foreground">{contrato.signatarioNome || '—'}</p>
                    </div>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", config.bgColor, config.color)}>
                      {config.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#c9a96e]/15">
                <span className="text-xs text-muted-foreground">
                  Página {safePage} de {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(safePage - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(safePage + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedContrato && (
        <ContratoDetailModal
          contrato={selectedContrato}
          isOpen={!!selectedContrato}
          onClose={() => setSelectedContrato(null)}
        />
      )}
    </>
  );
}
