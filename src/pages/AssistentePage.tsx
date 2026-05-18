import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Brain, Zap, ListTodo,
  Settings, Cpu,
  Scale, Search, Calendar, CheckCircle2,
  BarChart2, Users, Target, TrendingUp, ScanLine, FileText,
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { IsaChat } from '@/components/assistentes/IsaChat';
import { IsaConversionMetrics } from '@/components/assistentes/IsaConversionMetrics';
import { DonnaChat } from '@/components/assistentes/DonnaChat';
import isaAvatar   from '@/assets/isa-avatar.png';
import donnaAvatar from '@/assets/donna-avatar.png';

// ── Paleta ─────────────────────────────────────────────────────────────────────
const BROWN  = '#3d2b1f';
const GOLD   = '#c9a96e';
const NAVY   = '#0f1528';
const BLUE_A = '#5b8dd9';

// ── Capacidades ────────────────────────────────────────────────────────────────
const ISA_CAPABILITIES = [
  { icon: Search,       label: 'Análise de Leads' },
  { icon: Scale,        label: 'Consulta de Processos' },
  { icon: ListTodo,     label: 'Gestão de Tarefas' },
  { icon: Brain,        label: 'Estratégia Jurídica' },
  { icon: Calendar,     label: 'Prazos e Agenda' },
  { icon: CheckCircle2, label: 'Automação Inteligente' },
];

const DONNA_CAPABILITIES = [
  { icon: BarChart2,  label: 'Relatórios e Indicadores' },
  { icon: Users,      label: 'Cadastro de Clientes' },
  { icon: ScanLine,   label: 'Análise de Padrões' },
  { icon: Target,     label: 'Precisão em Dados' },
  { icon: TrendingUp, label: 'Insights Estratégicos' },
  { icon: FileText,   label: 'Gestão de Processos' },
];

// ── Isa — chat ─────────────────────────────────────────────────────────────────
function IsaView({ onBack }: { onBack: () => void }) {
  return (
    <AppLayout>
      <AppHeader title="Isa — Assistente Jurídica" />
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar aos agentes
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-600">Online</span>
          </div>
        </div>
        <IsaChat />
      </div>
    </AppLayout>
  );
}

// ── Isa — métricas ─────────────────────────────────────────────────────────────
function IsaMetricsView({ onBack }: { onBack: () => void }) {
  return (
    <AppLayout>
      <AppHeader title="Isa — Métricas de Conversão" />
      <div className="flex-1 overflow-auto">
        <div className="px-4 py-2.5 border-b bg-card">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar aos agentes
          </button>
        </div>
        <div className="p-6">
          <IsaConversionMetrics />
        </div>
      </div>
    </AppLayout>
  );
}

