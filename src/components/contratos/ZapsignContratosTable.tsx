import { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ExternalLink, Search, ChevronLeft, ChevronRight, Zap, Building2, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ContratoZapsignComStatus, TipoOrigemZapsign } from '@/hooks/useZapsignContratos';
import { cn } from '@/lib/utils';

interface ZapsignContratosTableProps {
  contratos: ContratoZapsignComStatus[];
  isLoading: boolean;
  activeTab: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Assinado':               'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Assinatura Parcial':     'bg-blue-50 text-blue-700 border-blue-200',
  'Aguardando Assinatura':  'bg-amber-50 text-amber-700 border-amber-200',
  'Rejeitado':              'bg-red-50 text-red-700 border-red-200',
  'Cancelado':              'bg-zinc-100 text-zinc-600 border-zinc-200',
  'Expirado':               'bg-orange-50 text-orange-700 border-orange-200',
};

const ORIGEM_CONFIG: Record<TipoOrigemZapsign, { label: string; className: string; icon: React.ElementType }> = {
  trafego:    { label: 'Tráfego',   className: 'bg-blue-50 text-blue-700 border-blue-300',     icon: Zap },
  escritorio: { label: 'Escritório', className: 'bg-purple-50 text-purple-700 border-purple-300', icon: Building2 },
  indefinido: { label: 'Indefinido', className: 'bg-zinc-50 text-zinc-500 border-zinc-200',      icon: HelpCircle },
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function OrigemBadge({ origem }: { origem: TipoOrigemZapsign }) {
  const cfg = ORIGEM_CONFIG[origem];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 text-xs', cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

export function ZapsignContratosTable({ contratos, isLoading, activeTab }: ZapsignContratosTableProps) {
  const [searchTerm, setSearchTerm]     = useState('');
  const [origemFilter, setOrigemFilter] = useState<string>('todas');
  const [page, setPage]                 = useState(1);
  const [pageSize, setPageSize]         = useState(10);

  // Filtra por aba ativa
  const byTab = useMemo(() => contratos.filter(c => {
    switch (activeTab) {
      case 'zapsign-em-assinatura': return c.statusLocal === 'Aguardando Assinatura';
      case 'zapsign-assinados':     return c.statusLocal === 'Assinado';
      case 'zapsign-cancelados':    return ['Cancelado','Rejeitado','Expirado'].includes(c.statusLocal);
      default: return true;
    }
  }), [contratos, activeTab]);

  // Filtra por busca e origem — reseta página ao mudar filtros
  const filtered = useMemo(() => {
    setPage(1);
    const q = searchTerm.toLowerCase();
    return byTab.filter(c => {
      const matchSearch =
        !q ||
        (c.name        || '').toLowerCase().includes(q) ||
        (c.leadNome    || '').toLowerCase().includes(q) ||
        (c.leadEmail   || '').toLowerCase().includes(q) ||
        (c.leadPhone   || '').toLowerCase().includes(q);
      const matchOrigem = origemFilter === 'todas' || c.tipoOrigem === origemFilter;
      return matchSearch && matchOrigem;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byTab, searchTerm, origemFilter]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handlePageChange = (p: number) => setPage(Math.min(Math.max(1, p), totalPages));

  // Contagem por origem (da lista filtrada por aba, sem filtro origem)
  const countTrafego    = byTab.filter(c => c.tipoOrigem === 'trafego').length;
  const countEscritorio = byTab.filter(c => c.tipoOrigem === 'escritorio').length;
  const countIndefinido = byTab.filter(c => c.tipoOrigem === 'indefinido').length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Carregando contratos Zapsign...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">

      {/* Resumo rápido por origem */}
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
          <span className="rounded-full bg-current/10 px-1.5 py-0.5 text-[10px] font-semibold">
            {byTab.length}
          </span>
        </button>

        <button
          onClick={() => setOrigemFilter('trafego')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
            origemFilter === 'trafego'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-400'
          )}
        >
          <Zap className="h-3 w-3" />
          Tráfego
          <span className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            origemFilter === 'trafego' ? 'bg-white/20' : 'bg-blue-100'
          )}>
            {countTrafego}
          </span>
        </button>

        <button
          onClick={() => setOrigemFilter('escritorio')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
            origemFilter === 'escritorio'
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-purple-50 border-purple-200 text-purple-700 hover:border-purple-400'
          )}
        >
          <Building2 className="h-3 w-3" />
          Escritório
          <span className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            origemFilter === 'escritorio' ? 'bg-white/20' : 'bg-purple-100'
          )}>
            {countEscritorio}
          </span>
        </button>

        {countIndefinido > 0 && (
          <button
            onClick={() => setOrigemFilter('indefinido')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              origemFilter === 'indefinido'
                ? 'bg-zinc-600 text-white border-zinc-600'
                : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-400'
            )}
          >
            <HelpCircle className="h-3 w-3" />
            Indefinido
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              origemFilter === 'indefinido' ? 'bg-white/20' : 'bg-zinc-100'
            )}>
              {countIndefinido}
            </span>
          </button>
        )}

        {/* Busca */}
        <div className="ml-auto relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, telefone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs w-56"
          />
        </div>
      </div>

      {/* Tabela */}
      {paginated.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <p className="font-medium text-sm">Nenhum contrato encontrado</p>
            <p className="text-xs text-muted-foreground">Tente ajustar os filtros ou criar um novo contrato</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-semibold">Contrato</TableHead>
                <TableHead className="text-xs font-semibold">Signatário</TableHead>
                <TableHead className="text-xs font-semibold">Origem</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Criado</TableHead>
                <TableHead className="text-xs font-semibold">Assinado</TableHead>
                <TableHead className="text-xs font-semibold text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((c, idx) => (
                <TableRow
                  key={c.id}
                  className={cn(
                    'hover:bg-muted/30 transition-colors',
                    idx % 2 === 0 ? '' : 'bg-muted/10'
                  )}
                >
                  {/* Contrato */}
                  <TableCell className="max-w-[200px]">
                    <p className="font-medium text-sm truncate" title={c.name}>{c.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{c.id.slice(0, 8)}…</p>
                  </TableCell>

                  {/* Signatário */}
                  <TableCell>
                    <p className="text-sm font-medium">{c.leadNome || '—'}</p>
                    <p className="text-[11px] text-muted-foreground">{c.leadEmail || '—'}</p>
                    {c.leadPhone && (
                      <p className="text-[11px] text-muted-foreground">{c.leadPhone}</p>
                    )}
                  </TableCell>

                  {/* Origem */}
                  <TableCell>
                    <OrigemBadge origem={c.tipoOrigem} />
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', STATUS_COLORS[c.statusLocal] || 'bg-zinc-50 text-zinc-600 border-zinc-200')}
                    >
                      {c.statusLocal}
                    </Badge>
                  </TableCell>

                  {/* Criado */}
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {c.created_at
                      ? format(new Date(c.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })
                      : '—'}
                  </TableCell>

                  {/* Assinado */}
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {c.signers?.[0]?.signed_at
                      ? format(new Date(c.signers[0].signed_at), 'dd/MM/yy HH:mm', { locale: ptBR })
                      : '—'}
                  </TableCell>

                  {/* Link */}
                  <TableCell className="text-right">
                    {c.signers?.[0]?.sign_url ? (
                      <a
                        href={c.signers[0].sign_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-7 w-7 rounded-lg hover:bg-muted transition-colors"
                        title="Abrir link de assinatura"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Paginação */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          {/* Info */}
          <div className="flex items-center gap-3">
            <span>
              Exibindo <span className="font-semibold text-foreground">{(page - 1) * pageSize + 1}</span>–
              <span className="font-semibold text-foreground">{Math.min(page * pageSize, filtered.length)}</span>
              {' '}de{' '}
              <span className="font-semibold text-foreground">{filtered.length}</span> contratos
            </span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(s => (
                  <SelectItem key={s} value={String(s)}>{s} / pág</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Navegação */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handlePageChange(1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-3 w-3" />
              <ChevronLeft className="h-3 w-3 -ml-2" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>

            {/* Páginas numéricas */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <Button
                  key={p}
                  variant={page === p ? 'default' : 'outline'}
                  size="icon"
                  className={cn('h-7 w-7 text-xs', page === p && 'bg-cyan-600 hover:bg-cyan-700 border-cyan-600')}
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handlePageChange(totalPages)}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-3 w-3" />
              <ChevronRight className="h-3 w-3 -ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
