import { useMemo } from 'react';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { Compromisso } from '@/types/compromissos';
import { IntimacaoEvent } from '@/hooks/useIntimacoes';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIMEZONE = 'America/Manaus';

interface AgendaKPIsProps {
  compromissos: Compromisso[];
  intimacoes: IntimacaoEvent[];
}

export function AgendaKPIs({ compromissos, intimacoes }: AgendaKPIsProps) {
  const now = new Date();
  const todayStart = startOfDay(now);

  const stats = useMemo(() => {
    const tarefas    = compromissos.filter(c => c.tipo === 'Tarefa');
    const audiencias = compromissos.filter(c => c.tipo === 'Audiência');
    const outros     = compromissos.filter(c => !['Tarefa', 'Audiência'].includes(c.tipo));

    const split = (items: Compromisso[]) => {
      let atrasadas = 0, hoje = 0, futuras = 0;
      items.forEach(c => {
        const d = toZonedTime(new Date(c.data_inicio), TIMEZONE);
        if (isToday(d)) hoje++;
        else if (isBefore(d, todayStart)) atrasadas++;
        else futuras++;
      });
      return { atrasadas, hoje, futuras, total: items.length };
    };

    return {
      tarefas:      split(tarefas),
      audiencias:   split(audiencias),
      compromissos: split(outros),
      intimacoes: {
        total:    intimacoes.length,
        pendentes: intimacoes.filter(i => !i.lida).length,
      },
    };
  }, [compromissos, intimacoes, todayStart]);

  const totalAtrasados =
    stats.tarefas.atrasadas +
    stats.audiencias.atrasadas +
    stats.compromissos.atrasadas;

  const dayNum   = format(now, 'd');
  const dayName  = format(now, 'EEEE', { locale: ptBR });
  const monthAbb = format(now, 'MMMM', { locale: ptBR }).toUpperCase();

  // Config visual por KPI
  const kpis = [
    {
      title: 'Tarefas',
      total: stats.tarefas.total,
      dot: '#16a34a',
      iconColor: '#16a34a',
      iconBg: '#f0fdf4',
      atrasadas: stats.tarefas.atrasadas,
      hoje: stats.tarefas.hoje,
      futuras: stats.tarefas.futuras,
      labelAt: 'atrasadas',
      showDetalhes: true,
      // SVG path: check square
      iconPath: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    },
    {
      title: 'Intimações',
      total: stats.intimacoes.total,
      dot: '#64748b',
      iconColor: stats.intimacoes.pendentes > 0 ? '#dc2626' : '#64748b',
      iconBg: stats.intimacoes.pendentes > 0 ? '#fef2f2' : '#f8fafc',
      atrasadas: stats.intimacoes.pendentes,
      hoje: 0,
      futuras: 0,
      labelAt: 'pendentes',
      showDetalhes: false,
      iconPath: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
    },
    {
      title: 'Audiências',
      total: stats.audiencias.total,
      dot: '#db2777',
      iconColor: '#db2777',
      iconBg: '#fdf2f8',
      atrasadas: stats.audiencias.atrasadas,
      hoje: stats.audiencias.hoje,
      futuras: stats.audiencias.futuras,
      labelAt: 'atrasadas',
      showDetalhes: true,
      iconPath: 'M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z',
    },
    {
      title: 'Compromissos',
      total: stats.compromissos.total,
      dot: '#d97706',
      iconColor: stats.compromissos.atrasadas > 0 ? '#dc2626' : '#d97706',
      iconBg: stats.compromissos.atrasadas > 0 ? '#fef2f2' : '#fff7ed',
      atrasadas: stats.compromissos.atrasadas,
      hoje: stats.compromissos.hoje,
      futuras: stats.compromissos.futuras,
      labelAt: 'atrasados',
      showDetalhes: true,
      iconPath: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    },
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '0.5px solid rgba(201,169,110,0.25)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      <div className="flex">
        {/* Data */}
        <div
          className="flex flex-col items-center justify-center shrink-0"
          style={{
            background: '#3d2b1f', color: '#c9a96e',
            padding: '16px 20px', minWidth: 88,
            borderRight: '0.5px solid rgba(201,169,110,0.2)',
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', opacity: 0.55, textTransform: 'uppercase', marginBottom: 2 }}>
            {monthAbb}
          </span>
          <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, color: '#c9a96e' }}>{dayNum}</span>
          <span style={{ fontSize: 10, opacity: 0.45, textTransform: 'capitalize', marginTop: 3 }}>{dayName}</span>
        </div>

        {/* KPIs */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 bg-white dark:bg-card">
          {kpis.map((kpi, idx) => (
            <div
              key={kpi.title}
              className="flex items-start gap-3 px-4 py-4"
              style={{ borderLeft: '0.5px solid rgba(201,169,110,0.12)' }}
            >
              {/* Ícone */}
              <div
                className="shrink-0 flex items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: 10, background: kpi.iconBg, marginTop: 2 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={kpi.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {kpi.iconPath.split('M').filter(Boolean).map((p, i) => (
                    <path key={i} d={`M${p}`} />
                  ))}
                </svg>
              </div>

              {/* Texto */}
              <div className="min-w-0 flex-1">
                {/* Título + badge total */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#3d2b1f' }} className="dark:text-[#c9a96e]">
                    {kpi.title}
                  </span>
                  <span
                    style={{
                      fontSize: 10, fontWeight: 700,
                      padding: '1px 6px', borderRadius: 6,
                      background: kpi.atrasadas > 0 ? '#fef2f2' : 'rgba(201,169,110,0.12)',
                      color: kpi.atrasadas > 0 ? '#dc2626' : '#7c5a2a',
                    }}
                  >
                    {kpi.total > 99 ? '99+' : kpi.total}
                  </span>
                </div>

                {/* Linhas de detalhe */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600, color: kpi.atrasadas > 0 ? '#dc2626' : '#6b7280' }}>
                      {kpi.atrasadas}
                    </span>{' '}{kpi.labelAt}
                  </p>
                  {kpi.showDetalhes && (
                    <>
                      <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600, color: '#16a34a' }}>{kpi.hoje}</span>{' '}hoje
                      </p>
                      <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600, color: '#6b7280' }}>{kpi.futuras}</span>{' '}futuras
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rodapé */}
      <div
        className="flex items-center gap-2 px-4 py-2"
        style={{ borderTop: '0.5px solid rgba(201,169,110,0.12)', background: 'rgba(250,248,245,0.8)' }}
      >
        <RefreshCw className="h-3 w-3" style={{ color: 'rgba(201,169,110,0.4)' }} />
        <span style={{ fontSize: 11, color: '#9ca3af' }}>Atualiza em tempo real</span>
        {totalAtrasados > 0 && (
          <div
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{ background: '#fef2f2', border: '0.5px solid #fca5a5' }}
          >
            <AlertTriangle className="h-3 w-3" style={{ color: '#dc2626' }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: '#dc2626' }}>
              {totalAtrasados} {totalAtrasados === 1 ? 'item atrasado' : 'itens atrasados'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
