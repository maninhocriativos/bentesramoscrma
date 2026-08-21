import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { UserRoundCog, Search, Tag as TagIcon, ArrowRightLeft, PlayCircle, Users, Calendar } from 'lucide-react';

const TZ = 'America/Manaus';

interface Staff { id: string; nome: string; }

interface AtendimentoEvent {
  kind: 'atendimento';
  id: string;
  subscriber_id: string;
  created_at: string;
  action: 'primeiro_atendimento' | 'assumiu' | 'retomou';
  user_id: string;
  user_nome: string;
  previous_user_id: string | null;
  previous_user_nome: string | null;
}

interface TagEvent {
  kind: 'tag';
  id: string;
  subscriber_id: string;
  created_at: string;
  action: 'added' | 'removed';
  tag_nome: string;
  changed_by: string | null;
  changed_by_nome: string;
  reason: string | null;
}

type HistoricoEvent = AtendimentoEvent | TagEvent;

interface SubscriberInfo { nome: string; telefone: string; linha_whatsapp: string | null; }

const primeiroNome = (n: string) => (n || '').split(' ')[0];

function toStartOfDayISO(dateStr: string) {
  return `${dateStr}T00:00:00-04:00`;
}
function toEndOfDayISO(dateStr: string) {
  return `${dateStr}T23:59:59-04:00`;
}
function todayManausStr() {
  return formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
}

