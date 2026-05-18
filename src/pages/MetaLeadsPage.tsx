import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useMetaFormLeads, useMetaFormChat } from '@/hooks/useMetaFormLeads';
import { MetaFormLead, MetaFormLeadStatus, LeadClassificacao } from '@/types/metaFormLeads';
import {
  Search, RefreshCw, Download, ChevronRight, Phone, Mail,
  Clock, CheckCircle, XCircle, Sparkles, Zap, Users,
  MessageCircle, ArrowLeft, Target, Megaphone, Bot,
  Sheet, Loader2, AlertTriangle, Copy, Calendar, Activity,
  Star, Hash, User, TrendingUp, Filter, X
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  marrom: '#1e1008', marromMed: '#3d2010', marromLight: '#6b3f25',
  dourado: '#c9943a', douradoLight: '#e8b86d', douradoPale: '#fdf3e3',
  cream: '#faf7f2', white: '#ffffff', border: '#e8ddd0', borderLight: '#f0e8dc',
  muted: '#8a7260', mutedLight: '#b09880',
  green: '#15803d', greenBg: '#f0fdf4',
  red: '#b91c1c', redBg: '#fef2f2',
  blue: '#1d4ed8', blueBg: '#eff6ff',
  amber: '#b45309', amberBg: '#fffbeb',
  purple: '#6d28d9', purpleBg: '#f5f3ff',
};

const STATUS_CFG: Record<MetaFormLeadStatus, { label: string; color: string; bg: string; border: string; Icon: any; dot: string }> = {
  novo:           { label: 'Novo',           color: T.blue,   bg: T.blueBg,   border: '#bfdbfe', Icon: Sparkles,     dot: '#3b82f6' },
  em_atendimento: { label: 'Em Atendimento', color: T.amber,  bg: T.amberBg,  border: '#fcd34d', Icon: Clock,        dot: '#f59e0b' },
  concluido:      { label: 'Concluído',      color: T.green,  bg: T.greenBg,  border: '#6ee7b7', Icon: CheckCircle,  dot: '#22c55e' },
  perdido:        { label: 'Perdido',        color: T.red,    bg: T.redBg,    border: '#fca5a5', Icon: XCircle,      dot: '#ef4444' },
};

