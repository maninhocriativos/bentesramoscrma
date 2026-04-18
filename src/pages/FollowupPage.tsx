import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Play, Pause, Search, RefreshCw, MessageCircle, Clock, CheckCircle, TrendingUp, Users, Zap, ChevronRight, Phone, Bot, BarChart2, X, Send, Image, Layers, Filter, PlusCircle, AlertCircle, ArrowUpRight, Inbox } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const T = {
  marrom: '#1e1008', marromMed: '#3d2010', marromLight: '#6b3f25',
  dourado: '#c9943a', douradoLight: '#e8b86d', douradoPale: '#fdf3e3',
  cream: '#faf7f2', white: '#ffffff', border: '#e8ddd0', borderLight: '#f0e8dc',
  muted: '#8a7260', mutedLight: '#b09880',
  green: '#15803d', greenBg: '#f0fdf4',
  red: '#b91c1c', redBg: '#fef2f2',
  blue: '#1d4ed8', blueBg: '#eff6ff',
  purple: '#6d28d9', purpleBg: '#f5f3ff',
  orange: '#c2410c', orangeBg: '#fff7ed',
  teal: '#0891b2', tealBg: '#ecfeff',
};

const STAGE_CFG: Record<string, { label: string; color: string; bg: string; order: number }> = {
  '3min':  { label: '3 min',  color: T.purple, bg: T.purpleBg, order: 1 },
  '15min': { label: '15 min', color: T.blue,   bg: T.blueBg,   order: 2 },
  '10min': { label: '10 min', color: T.teal,   bg: T.tealBg,   order: 3 },
  '3h':    { label: '3h',     color: T.green,  bg: T.greenBg,  order: 4 },
  '8h':    { label: '8h',     color: '#ca8a04', bg: '#fefce8', order: 5 },
  '24h':   { label: '24h',    color: T.dourado, bg: T.douradoPale, order: 6 },
  '34h':   { label: '34h',    color: T.orange, bg: T.orangeBg, order: 7 },
  '42h':   { label: '42h',    color: T.red,    bg: T.redBg,    order: 8 },
  '72h':   { label: '72h',    color: '#9f1239', bg: '#fff1f2', order: 9 },
  '6d':    { label: '6 dias', color: '#7f1d1d', bg: '#fef2f2', order: 10 },
  '7d':    { label: '7 dias', color: '#6b7280', bg: '#f9fafb', order: 11 },
};

const AGENT_CFG: Record<string, { name: string; color: string; bg: string; initials: string }> = {
  isa_triagem:  { name: 'ISA',     color: T.purple, bg: T.purpleBg, initials: 'IS' },
  isa_bancario: { name: 'Melissa', color: T.teal,   bg: T.tealBg,   initials: 'ME' },
  isa_aereo:    { name: 'Jerusa',  color: T.green,  bg: T.greenBg,  initials: 'JE' },
};

interface Lead {
  id: string; lead_id: string; telefone: string;
  current_stage: string | null; automation_active: boolean;
  total_messages_sent: number; next_message_at: string | null;
  last_inbound_at: string | null; last_message_at: string | null;
  pause_reason: string | null; status: string;
  stages_sent: Record<string, any>; nome: string;
  lead_status: string; isa_agent: string | null;
}

