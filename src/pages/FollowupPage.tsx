import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Play, Pause, Search, RefreshCw, MessageCircle,
  Clock, CheckCircle, AlertCircle, TrendingUp,
  Users, Zap, ChevronRight, Phone, Bot, Archive,
  BarChart2, Filter, X
} from 'lucide-react';

// ── Paleta marrom/dourado ─────────────────────────────────────────────────────
const C = {
  marrom: '#3d2b1f',
  marromMedio: '#5a3e2b',
  marromClaro: '#7a5c43',
  dourado: '#c9a96e',
  douradoEscuro: '#b8922a',
  bg: '#f9f6f2',
  bgCard: '#ffffff',
  bgMuted: '#f3ede6',
  border: '#e4d9cc',
  borderLight: '#efe8df',
  text: '#2c1810',
  textMuted: '#8a7260',
  textLight: '#b09880',
  verde: '#16a34a',
  vermelho: '#dc2626',
  amarelo: '#d97706',
  azul: '#2563eb',
  roxo: '#7c3aed',
};

// ── Estágios ──────────────────────────────────────────────────────────────────
const STAGES: Record<string, { label: string; color: string; bg: string; order: number }> = {
  '3min':  { label: '3 min',    color: C.roxo,    bg: '#f5f3ff', order: 1 },
  '15min': { label: '15 min',   color: C.azul,    bg: '#eff6ff', order: 2 },
  '10min': { label: '10 min',   color: '#0891b2', bg: '#ecfeff', order: 3 },
  '3h':    { label: '3h',       color: C.verde,   bg: '#f0fdf4', order: 4 },
  '8h':    { label: '8h',       color: '#ca8a04', bg: '#fefce8', order: 5 },
  '24h':   { label: '24h',      color: C.amarelo, bg: '#fffbeb', order: 6 },
  '34h':   { label: '34h',      color: '#ea580c', bg: '#fff7ed', order: 7 },
  '42h':   { label: '42h',      color: C.vermelho,bg: '#fef2f2', order: 8 },
  '72h':   { label: '72h',      color: '#b91c1c', bg: '#fef2f2', order: 9 },
  '6d':    { label: '6 dias',   color: '#7f1d1d', bg: '#fef2f2', order: 10 },
  '7d':    { label: '7 dias',   color: '#6b7280', bg: '#f9fafb', order: 11 },
};

const AGENT_LABELS: Record<string, { name: string; color: string }> = {
  isa_triagem:  { name: 'ISA',     color: C.roxo },
  isa_bancario: { name: 'Melissa', color: '#0891b2' },
  isa_aereo:    { name: 'Jerusa',  color: '#16a34a' },
};

interface FollowupItem {
  id: string;
  lead_id: string;
  telefone: string;
  current_stage: string | null;
  automation_active: boolean;
  total_messages_sent: number;
  next_message_at: string | null;
  last_inbound_at: string | null;
  last_message_at: string | null;
  pause_reason: string | null;
  status: string;
  stages_sent: Record<string, any>;
  nome: string;
  lead_status: string;
  isa_agent: string | null;
}

interface Metrics {
  total: number;
  ativos: number;
  respondidos: number;
  arquivados: number;
  taxaResposta: number;
  porEstagio: Record<string, number>;
}

// ── Componentes auxiliares ────────────────────────────────────────────────────
function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: C.bgMuted, color: C.textMuted, border: `1px solid ${C.border}` }}>
      Aguardando
    </span>
  );
  const cfg = STAGES[stage];
  if (!cfg) return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
      {cfg.label}
    </span>
  );
}

function AgentBadge({ agent }: { agent: string | null }) {
  const cfg = agent ? AGENT_LABELS[agent] : null;
  if (!cfg) return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
      <Bot size={9} style={{ display: 'inline', marginRight: 3 }} />{cfg.name}
    </span>
  );
}