// ── Configuração de classificação ─────────────────────────────────────────────
const CLASS_CFG: Record<LeadClassificacao, { label: string; color: string; bg: string; border: string }> = {
  quente: { label: '🔥 Quente', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  medio:  { label: '🌡️ Médio',  color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  frio:   { label: '🧊 Frio',   color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
};

// Gradientes por inicial do nome
const GRADIENTS: Record<string, string> = {
  A:'#667eea,#764ba2',B:'#f093fb,#f5576c',C:'#4facfe,#00f2fe',D:'#43e97b,#38f9d7',
  E:'#fa709a,#fee140',F:'#a18cd1,#fbc2eb',G:'#fccb90,#d57eeb',H:'#a1c4fd,#c2e9fb',
  I:'#fd7043,#ff8f00',J:'#66bb6a,#43a047',K:'#ab47bc,#8e24aa',L:'#26c6da,#00acc1',
  M:'#ef5350,#e53935',N:'#7e57c2,#5e35b1',O:'#26a69a,#00897b',P:'#ec407a,#d81b60',
  Q:'#5c6bc0,#3949ab',R:'#ff7043,#f4511e',S:'#8d6e63,#6d4c41',T:'#78909c,#546e7a',
  U:'#42a5f5,#1e88e5',V:'#9ccc65,#7cb342',W:'#ffca28,#ffb300',X:'#26c6da,#0097a7',
  Y:'#ef5350,#c62828',Z:'#ab47bc,#7b1fa2',
};

function getInitials(nome: string | null): string {
  if (!nome?.trim() || nome === '..') return '?';
  const parts = nome.trim().split(' ').filter(p => p.length > 0);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getGradient(nome: string | null): string {
  const letter = getInitials(nome);
  return GRADIENTS[letter] || `${T.marromLight},${T.dourado}`;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ nome, size = 40 }: { nome: string | null; size?: number }) {
  const initials = getInitials(nome);
  const grad = getGradient(nome);
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      background: initials === '?' ? T.cream : `linear-gradient(135deg, ${grad})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, color: initials === '?' ? T.muted : '#fff',
      boxShadow: initials === '?' ? 'none' : '0 2px 8px rgba(0,0,0,0.15)',
      border: initials === '?' ? `1px solid ${T.border}` : 'none',
      letterSpacing: '-0.02em',
    }}>
      {initials === '?' ? <User size={size * 0.4} /> : initials}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, Icon, accent, sub }: any) {
  return (
    <div style={{
      background: T.white, borderRadius: 18, padding: '18px 20px',
      border: `1px solid ${T.border}`, position: 'relative', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(30,16,8,0.05), 0 4px 12px rgba(30,16,8,0.04)',
      transition: 'transform 0.15s, box-shadow 0.15s',
      cursor: 'default',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(30,16,8,0.1)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(30,16,8,0.05)'; }}
    >
      <div style={{ position: 'absolute', top: -18, right: -18, width: 72, height: 72, borderRadius: '50%', background: `${accent}12` }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}cc, ${accent}44)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} style={{ color: accent }} />
        </div>
      </div>
      <div style={{ fontSize: 34, fontWeight: 900, color: T.marrom, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: accent, fontWeight: 700, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Source badge helper ───────────────────────────────────────────────────────
function sourceBadge(lead: MetaFormLead, selected: boolean) {
  if (lead.source === 'meta_webhook') {
    return { label: '🎯 Meta Direto', color: '#7c3aed', bg: selected ? '#f5f3ffcc' : '#f5f3ff', border: '#ddd6fe' };
  }
  if (lead.source === 'meta' || !!lead.form_id) {
    return { label: '📋 Meta', color: T.purple, bg: selected ? '#f5f3ffcc' : T.purpleBg, border: '#ddd6fe' };
  }
  return { label: '📊 Sheets', color: T.green, bg: selected ? '#f0fdf4cc' : T.greenBg, border: '#bbf7d0' };
}

// ── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, selected, onClick }: { lead: MetaFormLead; selected: boolean; onClick: () => void }) {
  const cfg = STATUS_CFG[lead.status];
  const src = sourceBadge(lead, selected);
  const classCfg = lead.classificacao ? CLASS_CFG[lead.classificacao] : null;
  const displayName = lead.nome?.trim() && lead.nome !== '..' ? lead.nome : 'Sem nome';
  const timeAgo = formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR });

  return (
    <div onClick={onClick} style={{
      background: selected ? `linear-gradient(135deg, ${T.marrom}f8, ${T.marromMed}f8)` : T.white,
      border: selected ? `1.5px solid ${T.dourado}` : `1px solid ${T.border}`,
      borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
      boxShadow: selected
        ? `0 4px 20px ${T.marrom}30, 0 0 0 1px ${T.dourado}40`
        : '0 1px 3px rgba(30,16,8,0.05), 0 2px 8px rgba(30,16,8,0.03)',
      transition: 'all 0.15s ease', position: 'relative', overflow: 'hidden',
    }}
    onMouseEnter={e => { if (!selected) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(30,16,8,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = T.dourado + '60'; } }}
    onMouseLeave={e => { if (!selected) { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(30,16,8,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = T.border; } }}
    >
      {/* Barra de status no topo */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: `linear-gradient(90deg, ${cfg.dot}, ${cfg.dot}60)`, borderRadius: '16px 16px 0 0' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 10 }}>
        <Avatar nome={lead.nome} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: selected ? '#fff' : T.marrom, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
            {displayName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, color: cfg.color, background: selected ? `${cfg.bg}cc` : cfg.bg, border: `1px solid ${cfg.border}` }}>
              {cfg.label}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, color: src.color, background: src.bg, border: `1px solid ${src.border}` }}>
              {src.label}
            </span>
            {classCfg && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, color: classCfg.color, background: selected ? `${classCfg.bg}cc` : classCfg.bg, border: `1px solid ${classCfg.border}` }}>
                {classCfg.label}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={14} style={{ color: selected ? T.douradoLight : T.mutedLight, flexShrink: 0, marginTop: 2 }} />
      </div>

      {/* Footer do card */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${selected ? 'rgba(255,255,255,0.1)' : T.borderLight}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {lead.telefone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Phone size={10} style={{ color: selected ? T.douradoLight : T.muted }} />
              <span style={{ fontSize: 11, color: selected ? 'rgba(255,255,255,0.7)' : T.muted }}>{lead.telefone}</span>
            </div>
          )}
          {lead.email && !lead.telefone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Mail size={10} style={{ color: selected ? T.douradoLight : T.muted }} />
              <span style={{ fontSize: 11, color: selected ? 'rgba(255,255,255,0.7)' : T.muted, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{lead.email}</span>
            </div>
          )}
        </div>
        <span style={{ fontSize: 10, color: selected ? 'rgba(255,255,255,0.5)' : T.mutedLight, flexShrink: 0 }}>{timeAgo}</span>
      </div>
    </div>
  );
}

// ── Painel Detalhe ────────────────────────────────────────────────────────────
function Detalhe({ lead, onStatus, onBack, dispararISA }: {
  lead: MetaFormLead; onStatus: (s: MetaFormLeadStatus) => void;
  onBack: () => void; dispararISA: (lead: MetaFormLead, msg?: string) => Promise<any>;
}) {
  const { messages } = useMetaFormChat(lead.id);
  const [disparando, setDisparando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [msgCustom, setMsgCustom] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const cfg = STATUS_CFG[lead.status];
  const classCfg = lead.classificacao ? CLASS_CFG[lead.classificacao] : null;
  const displayName = lead.nome?.trim() && lead.nome !== '..' ? lead.nome : 'Sem nome';
  const primeiroNome = displayName === 'Sem nome' ? 'você' : displayName.split(' ')[0];
  const src = sourceBadge(lead, false);
  const msgPadrao = `Olá ${primeiroNome}! 👋 Recebi seu contato e estou aqui para te ajudar com suas dúvidas jurídicas. Me conta um pouco mais sobre o que você precisa! 😊`;

  const handleDisparar = async () => {
    if (!lead.telefone) { toast({ title: 'Lead sem telefone', variant: 'destructive' }); return; }
    setDisparando(true);
    await dispararISA(lead, editando && msgCustom.trim() ? msgCustom : msgPadrao);
    setDisparando(false); setEditando(false); setMsgCustom('');
  };

  const copy = (text: string, label: string) => { navigator.clipboard.writeText(text); toast({ title: `${label} copiado!` }); };

  const formFields = lead.form_fields && typeof lead.form_fields === 'object'
    ? Object.entries(lead.form_fields as Record<string, unknown>).filter(([_, v]) => v != null && v !== '')
    : [];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.cream, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${T.marrom} 0%, ${T.marromMed} 100%)`, padding: '16px 20px', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: 80, width: 80, height: 80, borderRadius: '50%', background: `${T.dourado}15` }} />

        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 11, marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <ArrowLeft size={13} /> Voltar
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar nome={lead.nome} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginBottom: 6 }}>{displayName}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
              <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 99, fontWeight: 600, background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}>{src.label}</span>
              {classCfg && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, color: classCfg.color, background: classCfg.bg, border: `1px solid ${classCfg.border}` }}>{classCfg.label}</span>
              )}
            </div>
          </div>
        </div>

        {/* Contatos */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {lead.telefone && (
            <div onClick={() => copy(lead.telefone!, 'Telefone')} style={{ flex: 1, minWidth: 140, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
              <Phone size={13} style={{ color: T.dourado, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{lead.telefone}</span>
              <Copy size={10} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            </div>
          )}
          {lead.email && (
            <div onClick={() => copy(lead.email!, 'Email')} style={{ flex: 1, minWidth: 140, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
              <Mail size={13} style={{ color: T.dourado, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{lead.email}</span>
              <Copy size={10} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ISA */}
        <div style={{ background: `${T.dourado}08`, border: `1px solid ${T.dourado}35`, borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={16} style={{ color: T.dourado }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: T.marrom }}>Disparo ISA</div>
              <div style={{ fontSize: 11, color: T.muted }}>WhatsApp · instância tráfego</div>
            </div>
            {!lead.telefone && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: T.redBg, color: T.red, border: `1px solid #fecaca`, flexShrink: 0 }}>⚠️ Sem telefone</span>}
          </div>

          {!editando ? (
            <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 13px', marginBottom: 12, fontSize: 12, color: T.marromLight, lineHeight: 1.6, fontStyle: 'italic' }}>
              "{msgPadrao}"
            </div>
          ) : (
            <textarea value={msgCustom} onChange={e => setMsgCustom(e.target.value)} placeholder={msgPadrao} autoFocus rows={4}
              style={{ width: '100%', padding: '10px 12px', marginBottom: 10, borderRadius: 10, border: `1.5px solid ${T.dourado}50`, fontSize: 12, resize: 'vertical', fontFamily: 'inherit', background: T.white, color: T.marrom, outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }} />
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDisparar} disabled={disparando || !lead.telefone} style={{ flex: 1, padding: '11px 16px', borderRadius: 11, border: 'none', background: disparando || !lead.telefone ? '#d1c4b8' : `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, color: '#fff', fontWeight: 700, fontSize: 13, cursor: disparando || !lead.telefone ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: disparando || !lead.telefone ? 'none' : `0 4px 14px ${T.marrom}40` }}>
              {disparando ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</> : <><Zap size={14} /> {editando ? 'Enviar mensagem' : 'Disparar ISA'}</>}
            </button>
            <button onClick={() => { setEditando(!editando); if (editando) setMsgCustom(''); }} style={{ padding: '11px 14px', borderRadius: 11, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: editando ? T.redBg : T.white, border: `1px solid ${editando ? '#fca5a5' : T.border}`, color: editando ? T.red : T.muted }}>
              {editando ? 'Cancelar' : 'Editar'}
            </button>
          </div>
        </div>

        {/* Status */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Alterar Status</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(Object.entries(STATUS_CFG) as [MetaFormLeadStatus, typeof STATUS_CFG[MetaFormLeadStatus]][]).map(([s, c]) => {
              const active = lead.status === s;
              return (
                <button key={s} onClick={() => onStatus(s)} style={{ padding: '10px 12px', borderRadius: 11, cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 500, border: active ? `2px solid ${c.color}50` : `1px solid ${T.border}`, background: active ? c.bg : T.white, color: active ? c.color : T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.12s', boxShadow: active ? `0 2px 8px ${c.color}20` : 'none' }}>
                  <c.Icon size={13} /> {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat — só para leads com linked_lead_id (não para meta_leads_aereo) */}
        {lead.linked_lead_id && (
          <button onClick={() => navigate(`/chat?lead_id=${lead.linked_lead_id}`)} style={{ width: '100%', padding: '13px 16px', borderRadius: 14, background: T.white, border: `1px solid ${T.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(30,16,8,0.05)', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(30,16,8,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = T.dourado + '60'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(30,16,8,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = T.border; }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${T.dourado}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MessageCircle size={17} style={{ color: T.dourado }} />
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.marrom }}>Abrir no Chat</div>
              <div style={{ fontSize: 11, color: T.muted }}>Ver histórico completo</div>
            </div>
            <ChevronRight size={15} style={{ color: T.mutedLight }} />
          </button>
        )}

        {/* Campanha */}
        {(lead.campaign_name || lead.ad_name || lead.adset_name) && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Campanha</div>
            <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
              {[{ Icon: Target, label: 'Campanha', value: lead.campaign_name }, { Icon: Megaphone, label: 'Anúncio', value: lead.ad_name }, { Icon: Hash, label: 'Conjunto', value: lead.adset_name }].filter(x => x.value).map((item, idx, arr) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: idx < arr.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
                  <item.Icon size={13} style={{ color: T.mutedLight, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: T.muted, minWidth: 60, fontWeight: 600 }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: T.marrom, fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form fields */}
        {formFields.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Dados do Formulário</div>
            <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
              {formFields.map(([key, value], idx) => (
                <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 14px', borderBottom: idx < formFields.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
                  <span style={{ fontSize: 11, color: T.muted, minWidth: 90, paddingTop: 1, fontWeight: 600, flexShrink: 0 }}>{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                  <span style={{ fontSize: 12, color: T.marrom, fontWeight: 500, wordBreak: 'break-word' }}>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mensagens */}
        {messages.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Últimas mensagens ({messages.length})</div>
            <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.slice(-4).map(msg => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '82%', padding: '8px 12px', borderRadius: 12, fontSize: 12, background: msg.sender_type === 'agent' ? `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})` : T.cream, color: msg.sender_type === 'agent' ? '#fff' : T.marrom, lineHeight: 1.5 }}>
                    {msg.sender_name && <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>{msg.sender_name}</div>}
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', paddingBottom: 4 }}>
          <Calendar size={11} style={{ color: T.mutedLight }} />
          <span style={{ fontSize: 11, color: T.mutedLight }}>{format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function MetaLeadsPage() {
  const { leads, loading, syncing, syncError, fetchLeads, syncFromMeta, updateLeadStatus, dispararISAManual } = useMetaFormLeads();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<MetaFormLeadStatus | 'all'>('all');
  const [filterClass, setFilterClass] = useState<LeadClassificacao | 'all'>('all');
  const [selectedLead, setSelectedLead] = useState<MetaFormLead | null>(null);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    let r = [...leads];
    if (filterStatus !== 'all') r = r.filter(l => l.status === filterStatus);
    if (filterClass !== 'all') r = r.filter(l => l.classificacao === filterClass);
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter(l => (l.nome?.toLowerCase() || '').includes(s) || (l.email?.toLowerCase() || '').includes(s) || (l.telefone || '').includes(search));
    }
    return r;
  }, [leads, filterStatus, filterClass, search]);

  const kpis = useMemo(() => ({
    total: leads.length,
    novos: leads.filter(l => l.status === 'novo').length,
    atendimento: leads.filter(l => l.status === 'em_atendimento').length,
    concluidos: leads.filter(l => l.status === 'concluido').length,
    trafego: leads.filter(l => l.source === 'meta' || !!l.form_id).length,
  }), [leads]);

  const handleStatus = async (status: MetaFormLeadStatus) => {
    if (!selectedLead) return;
    await updateLeadStatus(selectedLead.id, status);
    setSelectedLead(prev => prev ? { ...prev, status } : null);
  };

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ['Nome', 'Telefone', 'Email', 'Status', 'Origem', 'Classifica\u00e7\u00e3o', 'Problema do Voo', 'Tempo Prejudicado', 'Teve Preju\u00edzo', 'Comprovantes', 'Campanha', 'Conjunto', 'An\u00fancio', 'Data'];
    const rows = filtered.map(l => {
      const ff = (l.form_fields || {}) as Record<string, any>;
      return [
        l.nome || '',
        l.telefone || '',
        l.email || '',
        STATUS_CFG[l.status].label,
        l.source === 'meta_webhook' ? 'Meta Direto' : l.source === 'meta' ? 'Meta' : 'Sheets',
        l.classificacao || '',
        ff['Problema do Voo'] || '',
        ff['Tempo Prejudicado'] || '',
        ff['Teve Preju\u00edzo'] || '',
        ff['Comprovantes'] || '',
        l.campaign_name || '',
        l.adset_name || '',
        l.ad_name || '',
        format(new Date(l.created_at), 'dd/MM/yyyy HH:mm'),
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: `${filtered.length} leads exportados` });
  };

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 14, background: T.cream }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={22} style={{ color: T.douradoLight }} />
        </div>
        <span style={{ color: T.muted, fontWeight: 700, fontSize: 15 }}>Carregando leads...</span>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: T.cream, overflow: 'hidden' }}>

        {/* TOPBAR */}
        <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '16px 24px', flexShrink: 0, boxShadow: '0 2px 12px rgba(30,16,8,0.06)' }}>

          {syncError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, marginBottom: 12, background: T.redBg, border: `1px solid #fecaca`, fontSize: 13 }}>
              <AlertTriangle size={14} style={{ color: T.red }} />
              <span style={{ color: '#991b1b' }}>{syncError}</span>
            </div>
          )}

          {/* Título */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${T.marrom}40` }}>
                <Activity size={20} style={{ color: T.douradoLight }} />
              </div>
              <div>
                <h1 style={{ fontSize: 19, fontWeight: 900, color: T.marrom, margin: 0, letterSpacing: '-0.03em' }}>Leads Meta & Tráfego</h1>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{filtered.length} de {leads.length} leads</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={exportCSV} style={{ padding: '9px 16px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.white, color: T.marromLight, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 1px 4px rgba(30,16,8,0.06)' }}>
                <Download size={13} /> CSV
              </button>
              <button onClick={syncFromMeta} disabled={syncing} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: syncing ? '#d1d5db' : 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: syncing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: syncing ? 'none' : '0 3px 10px rgba(22,163,74,0.3)' }}>
                {syncing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sheet size={13} />}
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <button onClick={fetchLeads} style={{ padding: '9px 11px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.white, color: T.muted, cursor: 'pointer', boxShadow: '0 1px 4px rgba(30,16,8,0.06)' }}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 18 }}>
            <KpiCard label="Total" value={kpis.total} Icon={Users} accent={T.marrom} />
            <KpiCard label="Novos" value={kpis.novos} Icon={Sparkles} accent="#2563eb" sub="Sem contato" />
            <KpiCard label="Em Atendimento" value={kpis.atendimento} Icon={Clock} accent="#d97706" />
            <KpiCard label="Convertidos" value={kpis.concluidos} Icon={Star} accent="#16a34a" />
            <KpiCard label="Leads Tráfego" value={kpis.trafego} Icon={Target} accent="#7c3aed" sub="Meta/Facebook" />
          </div>

          {/* Busca + Filtros */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.muted }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, telefone ou email..."
                  style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.cream, fontSize: 12, color: T.marrom, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = T.dourado}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = T.border}
                />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 2 }}><X size={13} /></button>}
              </div>
              {/* Filtro status */}
              <div style={{ display: 'flex', gap: 4, background: T.cream, borderRadius: 11, padding: '3px', border: `1px solid ${T.border}`, flexShrink: 0 }}>
                {(['all', 'novo', 'em_atendimento', 'concluido', 'perdido'] as const).map(s => {
                  const active = filterStatus === s;
                  const cfg = s !== 'all' ? STATUS_CFG[s] : null;
                  return (
                    <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: active ? T.white : 'transparent', color: active ? (cfg ? cfg.color : T.marrom) : T.muted, boxShadow: active ? '0 2px 8px rgba(30,16,8,0.12)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                      {s === 'all' ? 'Todos' : cfg!.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Filtro classificação */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Classificação:</span>
              {(['all', 'quente', 'medio', 'frio'] as const).map(c => {
                const active = filterClass === c;
                const cls = c !== 'all' ? CLASS_CFG[c] : null;
                return (
                  <button key={c} onClick={() => setFilterClass(c)} style={{ padding: '4px 12px', borderRadius: 99, border: active && cls ? `1.5px solid ${cls.border}` : `1px solid ${T.border}`, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: active ? (cls ? cls.bg : T.white) : 'transparent', color: active ? (cls ? cls.color : T.marrom) : T.muted, transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
                    {c === 'all' ? 'Todos' : cls!.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Grid de cards */}
          <div style={{ flex: selectedLead ? '0 0 calc(100% - 420px)' : '1', overflowY: 'auto', padding: 20, borderRight: selectedLead ? `1px solid ${T.border}` : 'none' }}>
            {filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320, gap: 14 }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: T.white, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={28} style={{ color: T.mutedLight }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: T.marrom, marginBottom: 6 }}>Nenhum lead encontrado</div>
                  <div style={{ fontSize: 13, color: T.muted }}>Ajuste os filtros ou sincronize</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: selectedLead ? 'repeat(auto-fill, minmax(220px, 1fr))' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {filtered.map(lead => (
                  <LeadCard key={lead.id} lead={lead} selected={selectedLead?.id === lead.id} onClick={() => setSelectedLead(lead)} />
                ))}
              </div>
            )}
          </div>

          {/* Detalhe */}
          {selectedLead ? (
            <div style={{ width: 420, flexShrink: 0, overflow: 'hidden' }}>
              <Detalhe lead={selectedLead} onStatus={handleStatus} onBack={() => setSelectedLead(null)} dispararISA={dispararISAManual} />
            </div>
          ) : (
            <div style={{ width: 0 }} />
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </AppLayout>
  );
}