export default function HistoricoAtendimentoPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<HistoricoEvent[]>([]);
  const [subscribers, setSubscribers] = useState<Record<string, SubscriberInfo>>({});
  const [staff, setStaff] = useState<Staff[]>([]);

  const [dateFrom, setDateFrom] = useState(todayManausStr());
  const [dateTo, setDateTo] = useState(todayManausStr());
  const [attendantFilter, setAttendantFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'atendimento' | 'tag'>('all');
  const [search, setSearch] = useState('');

  const loadStaff = useCallback(async () => {
    const { data } = await supabase.from('perfis').select('id, nome').not('cargo', 'is', null).order('nome');
    setStaff(((data || []) as any[]).filter(p => p.nome).map(p => ({ id: p.id, nome: p.nome })));
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const fromISO = toStartOfDayISO(dateFrom);
    const toISO = toEndOfDayISO(dateTo);

    const [atendimentoRes, tagRes] = await Promise.all([
      supabase
        .from('chat_atendimento_log' as any)
        .select('id, subscriber_id, created_at, action, user_id, user_nome, previous_user_id, previous_user_nome')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('tag_change_log' as any)
        .select('id, subscriber_id, created_at, action, reason, changed_by, chat_tags(name), perfis(nome)')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    const atendimentoEvents: AtendimentoEvent[] = ((atendimentoRes.data || []) as any[]).map(r => ({
      kind: 'atendimento', id: r.id, subscriber_id: r.subscriber_id, created_at: r.created_at,
      action: r.action, user_id: r.user_id, user_nome: r.user_nome,
      previous_user_id: r.previous_user_id, previous_user_nome: r.previous_user_nome,
    }));

    const tagEvents: TagEvent[] = ((tagRes.data || []) as any[]).map(r => ({
      kind: 'tag', id: r.id, subscriber_id: r.subscriber_id, created_at: r.created_at,
      action: r.action, tag_nome: r.chat_tags?.name || 'Tag removida', changed_by: r.changed_by,
      changed_by_nome: r.perfis?.nome || 'Sistema', reason: r.reason,
    }));

    const merged = [...atendimentoEvents, ...tagEvents].sort((a, b) => b.created_at.localeCompare(a.created_at));
    setEvents(merged);

    const subIds = Array.from(new Set(merged.map(e => e.subscriber_id)));
    if (subIds.length > 0) {
      const { data: subs } = await supabase
        .from('manychat_subscribers')
        .select('subscriber_id, nome, telefone, linha_whatsapp')
        .in('subscriber_id', subIds);
      const map: Record<string, SubscriberInfo> = {};
      ((subs || []) as any[]).forEach(s => { map[s.subscriber_id] = { nome: s.nome || s.subscriber_id, telefone: s.telefone || '', linha_whatsapp: s.linha_whatsapp }; });
      setSubscribers(map);
    } else {
      setSubscribers({});
    }

    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { loadStaff(); }, [loadStaff]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (typeFilter !== 'all' && e.kind !== typeFilter) return false;
      if (attendantFilter !== 'all') {
        const involved = e.kind === 'atendimento'
          ? [e.user_id, e.previous_user_id].filter(Boolean)
          : [e.changed_by].filter(Boolean);
        if (!involved.includes(attendantFilter)) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const sub = subscribers[e.subscriber_id];
        const nome = (sub?.nome || '').toLowerCase();
        const tel = (sub?.telefone || '');
        if (!nome.includes(q) && !tel.includes(q)) return false;
      }
      return true;
    });
  }, [events, typeFilter, attendantFilter, search, subscribers]);

  const porAtendente = useMemo(() => {
    const map = new Map<string, { nome: string; iniciados: number; handoffs: number; tags: number }>();
    const bump = (id: string, nome: string, field: 'iniciados' | 'handoffs' | 'tags') => {
      if (!id) return;
      const cur = map.get(id) || { nome, iniciados: 0, handoffs: 0, tags: 0 };
      cur[field]++;
      map.set(id, cur);
    };
    events.forEach(e => {
      if (e.kind === 'atendimento') {
        if (e.action === 'primeiro_atendimento') bump(e.user_id, primeiroNome(e.user_nome), 'iniciados');
        else bump(e.user_id, primeiroNome(e.user_nome), 'handoffs');
      } else {
        if (e.changed_by) bump(e.changed_by, primeiroNome(e.changed_by_nome), 'tags');
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.iniciados + b.handoffs + b.tags) - (a.iniciados + a.handoffs + a.tags));
  }, [events]);

  const uniqueClients = new Set(events.map(e => e.subscriber_id)).size;

  const fmtHora = (iso: string) => formatInTimeZone(new Date(iso), TZ, 'HH:mm');
  const fmtData = (iso: string) => formatInTimeZone(new Date(iso), TZ, "dd MMM", { locale: ptBR });

  const describeAtendimento = (e: AtendimentoEvent) => {
    if (e.action === 'primeiro_atendimento') return `Atendimento iniciado por ${primeiroNome(e.user_nome)}`;
    if (e.previous_user_nome) return `${primeiroNome(e.user_nome)} assumiu de ${primeiroNome(e.previous_user_nome)}`;
    return `${primeiroNome(e.user_nome)} assumiu o atendimento`;
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <UserRoundCog className="h-8 w-8 text-primary" />
            Histórico de Atendimento
          </h1>
          <p className="text-muted-foreground mt-1">
            Quem iniciou e assumiu cada conversa, e quem alterou cada tag — por cliente e por atendente
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Eventos no período</p>
            <p className="text-2xl font-bold">{events.length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Clientes envolvidos</p>
            <p className="text-2xl font-bold flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" />{uniqueClients}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Handoffs de atendimento</p>
            <p className="text-2xl font-bold flex items-center gap-1.5"><ArrowRightLeft className="h-4 w-4 text-primary" />{events.filter(e => e.kind === 'atendimento' && e.action !== 'primeiro_atendimento').length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Mudanças de tag</p>
            <p className="text-2xl font-bold flex items-center gap-1.5"><TagIcon className="h-4 w-4 text-primary" />{events.filter(e => e.kind === 'tag').length}</p>
          </CardContent></Card>
        </div>

        {/* Por atendente */}
        {porAtendente.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {porAtendente.map(a => (
              <Card key={a.nome} className="border-border/60">
                <CardContent className="pt-4 pb-3.5">
                  <p className="text-sm font-semibold truncate">{a.nome}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><PlayCircle className="h-3 w-3" />{a.iniciados} iniciou</span>
                    <span className="flex items-center gap-1"><ArrowRightLeft className="h-3 w-3" />{a.handoffs} assumiu</span>
                    <span className="flex items-center gap-1"><TagIcon className="h-3 w-3" />{a.tags} tags</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex gap-2 items-center">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[150px]" />
            <span className="text-muted-foreground text-sm">até</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[150px]" />
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por cliente ou telefone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={attendantFilter} onValueChange={setAttendantFilter}>
            <SelectTrigger className="w-full lg:w-[200px]"><SelectValue placeholder="Atendente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os atendentes</SelectItem>
              {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
            <SelectTrigger className="w-full lg:w-[170px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tudo</SelectItem>
              <SelectItem value="atendimento">Só atendimento</SelectItem>
              <SelectItem value="tag">Só tags</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Timeline */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Nenhum evento encontrado no período/filtros selecionados</div>
            ) : (
              <div className="divide-y divide-border/60">
                {filtered.map(e => {
                  const sub = subscribers[e.subscriber_id];
                  return (
                    <div key={`${e.kind}-${e.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                      <div className="w-[70px] shrink-0 text-xs font-mono text-muted-foreground">
                        <div className="tabular-nums">{fmtHora(e.created_at)}</div>
                        <div className="text-[10px] opacity-60">{fmtData(e.created_at)}</div>
                      </div>
                      <div className="w-[190px] shrink-0 min-w-0">
                        <p className="text-sm font-medium truncate">{sub?.nome || e.subscriber_id}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{sub?.telefone}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        {e.kind === 'atendimento' ? (
                          <div className="flex items-center gap-2">
                            {e.action === 'primeiro_atendimento'
                              ? <PlayCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              : <ArrowRightLeft className="h-3.5 w-3.5 text-sky-500 shrink-0" />}
                            <span className="text-sm truncate">{describeAtendimento(e)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <TagIcon className={`h-3.5 w-3.5 shrink-0 ${e.action === 'added' ? 'text-emerald-500' : 'text-rose-500'}`} />
                            <span className="text-sm">
                              <strong>{e.changed_by_nome}</strong> {e.action === 'added' ? 'adicionou' : 'removeu'} a tag
                            </span>
                            <Badge variant="outline" className="text-[11px]">{e.tag_nome}</Badge>
                            {e.reason && <span className="text-[11px] text-muted-foreground truncate">· {e.reason}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
