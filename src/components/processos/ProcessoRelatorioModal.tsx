import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, FileText, Download, Loader2, Scale } from 'lucide-react';
import { Processo, ProcessoParte, ProcessoMovimento } from '@/types/processos';
import { Tarefa } from '@/types/tarefas';
import { supabase } from '@/integrations/supabase/client';

interface Despesa { id: string; tipo: string | null; descricao: string | null; valor: number | null; data_despesa: string | null; status: string | null; }
interface Honorario { id: string; tipo: string | null; valor_total: number | null; valor_entrada: number | null; forma_pagamento: string | null; status: string | null; data_contrato: string | null; }
interface ContatoRegistro { id: string; resumo: string; data_interacao: string; }

interface Props {
  onClose: () => void;
  processo: Processo;
  clienteNome: string | null;
  statusAtual: string;
  tituloAcaoAtual: string;
  partes: ProcessoParte[];
  movimentos: ProcessoMovimento[];
  tarefas: Tarefa[];
  despesas: Despesa[];
  honorarios: Honorario[];
}

type SecaoKey = 'dados' | 'partes' | 'movimentos' | 'tarefas' | 'financeiro' | 'contatos';

const SECOES: { key: SecaoKey; label: string }[] = [
  { key: 'dados',      label: 'Dados do Processo' },
  { key: 'partes',     label: 'Partes' },
  { key: 'movimentos', label: 'Movimentações' },
  { key: 'tarefas',    label: 'Tarefas' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'contatos',   label: 'Contatos com o Cliente' },
];

function fmtMoeda(v: number | null | undefined): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function fmtData(v: string | null | undefined): string {
  if (!v) return '—';
  try { return format(new Date(v), 'dd/MM/yyyy', { locale: ptBR }); } catch { return v; }
}

