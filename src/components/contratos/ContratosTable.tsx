import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileSignature, Clock, CheckCircle2, XCircle, AlertCircle,
  ExternalLink, FileText, Mail, Calendar, MessageSquare,
  Loader2, AlertTriangle, Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ContratoComStatus } from '@/pages/ContratosPage';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ContratosTableProps {
  contratos: ContratoComStatus[];
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  'Documento Enviado': { label: 'Enviado', color: 'text-blue-700', bgColor: 'bg-blue-50', icon: <FileSignature className="h-3 w-3" /> },
  'Aguardando Assinatura': { label: 'Aguardando', color: 'text-amber-700', bgColor: 'bg-amber-50', icon: <Clock className="h-3 w-3" /> },
  'Assinatura Parcial': { label: 'Parcial', color: 'text-orange-700', bgColor: 'bg-orange-50', icon: <AlertCircle className="h-3 w-3" /> },
  'Assinado': { label: 'Assinado', color: 'text-emerald-700', bgColor: 'bg-emerald-50', icon: <CheckCircle2 className="h-3 w-3" /> },
  'Finalizado': { label: 'Finalizado', color: 'text-green-700', bgColor: 'bg-green-50', icon: <CheckCircle2 className="h-3 w-3" /> },
  'Prazo Expirado': { label: 'Expirado', color: 'text-red-700', bgColor: 'bg-red-50', icon: <XCircle className="h-3 w-3" /> },
  'Cancelado': { label: 'Cancelado', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: <XCircle className="h-3 w-3" /> },
  'Recusado': { label: 'Recusado', color: 'text-red-700', bgColor: 'bg-red-50', icon: <XCircle className="h-3 w-3" /> },
};

export function ContratosTable({ contratos }: ContratosTableProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const sendContractReminder = async (contrato: ContratoComStatus, type: 'soft' | 'urgent') => {
    setSendingReminder(contrato.id);
    try {
      const { data, error } = await supabase.functions.invoke('contract-reminder', {
        body: { documentKey: contrato.key, documentName: contrato.leadNome, reminderType: type },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: 'Cobrança enviada!', description: `Mensagem ${type === 'urgent' ? 'urgente' : 'de lembrete'} enviada para ${data.lead?.nome || 'o cliente'}.` });
      } else {
        throw new Error(data?.error || 'Erro ao enviar cobrança');
      }
    } catch (error: any) {
      toast({ title: 'Erro ao enviar cobrança', description: error.message || 'Não foi possível enviar.', variant: 'destructive' });
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
      (c.key || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Search Bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Busca rápida..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 px-0 text-sm"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} de {contratos.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
            <FileText className="h-7 w-7 text-muted-foreground/50" />
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Documento</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Signatário</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Categoria</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Atualização</th>
                  <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contrato, idx) => {
                  const config = statusConfig[contrato.status] || statusConfig['Aguardando Assinatura'];
                  return (
                    <tr
                      key={contrato.id}
                      className={cn(
                        'border-b border-border/50 hover:bg-muted/30 transition-colors group',
                        idx % 2 === 0 ? 'bg-card' : 'bg-muted/10'
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary" className={cn('gap-1 text-[11px] font-medium px-2 py-0.5', config.bgColor, config.color)}>
                          {config.icon}
                          {config.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-foreground truncate max-w-[220px] block">{contrato.leadNome}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {contrato.leadEmail ? (
                          <span className="text-muted-foreground truncate max-w-[200px] block">{contrato.leadEmail}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-muted-foreground text-xs">{contrato.tipoAcao || '—'}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {contrato.lastUpdate ? (
                          <span className="text-muted-foreground text-xs">
                            {new Date(contrato.lastUpdate).toLocaleDateString('pt-BR', {
                              day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending(contrato.status) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" disabled={sendingReminder === contrato.id}>
                                  {sendingReminder === contrato.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
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
                          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                            <a href={contrato.linkContrato} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                              <span className="hidden lg:inline">Clicksign</span>
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
          <div className="md:hidden divide-y divide-border">
            {filtered.map((contrato) => {
              const config = statusConfig[contrato.status] || statusConfig['Aguardando Assinatura'];
              return (
                <div key={contrato.id} className="px-4 py-3 flex items-center gap-3">
                  <Badge variant="secondary" className={cn('gap-1 text-[10px] font-medium px-1.5 py-0.5 shrink-0', config.bgColor, config.color)}>
                    {config.icon}
                    {config.label}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{contrato.leadNome}</p>
                    {contrato.lastUpdate && (
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(contrato.lastUpdate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isPending(contrato.status) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={sendingReminder === contrato.id}>
                            {sendingReminder === contrato.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
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
                    <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <a href={contrato.linkContrato} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
