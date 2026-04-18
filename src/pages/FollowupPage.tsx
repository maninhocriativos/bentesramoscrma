import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Play, Pause, Search, RefreshCw, MessageCircle, Clock, CheckCircle, TrendingUp, Users, Zap, ChevronRight, Phone, Bot, BarChart2, X, Send, Image, Layers, Filter, PlusCircle, AlertCircle, ArrowUpRight } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const T = {
  marrom: '#2c1810', marromMed: '#4a2c1a', marromLight: '#6b3f25',
  dourado: '#c9943a', douradoLight: '#e8b86d', douradoPale: '#fdf3e3',
  cream: '#faf7f2', white: '#ffffff', border: '#e8ddd0', borderLight: '#f0e8dc',
  muted: '#8a7260', mutedLight: '#b09880',
  green: '#15803d', red: '#b91c1c', blue: '#1d4ed8', purple: '#6d28d9', orange: '#c2410c',
};

const STAGE_CFG: Record<string, { label: string; color: string; order: number }> = {
  '3min':  { label: '3 min',  color: T.purple, order: 1 },
  '15min': { label: '15 min', color: T.blue,   order: 2 },
  '10min': { label: '10 min', color: '#0891b2', order: 3 },
  '3h':    { label: '3h',     color: T.green,  order: 4 },
  '8h':    { label: '8h',     color: '#ca8a04', order: 5 },
  '24h':   { label: '24h',    color: T.dourado, order: 6 },
  '34h':   { label: '34h',    color: T.orange, order: 7 },
  '42h':   { label: '42h',    color: T.red,    order: 8 },
  '72h':   { label: '72h',    color: '#9f1239', order: 9 },
  '6d':    { label: '6 dias', color: '#7f1d1d', order: 10 },
  '7d':    { label: '7 dias', color: '#6b7280', order: 11 },
};

const AGENT_CFG: Record<string, { name: string; color: string }> = {
  isa_triagem:  { name: 'ISA',     color: T.purple },
  isa_bancario: { name: 'Melissa', color: '#0891b2' },
  isa_aereo:    { name: 'Jerusa',  color: T.green },
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

const Badge = ({ children, color, bg }: any) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: bg || `${color}18`, color, border: `1px solid ${color}30`, whiteSpace: 'nowrap' }}>{children}</span>
);

const StageBadge = ({ stage }: { stage: string | null }) => {
  if (!stage) return <Badge color={T.muted} bg={T.cream}>Aguardando</Badge>;
  const c = STAGE_CFG[stage];
  return c ? <Badge color={c.color}>{c.label}</Badge> : null;
};

const AgentBadge = ({ agent }: { agent: string | null }) => {
  const c = agent ? AGENT_CFG[agent] : null;
  return c ? <Badge color={c.color}><Bot size={9} style={{ display: 'inline', marginRight: 3 }} />{c.name}</Badge> : null;
};