// ── Donn@ — chat ──────────────────────────────────────────────────────────────
function DonnaView({ onBack }: { onBack: () => void }) {
  return (
    <AppLayout>
      <AppHeader title="Donn@ — Análise e Relatórios" />
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar aos agentes
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-600">Online</span>
          </div>
        </div>
        <DonnaChat />
      </div>
    </AppLayout>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
type View = 'grid' | 'isa-chat' | 'isa-metrics' | 'donna-chat';

export default function AssistentePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const agentParam = searchParams.get('agent');
  const initialView: View = agentParam === 'isa' ? 'isa-chat' : agentParam === 'donna' ? 'donna-chat' : 'grid';
  const [view, setView] = useState<View>(initialView);

  if (view === 'isa-chat')    return <IsaView        onBack={() => setView('grid')} />;
  if (view === 'isa-metrics') return <IsaMetricsView onBack={() => setView('grid')} />;
  if (view === 'donna-chat')  return <DonnaView      onBack={() => setView('grid')} />;

  return (
    <AppLayout>
      <AppHeader title="Agentes IA" />

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

          {/* ── Cabeçalho ── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Inteligência Artificial
              </span>
            </div>
            <h1 className="text-2xl font-black" style={{ color: BROWN }}>Agentes do Escritório</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Assistentes especializadas que atuam no seu escritório jurídico
            </p>
          </div>

          {/* ── Grid de agentes ── */}
          <div className="grid sm:grid-cols-2 gap-6">

            {/* ── Cartão Isa ── */}
            <div
              className="relative overflow-hidden rounded-2xl flex flex-col"
              style={{
                background: 'linear-gradient(160deg, #1a0e08 0%, #2d1810 50%, #3d2b1f 100%)',
                border: `1px solid ${GOLD}35`,
                boxShadow: `0 20px 60px rgba(61,43,31,0.35), 0 4px 16px ${GOLD}15`,
              }}
            >
              {/* Barra dourada no topo */}
              <div style={{ height: 3, background: `linear-gradient(90deg, ${BROWN}, ${GOLD}, ${BROWN})` }} />

              {/* Brilho decorativo */}
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-[0.04] blur-3xl"
                style={{ background: GOLD }} />

              <div className="relative p-5 flex-1">
                {/* Header */}
                <div className="flex items-start gap-4 mb-5">
                  <div className="relative shrink-0">
                    <img
                      src={isaAvatar}
                      alt="Isa"
                      className="h-16 w-16 rounded-2xl object-cover object-top"
                      style={{ border: `2px solid ${GOLD}50` }}
                    />
                    <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[#1a0e08] animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="text-lg font-black text-white">Isa</h2>
                      <span
                        className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: `${GOLD}25`, color: GOLD, border: `1px solid ${GOLD}40` }}
                      >
                        Ativa
                      </span>
                    </div>
                    <p style={{ color: `${GOLD}cc`, fontSize: 12, fontWeight: 600 }}>
                      Assistente Jurídica Inteligente
                    </p>
                    <p className="text-white/40 text-[11px] mt-0.5 leading-snug">
                      Análise de leads, processos, prazos e automação
                    </p>
                  </div>
                </div>

                {/* Capacidades */}
                <div className="mb-5">
                  <p className="text-[9px] font-black uppercase tracking-widest mb-2.5"
                    style={{ color: `${GOLD}70` }}>
                    Capacidades
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ISA_CAPABILITIES.map(({ icon: Icon, label }) => (
                      <div
                        key={label}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <Icon className="h-2.5 w-2.5 shrink-0" style={{ color: GOLD }} />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rodapé de ações */}
              <div className="px-5 pb-5 pt-0 flex gap-2">
                <button
                  onClick={() => setView('isa-chat')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, #b8922a)`, color: BROWN }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Abrir Chat
                </button>
                <button
                  onClick={() => setView('isa-metrics')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  <Zap className="h-4 w-4" />
                  Métricas
                </button>
                <button
                  onClick={() => navigate('/isa-autonoma')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── Cartão Donn@ ── */}
            <div
              className="relative overflow-hidden rounded-2xl flex flex-col"
              style={{
                background: 'linear-gradient(160deg, #080e1c 0%, #111f3d 50%, #182650 100%)',
                border: `1px solid ${BLUE_A}30`,
                boxShadow: `0 20px 60px rgba(15,21,40,0.40), 0 4px 16px ${BLUE_A}10`,
              }}
            >
              {/* Barra azul no topo */}
              <div style={{ height: 3, background: `linear-gradient(90deg, ${NAVY}, ${BLUE_A}, ${NAVY})` }} />

              {/* Brilho decorativo */}
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-[0.05] blur-3xl"
                style={{ background: BLUE_A }} />

              <div className="relative p-5 flex-1">
                {/* Header */}
                <div className="flex items-start gap-4 mb-5">
                  <div className="relative shrink-0">
                    <img
                      src={donnaAvatar}
                      alt="Donn@"
                      className="h-16 w-16 rounded-2xl object-cover object-top"
                      style={{ border: `2px solid ${BLUE_A}50` }}
                    />
                    <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-amber-400 border-2 border-[#080e1c]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="text-lg font-black text-white">Donn@</h2>
                      <span
                        className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: `${BLUE_A}20`, color: BLUE_A, border: `1px solid ${BLUE_A}35` }}
                      >
                        Em breve
                      </span>
                    </div>
                    <p style={{ color: `${BLUE_A}cc`, fontSize: 12, fontWeight: 600 }}>
                      Assistente de Análise e Dados
                    </p>
                    <p className="text-white/40 text-[11px] mt-0.5 leading-snug">
                      Relatórios, indicadores e insights estratégicos
                    </p>
                  </div>
                </div>

                {/* Capacidades */}
                <div className="mb-5">
                  <p className="text-[9px] font-black uppercase tracking-widest mb-2.5"
                    style={{ color: `${BLUE_A}60` }}>
                    Capacidades
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {DONNA_CAPABILITIES.map(({ icon: Icon, label }) => (
                      <div
                        key={label}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <Icon className="h-2.5 w-2.5 shrink-0" style={{ color: BLUE_A }} />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rodapé de ações */}
              <div className="px-5 pb-5 pt-0 flex gap-2">
                <button
                  onClick={() => setView('donna-chat')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: `linear-gradient(135deg, ${BLUE_A}, #3a6ab8)`, color: '#fff' }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Ver Detalhes
                </button>
                <button
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold opacity-40 cursor-not-allowed"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.08)' }}
                  disabled
                >
                  <Zap className="h-4 w-4" />
                  Métricas
                </button>
                <button
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold opacity-40 cursor-not-allowed"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.08)' }}
                  disabled
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>

          </div>

          {/* ── Nota de rodapé ── */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground/50">
              Para automações autônomas, acesse{' '}
              <button
                onClick={() => navigate('/isa-autonoma')}
                className="font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Isa Autônoma
              </button>{' '}
              no menu lateral
            </p>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
