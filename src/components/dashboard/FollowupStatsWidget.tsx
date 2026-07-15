import { useState, useEffect, useCallback, memo, ElementType } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Clock, CheckCircle2, Users, RefreshCw, Send, MessageCircle, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnviadoItem {
  leadId: string;
  nome: string;
  enviadoEm: string;
  respondeu: boolean;
}

interface FollowupStats {
  pipeline_ativo: number;
  em_andamento: number;
  aguardando_optin: number;
  convertidos_automacao: number;
  enviados_hoje: number;
  ultimo_envio: string | null;
  enviados_recentes: EnviadoItem[];
}

const EMPTY: FollowupStats = {
  pipeline_ativo: 0, em_andamento: 0, aguardando_optin: 0, convertidos_automacao: 0,
  enviados_hoje: 0, ultimo_envio: null, enviados_recentes: [],
};

function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Manaus', hour: '2-digit', minute: '2-digit',
  });
}

function formatarDataHora(iso: string) {
  const d = new Date(iso);
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Manaus' });
  const dStr = d.toLocaleDateString('pt-BR', { timeZone: 'America/Manaus' });
  return dStr === hoje ? formatarHora(iso) : `${dStr.slice(0, 5)} ${formatarHora(iso)}`;
}

// ─── KPI pill ─────────────────────────────────────────────────────────────────
function KpiPill({ icon: Icon, label, value, color }: {
  icon: ElementType; label: string; value: number; color: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/40 flex-1 min-w-0">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-none mb-1 truncate">{label}</p>
        <p className="text-xl font-black tabular-nums text-foreground leading-none">{value.toLocaleString('pt-BR')}</p>
      </div>
    </div>
  );
}

// ─── Row da lista de enviados ─────────────────────────────────────────────────
function EnviadoRow({ item }: { item: EnviadoItem }) {
  const nome = (item.nome || 'Lead').split(' ').slice(0, 2).join(' ');
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-muted-foreground">
          {nome.charAt(0).toUpperCase()}
        </span>
      </div>
      <span className="text-sm text-foreground flex-1 truncate">{nome}</span>
      <span className="text-[11px] text-muted-foreground shrink-0">{formatarDataHora(item.enviadoEm)}</span>
      <span className={cn(
        'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
        item.respondeu
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-amber-50 text-amber-600'
      )}>
        {item.respondeu ? '✓ Respondeu' : '⏳ Aguardando'}
      </span>
    </div>
  );
}

