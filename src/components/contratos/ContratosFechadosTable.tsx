import { useMemo, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Loader2, Search, Zap, Building2, HelpCircle, CheckCircle2,
  XCircle, Handshake, Send,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMetaCapi } from '@/hooks/useMetaCapi';
import type { ContratoFechadoComStatus } from '@/hooks/useContratosFechados';

interface ContratosFechadosTableProps {
  contratos: ContratoFechadoComStatus[];
  isLoading: boolean;
  onRefresh?: () => void;
}

const ORIGEM_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  trafego:    { label: 'Tráfego',   className: 'bg-blue-50 text-blue-700 border-blue-300',     icon: Zap },
  escritorio: { label: 'Escritório', className: 'bg-purple-50 text-purple-700 border-purple-300', icon: Building2 },
  indefinido: { label: 'Indefinido', className: 'bg-zinc-50 text-zinc-500 border-zinc-200',      icon: HelpCircle },
};

function OrigemBadge({ origem }: { origem: string }) {
  const cfg = ORIGEM_CONFIG[origem] || ORIGEM_CONFIG.indefinido;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 text-xs', cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function ConfirmadoBadge({ contrato }: { contrato: ContratoFechadoComStatus }) {
  if (contrato.confirmadoDigitalmente === true) {
    const label = contrato.confirmadoProvider === 'zapsign' ? 'ZapSign' : 'ClickSign';
    return (
      <Badge variant="outline" className="gap-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Confirmado ({label})
      </Badge>
    );
  }
  if (contrato.confirmadoDigitalmente === false) {
    return (
      <Badge variant="outline" className="gap-1 text-xs bg-amber-50 text-amber-700 border-amber-300">
        <XCircle className="h-3 w-3" /> Não encontrado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-xs bg-muted text-muted-foreground border-border">
      <Handshake className="h-3 w-3" /> Presencial
    </Badge>
  );
}

export function ContratosFechadosTable({ contratos, isLoading, onRefresh }: ContratosFechadosTableProps) {
  const { toast } = useToast();
  const { sendMetaEvent } = useMetaCapi();
  const [searchTerm, setSearchTerm] = useState('');
  const [origemFilter, setOrigemFilter] = useState<string>('todas');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return contratos.filter(c => {
      const matchSearch = !q ||
        (c.leadNome || '').toLowerCase().includes(q) ||
        (c.tipo_contrato || '').toLowerCase().includes(q);
      const matchOrigem = origemFilter === 'todas' || c.tipoOrigem === origemFilter;
      return matchSearch && matchOrigem;
    });
  }, [contratos, searchTerm, origemFilter]);

  const countTrafego    = contratos.filter(c => c.tipoOrigem === 'trafego').length;
  const countEscritorio = contratos.filter(c => c.tipoOrigem === 'escritorio').length;
  const countIndefinido = contratos.filter(c => c.tipoOrigem === 'indefinido').length;

  const handleRetryMeta = async (c: ContratoFechadoComStatus) => {
    if (!c.lead_id) return;
    setRetryingId(c.id);
    try {
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('email, telefone, facebook_lead_id')
        .eq('id', c.lead_id)
        .maybeSingle();

      const result = await sendMetaEvent({
        lead_id:              c.lead_id,
        facebook_lead_id:     (lead as any)?.facebook_lead_id ?? null,
        email:                (lead as any)?.email ?? null,
        phone:                (lead as any)?.telefone ?? null,
        nome:                 c.leadNome,
        event_name:           'Purchase',
        value:                c.valor_contrato ?? 0,
        status:               'Contrato Assinado',
        tipo_contrato:        c.tipo_contrato,
        quantidade_contratos: c.quantidade_contratos,
      });

      if (result.success) {
        await supabase.from('contratos_fechados' as any).update({ meta_conversion_sent: true } as any).eq('id', c.id);
        onRefresh?.();
      } else {
        toast({ title: 'Falha ao reenviar', description: result.warning || result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Falha ao reenviar', description: err.message, variant: 'destructive' });
    } finally {
      setRetryingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Carregando contratos fechados...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo por origem */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setOrigemFilter('todas')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
            origemFilter === 'todas'
              ? 'bg-foreground text-background border-foreground'
              : 'bg-background border-border text-muted-foreground hover:border-foreground/30'
          )}
        >
          Todos
          <span className="rounded-full bg-current/10 px-1.5 py-0.5 text-[10px] font-semibold">{contratos.length}</span>
        </button>
        <button
          onClick={() => setOrigemFilter('trafego')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
            origemFilter === 'trafego' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-400'
          )}
        >
          <Zap className="h-3 w-3" /> Tráfego
          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', origemFilter === 'trafego' ? 'bg-white/20' : 'bg-blue-100')}>{countTrafego}</span>
        </button>
        <button
          onClick={() => setOrigemFilter('escritorio')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
            origemFilter === 'escritorio' ? 'bg-purple-600 text-white border-purple-600' : 'bg-purple-50 border-purple-200 text-purple-700 hover:border-purple-400'
          )}
        >
          <Building2 className="h-3 w-3" /> Escritório
          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', origemFilter === 'escritorio' ? 'bg-white/20' : 'bg-purple-100')}>{countEscritorio}</span>
        </button>
        {countIndefinido > 0 && (
          <button
            onClick={() => setOrigemFilter('indefinido')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              origemFilter === 'indefinido' ? 'bg-zinc-600 text-white border-zinc-600' : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-400'
            )}
          >
            <HelpCircle className="h-3 w-3" /> Indefinido
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', origemFilter === 'indefinido' ? 'bg-white/20' : 'bg-zinc-100')}>{countIndefinido}</span>
          </button>
        )}
        <div className="ml-auto relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por lead ou tipo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs w-56"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <p className="font-medium text-sm">Nenhum contrato encontrado</p>
            <p className="text-xs text-muted-foreground">Registros feitos pelo botão "Contrato Fechado" no chat aparecem aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-semibold">Lead</TableHead>
                <TableHead className="text-xs font-semibold">Tipo</TableHead>
                <TableHead className="text-xs font-semibold">Qtd.</TableHead>
                <TableHead className="text-xs font-semibold">Modalidade</TableHead>
                <TableHead className="text-xs font-semibold">Origem</TableHead>
                <TableHead className="text-xs font-semibold">Confirmado</TableHead>
                <TableHead className="text-xs font-semibold">Meta</TableHead>
                <TableHead className="text-xs font-semibold">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c, idx) => (
                <TableRow key={c.id} className={cn('hover:bg-muted/30 transition-colors', idx % 2 === 0 ? '' : 'bg-muted/10')}>
                  <TableCell className="max-w-[180px]">
                    <p className="font-medium text-sm truncate" title={c.leadNome || ''}>{c.leadNome || '—'}</p>
                  </TableCell>
                  <TableCell className="max-w-[160px]">
                    <p className="text-xs truncate" title={c.tipo_contrato}>{c.tipo_contrato}</p>
                  </TableCell>
                  <TableCell className="text-sm">{c.quantidade_contratos}</TableCell>
                  <TableCell className="text-xs">{c.modalidade_assinatura === 'online' ? '💻 Online' : '🤝 Presencial'}</TableCell>
                  <TableCell><OrigemBadge origem={c.tipoOrigem} /></TableCell>
                  <TableCell><ConfirmadoBadge contrato={c} /></TableCell>
                  <TableCell>
                    {c.tipoOrigem !== 'trafego' ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : c.meta_conversion_sent ? (
                      <Badge variant="outline" className="gap-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Enviado
                      </Badge>
                    ) : (
                      <Button
                        size="sm" variant="outline"
                        onClick={() => handleRetryMeta(c)}
                        disabled={retryingId === c.id}
                        className="h-7 gap-1 text-[11px] border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        {retryingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Reenviar
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {c.created_at ? format(new Date(c.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
