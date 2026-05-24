import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Play, Pause, Search, RefreshCw, MessageCircle, Clock, CheckCircle, TrendingUp,
  Users, Zap, X, Send, Image, Filter, PlusCircle, AlertCircle, ArrowUpRight,
  Inbox, Leaf, Megaphone, Trash2, Edit3, Upload, FileText, Volume2, Video,
  GripVertical, ToggleLeft, ToggleRight, Eye,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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
  '15min': { label: '1º Follow-up (15min)', color: T.blue,   bg: T.blueBg,   order: 1 },
  '24h':   { label: '2º Follow-up (24h)',   color: T.dourado, bg: T.douradoPale, order: 2 },
  '44h':   { label: '3º Follow-up (44h)',   color: T.orange, bg: T.orangeBg, order: 3 },
};

const AGENT_CFG: Record<string, { name: string; color: string; bg: string }> = {
  isa_triagem:  { name: 'ISA',     color: T.purple, bg: T.purpleBg },
  isa_bancario: { name: 'Melissa', color: T.teal,   bg: T.tealBg  },
  isa_aereo:    { name: 'Jerusa',  color: T.green,  bg: T.greenBg },
};

const MIDIA_CFG: Record<string, { label: string; icon: any; accept: string }> = {
  text:     { label: 'Texto',      icon: FileText, accept: '' },
  image:    { label: 'Imagem',     icon: Image,    accept: 'image/*' },
  audio:    { label: 'Áudio',      icon: Volume2,  accept: 'audio/*' },
  video:    { label: 'Vídeo',      icon: Video,    accept: 'video/*' },
  document: { label: 'Documento',  icon: FileText, accept: '.pdf,.doc,.docx,.xls,.xlsx' },
};

interface Lead {
  id: string; lead_id: string; telefone: string;
  current_stage: string | null; automation_active: boolean;
  total_messages_sent: number; next_message_at: string | null;
  last_inbound_at: string | null; status: string;
  stages_sent: Record<string, any>; nome: string;
  isa_agent: string | null; pause_reason: string | null;
  created_at: string | null; updated_at: string | null;
}

interface Nutricao {
  id: string; subscriber_id: string; lead_id: string; telefone: string;
  status: 'pendente' | 'aceito' | 'recusado';
  optin_enviado_em: string; resposta_em: string | null;
  ultima_campanha_em: string | null; proxima_campanha_em: string | null;
  nome?: string;
}