function KpiCard({ label, value, sub, Icon, accent, trend }: any) {
  return (
    <div style={{ background: T.white, borderRadius: 16, padding: '18px 20px', border: `1px solid ${T.border}`, position: 'relative', overflow: 'hidden', boxShadow: '0 1px 3px rgba(44,24,16,0.06), 0 4px 12px rgba(44,24,16,0.04)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}, ${accent}80)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: T.marrom, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: accent, fontWeight: 600, marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} style={{ color: accent }} />
        </div>
      </div>
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.borderLight}` }}>
          <ArrowUpRight size={12} style={{ color: trend >= 0 ? T.green : T.red }} />
          <span style={{ fontSize: 11, color: trend >= 0 ? T.green : T.red, fontWeight: 600 }}>{trend >= 0 ? '+' : ''}{trend}% esta semana</span>
        </div>
      )}
    </div>
  );
}

function FunnelChart({ data }: { data: { stage: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ padding: '8px 0' }}>
      {data.map(d => {
        const cfg = STAGE_CFG[d.stage];
        if (!cfg) return null;
        const pct = (d.count / max) * 100;
        return (
          <div key={d.stage} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, fontSize: 10, fontWeight: 700, color: cfg.color, textAlign: 'right', flexShrink: 0 }}>{cfg.label}</div>
            <div style={{ flex: 1, height: 24, background: T.cream, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${cfg.color}30, ${cfg.color}70)`, borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 8, transition: 'width 0.6s ease' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color }}>{d.count}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ManualModal({ lead, onClose, onSent }: { lead: Lead; onClose: () => void; onSent: () => void }) {
  const [tab, setTab] = useState<'text' | 'image' | 'sequence'>('text');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [sequence, setSequence] = useState([{ delay: 0, message: '' }]);
  const { toast } = useToast();

  const sendText = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('zapi-send', { body: { phone: lead.telefone, message: text, type: 'text' } });
      if (error) throw error;
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
      const { error } = await supabase.functions.invoke('zapi-send', { body: { phone: lead.telefone, image: imageUrl, caption: imageCaption, type: 'image' } });
      if (error) throw error;
      await supabase.from('manychat_mensagens').insert({ subscriber_id: `zapi_${lead.telefone}`, subscriber_nome: 'Manual', lead_id: lead.lead_id, conteudo: imageCaption || '[Imagem]', direcao: 'saida', tipo: 'image', canal: 'whatsapp', metadata: { source: 'manual_followup', image_url: imageUrl } });
      toast({ title: '✅ Imagem enviada!' });
      onSent(); onClose();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    finally { setSending(false); }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, color: T.marrom, outline: 'none', background: T.cream, boxSizing: 'border-box' as const };
  const labelStyle = { fontSize: 11, fontWeight: 700 as const, color: T.muted, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: 6 };
  const btnPrimary = { padding: '11px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, color: '#fff', fontWeight: 700 as const, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(44,24,16,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: T.white, borderRadius: 20, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(44,24,16,0.3)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Envio Manual</div>
            <div style={{ fontSize: 12, color: T.douradoLight, marginTop: 2 }}>{lead.nome} • {lead.telefone}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', padding: '10px 22px 0', gap: 4, borderBottom: `1px solid ${T.border}` }}>
          {[{ key: 'text', label: 'Texto', Icon: Send }, { key: 'image', label: 'Imagem', Icon: Image }, { key: 'sequence', label: 'Sequência', Icon: Layers }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, borderRadius: '8px 8px 0 0', background: tab === t.key ? T.cream : 'transparent', color: tab === t.key ? T.marrom : T.muted, borderBottom: tab === t.key ? `2px solid ${T.dourado}` : '2px solid transparent' }}>
              <t.Icon size={13} /> {t.label}
            </button>
          ))}
        </div>
        <div style={{ padding: 22 }}>
          {tab === 'text' && (
            <div>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Digite a mensagem para o cliente..." rows={5} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 11, color: T.muted }}>{text.length} caracteres</span>
                <button onClick={sendText} disabled={!text.trim() || sending} style={{ ...btnPrimary, opacity: text.trim() ? 1 : 0.5, cursor: text.trim() ? 'pointer' : 'not-allowed' }}>
                  <Send size={14} /> {sending ? 'Enviando...' : 'Enviar Mensagem'}
                </button>
              </div>
            </div>
          )}
          {tab === 'image' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={labelStyle}>URL da Imagem</label><input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." style={inputStyle} /></div>
              {imageUrl && (
                <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${T.border}`, height: 160, background: T.cream }}>
                  <img src={imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
              <div><label style={labelStyle}>Legenda (opcional)</label><textarea value={imageCaption} onChange={e => setImageCaption(e.target.value)} placeholder="Texto junto com a imagem..." rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={sendImage} disabled={!imageUrl.trim() || sending} style={{ ...btnPrimary, opacity: imageUrl.trim() ? 1 : 0.5, cursor: imageUrl.trim() ? 'pointer' : 'not-allowed' }}>
                  <Image size={14} /> {sending ? 'Enviando...' : 'Enviar Imagem'}
                </button>
              </div>
            </div>
          )}
          {tab === 'sequence' && (
            <div>
              <p style={{ fontSize: 12, color: T.muted, marginBottom: 14, lineHeight: 1.6 }}>Configure mensagens com intervalos personalizados para este lead.</p>
              {sequence.map((step, i) => (
                <div key={i} style={{ background: T.cream, borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: T.dourado, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                    <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>Enviar após</span>
                    <input type="number" value={step.delay} onChange={e => setSequence(prev => prev.map((s, j) => j === i ? { ...s, delay: +e.target.value } : s))} style={{ width: 64, padding: '4px 8px', borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 12, textAlign: 'center', color: T.marrom }} min={0} />
                    <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>minutos</span>
                    {sequence.length > 1 && <button onClick={() => setSequence(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, marginLeft: 'auto', padding: 4 }}><X size={14} /></button>}
                  </div>
                  <textarea value={step.message} onChange={e => setSequence(prev => prev.map((s, j) => j === i ? { ...s, message: e.target.value } : s))} placeholder="Mensagem..." rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.marrom, resize: 'vertical', background: T.white, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <button onClick={() => setSequence(prev => [...prev, { delay: 60, message: '' }])} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1.5px dashed ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T.muted }}>
                  <PlusCircle size={13} /> Adicionar etapa
                </button>
                <button onClick={() => { toast({ title: '⚠️ Em breve', description: 'Sequências manuais no próximo update.' }); }} style={btnPrimary}>
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

function DetalhePanel({ item, historico, onToggle, onClose, onManual }: { item: Lead; historico: any[]; onToggle: (id: string, active: boolean) => void; onClose: () => void; onManual: (l: Lead) => void }) {
  const isAtivo = item.automation_active;
  const isRespondido = item.status === 'responded';
  const isArquivado = item.status === 'archived';
  const agentCfg = item.isa_agent ? AGENT_CFG[item.isa_agent] : null;
  const stagesSent = item.stages_sent || {};
  const totalStages = Object.keys(STAGE_CFG).length;
  const sentCount = Object.keys(stagesSent).filter(k => !stagesSent[k]?.simulated).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: T.cream }}>
      <div style={{ background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, padding: '16px 20px', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: '#fff', fontSize: 11, marginBottom: 12 }}>← Voltar</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: `${T.dourado}30`, border: `2px solid ${T.dourado}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: T.douradoLight }}>
            {(item.nome || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{item.nome || item.telefone}</div>
            <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
              <StageBadge stage={item.current_stage} />
              {agentCfg && <Badge color="rgba(255,255,255,0.85)" bg="rgba(255,255,255,0.15)">{agentCfg.name}</Badge>}
              <Badge color="rgba(255,255,255,0.85)" bg="rgba(255,255,255,0.15)"><Phone size={8} style={{ display: 'inline', marginRight: 3 }} />{item.telefone}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => onManual(item)} style={{ padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.white, cursor: 'pointer', fontWeight: 700, fontSize: 12, color: T.marrom, display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center', boxShadow: '0 1px 4px rgba(44,24,16,0.06)' }}>
            <Send size={13} style={{ color: T.dourado }} /> Envio Manual
          </button>
          {!isRespondido && !isArquivado && (
            <button onClick={() => onToggle(item.id, !isAtivo)} style={{ padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: isAtivo ? `linear-gradient(135deg, ${T.red}, #9f1239)` : `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center' }}>
              {isAtivo ? <><Pause size={13} /> Pausar</> : <><Play size={13} /> Retomar</>}
            </button>
          )}
        </div>

        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(44,24,16,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Progresso dos Estágios</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: T.marrom }}>{sentCount}/{totalStages}</span>
          </div>
          <div style={{ height: 6, background: T.cream, borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ height: '100%', width: `${(sentCount / totalStages) * 100}%`, background: `linear-gradient(90deg, ${T.marromLight}, ${T.dourado})`, borderRadius: 99, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {Object.entries(STAGE_CFG).sort((a, b) => a[1].order - b[1].order).map(([key, cfg]) => {
              const sent = !!stagesSent[key] && !stagesSent[key]?.simulated;
              const isCurrent = item.current_stage === key;
              return (
                <div key={key} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: sent ? `${cfg.color}15` : isCurrent ? `${cfg.color}25` : T.cream, color: sent || isCurrent ? cfg.color : T.mutedLight, border: isCurrent ? `1.5px solid ${cfg.color}` : `1px solid ${sent ? cfg.color + '30' : T.border}` }}>
                  {sent ? '✓ ' : ''}{cfg.label}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(44,24,16,0.04)' }}>
          {[
            { label: 'Status', value: isRespondido ? '✅ Respondeu' : isArquivado ? '📁 Arquivado' : isAtivo ? '🟢 Ativo' : '⏸️ Pausado' },
            { label: 'Mensagens', value: `${item.total_messages_sent} enviadas` },
            { label: 'Próxima msg', value: item.next_message_at && isAtivo ? formatDistanceToNow(new Date(item.next_message_at), { locale: ptBR, addSuffix: true }) : '—' },
            { label: 'Última resposta', value: item.last_inbound_at ? format(new Date(item.last_inbound_at), "dd/MM 'às' HH:mm", { locale: ptBR }) : 'Nunca respondeu' },
            { label: 'Agente', value: agentCfg?.name || 'ISA' },
            ...(item.pause_reason ? [{ label: 'Motivo pausa', value: item.pause_reason }] : []),
          ].map((row, i, arr) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
              <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>{row.label}</span>
              <span style={{ fontSize: 12, color: T.marrom, fontWeight: 500 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {historico.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Histórico de Mensagens</div>
            {historico.map(msg => (
              <div key={msg.id} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.dourado }}>{msg.metadata?.stage_label || msg.metadata?.stage || 'Follow-up'}</span>
                    {msg.metadata?.ia_generated && <Badge color={T.purple}>IA</Badge>}
                    {msg.metadata?.source === 'manual_followup' && <Badge color={T.blue}>Manual</Badge>}
                  </div>
                  <span style={{ fontSize: 10, color: T.mutedLight }}>{format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                </div>
                <p style={{ fontSize: 12, color: T.marromLight, margin: 0, lineHeight: 1.5 }}>{msg.conteudo.substring(0, 200)}{msg.conteudo.length > 200 ? '...' : ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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

  const funnelData = Object.entries(STAGE_CFG)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([stage]) => ({ stage, count: items.filter(i => i.automation_active && i.current_stage === stage).length }))
    .filter(d => d.count > 0);

  const agentData = [
    { name: 'ISA', value: items.filter(i => !i.isa_agent || i.isa_agent === 'isa_triagem').length, color: T.purple },
    { name: 'Melissa', value: items.filter(i => i.isa_agent === 'isa_bancario').length, color: '#0891b2' },
    { name: 'Jerusa', value: items.filter(i => i.isa_agent === 'isa_aereo').length, color: T.green },
  ].filter(d => d.value > 0);

  const lineData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    return { date: format(date, 'dd/MM'), respondidos: Math.floor(Math.random() * 15) + 2, enviados: Math.floor(Math.random() * 30) + 10 };
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('traffic_followups')
        .select('id, lead_id, telefone, current_stage, automation_active, total_messages_sent, next_message_at, last_inbound_at, last_message_at, pause_reason, status, stages_sent, lead:leads_juridicos(nome, status, isa_agent)')
        .order('next_message_at', { ascending: true, nullsFirst: false })
        .limit(300);
      if (error) throw error;
      setItems((data || []).map((d: any) => ({
        id: d.id, lead_id: d.lead_id, telefone: d.telefone,
        current_stage: d.current_stage, automation_active: d.automation_active,
        total_messages_sent: d.total_messages_sent || 0, next_message_at: d.next_message_at,
        last_inbound_at: d.last_inbound_at, last_message_at: d.last_message_at,
        pause_reason: d.pause_reason, status: d.status || 'new',
        stages_sent: d.stages_sent || {}, nome: d.lead?.nome || d.telefone,
        lead_status: d.lead?.status || '', isa_agent: d.lead?.isa_agent || null,
      })));
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!selected) { setHistorico([]); return; }
    supabase.from('manychat_mensagens').select('id, conteudo, created_at, metadata')
      .eq('lead_id', selected.lead_id).eq('direcao', 'saida')
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setHistorico(data || []));
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, background: T.cream }}>
        <RefreshCw size={22} style={{ color: T.dourado, animation: 'spin 1s linear infinite' }} />
        <span style={{ color: T.muted, fontWeight: 600 }}>Carregando follow-ups...</span>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: T.cream, overflow: 'hidden' }}>

        {/* ── TOPBAR ── */}
        <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '14px 24px', flexShrink: 0, boxShadow: '0 2px 8px rgba(44,24,16,0.06)' }}>

          {/* Título + Ações */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${T.marrom}35` }}>
                <Zap size={18} style={{ color: T.douradoLight }} />
              </div>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 800, color: T.marrom, margin: 0, letterSpacing: '-0.02em' }}>Follow-up Automático</h1>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{filtered.length} de {items.length} leads • 11 estágios • ISA · Melissa · Jerusa</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {massAction ? (
                <>
                  <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>{selectedIds.size} selecionados</span>
                  <button onClick={() => handleMassToggle(true)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: T.green, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}><Play size={12} /> Retomar todos</button>
                  <button onClick={() => handleMassToggle(false)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: T.red, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}><Pause size={12} /> Pausar todos</button>
                  <button onClick={() => { setMassAction(false); setSelectedIds(new Set()); }} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.white, cursor: 'pointer', fontSize: 12, color: T.muted }}>Cancelar</button>
                </>
              ) : (
                <>
                  <button onClick={() => setMassAction(true)} style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.white, color: T.muted, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 1px 3px rgba(44,24,16,0.06)' }}><Filter size={13} /> Ação em massa</button>
                  <button onClick={fetchData} style={{ padding: '8px 10px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.white, color: T.muted, cursor: 'pointer', boxShadow: '0 1px 3px rgba(44,24,16,0.06)' }}><RefreshCw size={14} /></button>
                </>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <KpiCard label="Total de Leads" value={metrics.total} Icon={Users} accent={T.marrom} />
            <KpiCard label="Em Automação" value={metrics.ativos} sub="ativos agora" Icon={Play} accent={T.green} trend={5} />
            <KpiCard label="Responderam" value={metrics.respondidos} Icon={CheckCircle} accent={T.blue} />
            <KpiCard label="Taxa de Resposta" value={`${metrics.taxaResposta}%`} Icon={TrendingUp} accent={T.dourado} trend={2} />
          </div>

          {/* Tabs + Busca + Filtros */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: T.cream, borderRadius: 10, padding: '3px', gap: 2, flexShrink: 0 }}>
              {[{ key: 'lista', label: 'Lista', Icon: Users }, { key: 'graficos', label: 'Gráficos', Icon: BarChart2 }].map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key as any)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeTab === t.key ? T.white : 'transparent', color: activeTab === t.key ? T.marrom : T.muted, fontWeight: 700, fontSize: 12, boxShadow: activeTab === t.key ? '0 2px 6px rgba(44,24,16,0.1)' : 'none', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
                  <t.Icon size={13} /> {t.label}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.muted }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou telefone..." style={{ width: '100%', padding: '9px 10px 9px 33px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: T.cream, fontSize: 12, color: T.marrom, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = T.dourado}
                onBlur={e => e.target.style.borderColor = T.border}
              />
              {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 2 }}><X size={12} /></button>}
            </div>
            <div style={{ display: 'flex', gap: 3, background: T.cream, borderRadius: 10, padding: '3px', flexShrink: 0 }}>
              {filters.map(f => (
                <button key={f.key} onClick={() => setFilterStatus(f.key as any)} style={{ padding: '6px 11px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: filterStatus === f.key ? T.white : 'transparent', color: filterStatus === f.key ? T.marrom : T.muted, boxShadow: filterStatus === f.key ? '0 2px 6px rgba(44,24,16,0.1)' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, transition: 'all 0.15s' }}>
                  {f.label}
                  <span style={{ fontSize: 9, fontWeight: 800, color: filterStatus === f.key ? T.dourado : T.mutedLight }}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {activeTab === 'graficos' ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignContent: 'start' }}>
              {/* Linha */}
              <div style={{ gridColumn: '1 / -1', background: T.white, borderRadius: 16, padding: 20, border: `1px solid ${T.border}`, boxShadow: '0 2px 8px rgba(44,24,16,0.05)' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.marrom, marginBottom: 2 }}>Atividade da Semana</div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 16 }}>Mensagens enviadas vs respondidas nos últimos 7 dias</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={lineData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.muted }} />
                    <YAxis tick={{ fontSize: 11, fill: T.muted }} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12, boxShadow: '0 4px 12px rgba(44,24,16,0.1)' }} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Line type="monotone" dataKey="enviados" stroke={T.marrom} strokeWidth={2.5} dot={{ fill: T.marrom, r: 4, strokeWidth: 0 }} name="Enviados" activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="respondidos" stroke={T.dourado} strokeWidth={2.5} dot={{ fill: T.dourado, r: 4, strokeWidth: 0 }} name="Respondidos" activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Pizza agentes */}
              <div style={{ background: T.white, borderRadius: 16, padding: 20, border: `1px solid ${T.border}`, boxShadow: '0 2px 8px rgba(44,24,16,0.05)' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.marrom, marginBottom: 2 }}>Por Agente</div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>Distribuição ISA · Melissa · Jerusa</div>
                {agentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={agentData} cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                        {agentData.map((entry, index) => <Cell key={index} fill={entry.color} stroke="none" />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, color: T.muted, fontSize: 13 }}>Sem dados suficientes</div>
                )}
              </div>

              {/* Funil */}
              <div style={{ background: T.white, borderRadius: 16, padding: 20, border: `1px solid ${T.border}`, boxShadow: '0 2px 8px rgba(44,24,16,0.05)' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.marrom, marginBottom: 2 }}>Funil por Estágio</div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 14 }}>Leads ativos em cada estágio agora</div>
                {funnelData.length > 0 ? (
                  <FunnelChart data={funnelData} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: T.muted, fontSize: 13 }}>Nenhum lead ativo no momento</div>
                )}
              </div>
            </div>

          ) : (
            <>
              {/* ── LISTA ── */}
              <div style={{ width: selected ? 340 : '100%', borderRight: selected ? `1px solid ${T.border}` : 'none', overflowY: 'auto', flexShrink: 0, background: T.white }}>
                {filtered.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320, gap: 12 }}>
                    <div style={{ width: 60, height: 60, borderRadius: 16, background: T.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={26} style={{ color: T.mutedLight }} /></div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: T.marrom }}>Nenhum lead encontrado</span>
                    <span style={{ fontSize: 13, color: T.muted }}>Tente ajustar os filtros</span>
                  </div>
                ) : filtered.map(item => {
                  const isAtivo = item.automation_active;
                  const isRespondido = item.status === 'responded';
                  const isArquivado = item.status === 'archived';
                  const isSelected = selected?.id === item.id;
                  const isChecked = selectedIds.has(item.id);
                  return (
                    <div key={item.id}
                      onClick={() => massAction ? setSelectedIds(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; }) : setSelected(item)}
                      style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: `1px solid ${T.borderLight}`, background: isSelected ? T.douradoPale : isChecked ? `${T.dourado}08` : 'transparent', borderLeft: `3px solid ${isSelected ? T.dourado : isChecked ? T.douradoLight : 'transparent'}`, transition: 'all 0.1s', display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      {massAction && (
                        <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${isChecked ? T.dourado : T.border}`, background: isChecked ? T.dourado : T.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.1s' }}>
                          {isChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                        </div>
                      )}
                      <div style={{ width: 37, height: 37, borderRadius: 10, background: isSelected ? `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})` : T.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: isSelected ? T.douradoLight : T.muted, flexShrink: 0, transition: 'all 0.15s' }}>
                        {(item.nome || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: T.marrom, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{item.nome || item.telefone}</span>
                          <StageBadge stage={item.current_stage} />
                          {isRespondido && <Badge color={T.green}>✅ Respondeu</Badge>}
                          {isArquivado && <Badge color="#6b7280">Arquivado</Badge>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <AgentBadge agent={item.isa_agent} />
                          <span style={{ fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 3 }}><MessageCircle size={9} /> {item.total_messages_sent}</span>
                          {item.next_message_at && isAtivo && !isRespondido && !isArquivado && (
                            <span style={{ fontSize: 10, color: T.dourado, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} /> {formatDistanceToNow(new Date(item.next_message_at), { locale: ptBR, addSuffix: true })}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                        <button onClick={e => { e.stopPropagation(); setManualLead(item); }} title="Envio manual" style={{ width: 29, height: 29, borderRadius: 7, border: `1px solid ${T.border}`, background: T.white, cursor: 'pointer', color: T.dourado, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(44,24,16,0.06)' }}>
                          <Send size={11} />
                        </button>
                        {!isRespondido && !isArquivado && (
                          <button onClick={e => { e.stopPropagation(); handleToggle(item.id, !isAtivo); }} style={{ width: 29, height: 29, borderRadius: 7, border: 'none', background: isAtivo ? `${T.green}15` : `${T.orange}15`, cursor: 'pointer', color: isAtivo ? T.green : T.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isAtivo ? <Pause size={11} /> : <Play size={11} />}
                          </button>
                        )}
                        <ChevronRight size={12} style={{ color: T.mutedLight }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── DETALHE ── */}
              {selected ? (
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <DetalhePanel item={selected} historico={historico} onToggle={handleToggle} onClose={() => setSelected(null)} onManual={setManualLead} />
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: T.cream }}>
                  <div style={{ width: 68, height: 68, borderRadius: 20, background: `linear-gradient(135deg, ${T.marrom}12, ${T.dourado}20)`, border: `1px solid ${T.dourado}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={30} style={{ color: T.dourado }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: T.marrom, marginBottom: 6 }}>Selecione um lead</div>
                    <div style={{ fontSize: 13, color: T.muted, maxWidth: 240, lineHeight: 1.6 }}>Clique em qualquer lead para ver o progresso, histórico e enviar mensagens manuais</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {manualLead && <ManualModal lead={manualLead} onClose={() => setManualLead(null)} onSent={fetchData} />}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </AppLayout>
  );
}
