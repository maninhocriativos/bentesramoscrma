import { useState, useMemo, useRef } from 'react';
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ExternalLink, Search, ChevronLeft, ChevronRight, Zap, Building2, HelpCircle, MessageCircle, AlertTriangle, MoreHorizontal, Trash2, Link2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ContratoZapsignComStatus, TipoOrigemZapsign } from '@/hooks/useZapsignContratos';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ZapsignContratosTableProps {
  contratos: ContratoZapsignComStatus[];
  isLoading: boolean;
  activeTab: string;
  onRefresh?: () => void;
}

interface LeadSugestao {
  id: string; nome: string | null; email: string | null;
  telefone: string | null; tipo_origem: string | null;
  matchType: 'telefone' | 'email' | 'nome' | 'busca';
}

// ─── Vincular Lead (ZapSign) ────────────────────────────────────────────────
// Mesma ideia do "Vincular Lead" que já existe no ClickSign (ContratoDetailModal),
// mas o ZapSign não tinha nenhum jeito de corrigir manualmente um contrato que o
// matching automático (telefone/email/nome) não conseguiu resolver.
function VincularLeadZapsignDialog({ contrato, open, onOpenChange, onLinked }: {
  contrato: ContratoZapsignComStatus | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLinked: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [sugestoes, setSugestoes] = useState<LeadSugestao[]>([]);
  const [loadingSugestoes, setLoadingSugestoes] = useState(false);
  const [vinculandoId, setVinculandoId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signerName  = contrato?.leadNome  || contrato?.signers?.[0]?.name  || '';
  const signerEmail = contrato?.leadEmail || contrato?.signers?.[0]?.email || '';
  const signerPhone = contrato?.leadPhone || contrato?.signers?.[0]?.phone || '';

  const buscarLeads = async (texto?: string) => {
    setLoadingSugestoes(true);
    try {
      const found: LeadSugestao[] = [];
      const seen = new Set<string>();
      const add = (l: any, type: LeadSugestao['matchType']) => {
        if (!seen.has(l.id)) {
          seen.add(l.id);
          found.push({ id: l.id, nome: l.nome, email: l.email, telefone: l.telefone, tipo_origem: l.tipo_origem, matchType: type });
        }
      };

      if (texto && texto.length >= 2) {
        const [{ data: byNome }, { data: byEmail }, { data: byFone }] = await Promise.all([
          supabase.from('leads_juridicos').select('id, nome, email, telefone, tipo_origem').ilike('nome', `%${texto}%`).limit(5),
          supabase.from('leads_juridicos').select('id, nome, email, telefone, tipo_origem').ilike('email', `%${texto}%`).limit(3),
          supabase.from('leads_juridicos').select('id, nome, email, telefone, tipo_origem').ilike('telefone', `%${texto}%`).limit(3),
        ]);
        for (const l of byNome || []) add(l, 'nome');
        for (const l of byEmail || []) add(l, 'email');
        for (const l of byFone || []) add(l, 'telefone');
      } else {
        if (signerPhone) {
          const norm = signerPhone.replace(/\D/g, '').slice(-8);
          if (norm.length >= 8) {
            const { data } = await supabase.from('leads_juridicos').select('id, nome, email, telefone, tipo_origem').ilike('telefone', `%${norm}`).limit(5);
            for (const l of data || []) add(l, 'telefone');
          }
        }
        if (signerEmail) {
          const { data } = await supabase.from('leads_juridicos').select('id, nome, email, telefone, tipo_origem').eq('email', signerEmail).limit(3);
          for (const l of data || []) add(l, 'email');
        }
        if (signerName && found.length < 5) {
          const firstName = signerName.split(' ')[0];
          if (firstName.length >= 3) {
            const { data } = await supabase.from('leads_juridicos').select('id, nome, email, telefone, tipo_origem').ilike('nome', `${firstName}%`).limit(5);
            for (const l of data || []) add(l, 'nome');
          }
        }
      }
      setSugestoes(found.slice(0, 8));
    } catch (err: any) {
      toast({ title: 'Erro ao buscar leads', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingSugestoes(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
    if (v) { setSearch(''); setSugestoes([]); buscarLeads(); }
    else { if (debounceRef.current) clearTimeout(debounceRef.current); setSugestoes([]); setSearch(''); }
  };

  const handleVincular = async (leadId: string) => {
    if (!contrato) return;
    setVinculandoId(leadId);
    try {
      // Atualiza se já existe registro local, insere se não (documentos criados
      // direto no painel ZapSign, sem passar pelo CRM, não têm linha aqui ainda).
      const { data: updated, error: updateErr } = await supabase
        .from('contract_reminders_zapsign')
        .update({ lead_id: leadId })
        .eq('document_id', contrato.id)
        .select('id');
      if (updateErr) throw updateErr;

      if (!updated || updated.length === 0) {
        const { error: insertErr } = await supabase
          .from('contract_reminders_zapsign')
          .insert({
            document_id: contrato.id,
            document_name: contrato.name || 'Documento Zapsign',
            lead_id: leadId,
            signer_name: signerName || null,
            signer_email: signerEmail || null,
            signer_phone: signerPhone || null,
          });
        if (insertErr) throw insertErr;
      }

      toast({ title: 'Lead vinculado!', description: 'O contrato foi vinculado a este lead.' });
      handleOpenChange(false);
      onLinked();
    } catch (err: any) {
      toast({ title: 'Erro ao vincular', description: err.message, variant: 'destructive' });
    } finally {
      setVinculandoId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Vincular lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground truncate" title={contrato?.name}>
            {contrato?.name}
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
            <Input
              placeholder="Nome, email ou telefone..."
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => buscarLeads(val), 400);
              }}
              className="pl-8 h-9 text-sm"
              autoFocus
            />
          </div>

          {loadingSugestoes && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loadingSugestoes && sugestoes.length === 0 && search.length >= 2 && (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum lead encontrado</p>
          )}
          {!loadingSugestoes && sugestoes.length === 0 && search.length < 2 && (
            <p className="text-[11px] text-muted-foreground text-center py-1">Sugestões automáticas por telefone, email e nome do signatário</p>
          )}

          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {sugestoes.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-border/60 hover:border-border transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-xs font-medium text-foreground truncate">{s.nome || '—'}</span>
                    <span className={cn(
                      'text-[9px] px-1 py-0.5 rounded font-semibold shrink-0',
                      s.matchType === 'telefone' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      s.matchType === 'email'    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                   'bg-muted text-muted-foreground'
                    )}>
                      {s.matchType === 'telefone' ? 'Fone' : s.matchType === 'email' ? 'Email' : 'Nome'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{s.email || s.telefone || ''}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleVincular(s.id)}
                  disabled={!!vinculandoId}
                  className="h-7 px-2.5 text-[11px] shrink-0"
                >
                  {vinculandoId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Vincular'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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

export function ZapsignContratosTable({ contratos, isLoading, activeTab, onRefresh }: ZapsignContratosTableProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm]     = useState('');
  const [origemFilter, setOrigemFilter] = useState<string>('todas');
  const [page, setPage]                 = useState(1);
  const [pageSize, setPageSize]         = useState(10);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [vincularContrato, setVincularContrato] = useState<ContratoZapsignComStatus | null>(null);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);

  // Abre o PDF assinado — nunca existia como funcionar antes: uma vez o
  // cliente assinando, o link que sobrava na tela ("Abrir documento") era o
  // de ASSINATURA, não o do arquivo final. Prioriza a cópia arquivada no
  // Storage (webhook, permanente); sem ela (contratos assinados antes dessa
  // mudança), busca um link temporário direto na Zapsign na hora.
  const baixarAssinado = async (contrato: ContratoZapsignComStatus) => {
    setBaixandoId(contrato.id);
    try {
      if (contrato.signedPdfPath) {
        const { data, error } = await supabase.storage.from('documentos').createSignedUrl(contrato.signedPdfPath, 3600);
        if (error) throw error;
        if (data?.signedUrl) { window.open(data.signedUrl, '_blank', 'noopener,noreferrer'); return; }
      }
      const { data, error } = await supabase.functions.invoke('zapsign', {
        body: { action: 'get_document', document_id: contrato.id },
      });
      if (error) throw new Error(error.message);
      const signedFile = data?.signed_file;
      if (!signedFile) throw new Error('Zapsign ainda não disponibilizou o PDF assinado');
      window.open(signedFile, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast({ title: 'Erro ao abrir PDF assinado', description: err.message, variant: 'destructive' });
    } finally {
      setBaixandoId(null);
    }
  };

  const handleDelete = async (contratoId: string) => {
    setDeletingId(contratoId);
    try {
      // Cancelar na Zapsign
      const { data, error } = await supabase.functions.invoke('zapsign', {
        body: { action: 'cancel_document', document_id: contratoId },
      });
      if (error) throw new Error(error.message);

      // Atualizar status local
      await supabase
        .from('contract_reminders_zapsign')
        .update({ status: 'cancelled' })
        .eq('document_id', contratoId);

      toast({ title: 'Contrato cancelado', description: 'Documento cancelado na Zapsign' });
    } catch (err: any) {
      // Se falhar na Zapsign, apenas cancela localmente
      await supabase
        .from('contract_reminders_zapsign')
        .update({ status: 'cancelled' })
        .eq('document_id', contratoId);
      toast({ title: 'Cancelado localmente', description: 'Não foi possível cancelar na Zapsign, mas o registro foi atualizado' });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const sendReminder = async (contrato: ContratoZapsignComStatus, type: 'soft' | 'urgent') => {
    setSendingReminder(`${contrato.id}-${type}`);
    try {
      const signUrl = contrato.signers?.[0]?.sign_url;
      const { data, error } = await supabase.functions.invoke('zapsign-reminder', {
        body: {
          documentId: contrato.id,
          documentName: contrato.name,
          reminderType: type,
          signUrl,
          leadId: contrato.leadId,
          // Dados do signatário p/ contratos sem registro local (criados direto no ZapSign)
          signerPhone: contrato.leadPhone || contrato.signers?.[0]?.phone,
          signerName: contrato.leadNome || contrato.signers?.[0]?.name,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast({
          title: type === 'urgent' ? '⚠️ Cobrança urgente enviada!' : '✅ Lembrete enviado!',
          description: `WhatsApp enviado para ${contrato.leadNome || contrato.signers?.[0]?.name}`,
        });
      } else {
        throw new Error(data?.error || 'Erro ao enviar');
      }
    } catch (err: any) {
      toast({ title: 'Erro ao enviar lembrete', description: err.message, variant: 'destructive' });
    } finally {
      setSendingReminder(null);
    }
  };

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

                  {/* Ações */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={sendingReminder?.startsWith(c.id)}
                        >
                          {sendingReminder?.startsWith(c.id)
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <MoreHorizontal className="h-3.5 w-3.5" />
                          }
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {/* Lembretes — só para contratos pendentes */}
                        {c.statusLocal === 'Aguardando Assinatura' && (
                          <>
                            <DropdownMenuItem
                              onClick={() => sendReminder(c, 'soft')}
                              className="gap-2 cursor-pointer"
                            >
                              <MessageCircle className="h-4 w-4 text-blue-500" />
                              <div>
                                <p className="text-sm font-medium">Lembrete WhatsApp</p>
                                <p className="text-xs text-muted-foreground">Mensagem amigável</p>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => sendReminder(c, 'urgent')}
                              className="gap-2 cursor-pointer"
                            >
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                              <div>
                                <p className="text-sm font-medium">Cobrança Urgente</p>
                                <p className="text-xs text-muted-foreground">Tom mais assertivo</p>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {/* Baixar PDF assinado — só depois de concluído */}
                        {c.statusLocal === 'Assinado' && (
                          <DropdownMenuItem
                            onClick={() => baixarAssinado(c)}
                            disabled={baixandoId === c.id}
                            className="gap-2 cursor-pointer"
                          >
                            {baixandoId === c.id
                              ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              : <Download className="h-4 w-4 text-emerald-600" />}
                            Baixar PDF assinado
                          </DropdownMenuItem>
                        )}

                        {/* Abrir documento (link de assinatura) */}
                        {c.signers?.[0]?.sign_url && (
                          <DropdownMenuItem asChild>
                            <a
                              href={c.signers[0].sign_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="gap-2 cursor-pointer"
                            >
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              {c.statusLocal === 'Assinado' ? 'Abrir na Zapsign' : 'Abrir documento'}
                            </a>
                          </DropdownMenuItem>
                        )}

                        {/* Vincular lead */}
                        <DropdownMenuItem
                          onClick={() => setVincularContrato(c)}
                          className="gap-2 cursor-pointer"
                        >
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                          {c.tipoOrigem === 'indefinido' ? 'Vincular lead' : 'Trocar lead vinculado'}
                        </DropdownMenuItem>

                        {/* Cancelar */}
                        {!['Cancelado','Rejeitado','Expirado','Assinado'].includes(c.statusLocal) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setConfirmDeleteId(c.id)}
                              className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Cancelar contrato
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Vincular lead */}
      <VincularLeadZapsignDialog
        contrato={vincularContrato}
        open={!!vincularContrato}
        onOpenChange={(v) => { if (!v) setVincularContrato(null); }}
        onLinked={() => onRefresh?.()}
      />

      {/* Dialog de confirmação de cancelamento */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento será cancelado na Zapsign e o signatário não poderá mais assinar.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              disabled={!!deletingId}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Cancelar contrato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