interface Campanha {
  id: string; titulo: string; mensagem: string | null;
  tipo_midia: string; media_url: string | null; media_nome: string | null;
  legenda: string | null; ordem: number; ativo: boolean; intervalo_dias: number;
  created_at: string;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ nome, size = 40 }: { nome: string; size?: number }) {
  const letter = (nome || '?')[0].toUpperCase();
  const grad: Record<string, string> = {
    A: '#667eea,#764ba2', B: '#f093fb,#f5576c', C: '#4facfe,#00f2fe',
    D: '#43e97b,#38f9d7', E: '#fa709a,#fee140', F: '#a18cd1,#fbc2eb',
    G: '#fccb90,#d57eeb', H: '#a1c4fd,#c2e9fb', I: '#fd7043,#ff8f00',
    J: '#66bb6a,#43a047', K: '#ab47bc,#8e24aa', L: '#26c6da,#00acc1',
    M: '#ef5350,#e53935', N: '#7e57c2,#5e35b1', O: '#26a69a,#00897b',
    P: '#ec407a,#d81b60', Q: '#5c6bc0,#3949ab', R: '#ff7043,#f4511e',
    S: '#8d6e63,#6d4c41', T: '#78909c,#546e7a', U: '#42a5f5,#1e88e5',
  };
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      background: `linear-gradient(135deg, ${grad[letter] || `${T.marromLight},${T.dourado}`})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, color: '#fff',
    }}>
      {letter}
    </div>
  );
}

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg?: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: bg || `${color}15`, color, border: `1px solid ${color}25`, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {children}
    </span>
  );
}

// ── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ item, onToggle, onSelect, selected }: { item: Lead; onToggle: (id: string, active: boolean) => void; onSelect: (i: Lead) => void; selected: boolean }) {
  const stageCfg = item.current_stage ? STAGE_CFG[item.current_stage] : null;

  // Detect if client responded recently (< 2 hours)
  const respondedRecently = item.last_inbound_at
    ? (Date.now() - new Date(item.last_inbound_at).getTime()) < 2 * 60 * 60 * 1000
    : false;
  const isNew = item.status === 'new' || item.status === 'in_progress';
  const isActive = item.automation_active && isNew;

  // Derive last sent time from stages_sent
  const allSentTimes = Object.values(item.stages_sent || {})
    .map((s: any) => s?.at ? new Date(s.at).getTime() : 0)
    .filter(Boolean);
  const lastSentAt = allSentTimes.length > 0 ? new Date(Math.max(...allSentTimes)) : null;

  const stageOrder = Object.entries(STAGE_CFG).sort((a, b) => a[1].order - b[1].order);

  return (
    <div onClick={() => onSelect(item)} style={{
      background: selected ? `linear-gradient(135deg, ${T.marrom}f8, ${T.marromMed}f8)` : respondedRecently ? `linear-gradient(135deg, ${T.greenBg}, #fff)` : T.white,
      border: selected ? `1.5px solid ${T.dourado}` : respondedRecently ? `1.5px solid ${T.green}` : `1px solid ${T.border}`,
      borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
      boxShadow: selected ? `0 4px 20px ${T.marrom}30` : respondedRecently ? `0 4px 16px ${T.green}20` : '0 1px 3px rgba(30,16,8,0.05)',
      transition: 'all 0.15s', position: 'relative', overflow: 'hidden',
    }}>
      {/* Top color bar — stage or "respondeu" */}
      {respondedRecently
        ? <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${T.green}, ${T.green}60)`, borderRadius: '16px 16px 0 0' }} />
        : stageCfg && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: `linear-gradient(90deg, ${stageCfg.color}, ${stageCfg.color}60)`, borderRadius: '16px 16px 0 0' }} />
      }
      {/* Active pulse dot */}
      {isActive && <div style={{ position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: '50%', background: T.green, boxShadow: `0 0 0 3px ${T.green}30`, animation: 'pulse 2s infinite' }} />}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Avatar nome={item.nome} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: selected ? '#fff' : T.marrom, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nome || item.telefone}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
            {stageCfg && !respondedRecently && <Badge color={stageCfg.color} bg={stageCfg.bg}>{stageCfg.label}</Badge>}
            {respondedRecently && <Badge color={T.green} bg={T.greenBg}>💬 Respondeu agora!</Badge>}
            {item.status === 'responded' && !respondedRecently && <Badge color={T.green} bg={T.greenBg}>✅ Respondeu</Badge>}
            {item.status === 'nutricao' && <Badge color={T.teal} bg={T.tealBg}>🌱 Nutrição</Badge>}
            {!item.automation_active && item.status !== 'archived' && <Badge color={T.orange} bg={T.orangeBg}>⏸ Pausado</Badge>}
          </div>
        </div>
        {item.status !== 'archived' && (
          <button onClick={e => { e.stopPropagation(); onToggle(item.id, !item.automation_active); }}
            title={item.automation_active ? 'Pausar automação' : 'Retomar automação'}
            style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: item.automation_active ? `${T.green}20` : `${T.orange}20`, cursor: 'pointer', color: item.automation_active ? T.green : T.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {item.automation_active ? <Pause size={11} /> : <Play size={11} />}
          </button>
        )}
      </div>

      {/* Stage progress dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 10, marginBottom: 4 }}>
        {stageOrder.map(([key, cfg], idx) => {
          const sent = !!item.stages_sent?.[key];
          const isCurrent = item.current_stage === key;
          return (
            <React.Fragment key={key}>
              {idx > 0 && <div style={{ flex: 1, height: 2, background: sent ? cfg.color : `${T.border}`, borderRadius: 2, transition: 'background 0.3s' }} />}
              <div title={cfg.label} style={{
                width: 9, height: 9, borderRadius: '50%', flexShrink: 0, transition: 'all 0.3s',
                background: sent ? cfg.color : isCurrent ? `${cfg.color}40` : T.borderLight,
                border: isCurrent ? `2px solid ${cfg.color}` : sent ? 'none' : `1px solid ${T.border}`,
                boxShadow: isCurrent ? `0 0 0 3px ${cfg.color}20` : 'none',
              }} />
            </React.Fragment>
          );
        })}
        <div style={{ flex: 1, height: 2, background: item.status === 'nutricao' ? T.teal : T.border, borderRadius: 2, transition: 'background 0.3s' }} />
        <div title="Nutrição" style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: item.status === 'nutricao' ? T.teal : T.borderLight, border: `1px solid ${item.status === 'nutricao' ? T.teal : T.border}` }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: `1px solid ${selected ? 'rgba(255,255,255,0.1)' : T.borderLight}` }}>
        <span style={{ fontSize: 10, color: selected ? 'rgba(255,255,255,0.5)' : T.muted }}>
          <MessageCircle size={9} style={{ display: 'inline', marginRight: 3 }} />{item.total_messages_sent} msgs
          {lastSentAt && <span style={{ marginLeft: 6 }}>· env. {formatDistanceToNow(lastSentAt, { locale: ptBR, addSuffix: true })}</span>}
        </span>
        {item.next_message_at && item.automation_active && isNew ? (
          <span style={{ fontSize: 10, color: selected ? T.douradoLight : T.dourado, fontWeight: 700 }}>
            <Clock size={9} style={{ display: 'inline', marginRight: 3 }} />
            {formatDistanceToNow(new Date(item.next_message_at), { locale: ptBR, addSuffix: true })}
          </span>
        ) : item.last_inbound_at ? (
          <span style={{ fontSize: 10, color: selected ? T.douradoLight : T.green, fontWeight: 600 }}>
            resp. {formatDistanceToNow(new Date(item.last_inbound_at), { locale: ptBR, addSuffix: true })}
          </span>
        ) : (
          <span style={{ fontSize: 10, color: selected ? 'rgba(255,255,255,0.4)' : T.mutedLight }}>{item.telefone}</span>
        )}
      </div>
    </div>
  );
}

// ── Modal Campanha ─────────────────────────────────────────────────────────────
function CampanhaModal({ campanha, onClose, onSaved }: { campanha: Partial<Campanha> | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Campanha>>(campanha || { titulo: '', mensagem: '', tipo_midia: 'text', ordem: 0, ativo: true, intervalo_dias: 7 });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`,
    fontSize: 13, color: T.marrom, outline: 'none', background: T.cream,
    boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s',
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `media/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('followup-campanhas').upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('followup-campanhas').getPublicUrl(data.path);
      setForm(f => ({ ...f, media_url: publicUrl, media_nome: file.name }));
      toast({ title: '✅ Arquivo enviado!' });
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.titulo?.trim()) { toast({ title: 'Informe o título', variant: 'destructive' }); return; }
    if (form.tipo_midia === 'text' && !form.mensagem?.trim()) { toast({ title: 'Informe a mensagem', variant: 'destructive' }); return; }
    if (form.tipo_midia !== 'text' && !form.media_url?.trim()) { toast({ title: 'Envie o arquivo de mídia', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = { titulo: form.titulo, mensagem: form.mensagem || null, tipo_midia: form.tipo_midia, media_url: form.media_url || null, media_nome: form.media_nome || null, legenda: form.legenda || null, ordem: form.ordem || 0, ativo: form.ativo !== false, intervalo_dias: form.intervalo_dias || 7 };
      if (form.id) {
        await supabase.from('followup_campanhas').update(payload).eq('id', form.id);
      } else {
        await supabase.from('followup_campanhas').insert(payload);
      }
      toast({ title: form.id ? '✅ Campanha atualizada' : '✅ Campanha criada' });
      onSaved(); onClose();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const tipoAtual = MIDIA_CFG[form.tipo_midia || 'text'];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,16,8,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: T.white, borderRadius: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(30,16,8,0.35)' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '24px 24px 0 0' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{form.id ? 'Editar Campanha' : 'Nova Campanha'}</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Título */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Título</label>
            <input value={form.titulo || ''} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Novidades sobre seus direitos" style={inputStyle} onFocus={e => e.target.style.borderColor = T.dourado} onBlur={e => e.target.style.borderColor = T.border} />
          </div>

          {/* Tipo de mídia */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Tipo de Conteúdo</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(MIDIA_CFG).map(([key, cfg]) => (
                <button key={key} onClick={() => setForm(f => ({ ...f, tipo_midia: key, media_url: key === 'text' ? null : f.media_url }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, border: `1.5px solid ${form.tipo_midia === key ? T.dourado : T.border}`, background: form.tipo_midia === key ? T.douradoPale : T.white, color: form.tipo_midia === key ? T.marrom : T.muted, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                  <cfg.icon size={12} />{cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conteúdo */}
          {form.tipo_midia === 'text' ? (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Mensagem</label>
              <textarea value={form.mensagem || ''} onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))} placeholder="Conteúdo informativo para enviar ao lead..." rows={5} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} onFocus={e => e.target.style.borderColor = T.dourado} onBlur={e => e.target.style.borderColor = T.border} />
            </div>
          ) : (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>{tipoAtual.label}</label>
              {form.media_url ? (
                <div style={{ background: T.cream, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {form.tipo_midia === 'image' && <img src={form.media_url} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />}
                  {form.tipo_midia !== 'image' && <tipoAtual.icon size={24} style={{ color: T.dourado }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.marrom, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.media_nome || 'Arquivo enviado'}</div>
                    <div style={{ fontSize: 11, color: T.green }}>✅ Pronto para envio</div>
                  </div>
                  <button onClick={() => setForm(f => ({ ...f, media_url: null, media_nome: null }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red }}><X size={14} /></button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${T.border}`, borderRadius: 12, padding: '24px 20px', textAlign: 'center', cursor: 'pointer', background: T.cream, transition: 'border-color 0.15s' }} onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = T.dourado} onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = T.border}>
                  <Upload size={24} style={{ color: T.mutedLight, marginBottom: 8 }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.muted }}>{uploading ? 'Enviando...' : `Clique para enviar ${tipoAtual.label.toLowerCase()}`}</div>
                  <div style={{ fontSize: 11, color: T.mutedLight, marginTop: 4 }}>Máx. 50MB</div>
                </div>
              )}
              <input ref={fileRef} type="file" accept={tipoAtual.accept} style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              {/* Legenda para imagem/vídeo */}
              {(form.tipo_midia === 'image' || form.tipo_midia === 'video') && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Legenda (opcional)</label>
                  <input value={form.legenda || ''} onChange={e => setForm(f => ({ ...f, legenda: e.target.value }))} placeholder="Texto que acompanha a mídia..." style={inputStyle} onFocus={e => e.target.style.borderColor = T.dourado} onBlur={e => e.target.style.borderColor = T.border} />
                </div>
              )}
            </div>
          )}

          {/* Configurações */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Intervalo (dias)</label>
              <input type="number" value={form.intervalo_dias || 7} min={1} max={90} onChange={e => setForm(f => ({ ...f, intervalo_dias: +e.target.value }))} style={{ ...inputStyle }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Ordem</label>
              <input type="number" value={form.ordem || 0} min={0} onChange={e => setForm(f => ({ ...f, ordem: +e.target.value }))} style={{ ...inputStyle }} />
            </div>
          </div>

          {/* Ativo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: T.cream, borderRadius: 10, border: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.marrom }}>Campanha ativa</span>
            <button onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: form.ativo ? T.green : T.muted }}>
              {form.ativo ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
          </div>

          <button onClick={handleSave} disabled={saving} style={{ padding: '13px 24px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: `0 4px 16px ${T.marrom}40` }}>
            {saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Criar campanha'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Aba Campanhas ─────────────────────────────────────────────────────────────
function TabCampanhas() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Partial<Campanha> | null | undefined>(undefined);
  const { toast } = useToast();

  const fetchCampanhas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('followup_campanhas').select('*').order('ordem', { ascending: true });
    setCampanhas(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCampanhas(); }, [fetchCampanhas]);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta campanha?')) return;
    await supabase.from('followup_campanhas').delete().eq('id', id);
    toast({ title: '🗑️ Campanha removida' });
    fetchCampanhas();
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from('followup_campanhas').update({ ativo }).eq('id', id);
    setCampanhas(prev => prev.map(c => c.id === id ? { ...c, ativo } : c));
  };

  const tipoIcone = (tipo: string) => {
    const cfg = MIDIA_CFG[tipo];
    return cfg ? <cfg.icon size={14} /> : <FileText size={14} />;
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.marrom }}>Campanhas de Nutrição</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Mensagens enviadas em sequência após opt-in do lead</div>
        </div>
        <button onClick={() => setEditando({})} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none', background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: `0 4px 14px ${T.marrom}40` }}>
          <PlusCircle size={15} /> Nova Campanha
        </button>
      </div>

      {/* Info box */}
      <div style={{ background: T.blueBg, border: `1px solid ${T.blue}25`, borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: T.blue, lineHeight: 1.7 }}>
        <strong>📋 Como funciona:</strong> Após o lead aceitar o opt-in de nutrição, as campanhas abaixo são enviadas em sequência, respeitando o intervalo configurado em cada uma.
        Suporta texto, imagem, áudio, vídeo e documentos PDF. O lead pode cancelar a qualquer momento respondendo <strong>PARAR</strong>.
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.muted }}>Carregando...</div>
      ) : campanhas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.muted }}>
          <Megaphone size={40} style={{ color: T.mutedLight, marginBottom: 12 }} />
          <div style={{ fontWeight: 700, fontSize: 15, color: T.marrom, marginBottom: 6 }}>Nenhuma campanha criada</div>
          <div style={{ fontSize: 13 }}>Crie a primeira mensagem de nutrição para seus leads.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {campanhas.map((c, idx) => (
            <div key={c.id} style={{ background: T.white, border: `1px solid ${c.ativo ? T.border : T.borderLight}`, borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 4px rgba(30,16,8,0.04)', opacity: c.ativo ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${T.marrom}, ${T.dourado})`, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: T.marrom }}>{c.titulo}</span>
                    <Badge color={T.muted}>{tipoIcone(c.tipo_midia)}{MIDIA_CFG[c.tipo_midia]?.label || c.tipo_midia}</Badge>
                    {!c.ativo && <Badge color={T.red} bg={T.redBg}>Inativa</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.mensagem ? c.mensagem.substring(0, 80) + (c.mensagem.length > 80 ? '...' : '') : c.media_nome || c.media_url || ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>A cada {c.intervalo_dias}d</span>
                  <button onClick={() => handleToggleAtivo(c.id, !c.ativo)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.ativo ? T.green : T.muted, padding: 4 }} title={c.ativo ? 'Desativar' : 'Ativar'}>
                    {c.ativo ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                  <button onClick={() => setEditando(c)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: T.white, cursor: 'pointer', color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit3 size={13} /></button>
                  <button onClick={() => handleDelete(c.id)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.red}30`, background: T.redBg, cursor: 'pointer', color: T.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando !== undefined && (
        <CampanhaModal campanha={editando} onClose={() => setEditando(undefined)} onSaved={fetchCampanhas} />
      )}
    </div>
  );
}

// ── Aba Nutrição ──────────────────────────────────────────────────────────────
function TabNutricao() {
  const [leads, setLeads] = useState<Nutricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'pendente' | 'aceito' | 'recusado'>('todos');
  const { toast } = useToast();

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('followup_nutricao')
      .select('*, lead:leads_juridicos(nome)')
      .order('optin_enviado_em', { ascending: false, nullsFirst: false })
      .limit(200);
    setLeads((data || []).map((d: any) => ({ ...d, nome: d.lead?.nome || d.telefone })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const statusCfg: Record<string, { label: string; color: string; bg: string }> = {
    pendente:  { label: '⏳ Aguardando',  color: T.dourado, bg: T.douradoPale },
    aceito:    { label: '✅ Aceito',       color: T.green,   bg: T.greenBg    },
    recusado:  { label: '🚫 Recusado',     color: T.red,     bg: T.redBg      },
  };

  const filtered = leads.filter(l => filter === 'todos' || l.status === filter);
  const counts = { todos: leads.length, pendente: leads.filter(l => l.status === 'pendente').length, aceito: leads.filter(l => l.status === 'aceito').length, recusado: leads.filter(l => l.status === 'recusado').length };

  const chartData = [
    { name: 'Aceito', value: counts.aceito, color: T.green },
    { name: 'Pendente', value: counts.pendente, color: T.dourado },
    { name: 'Recusado', value: counts.recusado, color: T.red },
  ].filter(d => d.value > 0);

  const handleReenviarOptin = async (lead: Nutricao) => {
    try {
      await supabase.functions.invoke('traffic-followup-automation', {
        body: { action: 'resend_optin', telefone: lead.telefone, subscriber_id: lead.subscriber_id, lead_id: lead.lead_id },
      });
      toast({ title: '📨 Opt-in reenviado!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Gráfico */}
        {chartData.length > 0 && (
          <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 20, padding: 20, minWidth: 180 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Distribuição</div>
            <ResponsiveContainer width={160} height={120}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" outerRadius={50} innerRadius={28} dataKey="value" paddingAngle={3}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, flex: 1, alignContent: 'start' }}>
          {[
            { label: 'Total', value: counts.todos, color: T.marrom },
            { label: 'Aceitaram', value: counts.aceito, color: T.green },
            { label: 'Taxa', value: counts.todos ? `${Math.round((counts.aceito / counts.todos) * 100)}%` : '—', color: T.dourado },
          ].map(k => (
            <div key={k.label} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 4px rgba(30,16,8,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: k.color, letterSpacing: '-0.03em' }}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 4, background: T.cream, borderRadius: 11, padding: 4, marginBottom: 16, width: 'fit-content', border: `1px solid ${T.border}` }}>
        {(['todos', 'pendente', 'aceito', 'recusado'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: filter === f ? T.white : 'transparent', color: filter === f ? T.marrom : T.muted, fontWeight: 700, fontSize: 11, boxShadow: filter === f ? '0 2px 8px rgba(30,16,8,0.12)' : 'none', display: 'flex', gap: 5, alignItems: 'center' }}>
            {f === 'todos' ? 'Todos' : statusCfg[f].label} <span style={{ fontSize: 9, fontWeight: 900, color: filter === f ? T.dourado : T.mutedLight }}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.muted }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.muted }}>
          <Leaf size={40} style={{ color: T.mutedLight, marginBottom: 12 }} />
          <div style={{ fontWeight: 700, fontSize: 15, color: T.marrom, marginBottom: 6 }}>Nenhum lead nesta lista</div>
          <div style={{ fontSize: 13 }}>Os leads chegam aqui após o 3º follow-up sem resposta.</div>
        </div>
      ) : (
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.cream }}>
                {['Lead', 'Telefone', 'Status', 'Opt-in enviado', 'Respondeu', 'Última campanha', 'Próxima campanha', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, i) => {
                const sc = statusCfg[lead.status];
                return (
                  <tr key={lead.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar nome={lead.nome || '?'} size={28} />
                        <span style={{ fontWeight: 700, color: T.marrom }}>{lead.nome || '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: T.muted }}>{lead.telefone}</td>
                    <td style={{ padding: '12px 14px' }}><Badge color={sc.color} bg={sc.bg}>{sc.label}</Badge></td>
                    <td style={{ padding: '12px 14px', color: T.muted }}>{lead.optin_enviado_em ? format(new Date(lead.optin_enviado_em), 'dd/MM HH:mm', { locale: ptBR }) : '—'}</td>
                    <td style={{ padding: '12px 14px', color: T.muted }}>{lead.resposta_em ? format(new Date(lead.resposta_em), 'dd/MM HH:mm', { locale: ptBR }) : '—'}</td>
                    <td style={{ padding: '12px 14px', color: T.muted }}>{lead.ultima_campanha_em ? format(new Date(lead.ultima_campanha_em), 'dd/MM HH:mm', { locale: ptBR }) : '—'}</td>
                    <td style={{ padding: '12px 14px', color: T.dourado, fontWeight: 700 }}>{lead.proxima_campanha_em && lead.status === 'aceito' ? formatDistanceToNow(new Date(lead.proxima_campanha_em), { locale: ptBR, addSuffix: true }) : '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {lead.status === 'pendente' && (
                        <button onClick={() => handleReenviarOptin(lead)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, border: `1px solid ${T.border}`, background: T.white, cursor: 'pointer', color: T.muted, fontWeight: 600 }}>Reenviar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Interface para leads disponíveis no modal ──────────────────────────────────
interface LeadDisponivel {
  id: string; nome: string; telefone: string;
  tipo_origem: string | null; status: string | null;
}

// ── Modal de Inscrição ─────────────────────────────────────────────────────────
function InscricaoModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<'escolha' | 'confirmar' | 'selecionar'>('escolha');
  const [tipo, setTipo] = useState<'trafego' | 'escritorio' | 'campanha' | null>(null);
  const [leads, setLeads] = useState<LeadDisponivel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState<number | null>(null);
  const [optedOutIds, setOptedOutIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchDisponivel = async (t: 'trafego' | 'escritorio' | 'campanha') => {
    setLoading(true);
    try {
      // Apenas leads ATIVOS no follow-up (não permite re-inscrever quem ainda está em andamento)
      const [{ data: existentes }, { data: optedOut }] = await Promise.all([
        supabase.from('traffic_followups').select('lead_id')
          .or('automation_active.eq.true,status.in.(new,in_progress)'),
        supabase.from('traffic_followups').select('lead_id')
          .eq('automation_active', false),
      ]);
      const inscritosSet = new Set((existentes || []).map((e: any) => e.lead_id));
      setOptedOutIds(new Set((optedOut || []).map((e: any) => e.lead_id)));

      let query = supabase
        .from('leads_juridicos')
        .select('id, nome, telefone, tipo_origem, status')
        .not('telefone', 'is', null)
        .not('status', 'in', '("Ganho","Perdido","Contrato Assinado")');

      if (t === 'trafego') query = query.eq('tipo_origem', 'trafego');
      else if (t === 'escritorio') query = (query as any).neq('tipo_origem', 'trafego');

      const { data } = await query.order('nome', { ascending: true }).limit(500);
      const disponiveis = (data || []).filter((l: any) => !inscritosSet.has(l.id));
      setLeads(disponiveis as LeadDisponivel[]);

      if (t !== 'campanha') {
        // Pré-seleciona todos (incluindo os que pediram pausa — usuário pode confirmar ciente)
        setSelected(new Set(disponiveis.map((l: any) => l.id)));
      }
    } finally { setLoading(false); }
  };

  const handleEscolha = async (t: 'trafego' | 'escritorio' | 'campanha') => {
    setTipo(t);
    await fetchDisponivel(t);
    setStep(t === 'campanha' ? 'selecionar' : 'confirmar');
  };

  const doEnroll = async () => {
    const toEnroll = leads.filter(l => selected.has(l.id));
    if (toEnroll.length === 0) { toast({ title: 'Nenhum lead selecionado', variant: 'destructive' }); return; }
    setEnrolling(true);
    try {
      const nextAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const records = toEnroll.map(l => {
        const phone = (l.telefone || '').replace(/\D/g, '');
        return {
          lead_id: l.id,
          subscriber_id: `zapi_${phone}`,
          telefone: phone,
          status: 'new',
          automation_active: true,
          current_stage: null,
          next_message_at: nextAt,
          stages_sent: {},
        };
      });

      const BATCH = 50;
      let count = 0;
      for (let i = 0; i < records.length; i += BATCH) {
        const { error } = await supabase
          .from('traffic_followups')
          .upsert(records.slice(i, i + BATCH), { onConflict: 'lead_id', ignoreDuplicates: false });
        if (error) throw error;
        count += records.slice(i, i + BATCH).length;
      }

      setEnrolled(count);
      toast({ title: `✅ ${count} lead(s) inscritos no follow-up!` });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Erro ao inscrever', description: err.message, variant: 'destructive' });
    } finally { setEnrolling(false); }
  };

  const filteredLeads = leads.filter(l =>
    !search || l.nome?.toLowerCase().includes(search.toLowerCase()) || l.telefone?.includes(search)
  );
  const allSelected = filteredLeads.length > 0 && filteredLeads.every(l => selected.has(l.id));
  const optedOutInSelection = leads.filter((l: LeadDisponivel) => selected.has(l.id) && optedOutIds.has(l.id)).length;

  const TIPO_CFG = {
    trafego:   { icon: '📢', label: 'Leads de Tráfego',   desc: 'Todos os leads vindos de anúncios (Meta Ads, Google, etc.)', color: T.blue,   bg: T.blueBg },
    escritorio: { icon: '🏛️', label: 'Leads do Escritório', desc: 'Leads orgânicos, indicações e atendimentos diretos',          color: T.dourado, bg: T.douradoPale },
    campanha:  { icon: '🎯', label: 'Nova Campanha',       desc: 'Escolha leads específicos para inscrever manualmente',         color: T.purple, bg: T.purpleBg },
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,16,8,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: T.white, borderRadius: 24, width: '100%', maxWidth: step === 'selecionar' ? 640 : 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(30,16,8,0.35)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
              {step === 'escolha' ? '➕ Inscrever Leads' : step === 'confirmar' ? `Confirmar: ${TIPO_CFG[tipo!].label}` : '🎯 Selecionar Leads'}
            </div>
            {step === 'escolha' && <div style={{ fontSize: 11, color: T.douradoLight, marginTop: 2 }}>Escolha quais leads entram no follow-up automático</div>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* ── STEP 1: Escolha ── */}
          {step === 'escolha' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(Object.entries(TIPO_CFG) as [keyof typeof TIPO_CFG, typeof TIPO_CFG['trafego']][]).map(([key, cfg]) => (
                <button key={key} onClick={() => handleEscolha(key)} disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 16, border: `1.5px solid ${T.border}`, background: T.cream, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = cfg.color; (e.currentTarget as HTMLButtonElement).style.background = cfg.bg; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; (e.currentTarget as HTMLButtonElement).style.background = T.cream; }}>
                  <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{cfg.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: T.marrom, marginBottom: 3 }}>{cfg.label}</div>
                    <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.4 }}>{cfg.desc}</div>
                  </div>
                  <div style={{ color: T.mutedLight, fontSize: 16 }}>›</div>
                </button>
              ))}
              {loading && <div style={{ textAlign: 'center', color: T.muted, fontSize: 12, padding: 8 }}>Carregando leads...</div>}
            </div>
          )}

          {/* ── STEP 2a: Confirmar (tráfego / escritório) ── */}
          {step === 'confirmar' && tipo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: TIPO_CFG[tipo].bg, border: `1.5px solid ${TIPO_CFG[tipo].color}25`, borderRadius: 16, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>{TIPO_CFG[tipo].icon}</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: TIPO_CFG[tipo].color, letterSpacing: '-0.03em', marginBottom: 4 }}>
                  {loading ? '...' : leads.length}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.marrom }}>
                  {leads.length === 1 ? 'lead disponível' : 'leads disponíveis'} para inscrição
                </div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
                  (já inscritos e com contrato fechado foram excluídos automaticamente)
                </div>
              </div>

              {enrolled !== null ? (
                <div style={{ background: T.greenBg, border: `1.5px solid ${T.green}30`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>✅</div>
                  <div style={{ fontWeight: 800, color: T.green, fontSize: 15 }}>{enrolled} leads inscritos com sucesso!</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>O follow-up automático começa em até 15 minutos.</div>
                </div>
              ) : (
                <>
                  <div style={{ background: T.blueBg, border: `1px solid ${T.blue}20`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: T.blue, lineHeight: 1.6 }}>
                    <strong>ℹ️ O que acontece:</strong> Cada lead receberá o 1º follow-up em ~15 minutos (se dentro do horário 8h–20h Manaus). A sequência completa é 15min → 24h → 44h → Nutrição.
                  </div>
                  {optedOutInSelection > 0 && (
                    <div style={{ background: '#fff8e1', border: '1.5px solid #f59e0b', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400e', lineHeight: 1.6, display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                      <span><strong>{optedOutInSelection} lead{optedOutInSelection !== 1 ? 's' : ''}</strong> deste grupo solicitou não receber mensagens. Ao confirmar, {optedOutInSelection !== 1 ? 'eles serão incluídos' : 'ele será incluído'} mesmo assim.</span>
                    </div>
                  )}
                  <button onClick={doEnroll} disabled={enrolling || leads.length === 0}
                    style={{ padding: '14px 24px', borderRadius: 12, border: 'none', background: leads.length === 0 ? T.borderLight : `linear-gradient(135deg, ${TIPO_CFG[tipo].color}, ${TIPO_CFG[tipo].color}cc)`, color: leads.length === 0 ? T.muted : '#fff', fontWeight: 800, fontSize: 14, cursor: leads.length === 0 ? 'not-allowed' : 'pointer', boxShadow: leads.length > 0 ? `0 4px 16px ${TIPO_CFG[tipo].color}40` : 'none' }}>
                    {enrolling ? 'Inscrevendo...' : `Inscrever ${leads.length} lead${leads.length !== 1 ? 's' : ''}`}
                  </button>
                </>
              )}
              {!enrolled && <button onClick={() => { setStep('escolha'); setTipo(null); setLeads([]); }} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>← Voltar</button>}
            </div>
          )}

          {/* ── STEP 2b: Selecionar (campanha) ── */}
          {step === 'selecionar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Busca */}
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.muted }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lead por nome ou telefone..."
                  style={{ width: '100%', padding: '9px 10px 9px 30px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: T.cream, fontSize: 12, color: T.marrom, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = T.dourado} onBlur={e => e.target.style.borderColor = T.border} />
              </div>

              {/* Selecionar todos */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: T.marrom }}>
                  <input type="checkbox" checked={allSelected} onChange={() => {
                    if (allSelected) setSelected(new Set());
                    else setSelected(new Set(filteredLeads.map(l => l.id)));
                  }} style={{ width: 14, height: 14, cursor: 'pointer' }} />
                  Selecionar todos ({filteredLeads.length})
                </label>
                <span style={{ fontSize: 11, color: T.dourado, fontWeight: 700 }}>{selected.size} selecionado{selected.size !== 1 ? 's' : ''}</span>
              </div>

              {/* Lista */}
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', maxHeight: 320, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ padding: 24, textAlign: 'center', color: T.muted, fontSize: 12 }}>Carregando...</div>
                ) : filteredLeads.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: T.muted, fontSize: 12 }}>Nenhum lead disponível</div>
                ) : filteredLeads.map((l, i) => (
                  <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < filteredLeads.length - 1 ? `1px solid ${T.borderLight}` : 'none', cursor: 'pointer', background: selected.has(l.id) ? (optedOutIds.has(l.id) ? '#fff8e1' : T.douradoPale) : T.white, transition: 'background 0.1s' }}>
                    <input type="checkbox" checked={selected.has(l.id)} onChange={() => {
                      setSelected(prev => { const n = new Set(prev); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n; });
                    }} style={{ width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }} />
                    <Avatar nome={l.nome} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: T.marrom, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.nome}
                        {optedOutIds.has(l.id) && <span style={{ marginLeft: 6, fontSize: 10, background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>não contatar</span>}
                      </div>
                      <div style={{ fontSize: 10, color: T.muted }}>{l.telefone}</div>
                    </div>
                    <Badge color={l.tipo_origem === 'trafego' ? T.blue : T.dourado} bg={l.tipo_origem === 'trafego' ? T.blueBg : T.douradoPale}>
                      {l.tipo_origem === 'trafego' ? '📢' : '🏛️'} {l.tipo_origem || 'orgânico'}
                    </Badge>
                  </label>
                ))}
              </div>

              {/* Aviso opted-out */}
              {optedOutInSelection > 0 && (
                <div style={{ background: '#fff8e1', border: '1.5px solid #f59e0b', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400e', lineHeight: 1.6, display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                  <span><strong>{optedOutInSelection} lead{optedOutInSelection !== 1 ? 's' : ''} selecionado{optedOutInSelection !== 1 ? 's' : ''}</strong> solicitou não receber mensagens. {optedOutInSelection !== 1 ? 'Eles serão incluídos' : 'Ele será incluído'} mesmo assim ao confirmar.</span>
                </div>
              )}

              {/* Ações */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => { setStep('escolha'); setTipo(null); setLeads([]); setSelected(new Set()); }} style={{ flex: 1, padding: '11px 16px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.white, color: T.muted, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>← Voltar</button>
                <button onClick={doEnroll} disabled={enrolling || selected.size === 0}
                  style={{ flex: 2, padding: '11px 16px', borderRadius: 10, border: 'none', background: selected.size === 0 ? T.borderLight : `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, color: selected.size === 0 ? T.muted : '#fff', cursor: selected.size === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 800, boxShadow: selected.size > 0 ? `0 4px 16px ${T.marrom}40` : 'none' }}>
                  {enrolling ? 'Inscrevendo...' : `Inscrever ${selected.size} lead${selected.size !== 1 ? 's' : ''}`}
                </button>
              </div>
              {enrolled !== null && (
                <div style={{ background: T.greenBg, border: `1px solid ${T.green}30`, borderRadius: 10, padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 700, color: T.green }}>
                  ✅ {enrolled} leads inscritos! O follow-up começa em ~15 min.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function FollowupPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ativo' | 'respondido' | 'nutricao' | 'arquivado'>('all');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<'sequencias' | 'nutricao' | 'campanhas'>('sequencias');
  const [massAction, setMassAction] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showInscricao, setShowInscricao] = useState(false);
  const { toast } = useToast();

  const metrics = {
    total: items.length,
    ativos: items.filter(i => i.automation_active).length,
    respondidos: items.filter(i => i.status === 'responded').length,
    nutricao: items.filter(i => i.status === 'nutricao').length,
    taxa: items.length > 0 ? Math.round((items.filter(i => i.status === 'responded').length / items.length) * 100) : 0,
  };

  const mapRow = useCallback((d: any): Lead => ({
    id: d.id, lead_id: d.lead_id, telefone: d.telefone,
    current_stage: d.current_stage, automation_active: d.automation_active,
    total_messages_sent: d.total_messages_sent || 0, next_message_at: d.next_message_at,
    last_inbound_at: d.last_inbound_at, status: d.status || 'new',
    stages_sent: d.stages_sent || {}, nome: d.lead?.nome || d.telefone,
    isa_agent: d.lead?.isa_agent || null, pause_reason: d.pause_reason || null,
    created_at: d.created_at || null, updated_at: d.updated_at || null,
  }), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('traffic_followups')
        .select('id, lead_id, telefone, current_stage, automation_active, total_messages_sent, next_message_at, last_inbound_at, status, stages_sent, pause_reason, created_at, updated_at, lead:leads_juridicos(nome, isa_agent)')
        .order('next_message_at', { ascending: true, nullsFirst: false }).limit(300);
      setItems((data || []).map(mapRow));
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [toast, mapRow]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time subscription — update cards as automation fires
  useEffect(() => {
    const channel = supabase
      .channel('followup-page-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'traffic_followups' }, (payload: { new: Record<string, any> }) => {
        setItems((prev: Lead[]) => prev.map((i: Lead) => i.id === payload.new.id
          ? { ...i, ...mapRow({ ...payload.new, lead: { nome: i.nome, isa_agent: i.isa_agent } }) }
          : i
        ));
        setSelected((prev: Lead | null) => prev?.id === payload.new.id
          ? { ...prev, ...mapRow({ ...payload.new, lead: { nome: prev.nome, isa_agent: prev.isa_agent } }) }
          : prev
        );
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'traffic_followups' }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, mapRow]);

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from('traffic_followups').update({ automation_active: active, pause_reason: active ? null : 'Pausado manualmente' }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, automation_active: active } : i));
    toast({ title: active ? '▶️ Retomado' : '⏸️ Pausado' });
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
    const matchFilter = filterStatus === 'all' ? true
      : filterStatus === 'ativo' ? item.automation_active
      : filterStatus === 'respondido' ? item.status === 'responded'
      : filterStatus === 'nutricao' ? item.status === 'nutricao'
      : item.status === 'archived';
    return matchSearch && matchFilter;
  });

  const filters = [
    { key: 'all',       label: 'Todos',        count: items.length },
    { key: 'ativo',     label: 'Ativos',        count: metrics.ativos },
    { key: 'respondido',label: 'Responderam',   count: metrics.respondidos },
    { key: 'nutricao',  label: '🌱 Nutrição',   count: metrics.nutricao },
    { key: 'arquivado', label: 'Arquivados',    count: items.filter(i => i.status === 'archived').length },
  ];

  const tabs = [
    { key: 'sequencias', label: 'Sequências', Icon: Inbox },
    { key: 'nutricao',   label: 'Nutrição',   Icon: Leaf },
    { key: 'campanhas',  label: 'Campanhas',  Icon: Megaphone },
  ];

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 14, background: T.cream }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={22} style={{ color: T.douradoLight }} />
        </div>
        <span style={{ color: T.muted, fontWeight: 700, fontSize: 15 }}>Carregando follow-ups...</span>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: T.cream, overflow: 'hidden' }}>

        {/* ── TOPBAR ── */}
        <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '16px 24px', flexShrink: 0, boxShadow: '0 2px 12px rgba(30,16,8,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${T.marrom}40` }}>
                <Zap size={20} style={{ color: T.douradoLight }} />
              </div>
              <div>
                <h1 style={{ fontSize: 19, fontWeight: 900, color: T.marrom, margin: 0, letterSpacing: '-0.03em' }}>Follow-up Inteligente</h1>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Tráfego pago · 15min → 24h → 44h → Nutrição</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowInscricao(true)} style={{ padding: '9px 14px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.white, color: T.muted, cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                <ArrowUpRight size={13} /> Inscrever leads
              </button>
              <button onClick={fetchData} style={{ padding: '9px 11px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.white, color: T.muted, cursor: 'pointer' }}><RefreshCw size={14} /></button>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Total de Leads', value: metrics.total, Icon: Users, accent: T.marrom },
              { label: 'Em Automação', value: metrics.ativos, Icon: Play, accent: T.green },
              { label: 'Responderam', value: metrics.respondidos, Icon: CheckCircle, accent: T.blue },
              { label: 'Taxa de Resposta', value: `${metrics.taxa}%`, Icon: TrendingUp, accent: T.dourado },
            ].map(k => (
              <div key={k.label} style={{ background: T.white, borderRadius: 14, padding: '14px 16px', border: `1px solid ${T.border}`, boxShadow: '0 1px 4px rgba(30,16,8,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</span>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${k.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <k.Icon size={14} style={{ color: k.accent }} />
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: T.marrom, letterSpacing: '-0.03em' }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, background: T.cream, borderRadius: 11, padding: 4, width: 'fit-content', border: `1px solid ${T.border}` }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key as any)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeTab === t.key ? T.white : 'transparent', color: activeTab === t.key ? T.marrom : T.muted, fontWeight: 700, fontSize: 12, boxShadow: activeTab === t.key ? '0 2px 8px rgba(30,16,8,0.12)' : 'none', transition: 'all 0.15s' }}>
                <t.Icon size={13} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'nutricao' ? (
            <div style={{ flex: 1, overflowY: 'auto' }}><TabNutricao /></div>
          ) : activeTab === 'campanhas' ? (
            <div style={{ flex: 1, overflowY: 'auto' }}><TabCampanhas /></div>
          ) : (
            <>
              {/* Filtros da lista */}
              <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '10px 24px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.muted }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lead..." style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: T.cream, fontSize: 12, color: T.marrom, outline: 'none', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = T.dourado} onBlur={e => e.target.style.borderColor = T.border} />
                </div>
                <div style={{ display: 'flex', gap: 4, background: T.cream, borderRadius: 10, padding: 3, border: `1px solid ${T.border}` }}>
                  {filters.map(f => (
                    <button key={f.key} onClick={() => setFilterStatus(f.key as any)} style={{ padding: '5px 11px', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: filterStatus === f.key ? T.white : 'transparent', color: filterStatus === f.key ? T.marrom : T.muted, boxShadow: filterStatus === f.key ? '0 1px 6px rgba(30,16,8,0.1)' : 'none', whiteSpace: 'nowrap' }}>
                      {f.label} <span style={{ fontSize: 9, color: filterStatus === f.key ? T.dourado : T.mutedLight }}>{f.count}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  {massAction ? (
                    <>
                      <span style={{ fontSize: 12, color: T.muted, fontWeight: 700, alignSelf: 'center' }}>{selectedIds.size} sel.</span>
                      <button onClick={() => handleMassToggle(true)} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: T.green, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>▶ Retomar</button>
                      <button onClick={() => handleMassToggle(false)} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: T.red, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>⏸ Pausar</button>
                      <button onClick={() => { setMassAction(false); setSelectedIds(new Set()); }} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.white, cursor: 'pointer', fontSize: 11, color: T.muted }}>Cancelar</button>
                    </>
                  ) : (
                    <button onClick={() => setMassAction(true)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.white, color: T.muted, cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><Filter size={12} /> Ação em massa</button>
                  )}
                </div>
              </div>

              {/* Grid de cards */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: selected ? '0 0 calc(100% - 380px)' : '1', overflowY: 'auto', padding: 20 }}>
                  {filtered.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 12 }}>
                      <AlertCircle size={32} style={{ color: T.mutedLight }} />
                      <div style={{ fontWeight: 800, fontSize: 15, color: T.marrom }}>Nenhum lead</div>
                      <div style={{ fontSize: 13, color: T.muted }}>Ajuste os filtros ou inscreva leads antigos</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: selected ? 'repeat(auto-fill, minmax(220px, 1fr))' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                      {filtered.map(item => (
                        massAction ? (
                          <div key={item.id} onClick={() => setSelectedIds(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; })} style={{ position: 'relative' }}>
                            {selectedIds.has(item.id) && <div style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 6, background: T.dourado, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>✓</div>}
                            <LeadCard item={item} onToggle={handleToggle} onSelect={() => {}} selected={selectedIds.has(item.id)} />
                          </div>
                        ) : (
                          <LeadCard key={item.id} item={item} onToggle={handleToggle} onSelect={setSelected} selected={selected?.id === item.id} />
                        )
                      ))}
                    </div>
                  )}
                </div>

                {/* Detalhe */}
                {selected && (
                  <div style={{ width: 380, flexShrink: 0, borderLeft: `1px solid ${T.border}`, overflowY: 'auto', background: T.cream }}>
                    <div style={{ background: `linear-gradient(160deg, ${T.marrom}, ${T.marromMed})`, padding: '16px 20px' }}>
                      <button onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 11, marginBottom: 12 }}>← Fechar</button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar nome={selected.nome} size={44} />
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{selected.nome}</div>
                          <div style={{ fontSize: 11, color: T.douradoLight, marginTop: 3 }}>{selected.telefone}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Ações */}
                      {selected.status !== 'responded' && selected.status !== 'archived' && selected.status !== 'nutricao' && (
                        <button onClick={() => handleToggle(selected.id, !selected.automation_active)} style={{ padding: '11px 16px', borderRadius: 11, border: 'none', cursor: 'pointer', background: selected.automation_active ? `linear-gradient(135deg, ${T.red}, #9f1239)` : `linear-gradient(135deg, ${T.marrom}, ${T.marromMed})`, color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                          {selected.automation_active ? <><Pause size={14} /> Pausar automação</> : <><Play size={14} /> Retomar automação</>}
                        </button>
                      )}

                      {/* Estágios */}
                      <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Sequência</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {Object.entries(STAGE_CFG).sort((a, b) => a[1].order - b[1].order).map(([key, cfg]) => {
                            const sent = !!selected.stages_sent?.[key] && !selected.stages_sent[key]?.simulated;
                            const isCurrent = selected.current_stage === key;
                            return (
                              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 9, background: sent ? cfg.bg : isCurrent ? `${cfg.color}10` : T.cream, border: isCurrent ? `1.5px solid ${cfg.color}` : `1px solid ${T.borderLight}` }}>
                                <div style={{ width: 20, height: 20, borderRadius: '50%', background: sent ? cfg.color : isCurrent ? `${cfg.color}30` : T.borderLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: sent || isCurrent ? cfg.color : T.mutedLight, fontWeight: 800, border: `1px solid ${sent || isCurrent ? cfg.color : T.border}` }}>
                                  {sent ? '✓' : cfg.order}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: sent || isCurrent ? cfg.color : T.muted }}>{cfg.label}</span>
                                {sent && selected.stages_sent[key]?.at && (
                                  <span style={{ fontSize: 10, color: T.mutedLight, marginLeft: 'auto' }}>{format(new Date(selected.stages_sent[key].at), 'dd/MM HH:mm', { locale: ptBR })}</span>
                                )}
                                {isCurrent && !sent && selected.next_message_at && (
                                  <span style={{ fontSize: 10, color: cfg.color, fontWeight: 700, marginLeft: 'auto' }}>próxima {formatDistanceToNow(new Date(selected.next_message_at), { locale: ptBR, addSuffix: true })}</span>
                                )}
                              </div>
                            );
                          })}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 9, background: selected.status === 'nutricao' ? T.tealBg : T.cream, border: selected.status === 'nutricao' ? `1.5px solid ${T.teal}` : `1px solid ${T.borderLight}` }}>
                            <Leaf size={16} style={{ color: selected.status === 'nutricao' ? T.teal : T.mutedLight }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: selected.status === 'nutricao' ? T.teal : T.muted }}>Lista de Nutrição</span>
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
                        {[
                          { label: 'Status', value: { new: '🔵 Novo', in_progress: '🟢 Em andamento', responded: '✅ Respondeu', nutricao: '🌱 Nutrição', archived: '📁 Arquivado', paused: '⏸️ Pausado' }[selected.status] || selected.status },
                          { label: 'Mensagens', value: `${selected.total_messages_sent} enviadas` },
                          { label: 'Agente', value: selected.isa_agent ? AGENT_CFG[selected.isa_agent]?.name || selected.isa_agent : 'ISA' },
                          { label: 'Última resposta', value: selected.last_inbound_at ? format(new Date(selected.last_inbound_at), "dd/MM 'às' HH:mm", { locale: ptBR }) : 'Nunca respondeu' },
                        ].map((row, i, arr) => (
                          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
                            <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>{row.label}</span>
                            <span style={{ fontSize: 12, color: T.marrom, fontWeight: 600 }}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}`}</style>
      {showInscricao && (
        <InscricaoModal
          onClose={() => setShowInscricao(false)}
          onSuccess={() => { setShowInscricao(false); fetchData(); }}
        />
      )}
    </AppLayout>
  );
}