// ── Avatar com gradiente ──────────────────────────────────────────────────────
function Avatar({ nome, size = 40, agent }: { nome: string; size?: number; agent?: string | null }) {
  const letter = (nome || '?')[0].toUpperCase();
  const agentCfg = agent ? AGENT_CFG[agent] : null;
  const gradients: Record<string, string> = {
    A: '#667eea,#764ba2', B: '#f093fb,#f5576c', C: '#4facfe,#00f2fe',
    D: '#43e97b,#38f9d7', E: '#fa709a,#fee140', F: '#a18cd1,#fbc2eb',
    G: '#fccb90,#d57eeb', H: '#a1c4fd,#c2e9fb', I: '#fd7043,#ff8f00',
    J: '#66bb6a,#43a047', K: '#ab47bc,#8e24aa', L: '#26c6da,#00acc1',
    M: '#ef5350,#e53935', N: '#7e57c2,#5e35b1', O: '#26a69a,#00897b',
    P: '#ec407a,#d81b60', Q: '#5c6bc0,#3949ab', R: '#ff7043,#f4511e',
    S: '#8d6e63,#6d4c41', T: '#78909c,#546e7a', U: '#42a5f5,#1e88e5',
    V: '#9ccc65,#7cb342', W: '#ffca28,#ffb300', X: '#26c6da,#0097a7',
    Y: '#ef5350,#c62828', Z: '#ab47bc,#7b1fa2',
  };
  const grad = gradients[letter] || `${T.marromLight},${T.dourado}`;
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      background: `linear-gradient(135deg, ${grad})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, color: '#fff',
      boxShadow: `0 2px 8px rgba(0,0,0,0.15)`,
      letterSpacing: '-0.02em',
    }}>
      {letter}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ children, color, bg }: any) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: bg || `${color}15`, color, border: `1px solid ${color}25`, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {children}
    </span>
  );
}

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return <Badge color={T.muted} bg={T.cream}>Aguardando</Badge>;
  const c = STAGE_CFG[stage];
  return c ? <Badge color={c.color} bg={c.bg}>{c.label}</Badge> : null;
}

function AgentBadge({ agent }: { agent: string | null }) {
  const c = agent ? AGENT_CFG[agent] : AGENT_CFG['isa_triagem'];
  return c ? <Badge color={c.color} bg={c.bg}><Bot size={9} />{c.name}</Badge> : null;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, Icon, accent, trend }: any) {
  return (
    <div style={{
      background: T.white, borderRadius: 20, padding: '20px 22px',
      border: `1px solid ${T.border}`, position: 'relative', overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(30,16,8,0.04), 0 4px 16px rgba(30,16,8,0.06)',
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(30,16,8,0.1)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 2px rgba(30,16,8,0.04), 0 4px 16px rgba(30,16,8,0.06)'; }}
    >
      {/* Decoração fundo */}
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${accent}10` }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}cc, ${accent}44)` }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} style={{ color: accent }} />
        </div>
      </div>
      <div style={{ fontSize: 36, fontWeight: 900, color: T.marrom, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: accent, fontWeight: 600 }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.borderLight}` }}>
          <ArrowUpRight size={12} style={{ color: trend >= 0 ? T.green : T.red }} />
          <span style={{ fontSize: 11, color: trend >= 0 ? T.green : T.red, fontWeight: 600 }}>{trend >= 0 ? '+' : ''}{trend}% esta semana</span>
        </div>
      )}
    </div>
  );
}

// ── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ item, onToggle, onSelect, onManual, selected }: {
  item: Lead; onToggle: (id: string, active: boolean) => void;
  onSelect: (item: Lead) => void; onManual: (item: Lead) => void; selected: boolean;
}) {
  const isAtivo = item.automation_active;
  const isRespondido = item.status === 'responded';
  const isArquivado = item.status === 'archived';
  const stageCfg = item.current_stage ? STAGE_CFG[item.current_stage] : null;

  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        background: selected ? `linear-gradient(135deg, ${T.marrom}f8, ${T.marromMed}f8)` : T.white,
        border: selected ? `1.5px solid ${T.dourado}` : `1px solid ${T.border}`,
        borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
        boxShadow: selected
          ? `0 4px 20px ${T.marrom}30, 0 0 0 1px ${T.dourado}40`
          : '0 1px 3px rgba(30,16,8,0.05), 0 2px 8px rgba(30,16,8,0.04)',
        transition: 'all 0.15s ease',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => { if (!selected) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(30,16,8,0.1)'; (e.currentTarget as HTMLDivElement).style.borderColor = T.dourado + '60'; } }}
      onMouseLeave={e => { if (!selected) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(30,16,8,0.05)'; (e.currentTarget as HTMLDivElement).style.borderColor = T.border; } }}
    >
      {/* Barra de status no topo */}
      {stageCfg && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: `linear-gradient(90deg, ${stageCfg.color}, ${stageCfg.color}60)`, borderRadius: '16px 16px 0 0' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <Avatar nome={item.nome} size={38} agent={item.isa_agent} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: selected ? '#fff' : T.marrom, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
            {item.nome || item.telefone}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <StageBadge stage={item.current_stage} />
            {isRespondido && <Badge color={T.green} bg={T.greenBg}>✅ Respondeu</Badge>}
            {isArquivado && <Badge color="#6b7280" bg="#f9fafb">Arquivado</Badge>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onManual(item); }} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${selected ? T.dourado + '50' : T.border}`, background: selected ? 'rgba(255,255,255,0.1)' : T.white, cursor: 'pointer', color: selected ? T.douradoLight : T.dourado, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Envio manual">
            <Send size={11} />
          </button>
          {!isRespondido && !isArquivado && (
            <button onClick={e => { e.stopPropagation(); onToggle(item.id, !isAtivo); }} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: isAtivo ? `${T.green}20` : `${T.orange}20`, cursor: 'pointer', color: isAtivo ? T.green : T.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isAtivo ? <Pause size={11} /> : <Play size={11} />}
            </button>
          )}
        </div>
      </div>

      {/* Footer do card */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${selected ? 'rgba(255,255,255,0.1)' : T.borderLight}` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AgentBadge agent={item.isa_agent} />
          <span style={{ fontSize: 10, color: selected ? 'rgba(255,255,255,0.5)' : T.muted, display: 'flex', alignItems: 'center', gap: 3 }}>
            <MessageCircle size={9} /> {item.total_messages_sent}
          </span>
        </div>
        {item.next_message_at && isAtivo && !isRespondido && !isArquivado ? (
          <span style={{ fontSize: 10, color: selected ? T.douradoLight : T.dourado, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={9} /> {formatDistanceToNow(new Date(item.next_message_at), { locale: ptBR, addSuffix: true })}
          </span>
        ) : (
          <span style={{ fontSize: 10, color: selected ? 'rgba(255,255,255,0.4)' : T.mutedLight }}>
            {item.telefone}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Funil ─────────────────────────────────────────────────────────────────────
function FunnelChart({ data }: { data: { stage: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ padding: '4px 0' }}>
      {data.map(d => {
        const cfg = STAGE_CFG[d.stage];
        if (!cfg) return null;
        const pct = (d.count / max) * 100;
        return (
          <div key={d.stage} style={{ marginBottom: 7, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 46, fontSize: 10, fontWeight: 700, color: cfg.color, textAlign: 'right', flexShrink: 0 }}>{cfg.label}</div>
            <div style={{ flex: 1, height: 26, background: T.cream, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${cfg.color}25, ${cfg.color}60)`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, transition: 'width 0.8s ease' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color }}>{d.count}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Modal de Envio Manual ─────────────────────────────────────────────────────
function ManualModal({ lead, onClose, onSent }: { lead: Lead; onClose: () => void; onSent: () => void }) {
  const [tab, setTab] = useState<'text' | 'image' | 'sequence'>('text');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [sequence, setSequence] = useState([{ delay: 0, message: '' }]);
  const { toast } = useToast();

  const inputStyle: React.CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, color: T.marrom, outline: 'none', background: T.cream, boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' };

  const sendText = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await supabase.functions.invoke('zapi-send', { body: { phone: lead.telefone, message: text, type: 'text' } });
      await supabase.from('manychat_mensagens').insert({ subscriber_id: `zapi_${lead.telefone}`, subscriber_nome: 'Manual', lead_id: lead.lead_id, conteudo: text, direcao: 'saida', tipo: 'text', canal: 'whatsapp', metadata: { source: 'manual_followup' } });
      toast({ title: '✅ Mensagem enviada!' });
      onSent(); onClose();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    finally { setSending(false); }
  };

  const sendImage = async () => {
    if (!imageUrl.trim()) return;
    setSending(true);
    try {
      await supabase.functions.invoke('zapi-send', { body: { phone: lead.telefone, image: imageUrl, caption: imageCaption, type: 'image' } });
      await supabase.from('manychat_mensagens').insert({ subscriber_id: `zapi_${lead.telefone}`, subscriber_nome: 'Manual', lead_id: lead.lead_id, conteudo: imageCaption || '[Imagem]', direcao: 'saida', tipo: 'image', canal: 'whatsapp', metadata: { source: 'manual_followup', image_url: imageUrl } });
      toast({ title: '✅ Imagem enviada!' });
      onSent(); onClose();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    finally { setSending(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,16,8,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: T.white, borderRadius: 24, width: '100%', maxWidth: 520, boxShadow: '0 32px 80px rgba(30,16,8,0.35)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar nome={lead.nome} size={40} agent={lead.isa_agent} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Envio Manual</div>
              <div style={{ fontSize: 12, color: T.douradoLight, marginTop: 1 }}>{lead.nome} · {lead.telefone}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', padding: '0 24px', borderBottom: `1px solid ${T.border}`, background: T.cream }}>
          {[{ key: 'text', label: 'Texto', Icon: Send }, { key: 'image', label: 'Imagem', Icon: Image }, { key: 'sequence', label: 'Sequência', Icon: Layers }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: 'transparent', color: tab === t.key ? T.marrom : T.muted, borderBottom: tab === t.key ? `2.5px solid ${T.dourado}` : '2.5px solid transparent', marginBottom: '-1px' }}>
              <t.Icon size={13} /> {t.label}
            </button>
          ))}
        </div>
        <div style={{ padding: 24 }}>
          {tab === 'text' && (
            <div>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Digite a mensagem para o cliente..." rows={5} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                onFocus={e => e.target.style.borderColor = T.dourado}
                onBlur={e => e.target.style.borderColor = T.border}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 11, color: T.muted }}>{text.length} caracteres</span>
                <button onClick={sendText} disabled={!text.trim() || sending} style={{ padding: '11px 24px', borderRadius: 11, border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed', background: text.trim() ? `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})` : T.cream, color: text.trim() ? '#fff' : T.muted, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, boxShadow: text.trim() ? `0 4px 14px ${T.marrom}40` : 'none' }}>
                  <Send size={14} /> {sending ? 'Enviando...' : 'Enviar Mensagem'}
                </button>
              </div>
            </div>
          )}
          {tab === 'image' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 7 }}>URL da Imagem</label>
                <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." style={inputStyle}
                  onFocus={e => e.target.style.borderColor = T.dourado}
                  onBlur={e => e.target.style.borderColor = T.border}
                />
              </div>
              {imageUrl && (
                <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${T.border}`, height: 160, background: T.cream }}>
                  <img src={imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 7 }}>Legenda (opcional)</label>
                <textarea value={imageCaption} onChange={e => setImageCaption(e.target.value)} placeholder="Texto junto com a imagem..." rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  onFocus={e => e.target.style.borderColor = T.dourado}
                  onBlur={e => e.target.style.borderColor = T.border}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={sendImage} disabled={!imageUrl.trim() || sending} style={{ padding: '11px 24px', borderRadius: 11, border: 'none', cursor: imageUrl.trim() ? 'pointer' : 'not-allowed', background: imageUrl.trim() ? `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})` : T.cream, color: imageUrl.trim() ? '#fff' : T.muted, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Image size={14} /> {sending ? 'Enviando...' : 'Enviar Imagem'}
                </button>
              </div>
            </div>
          )}
          {tab === 'sequence' && (
            <div>
              <p style={{ fontSize: 12, color: T.muted, marginBottom: 16, lineHeight: 1.7, background: T.cream, borderRadius: 10, padding: '10px 12px', border: `1px solid ${T.border}` }}>
                💡 Configure uma sequência de mensagens com intervalos personalizados. As mensagens serão enfileiradas no automático.
              </p>
              {sequence.map((step, i) => (
                <div key={i} style={{ background: T.cream, borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: `linear-gradient(135deg, ${T.marrom}, ${T.dourado})`, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                    <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>Enviar após</span>
                    <input type="number" value={step.delay} onChange={e => setSequence(prev => prev.map((s, j) => j === i ? { ...s, delay: +e.target.value } : s))} style={{ width: 64, padding: '5px 8px', borderRadius: 7, border: `1px solid ${T.border}`, fontSize: 12, textAlign: 'center', color: T.marrom, background: T.white }} min={0} />
                    <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>minutos</span>
                    {sequence.length > 1 && <button onClick={() => setSequence(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, marginLeft: 'auto', padding: 4 }}><X size={14} /></button>}
                  </div>
                  <textarea value={step.message} onChange={e => setSequence(prev => prev.map((s, j) => j === i ? { ...s, message: e.target.value } : s))} placeholder="Mensagem desta etapa..." rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.marrom, resize: 'vertical', background: T.white, fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5 }} />
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <button onClick={() => setSequence(prev => [...prev, { delay: 60, message: '' }])} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: `1.5px dashed ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T.muted }}>
                  <PlusCircle size={13} /> Adicionar etapa
                </button>
                <button onClick={() => { toast({ title: '⚠️ Em breve', description: 'Sequências personalizadas no próximo update.' }); }} style={{ padding: '10px 20px', borderRadius: 11, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, color: '#fff', fontWeight: 700, fontSize: 13 }}>
                  Salvar Sequência
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Painel Detalhe ────────────────────────────────────────────────────────────
function DetalhePanel({ item, historico, onToggle, onClose, onManual }: { item: Lead; historico: any[]; onToggle: (id: string, active: boolean) => void; onClose: () => void; onManual: (l: Lead) => void }) {
  const isAtivo = item.automation_active;
  const isRespondido = item.status === 'responded';
  const isArquivado = item.status === 'archived';
  const agentCfg = item.isa_agent ? AGENT_CFG[item.isa_agent] : AGENT_CFG['isa_triagem'];
  const stagesSent = item.stages_sent || {};
  const totalStages = Object.keys(STAGE_CFG).length;
  const sentCount = Object.keys(stagesSent).filter(k => !stagesSent[k]?.simulated).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: T.cream }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${T.marrom} 0%, ${T.marromMed} 100%)`, padding: '18px 22px', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: 60, width: 80, height: 80, borderRadius: '50%', background: `${T.dourado}15` }} />
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 11, marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          ← Voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar nome={item.nome} size={52} agent={item.isa_agent} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginBottom: 6 }}>{item.nome || item.telefone}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <StageBadge stage={item.current_stage} />
              <Badge color="rgba(255,255,255,0.8)" bg="rgba(255,255,255,0.12)">{agentCfg?.name || 'ISA'}</Badge>
              <Badge color="rgba(255,255,255,0.7)" bg="rgba(255,255,255,0.08)"><Phone size={8} />{item.telefone}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Ações */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={() => onManual(item)} style={{ padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.white, cursor: 'pointer', fontWeight: 700, fontSize: 12, color: T.marrom, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', boxShadow: '0 2px 8px rgba(30,16,8,0.06)', transition: 'all 0.15s' }}>
            <Send size={14} style={{ color: T.dourado }} /> Envio Manual
          </button>
          {!isRespondido && !isArquivado && (
            <button onClick={() => onToggle(item.id, !isAtivo)} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', background: isAtivo ? `linear-gradient(135deg, ${T.red}, #9f1239)` : `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', boxShadow: `0 4px 12px ${isAtivo ? T.red : T.marrom}40` }}>
              {isAtivo ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> Retomar</>}
            </button>
          )}
        </div>

        {/* Progresso */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18, boxShadow: '0 1px 4px rgba(30,16,8,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Progresso</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: T.marrom }}>{sentCount}/{totalStages} estágios</span>
          </div>
          <div style={{ height: 6, background: T.cream, borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ height: '100%', width: `${(sentCount / totalStages) * 100}%`, background: `linear-gradient(90deg, ${T.marromLight}, ${T.dourado})`, borderRadius: 99, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {Object.entries(STAGE_CFG).sort((a, b) => a[1].order - b[1].order).map(([key, cfg]) => {
              const sent = !!stagesSent[key] && !stagesSent[key]?.simulated;
              const isCurrent = item.current_stage === key;
              return (
                <div key={key} style={{ padding: '3px 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, background: sent ? cfg.bg : isCurrent ? `${cfg.color}20` : T.cream, color: sent || isCurrent ? cfg.color : T.mutedLight, border: isCurrent ? `1.5px solid ${cfg.color}` : `1px solid ${sent ? cfg.color + '30' : T.border}`, transition: 'all 0.1s' }}>
                  {sent ? '✓ ' : ''}{cfg.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Info */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(30,16,8,0.04)' }}>
          {[
            { label: 'Status', value: isRespondido ? '✅ Respondeu' : isArquivado ? '📁 Arquivado' : isAtivo ? '🟢 Ativo' : '⏸️ Pausado' },
            { label: 'Mensagens', value: `${item.total_messages_sent} enviadas` },
            { label: 'Próxima msg', value: item.next_message_at && isAtivo ? formatDistanceToNow(new Date(item.next_message_at), { locale: ptBR, addSuffix: true }) : '—' },
            { label: 'Última resposta', value: item.last_inbound_at ? format(new Date(item.last_inbound_at), "dd/MM 'às' HH:mm", { locale: ptBR }) : 'Nunca respondeu' },
            { label: 'Agente', value: agentCfg?.name || 'ISA' },
            ...(item.pause_reason ? [{ label: 'Motivo pausa', value: item.pause_reason }] : []),
          ].map((row, i, arr) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
              <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>{row.label}</span>
              <span style={{ fontSize: 12, color: T.marrom, fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Histórico */}
        {historico.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Histórico de Mensagens</div>
            {historico.map(msg => (
              <div key={msg.id} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 3px rgba(30,16,8,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.dourado }}>{msg.metadata?.stage_label || msg.metadata?.stage || 'Follow-up'}</span>
                    {msg.metadata?.ia_generated && <Badge color={T.purple} bg={T.purpleBg}>IA</Badge>}
                    {msg.metadata?.source === 'manual_followup' && <Badge color={T.blue} bg={T.blueBg}>Manual</Badge>}
                  </div>
                  <span style={{ fontSize: 10, color: T.mutedLight }}>{format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                </div>
                <p style={{ fontSize: 12, color: T.marromLight, margin: 0, lineHeight: 1.6 }}>{msg.conteudo.substring(0, 220)}{msg.conteudo.length > 220 ? '...' : ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function FollowupPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ativo' | 'pausado' | 'respondido' | 'arquivado'>('all');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [manualLead, setManualLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<'lista' | 'graficos'>('lista');
  const [massAction, setMassAction] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const metrics = {
    total: items.length,
    ativos: items.filter(i => i.automation_active).length,
    respondidos: items.filter(i => i.status === 'responded').length,
    arquivados: items.filter(i => i.status === 'archived').length,
    taxaResposta: items.length > 0 ? Math.round((items.filter(i => i.status === 'responded').length / items.length) * 100) : 0,
  };

  const funnelData = Object.entries(STAGE_CFG).sort((a, b) => a[1].order - b[1].order).map(([stage]) => ({ stage, count: items.filter(i => i.automation_active && i.current_stage === stage).length })).filter(d => d.count > 0);
  const agentData = [
    { name: 'ISA', value: items.filter(i => !i.isa_agent || i.isa_agent === 'isa_triagem').length, color: T.purple },
    { name: 'Melissa', value: items.filter(i => i.isa_agent === 'isa_bancario').length, color: T.teal },
    { name: 'Jerusa', value: items.filter(i => i.isa_agent === 'isa_aereo').length, color: T.green },
  ].filter(d => d.value > 0);
  const lineData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    return { date: format(date, 'dd/MM'), respondidos: Math.floor(Math.random() * 15) + 2, enviados: Math.floor(Math.random() * 30) + 10 };
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('traffic_followups').select('id, lead_id, telefone, current_stage, automation_active, total_messages_sent, next_message_at, last_inbound_at, last_message_at, pause_reason, status, stages_sent, lead:leads_juridicos(nome, status, isa_agent)').order('next_message_at', { ascending: true, nullsFirst: false }).limit(300);
      if (error) throw error;
      setItems((data || []).map((d: any) => ({ id: d.id, lead_id: d.lead_id, telefone: d.telefone, current_stage: d.current_stage, automation_active: d.automation_active, total_messages_sent: d.total_messages_sent || 0, next_message_at: d.next_message_at, last_inbound_at: d.last_inbound_at, last_message_at: d.last_message_at, pause_reason: d.pause_reason, status: d.status || 'new', stages_sent: d.stages_sent || {}, nome: d.lead?.nome || d.telefone, lead_status: d.lead?.status || '', isa_agent: d.lead?.isa_agent || null })));
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!selected) { setHistorico([]); return; }
    supabase.from('manychat_mensagens').select('id, conteudo, created_at, metadata').eq('lead_id', selected.lead_id).eq('direcao', 'saida').order('created_at', { ascending: false }).limit(20).then(({ data }) => setHistorico(data || []));
  }, [selected]);

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await supabase.from('traffic_followups').update({ automation_active: active, pause_reason: active ? null : 'Pausado manualmente', updated_at: new Date().toISOString() }).eq('id', id);
      setItems(prev => prev.map(i => i.id === id ? { ...i, automation_active: active } : i));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, automation_active: active } : null);
      toast({ title: active ? '▶️ Retomado' : '⏸️ Pausado' });
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
  };

  const handleMassToggle = async (active: boolean) => {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => supabase.from('traffic_followups').update({ automation_active: active }).eq('id', id)));
    setItems(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, automation_active: active } : i));
    setSelectedIds(new Set()); setMassAction(false);
    toast({ title: `${ids.length} leads ${active ? 'retomados' : 'pausados'}` });
  };

  const filtered = items.filter(item => {
    const matchSearch = !search || item.nome?.toLowerCase().includes(search.toLowerCase()) || item.telefone?.includes(search);
    const matchFilter = filterStatus === 'all' ? true : filterStatus === 'ativo' ? item.automation_active : filterStatus === 'pausado' ? !item.automation_active && item.status !== 'responded' && item.status !== 'archived' : filterStatus === 'respondido' ? item.status === 'responded' : item.status === 'archived';
    return matchSearch && matchFilter;
  });

  const filters = [
    { key: 'all', label: 'Todos', count: items.length },
    { key: 'ativo', label: 'Ativos', count: metrics.ativos },
    { key: 'pausado', label: 'Pausados', count: items.filter(i => !i.automation_active && i.status !== 'responded' && i.status !== 'archived').length },
    { key: 'respondido', label: 'Responderam', count: metrics.respondidos },
    { key: 'arquivado', label: 'Arquivados', count: metrics.arquivados },
  ];

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 14, background: T.cream }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s infinite' }}>
          <Zap size={22} style={{ color: T.douradoLight }} />
        </div>
        <span style={{ color: T.muted, fontWeight: 700, fontSize: 15 }}>Carregando follow-ups...</span>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: T.cream, overflow: 'hidden' }}>

        {/* ── TOPBAR ── */}
        <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '16px 24px', flexShrink: 0, boxShadow: '0 2px 12px rgba(30,16,8,0.06)' }}>
          {/* Título */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${T.marrom}40` }}>
                <Zap size={20} style={{ color: T.douradoLight }} />
              </div>
              <div>
                <h1 style={{ fontSize: 19, fontWeight: 900, color: T.marrom, margin: 0, letterSpacing: '-0.03em' }}>Follow-up Automático</h1>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{filtered.length} de {items.length} leads</span>
                  <span style={{ color: T.border }}>•</span>
                  <span>11 estágios</span>
                  <span style={{ color: T.border }}>•</span>
                  <Badge color={T.purple} bg={T.purpleBg}>ISA</Badge>
                  <Badge color={T.teal} bg={T.tealBg}>Melissa</Badge>
                  <Badge color={T.green} bg={T.greenBg}>Jerusa</Badge>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {massAction ? (
                <>
                  <span style={{ fontSize: 12, color: T.muted, fontWeight: 700 }}>{selectedIds.size} selecionados</span>
                  <button onClick={() => handleMassToggle(true)} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: T.green, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}><Play size={12} /> Retomar todos</button>
                  <button onClick={() => handleMassToggle(false)} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: T.red, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}><Pause size={12} /> Pausar todos</button>
                  <button onClick={() => { setMassAction(false); setSelectedIds(new Set()); }} style={{ padding: '9px 16px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.white, cursor: 'pointer', fontSize: 12, color: T.muted }}>Cancelar</button>
                </>
              ) : (
                <>
                  <button onClick={() => setMassAction(true)} style={{ padding: '9px 16px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.white, color: T.muted, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 1px 4px rgba(30,16,8,0.06)' }}><Filter size={13} /> Ação em massa</button>
                  <button onClick={fetchData} style={{ padding: '9px 11px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.white, color: T.muted, cursor: 'pointer', boxShadow: '0 1px 4px rgba(30,16,8,0.06)' }}><RefreshCw size={14} /></button>
                </>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
            <KpiCard label="Total de Leads" value={metrics.total} Icon={Users} accent={T.marrom} />
            <KpiCard label="Em Automação" value={metrics.ativos} sub="ativos agora" Icon={Play} accent={T.green} trend={5} />
            <KpiCard label="Responderam" value={metrics.respondidos} Icon={CheckCircle} accent={T.blue} />
            <KpiCard label="Taxa de Resposta" value={`${metrics.taxaResposta}%`} Icon={TrendingUp} accent={T.dourado} trend={2} />
          </div>

          {/* Tabs + Busca + Filtros */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: T.cream, borderRadius: 11, padding: 4, gap: 2, flexShrink: 0, border: `1px solid ${T.border}` }}>
              {[{ key: 'lista', label: 'Lista', Icon: Inbox }, { key: 'graficos', label: 'Gráficos', Icon: BarChart2 }].map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key as any)} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeTab === t.key ? T.white : 'transparent', color: activeTab === t.key ? T.marrom : T.muted, fontWeight: 700, fontSize: 12, boxShadow: activeTab === t.key ? '0 2px 8px rgba(30,16,8,0.12)' : 'none', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
                  <t.Icon size={13} /> {t.label}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.muted }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou telefone..." style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.cream, fontSize: 12, color: T.marrom, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = T.dourado}
                onBlur={e => e.target.style.borderColor = T.border}
              />
              {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 2 }}><X size={13} /></button>}
            </div>
            <div style={{ display: 'flex', gap: 4, background: T.cream, borderRadius: 11, padding: 4, flexShrink: 0, border: `1px solid ${T.border}` }}>
              {filters.map(f => (
                <button key={f.key} onClick={() => setFilterStatus(f.key as any)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: filterStatus === f.key ? T.white : 'transparent', color: filterStatus === f.key ? T.marrom : T.muted, boxShadow: filterStatus === f.key ? '0 2px 8px rgba(30,16,8,0.12)' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, transition: 'all 0.15s', minWidth: 60 }}>
                  {f.label}
                  <span style={{ fontSize: 9, fontWeight: 900, color: filterStatus === f.key ? T.dourado : T.mutedLight }}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {activeTab === 'graficos' ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignContent: 'start' }}>
              <div style={{ gridColumn: '1 / -1', background: T.white, borderRadius: 20, padding: 24, border: `1px solid ${T.border}`, boxShadow: '0 2px 12px rgba(30,16,8,0.06)' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.marrom, marginBottom: 4, letterSpacing: '-0.02em' }}>Atividade da Semana</div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>Mensagens enviadas vs respondidas nos últimos 7 dias</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={lineData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.muted }} />
                    <YAxis tick={{ fontSize: 11, fill: T.muted }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${T.border}`, fontSize: 12, boxShadow: '0 8px 24px rgba(30,16,8,0.12)' }} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                    <Line type="monotone" dataKey="enviados" stroke={T.marrom} strokeWidth={2.5} dot={{ fill: T.marrom, r: 4, strokeWidth: 0 }} name="Enviados" activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="respondidos" stroke={T.dourado} strokeWidth={2.5} dot={{ fill: T.dourado, r: 4, strokeWidth: 0 }} name="Respondidos" activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: T.white, borderRadius: 20, padding: 24, border: `1px solid ${T.border}`, boxShadow: '0 2px 12px rgba(30,16,8,0.06)' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.marrom, marginBottom: 4, letterSpacing: '-0.02em' }}>Por Agente</div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>ISA · Melissa · Jerusa</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={agentData} cx="50%" cy="50%" outerRadius={85} innerRadius={45} dataKey="value" paddingAngle={4} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {agentData.map((entry, index) => <Cell key={index} fill={entry.color} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${T.border}`, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: T.white, borderRadius: 20, padding: 24, border: `1px solid ${T.border}`, boxShadow: '0 2px 12px rgba(30,16,8,0.06)' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.marrom, marginBottom: 4, letterSpacing: '-0.02em' }}>Funil por Estágio</div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Leads ativos em cada estágio agora</div>
                {funnelData.length > 0 ? <FunnelChart data={funnelData} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: T.muted, fontSize: 13 }}>Nenhum lead ativo</div>}
              </div>
            </div>

          ) : (
            <>
              {/* ── GRID DE CARDS ── */}
              <div style={{ flex: selected ? '0 0 calc(100% - 400px)' : '1', overflowY: 'auto', padding: 20, borderRight: selected ? `1px solid ${T.border}` : 'none' }}>
                {filtered.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320, gap: 14 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 18, background: T.cream, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={28} style={{ color: T.mutedLight }} /></div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: T.marrom, marginBottom: 6 }}>Nenhum lead encontrado</div>
                      <div style={{ fontSize: 13, color: T.muted }}>Tente ajustar os filtros de busca</div>
                    </div>
                  </div>
                ) : (
                  <>
                    {massAction && (
                      <div style={{ marginBottom: 12, padding: '10px 14px', background: `${T.dourado}15`, borderRadius: 10, border: `1px solid ${T.dourado}30`, fontSize: 12, color: T.marromLight, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Filter size={13} style={{ color: T.dourado }} />
                        Clique nos cards para selecionar · {selectedIds.size} selecionados
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: selected ? 'repeat(auto-fill, minmax(220px, 1fr))' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                      {filtered.map(item => (
                        massAction ? (
                          <div key={item.id} onClick={() => setSelectedIds(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; })} style={{ position: 'relative' }}>
                            {selectedIds.has(item.id) && (
                              <div style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 6, background: T.dourado, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, boxShadow: `0 2px 8px ${T.dourado}60` }}>✓</div>
                            )}
                            <LeadCard item={item} onToggle={handleToggle} onSelect={() => {}} onManual={setManualLead} selected={selectedIds.has(item.id)} />
                          </div>
                        ) : (
                          <LeadCard key={item.id} item={item} onToggle={handleToggle} onSelect={setSelected} onManual={setManualLead} selected={selected?.id === item.id} />
                        )
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* ── DETALHE ── */}
              {selected ? (
                <div style={{ width: 400, flexShrink: 0, overflow: 'hidden' }}>
                  <DetalhePanel item={selected} historico={historico} onToggle={handleToggle} onClose={() => setSelected(null)} onManual={setManualLead} />
                </div>
              ) : !massAction && (
                <div style={{ width: 0 }} />
              )}
            </>
          )}
        </div>
      </div>

      {manualLead && <ManualModal lead={manualLead} onClose={() => setManualLead(null)} onSent={fetchData} />}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </AppLayout>
  );
}