function KpiCard({ label, value, Icon, accent, sub }: any) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 2px 8px rgba(61,43,31,0.05)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '14px 14px 0 0' }} />
      <div style={{ width: 42, height: 42, borderRadius: 10, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={19} style={{ color: accent }} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.marrom, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: accent, marginTop: 1, fontWeight: 700 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Lista item ────────────────────────────────────────────────────────────────
function FollowupRow({ item, onToggle, onSelect, selected }: {
  item: FollowupItem;
  onToggle: (id: string, active: boolean) => void;
  onSelect: (item: FollowupItem) => void;
  selected: boolean;
}) {
  const isAtivo = item.automation_active;
  const isRespondido = item.status === 'responded';
  const isArquivado = item.status === 'archived';

  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        padding: '11px 14px', cursor: 'pointer',
        borderBottom: `1px solid ${C.borderLight}`,
        background: selected ? `${C.dourado}12` : 'transparent',
        borderLeft: `3px solid ${selected ? C.dourado : 'transparent'}`,
        transition: 'all 0.1s ease',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: selected ? `linear-gradient(135deg, ${C.marrom}, ${C.marromMedio})` : C.bgMuted,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800,
        color: selected ? C.dourado : C.textMuted,
      }}>
        {(item.nome || '?')[0].toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: C.marrom, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
            {item.nome || item.telefone}
          </span>
          <StageBadge stage={item.current_stage} />
          {isRespondido && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#f0fdf4', color: C.verde, border: `1px solid ${C.verde}30` }}>✅ Respondeu</span>}
          {isArquivado && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}>Arquivado</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <AgentBadge agent={item.isa_agent} />
          <span style={{ fontSize: 11, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
            <MessageCircle size={9} /> {item.total_messages_sent}
          </span>
          {item.next_message_at && isAtivo && !isRespondido && !isArquivado && (
            <span style={{ fontSize: 10, color: C.douradoEscuro, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={9} /> {formatDistanceToNow(new Date(item.next_message_at), { locale: ptBR, addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {/* Toggle */}
      {!isRespondido && !isArquivado && (
        <button
          onClick={e => { e.stopPropagation(); onToggle(item.id, !isAtivo); }}
          style={{
            width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer',
            background: isAtivo ? `${C.verde}15` : `${C.amarelo}15`,
            color: isAtivo ? C.verde : C.amarelo,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
          title={isAtivo ? 'Pausar' : 'Retomar'}
        >
          {isAtivo ? <Pause size={13} /> : <Play size={13} />}
        </button>
      )}
      <ChevronRight size={13} style={{ color: C.textLight, flexShrink: 0 }} />
    </div>
  );
}

// ── Painel Detalhe ────────────────────────────────────────────────────────────
function DetalhePanel({ item, historico, onToggle, onClose }: {
  item: FollowupItem;
  historico: any[];
  onToggle: (id: string, active: boolean) => void;
  onClose: () => void;
}) {
  const isAtivo = item.automation_active;
  const isRespondido = item.status === 'responded';
  const isArquivado = item.status === 'archived';
  const agentCfg = item.isa_agent ? AGENT_LABELS[item.isa_agent] : null;
  const stagesSent = item.stages_sent || {};
  const totalStages = Object.keys(STAGES).length;
  const sentCount = Object.keys(stagesSent).filter(k => !stagesSent[k]?.simulated).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: C.bg }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.marrom} 0%, ${C.marromMedio} 100%)`, padding: '14px 18px', flexShrink: 0 }}>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 7, padding: '5px 10px', cursor: 'pointer', color: '#fff', fontSize: 11, marginBottom: 10,
        }}>← Voltar</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 11,
            background: `${C.dourado}25`, border: `2px solid ${C.dourado}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 800, color: C.dourado,
          }}>
            {(item.nome || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{item.nome || item.telefone}</div>
            <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <StageBadge stage={item.current_stage} />
              {agentCfg && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                  {agentCfg.name}
                </span>
              )}
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                <Phone size={8} style={{ display: 'inline', marginRight: 2 }} />{item.telefone}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Progresso estágios */}
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Progresso</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.marrom }}>{sentCount}/{totalStages} estágios</span>
          </div>
          <div style={{ height: 5, background: C.bgMuted, borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', width: `${(sentCount / totalStages) * 100}%`, background: `linear-gradient(90deg, ${C.douradoEscuro}, ${C.dourado})`, borderRadius: 99, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {Object.entries(STAGES).sort((a, b) => a[1].order - b[1].order).map(([key, cfg]) => {
              const sent = !!stagesSent[key] && !stagesSent[key]?.simulated;
              const isCurrent = item.current_stage === key;
              return (
                <div key={key} title={sent ? `Enviado` : isCurrent ? 'Atual' : 'Pendente'} style={{
                  padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                  background: sent ? cfg.bg : isCurrent ? `${cfg.color}20` : C.bgMuted,
                  color: sent ? cfg.color : isCurrent ? cfg.color : C.textLight,
                  border: isCurrent ? `1.5px solid ${cfg.color}` : `1px solid ${sent ? cfg.color + '30' : C.border}`,
                }}>
                  {sent ? '✓ ' : ''}{cfg.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Ação */}
        {!isRespondido && !isArquivado && (
          <button onClick={() => onToggle(item.id, !isAtivo)} style={{
            padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: isAtivo ? `linear-gradient(135deg, ${C.vermelho}, #b91c1c)` : `linear-gradient(135deg, ${C.marrom}, ${C.marromMedio})`,
            color: '#fff', fontWeight: 700, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            boxShadow: `0 3px 10px ${isAtivo ? C.vermelho : C.marrom}35`,
          }}>
            {isAtivo ? <><Pause size={14} /> Pausar Follow-up</> : <><Play size={14} /> Retomar Follow-up</>}
          </button>
        )}

        {/* Detalhes */}
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {[
            { label: 'Status', value: isRespondido ? '✅ Respondeu' : isArquivado ? '📁 Arquivado' : isAtivo ? '🟢 Ativo' : '⏸️ Pausado' },
            { label: 'Mensagens enviadas', value: `${item.total_messages_sent}` },
            { label: 'Próxima mensagem', value: item.next_message_at && isAtivo ? formatDistanceToNow(new Date(item.next_message_at), { locale: ptBR, addSuffix: true }) : '—' },
            { label: 'Última resposta', value: item.last_inbound_at ? format(new Date(item.last_inbound_at), "dd/MM 'às' HH:mm", { locale: ptBR }) : 'Nunca respondeu' },
            { label: 'Última mensagem', value: item.last_message_at ? format(new Date(item.last_message_at), "dd/MM 'às' HH:mm", { locale: ptBR }) : '—' },
            { label: 'Agente', value: agentCfg?.name || 'ISA' },
            ...(item.pause_reason ? [{ label: 'Motivo pausa', value: item.pause_reason }] : []),
          ].map((row, i, arr) => (
            <div key={row.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 13px',
              borderBottom: i < arr.length - 1 ? `1px solid ${C.borderLight}` : 'none',
            }}>
              <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{row.label}</span>
              <span style={{ fontSize: 12, color: C.marrom, fontWeight: 500, textAlign: 'right', maxWidth: 160 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Histórico de mensagens */}
        {historico.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Mensagens enviadas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {historico.map(msg => (
                <div key={msg.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.douradoEscuro }}>
                        {msg.metadata?.stage_label || msg.metadata?.stage || 'Follow-up'}
                      </span>
                      {msg.metadata?.ia_generated && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: `${C.roxo}15`, color: C.roxo, fontWeight: 700 }}>IA</span>
                      )}
                      {msg.metadata?.agent_name && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: C.bgMuted, color: C.textMuted, fontWeight: 600 }}>
                          {msg.metadata.agent_name}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: C.textLight }}>
                      {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: C.marromClaro, margin: 0, lineHeight: 1.5 }}>
                    {msg.conteudo.substring(0, 220)}{msg.conteudo.length > 220 ? '...' : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function FollowupPage() {
  const [items, setItems] = useState<FollowupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ativo' | 'pausado' | 'respondido' | 'arquivado'>('all');
  const [selected, setSelected] = useState<FollowupItem | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ total: 0, ativos: 0, respondidos: 0, arquivados: 0, taxaResposta: 0, porEstagio: {} });
  const [showChart, setShowChart] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('traffic_followups')
        .select(`
          id, lead_id, telefone, current_stage, automation_active,
          total_messages_sent, next_message_at, last_inbound_at, last_message_at,
          pause_reason, status, stages_sent,
          lead:leads_juridicos(nome, status, isa_agent)
        `)
        .order('next_message_at', { ascending: true, nullsFirst: false })
        .limit(300);

      if (error) throw error;

      const formatted: FollowupItem[] = (data || []).map((d: any) => ({
        id: d.id,
        lead_id: d.lead_id,
        telefone: d.telefone,
        current_stage: d.current_stage,
        automation_active: d.automation_active,
        total_messages_sent: d.total_messages_sent || 0,
        next_message_at: d.next_message_at,
        last_inbound_at: d.last_inbound_at,
        last_message_at: d.last_message_at,
        pause_reason: d.pause_reason,
        status: d.status || 'new',
        stages_sent: d.stages_sent || {},
        nome: d.lead?.nome || d.telefone,
        lead_status: d.lead?.status || '',
        isa_agent: d.lead?.isa_agent || null,
      }));

      setItems(formatted);

      const ativos = formatted.filter(f => f.automation_active).length;
      const respondidos = formatted.filter(f => f.status === 'responded').length;
      const arquivados = formatted.filter(f => f.status === 'archived').length;
      const taxaResposta = formatted.length > 0 ? Math.round((respondidos / formatted.length) * 100) : 0;

      const porEstagio: Record<string, number> = {};
      formatted.filter(f => f.automation_active).forEach(f => {
        const stage = f.current_stage || 'aguardando';
        porEstagio[stage] = (porEstagio[stage] || 0) + 1;
      });

      setMetrics({ total: formatted.length, ativos, respondidos, arquivados, taxaResposta, porEstagio });
    } catch (err: any) {
      toast({ title: 'Erro ao carregar follow-ups', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!selected) { setHistorico([]); return; }
    supabase
      .from('manychat_mensagens')
      .select('id, conteudo, created_at, metadata')
      .eq('lead_id', selected.lead_id)
      .eq('direcao', 'saida')
      .eq('metadata->>source', 'traffic_followup')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setHistorico(data || []));
  }, [selected]);

  const handleToggle = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('traffic_followups')
        .update({
          automation_active: active,
          pause_reason: active ? null : 'Pausado manualmente',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setItems(prev => prev.map(i => i.id === id ? { ...i, automation_active: active, pause_reason: active ? null : 'Pausado manualmente' } : i));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, automation_active: active } : null);
      toast({ title: active ? '▶️ Follow-up retomado' : '⏸️ Follow-up pausado' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const filtered = items.filter(item => {
    const matchSearch = !search || item.nome?.toLowerCase().includes(search.toLowerCase()) || item.telefone?.includes(search);
    const matchFilter =
      filterStatus === 'all' ? true :
      filterStatus === 'ativo' ? item.automation_active :
      filterStatus === 'pausado' ? !item.automation_active && item.status !== 'responded' && item.status !== 'archived' :
      filterStatus === 'respondido' ? item.status === 'responded' :
      item.status === 'archived';
    return matchSearch && matchFilter;
  });

  const filters: { key: typeof filterStatus; label: string; count?: number }[] = [
    { key: 'all', label: 'Todos', count: items.length },
    { key: 'ativo', label: 'Ativos', count: metrics.ativos },
    { key: 'pausado', label: 'Pausados', count: items.filter(i => !i.automation_active && i.status !== 'responded' && i.status !== 'archived').length },
    { key: 'respondido', label: 'Responderam', count: metrics.respondidos },
    { key: 'arquivado', label: 'Arquivados', count: metrics.arquivados },
  ];

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, gap: 12 }}>
        <RefreshCw size={22} style={{ color: C.dourado, animation: 'spin 1s linear infinite' }} />
        <span style={{ color: C.textMuted, fontWeight: 600 }}>Carregando follow-ups...</span>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: C.bg, overflow: 'hidden' }}>

        {/* HEADER */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.bgCard, flexShrink: 0 }}>

          {/* Título */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${C.marrom}, ${C.marromMedio})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={17} style={{ color: C.dourado }} />
              </div>
              <div>
                <h1 style={{ fontSize: 17, fontWeight: 800, color: C.marrom, margin: 0 }}>Follow-up Automático</h1>
                <span style={{ fontSize: 11, color: C.textMuted }}>{filtered.length} de {items.length} leads • 11 estágios</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowChart(s => !s)} style={{
                padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: showChart ? C.bgMuted : C.bgCard, color: C.textMuted, cursor: 'pointer',
              }} title="Ver gráfico por estágio">
                <BarChart2 size={14} />
              </button>
              <button onClick={fetchData} style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bgCard, color: C.textMuted, cursor: 'pointer' }}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
            <KpiCard label="Total" value={metrics.total} Icon={Users} accent={C.marrom} />
            <KpiCard label="Ativos" value={metrics.ativos} Icon={Play} accent={C.verde} sub="Em automação" />
            <KpiCard label="Responderam" value={metrics.respondidos} Icon={CheckCircle} accent={C.azul} />
            <KpiCard label="Taxa Resposta" value={`${metrics.taxaResposta}%`} Icon={TrendingUp} accent={C.douradoEscuro} />
          </div>

          {/* Gráfico por estágio (colapsável) */}
          {showChart && (
            <div style={{ background: C.bgMuted, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Ativos por Estágio</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(metrics.porEstagio).sort((a, b) => (STAGES[a[0]]?.order || 99) - (STAGES[b[0]]?.order || 99)).map(([stage, count]) => {
                  const cfg = STAGES[stage];
                  if (!cfg) return null;
                  return (
                    <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 7, background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Busca */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              style={{
                width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8,
                border: `1px solid ${C.border}`, background: C.bg, fontSize: 12,
                color: C.marrom, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 2 }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 5, background: C.bgMuted, borderRadius: 9, padding: '3px 5px' }}>
            {filters.map(f => (
              <button key={f.key} onClick={() => setFilterStatus(f.key)} style={{
                flex: 1, padding: '5px 4px', borderRadius: 6, border: 'none',
                fontSize: 10, fontWeight: 700, cursor: 'pointer',
                background: filterStatus === f.key ? C.bgCard : 'transparent',
                color: filterStatus === f.key ? C.marrom : C.textMuted,
                boxShadow: filterStatus === f.key ? '0 1px 4px rgba(61,43,31,0.1)' : 'none',
                transition: 'all 0.12s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              }}>
                <span>{f.label}</span>
                {f.count !== undefined && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: filterStatus === f.key ? C.douradoEscuro : C.textLight }}>{f.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Lista */}
          <div style={{ width: selected ? 340 : '100%', borderRight: selected ? `1px solid ${C.border}` : 'none', overflowY: 'auto', flexShrink: 0 }}>
            {filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 10 }}>
                <AlertCircle size={26} style={{ color: C.textLight }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: C.marrom }}>Nenhum lead encontrado</span>
                <span style={{ fontSize: 12, color: C.textMuted }}>Ajuste os filtros</span>
              </div>
            ) : filtered.map(item => (
              <FollowupRow key={item.id} item={item} onToggle={handleToggle} onSelect={setSelected} selected={selected?.id === item.id} />
            ))}
          </div>

          {/* Detalhe */}
          {selected ? (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <DetalhePanel item={selected} historico={historico} onToggle={handleToggle} onClose={() => setSelected(null)} />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.textMuted }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: C.bgMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={26} style={{ color: C.textLight }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: C.marrom }}>Selecione um lead</span>
              <span style={{ fontSize: 12 }}>Veja detalhes, progresso e histórico</span>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </AppLayout>
  );
}