// Relatório de um único processo, com escolha de quais seções entram
// (pedido do usuário 2026-09-12) — mesma mecânica de geração de PDF
// (html2canvas + jsPDF) e identidade visual já usadas em AgendaPDFModal.
export function ProcessoRelatorioModal({ onClose, processo, clienteNome, statusAtual, tituloAcaoAtual, partes, movimentos, tarefas, despesas, honorarios }: Props) {
  const [secoesAtivas, setSecoesAtivas] = useState<Set<SecaoKey>>(new Set(SECOES.map(s => s.key)));
  const [generating, setGenerating] = useState(false);
  const [contatos, setContatos] = useState<ContatoRegistro[]>([]);
  const [contatosLoading, setContatosLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const toggleSecao = (k: SecaoKey) => setSecoesAtivas(prev => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  // Busca os contatos só quando a seção é marcada (evita 1 query a mais
  // sempre que o modal abre, se ninguém for usar essa seção).
  useEffect(() => {
    if (!secoesAtivas.has('contatos') || contatos.length > 0 || contatosLoading) return;
    setContatosLoading(true);
    supabase.from('interacoes').select('id, resumo, data_interacao')
      .eq('processo_id', processo.id).eq('tipo', 'Contato Processo')
      .order('data_interacao', { ascending: false })
      .then(({ data }) => { setContatos((data || []) as ContatoRegistro[]); setContatosLoading(false); });
  }, [secoesAtivas, processo.id, contatos.length, contatosLoading]);

  const totalHonorarios = useMemo(() => honorarios.reduce((acc, h) => acc + (h.valor_total || 0), 0), [honorarios]);
  const totalDespesas = useMemo(() => despesas.reduce((acc, d) => acc + (d.valor || 0), 0), [despesas]);

  const handleGeneratePDF = useCallback(async () => {
    if (!printRef.current) return;
    setGenerating(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas  = await html2canvas(printRef.current, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pageW = 210, pageH = 297;
      const imgW = pageW, imgH = (canvas.height * pageW) / canvas.width;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let posY = 0, remaining = imgH, totalPages = Math.ceil(imgH / pageH);
      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 0, -posY, imgW, imgH);
        remaining -= pageH; posY += pageH;
        if (remaining > 0) pdf.addPage();
      }
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(180, 140, 80);
        pdf.text(`Página ${i} de ${totalPages}`, pageW - 10, pageH - 4, { align: 'right' });
        pdf.setTextColor(160, 140, 120);
        pdf.text('Bentes Ramos — Advocacia & Consultoria Jurídica', 10, pageH - 4);
      }
      pdf.save(`processo-${(processo.numero_processo || processo.id).replace(/[^\w-]/g, '')}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }, [processo]);

  // Portal direto pro body: um ancestral (PageTransition) aplica um
  // transform que quebra position:fixed (mesmo bug já visto e documentado
  // nas Petições — o fixed vira relativo a esse ancestral e some/corta).
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 12px', overflow: 'auto', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#faf7f2', borderRadius: 20, width: '100%', maxWidth: 860, boxShadow: '0 40px 100px rgba(20,10,0,0.45)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ background: 'linear-gradient(135deg, #1e1008, #3d2010)', padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={18} style={{ color: '#c9943a' }} />
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Relatório do Processo — PDF</span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        {/* Controles: escolha das seções */}
        <div style={{ padding: '14px 22px', background: '#fff', borderBottom: '1px solid #e8ddd0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#8a7260' }}>Incluir no relatório:</span>
              {SECOES.map(s => {
                const sel = secoesAtivas.has(s.key);
                return (
                  <button key={s.key} onClick={() => toggleSecao(s.key)} style={{ padding: '4px 11px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${sel ? '#c9943a' : '#e8ddd0'}`, background: sel ? '#fdf3e3' : '#fff', color: sel ? '#8a5a1f' : '#9ca3af' }}>
                    {s.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleGeneratePDF}
              disabled={generating || secoesAtivas.size === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 10, border: 'none', cursor: generating || secoesAtivas.size === 0 ? 'not-allowed' : 'pointer', background: generating || secoesAtivas.size === 0 ? '#e8ddd0' : 'linear-gradient(135deg, #1e1008, #3d2010)', color: generating || secoesAtivas.size === 0 ? '#8a7260' : '#c9943a', fontWeight: 800, fontSize: 13 }}
            >
              {generating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
              {generating ? 'Gerando...' : 'Baixar PDF'}
            </button>
          </div>
        </div>

        {/* Preview / conteúdo imprimível */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '16px' }}>
          <div ref={printRef} style={{ background: '#ffffff', fontFamily: "'Georgia', 'Times New Roman', serif", width: '100%' }}>

            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #1e1008 0%, #3d2010 60%, #6b3f25 100%)', padding: '32px 40px 24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(201,148,58,0.08)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                <div>
                  <div style={{ color: '#c9943a', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'Arial, sans-serif' }}>ESCRITÓRIO DE ADVOCACIA</div>
                  <div style={{ color: '#ffffff', fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 2 }}>Bentes Ramos</div>
                  <div style={{ color: 'rgba(201,148,58,0.8)', fontSize: 13, fontFamily: 'Arial, sans-serif' }}>Advocacia & Consultoria Jurídica</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Relatório de Processo</div>
                  <div style={{ color: '#c9943a', fontSize: 15, fontWeight: 900, lineHeight: 1.3 }}>{processo.numero_processo || 'Sem número'}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontFamily: 'Arial, sans-serif', marginTop: 6 }}>
                    Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                  <div style={{ display: 'inline-block', marginTop: 8, padding: '3px 10px', border: '1px solid rgba(201,148,58,0.5)', borderRadius: 4, fontSize: 8, color: '#c9943a', fontFamily: 'Arial, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    CONFIDENCIAL
                  </div>
                </div>
              </div>
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #c9943a, transparent)', marginTop: 24 }} />
            </div>

            {secoesAtivas.has('dados') && (
              <div style={{ padding: '24px 32px', borderBottom: '1px solid #e8ddd0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#8a7260', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Arial, sans-serif', marginBottom: 12 }}>Dados do Processo</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 24px', fontFamily: 'Arial, sans-serif' }}>
                  {[
                    ['Cliente', clienteNome || '—'],
                    ['Número do processo', processo.numero_processo || '—'],
                    ['Ação', tituloAcaoAtual || '—'],
                    ['Status', statusAtual || '—'],
                    ['Tribunal', processo.tribunal || '—'],
                    ['Vara/Comarca', processo.vara_comarca || '—'],
                    ['Valor da causa', fmtMoeda(processo.valor_causa)],
                    ['Advogado responsável', processo.advogado_responsavel || '—'],
                    ['Data de distribuição', fmtData(processo.data_distribuicao)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 9, color: '#8a7260', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                      <div style={{ fontSize: 12.5, color: '#1e1008', fontWeight: 600, marginTop: 2 }}>{value}</div>
                    </div>
                  ))}
                </div>
                {processo.descricao && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 9, color: '#8a7260', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Descrição</div>
                    <div style={{ fontSize: 12, color: '#3d2010', marginTop: 3, lineHeight: 1.6, fontFamily: 'Arial, sans-serif' }}>{processo.descricao}</div>
                  </div>
                )}
              </div>
            )}

            {secoesAtivas.has('partes') && (
              <div style={{ padding: '24px 32px', borderBottom: '1px solid #e8ddd0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#8a7260', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Arial, sans-serif', marginBottom: 12 }}>Partes ({partes.length})</div>
                {partes.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'Arial, sans-serif' }}>Nenhuma parte cadastrada.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {partes.map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Arial, sans-serif', fontSize: 12, padding: '6px 0', borderBottom: i < partes.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                        <span style={{ color: '#1e1008', fontWeight: 600 }}>{p.nome}</span>
                        <span style={{ color: '#8a7260' }}>{p.tipo || p.polo || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {secoesAtivas.has('movimentos') && (
              <div style={{ padding: '24px 32px', borderBottom: '1px solid #e8ddd0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#8a7260', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Arial, sans-serif', marginBottom: 12 }}>Movimentações ({movimentos.length})</div>
                {movimentos.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'Arial, sans-serif' }}>Nenhuma movimentação registrada.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {movimentos.slice(0, 40).map((m, i) => (
                      <div key={i} style={{ fontFamily: 'Arial, sans-serif', paddingBottom: 8, borderBottom: i < Math.min(movimentos.length, 40) - 1 ? '1px solid #f0ebe3' : 'none' }}>
                        <div style={{ fontSize: 10, color: '#8a7260', marginBottom: 2 }}>{m.dataHora}</div>
                        <div style={{ fontSize: 12, color: '#1e1008', lineHeight: 1.5 }}>{m.descricao}</div>
                      </div>
                    ))}
                    {movimentos.length > 40 && (
                      <p style={{ fontSize: 10.5, color: '#9ca3af', fontFamily: 'Arial, sans-serif', fontStyle: 'italic' }}>
                        + {movimentos.length - 40} movimentações anteriores não exibidas.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {secoesAtivas.has('tarefas') && (
              <div style={{ padding: '24px 32px', borderBottom: '1px solid #e8ddd0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#8a7260', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Arial, sans-serif', marginBottom: 12 }}>Tarefas ({tarefas.length})</div>
                {tarefas.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'Arial, sans-serif' }}>Nenhuma tarefa vinculada.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tarefas.map(t => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Arial, sans-serif', fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f0ebe3' }}>
                        <span style={{ color: '#1e1008', fontWeight: 600 }}>{t.titulo}</span>
                        <span style={{ color: '#8a7260' }}>{t.status} · {fmtData(t.prazo_fatal || t.data_limite)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {secoesAtivas.has('financeiro') && (
              <div style={{ padding: '24px 32px', borderBottom: '1px solid #e8ddd0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#8a7260', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Arial, sans-serif', marginBottom: 12 }}>Financeiro</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: honorarios.length || despesas.length ? 14 : 0 }}>
                  <div style={{ fontFamily: 'Arial, sans-serif' }}>
                    <div style={{ fontSize: 9, color: '#8a7260', textTransform: 'uppercase' }}>Total honorários</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#14532d' }}>{fmtMoeda(totalHonorarios)}</div>
                  </div>
                  <div style={{ fontFamily: 'Arial, sans-serif' }}>
                    <div style={{ fontSize: 9, color: '#8a7260', textTransform: 'uppercase' }}>Total despesas</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#991b1b' }}>{fmtMoeda(totalDespesas)}</div>
                  </div>
                </div>
                {honorarios.map(h => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Arial, sans-serif', fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f0ebe3' }}>
                    <span style={{ color: '#1e1008' }}>Honorário {h.tipo || ''} — {h.forma_pagamento || '—'}</span>
                    <span style={{ color: '#14532d', fontWeight: 700 }}>{fmtMoeda(h.valor_total)}</span>
                  </div>
                ))}
                {despesas.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Arial, sans-serif', fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f0ebe3' }}>
                    <span style={{ color: '#1e1008' }}>{d.descricao || d.tipo || 'Despesa'}</span>
                    <span style={{ color: '#991b1b', fontWeight: 700 }}>{fmtMoeda(d.valor)}</span>
                  </div>
                ))}
              </div>
            )}

            {secoesAtivas.has('contatos') && (
              <div style={{ padding: '24px 32px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#8a7260', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Arial, sans-serif', marginBottom: 12 }}>Contatos com o Cliente ({contatos.length})</div>
                {contatosLoading ? (
                  <p style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'Arial, sans-serif' }}>Carregando...</p>
                ) : contatos.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'Arial, sans-serif' }}>Nenhum contato registrado.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {contatos.map(c => (
                      <div key={c.id} style={{ fontFamily: 'Arial, sans-serif', paddingBottom: 8, borderBottom: '1px solid #f0ebe3' }}>
                        <div style={{ fontSize: 10, color: '#8a7260', marginBottom: 2 }}>{format(new Date(c.data_interacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                        <div style={{ fontSize: 12, color: '#1e1008', lineHeight: 1.5 }}>{c.resumo}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{ background: 'linear-gradient(135deg, #1e1008, #3d2010)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(201,148,58,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#c9943a', fontSize: 14, fontWeight: 900 }}>BR</span>
                </div>
                <div>
                  <div style={{ color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>Bentes Ramos</div>
                  <div style={{ color: 'rgba(201,148,58,0.7)', fontSize: 9, fontFamily: 'Arial, sans-serif' }}>Advocacia & Consultoria Jurídica</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'Arial, sans-serif' }}>Documento gerado pelo sistema CRM interno</div>
                <div style={{ color: 'rgba(201,148,58,0.6)', fontSize: 9, fontFamily: 'Arial, sans-serif' }}>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