function FollowupStatsWidget() {
  const [stats, setStats] = useState<FollowupStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const hojeStart = new Date();
      hojeStart.setHours(0, 0, 0, 0);
      const hojeISO = hojeStart.toISOString();
      const h48ago  = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

      const [
        { count: pipeline_ativo, error: errPipeline },
        { count: em_andamento, error: errAndamento },
        { count: aguardando_optin, error: errOptin },
        { count: convertidos_automacao, error: errConvertidos },
      ] = await Promise.all([
        supabase.from('traffic_followups').select('id', { count: 'exact', head: true }).eq('automation_active', true),
        supabase.from('traffic_followups').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('followup_nutricao').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('leads_juridicos').select('id', { count: 'exact', head: true })
          .eq('tipo_origem', 'trafego').in('status', ['Ganho', 'Contrato Assinado']),
      ]);
      if (errPipeline || errAndamento || errOptin || errConvertidos) {
        console.error('[FollowupStatsWidget] Erro ao buscar contadores:', errPipeline || errAndamento || errOptin || errConvertidos);
      }

      // Reativações de hoje
      const { data: reativacoesHoje, error: errReativacoes } = await supabase
        .from('manychat_mensagens')
        .select('lead_id, created_at')
        .eq('direcao', 'saida')
        .filter('metadata->>source', 'eq', 'reativacao_antiga')
        .gte('created_at', hojeISO)
        .order('created_at', { ascending: false });
      if (errReativacoes) console.error('[FollowupStatsWidget] Erro ao buscar reativações de hoje:', errReativacoes);

      const enviados_hoje = reativacoesHoje?.length ?? 0;
      const ultimo_envio  = reativacoesHoje?.[0]?.created_at ?? null;

      // Enviados recentes (últimas 48h, únicos por lead)
      const { data: recentRaw, error: errRecent } = await supabase
        .from('manychat_mensagens')
        .select('lead_id, created_at')
        .eq('direcao', 'saida')
        .filter('metadata->>source', 'eq', 'reativacao_antiga')
        .gte('created_at', h48ago)
        .order('created_at', { ascending: false })
        .limit(30);
      if (errRecent) console.error('[FollowupStatsWidget] Erro ao buscar enviados recentes:', errRecent);

      // Deduplicar por lead (manter o mais recente)
      const uniqueSends = new Map<string, string>();
      for (const r of (recentRaw || [])) {
        if (!uniqueSends.has(r.lead_id)) uniqueSends.set(r.lead_id, r.created_at);
      }
      const recentLeadIds = Array.from(uniqueSends.keys()).slice(0, 8);

      // Buscar nomes e respostas em paralelo
      const [{ data: leadNames }, { data: respostas }] = await Promise.all([
        recentLeadIds.length > 0
          ? supabase.from('leads_juridicos').select('id, nome').in('id', recentLeadIds)
          : Promise.resolve({ data: [] }),
        recentLeadIds.length > 0
          ? supabase.from('manychat_mensagens').select('lead_id, created_at')
              .eq('direcao', 'entrada').in('lead_id', recentLeadIds).gte('created_at', h48ago)
          : Promise.resolve({ data: [] }),
      ]);

      const nomeMap = new Map((leadNames || []).map((l: any) => [l.id, l.nome]));
      // Para cada lead, guarda o PRIMEIRO inbound após o envio
      const respostaMap = new Map<string, string>();
      for (const r of (respostas || [])) {
        const sendTime = uniqueSends.get(r.lead_id);
        if (sendTime && r.created_at > sendTime) {
          if (!respostaMap.has(r.lead_id)) respostaMap.set(r.lead_id, r.created_at);
        }
      }

      const enviados_recentes: EnviadoItem[] = recentLeadIds.map(leadId => ({
        leadId,
        nome: String(nomeMap.get(leadId) || 'Lead'),
        enviadoEm: uniqueSends.get(leadId)!,
        respondeu: respostaMap.has(leadId),
      }));

      setStats({
        pipeline_ativo:        pipeline_ativo        ?? 0,
        em_andamento:          em_andamento          ?? 0,
        aguardando_optin:      aguardando_optin      ?? 0,
        convertidos_automacao: convertidos_automacao ?? 0,
        enviados_hoje,
        ultimo_envio,
        enviados_recentes,
      });
    } catch (err) {
      console.error('[FollowupStatsWidget] Erro inesperado ao carregar estatísticas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const responderam = stats.enviados_recentes.filter(e => e.respondeu).length;
  const naoResponderam = stats.enviados_recentes.length - responderam;

  return (
    <div className="rounded-2xl border border-[#c9a96e]/15 bg-card shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col">
      {/* Accent bar */}
      <div className="h-[3px] w-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-t-2xl" />

      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-border/30">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Follow-up Automático</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Pipeline de reativação de leads antigos</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-8 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* ── 4 KPIs em linha ── */}
          <div className="flex gap-3 px-5 py-4 flex-wrap">
            <KpiPill icon={Users}         label="Pipeline ativo"    value={stats.pipeline_ativo}       color="bg-blue-50 text-blue-600" />
            <KpiPill icon={MessageSquare} label="Em andamento"       value={stats.em_andamento}         color="bg-indigo-50 text-indigo-600" />
            <KpiPill icon={Clock}         label="Aguardando"         value={stats.aguardando_optin}     color="bg-amber-50 text-amber-600" />
            <KpiPill icon={CheckCircle2}  label="Convertidos"        value={stats.convertidos_automacao} color="bg-emerald-50 text-emerald-600" />
          </div>

          {/* ── Separador ── */}
          <div className="mx-5 border-t border-border/30" />

          {/* ── Corpo: hoje + lista ── */}
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-0 flex-1">

            {/* Coluna esquerda: disparos de hoje */}
            <div className="px-5 py-4 border-b md:border-b-0 md:border-r border-border/30 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Disparos de hoje</p>

              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Send className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl font-black text-foreground leading-none">
                    {stats.enviados_hoje}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/ 10 máx.</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">enviados hoje</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Timer className="h-3 w-3 shrink-0" />
                  <span>
                    Último:{' '}
                    <span className="font-semibold text-foreground">
                      {stats.ultimo_envio ? formatarHora(stats.ultimo_envio) : '—'}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>Horário: 9h – 18h (dias úteis)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageCircle className="h-3 w-3 shrink-0" />
                  <span>Intervalo: a cada 30 min</span>
                </div>
              </div>

              {/* Mini-resumo de respostas */}
              {stats.enviados_recentes.length > 0 && (
                <div className="pt-2 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Últimas 48h</p>
                  <div className="flex gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold">
                      {responderam} responderam
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold">
                      {naoResponderam} aguardando
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Coluna direita: lista de leads */}
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Leads reativados recentemente
              </p>
              {stats.enviados_recentes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum lead reativado ainda</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Os disparos ocorrem das 9h às 18h em dias úteis
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {stats.enviados_recentes.map(item => (
                    <EnviadoRow key={item.leadId} item={item} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default memo(FollowupStatsWidget);
