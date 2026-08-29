import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Users, DollarSign, Briefcase, Zap, Gavel, CalendarDays,
  ChevronRight, Scale, CheckSquare, FileSignature, Loader2,
} from 'lucide-react';
import { usePerfil } from '@/hooks/usePerfil';
import { useIntimacoes } from '@/hooks/useIntimacoes';
import { useCompromissos } from '@/hooks/useCompromissos';
import type { DashboardStats } from '@/hooks/useDashboardStats';
import { cn } from '@/lib/utils';

interface MobileDashboardScreenProps {
  stats: DashboardStats;
  heroMetrics: { totalLeads: number; convertidos: number; trafegoHoje: number; leadsTrafego: number };
  formatCurrency: (v: number) => string;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function KpiTile({ label, value, sub, icon: Icon, iconBg, iconColor }: {
  label: string; value: string; sub: string; icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="h-[3px] w-full bg-gradient-to-r from-primary to-gold" />
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wide leading-tight pr-1">{label}</p>
          <div className={cn('h-7 w-7 shrink-0 rounded-lg flex items-center justify-center', iconBg)}>
            <Icon className={cn('h-3.5 w-3.5', iconColor)} />
          </div>
        </div>
        <p className="text-xl font-black text-foreground tracking-tight leading-none mb-1 break-all">{value}</p>
        <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
      </div>
    </div>
  );
}

function SectionHeader({ title, icon, onAction }: { title: string; icon: React.ReactNode; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[13px] font-extrabold text-foreground">{title}</span>
      </div>
      {onAction && (
        <button onClick={onAction} className="flex items-center gap-0.5 text-xs font-bold text-[#b8922a]">
          Ver tudo <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

const quickLinks = [
  { key: 'leads', label: 'Leads', icon: Users, url: '/leads' },
  { key: 'processos', label: 'Processos', icon: Scale, url: '/processos' },
  { key: 'tarefas', label: 'Tarefas', icon: CheckSquare, url: '/tarefas' },
  { key: 'contratos', label: 'Contratos', icon: FileSignature, url: '/contratos' },
];

export function MobileDashboardScreen({ stats, heroMetrics, formatCurrency }: MobileDashboardScreenProps) {
  const navigate = useNavigate();
  const { fullName } = usePerfil();
  const { intimacoes, loading: intimacoesLoading } = useIntimacoes();
  const { compromissos, loading: compromissosLoading } = useCompromissos();

  const primeiroNome = fullName?.split(' ')[0] || 'Dr(a)';
  const hoje = useMemo(
    () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
    []
  );

  const intimacoesUrgentes = useMemo(
    () => intimacoes.filter((i) => !i.lida).slice(0, 3),
    [intimacoes]
  );
  const naoLidas = useMemo(() => intimacoes.filter((i) => !i.lida).length, [intimacoes]);

  const compromissosHoje = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return compromissos
      .filter((c) => {
        const d = new Date(c.data_inicio);
        return d >= start && d <= end;
      })
      .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());
  }, [compromissos]);

  return (
    <div className="min-h-full bg-background pb-6">
      {/* Header gradiente */}
      <div
        className="px-5 pt-5 pb-10"
        style={{ background: 'linear-gradient(160deg, hsl(var(--primary)) 0%, hsl(24 21% 13%) 100%)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-gold text-[10px] font-bold tracking-[2px] uppercase">Bentes Ramos</div>
            <div className="text-primary-foreground/75 text-[13px]">Advocacia</div>
          </div>
          <button
            onClick={() => navigate('/intimacoes')}
            className="relative h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center"
          >
            <Bell className="h-[18px] w-[18px] text-primary-foreground" />
            {naoLidas > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center px-1">
                {naoLidas}
              </span>
            )}
          </button>
        </div>
        <div className="text-primary-foreground/70 text-[13px] mb-1">{greeting()}, {primeiroNome}</div>
        <div className="text-primary-foreground text-xl font-bold capitalize leading-tight">{hoje}</div>
        <div className="text-gold text-[13px] font-semibold mt-1.5">
          {naoLidas} intimações não lidas · {compromissosHoje.length} compromisso{compromissosHoje.length !== 1 ? 's' : ''} hoje
        </div>
      </div>

      {/* KPIs sobrepostos */}
      <div className="px-4 -mt-6 grid grid-cols-2 gap-2.5">
        <KpiTile
          label="Total de Leads" value={heroMetrics.totalLeads.toLocaleString('pt-BR')}
          sub={heroMetrics.totalLeads > 0 ? `${((heroMetrics.convertidos / heroMetrics.totalLeads) * 100).toFixed(1)}% conversão` : 'leads no CRM'}
          icon={Users} iconBg="bg-[#3d2b1f]/8" iconColor="text-[#3d2b1f]"
        />
        <KpiTile
          label="Valor em Causa" value={formatCurrency(stats.total_valor_causa)}
          sub="processos ativos"
          icon={DollarSign} iconBg="bg-[#c9a96e]/15" iconColor="text-[#b8922a]"
        />
        <KpiTile
          label="Processos Ativos" value={stats.total_processos.toLocaleString('pt-BR')}
          sub="processos cadastrados"
          icon={Briefcase} iconBg="bg-emerald-50" iconColor="text-emerald-600"
        />
        <KpiTile
          label="Tráfego Hoje" value={heroMetrics.trafegoHoje.toLocaleString('pt-BR')}
          sub={`${heroMetrics.leadsTrafego.toLocaleString('pt-BR')} total`}
          icon={Zap} iconBg="bg-blue-50" iconColor="text-blue-600"
        />
      </div>

      {/* Intimações urgentes */}
      <SectionHeader title="Intimações não lidas" icon={<Gavel className="h-4 w-4 text-red-500" />} onAction={() => navigate('/intimacoes')} />
      <div className="px-4 flex flex-col gap-2">
        {intimacoesLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : intimacoesUrgentes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            Nenhuma intimação pendente de leitura
          </div>
        ) : intimacoesUrgentes.map((int) => (
          <button
            key={int.id}
            onClick={() => navigate('/intimacoes')}
            className="text-left rounded-2xl bg-card border border-border p-3 relative overflow-hidden"
          >
            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500" />
            <div className="flex items-center justify-between mb-1 pl-2">
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">{int.tribunal || 'Tribunal'}</span>
              {int.data_intimacao && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(int.data_intimacao).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
            <div className="text-[13px] text-foreground font-medium leading-snug pl-2">
              {int.processo_titulo || int.conteudo?.slice(0, 90) || 'Publicação sem título'}
            </div>
            {int.processo_cnj && (
              <div className="text-[11px] text-muted-foreground mt-1 pl-2 font-mono">{int.processo_cnj}</div>
            )}
          </button>
        ))}
      </div>

      {/* Agenda de hoje */}
      <SectionHeader title="Agenda de hoje" icon={<CalendarDays className="h-4 w-4 text-gold" />} onAction={() => navigate('/agenda')} />
      <div className="px-4 flex flex-col gap-2">
        {compromissosLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : compromissosHoje.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            Nenhum compromisso para hoje
          </div>
        ) : compromissosHoje.slice(0, 3).map((c) => (
          <div key={c.id} className="rounded-2xl bg-card border border-border p-3 flex items-center gap-3">
            <div className="w-11 text-center shrink-0">
              <div className="text-[15px] font-extrabold text-foreground tabular-nums">
                {new Date(c.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div className="w-[3px] self-stretch rounded bg-gold" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-foreground truncate">{c.titulo}</div>
              <div className="text-[11px] text-muted-foreground truncate">{c.tipo}{c.descricao ? ` · ${c.descricao}` : ''}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Ações rápidas */}
      <SectionHeader title="Acesso rápido" icon={null} />
      <div className="px-4 grid grid-cols-2 gap-2.5">
        {quickLinks.map((q) => (
          <button
            key={q.key}
            onClick={() => navigate(q.url)}
            className="rounded-2xl bg-card border border-border p-3.5 text-left"
          >
            <q.icon className="h-5 w-5 text-gold mb-2" />
            <div className="text-xs font-bold text-foreground">{q.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
