import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { enrichMovements, getCategoriaColor, getCategoriaIcon } from '@/lib/cnjMovimentosMap';
import { Activity, Clock, FileText, Gavel, Scale, Calendar, Mail, Bell, CheckCircle, Circle, FileCheck, ArrowUpRight } from 'lucide-react';

interface MovimentoEnriquecidoRow {
  id: string;
  data_movimento: string | null;
  movimento_titulo: string;
  movimento_cnj_codigo: string | null;
  created_at: string;
  processos: {
    id: string;
    numero_processo: string;
    nome_cliente: string | null;
    status: string | null;
  } | null;
  // enriched
  titulo_humano: string;
  categoria: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
  FileText, Gavel, FileCheck, Scale, ArrowUpRight, Calendar, Mail, Bell, CheckCircle, Circle,
};

function CategoriaIcon({ categoria }: { categoria: string }) {
  const name = getCategoriaIcon(categoria);
  const Icon = ICON_MAP[name] || Circle;
  return <Icon className="h-3 w-3 shrink-0" />;
}

function formatDataCurta(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hoje = new Date();
  const diff = Math.floor((hoje.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'ontem';
  if (diff < 7) return `${diff}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatUltimoSync(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function numeroCurto(cnj: string | undefined): string {
  if (!cnj) return '';
  // Mostra apenas os primeiros 7 dígitos (NNNNNNN) do CNJ
  const digits = cnj.replace(/\D/g, '');
  if (digits.length >= 7) return `...${digits.slice(0, 7)}`;
  return cnj.length > 18 ? cnj.slice(-18) : cnj;
}

interface Props {
  onProcessoSelect?: (processoId: string) => void;
}

export function MovimentosRecentes({ onProcessoSelect }: Props) {
  const [movimentos, setMovimentos] = useState<MovimentoEnriquecidoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMovimentos() {
      setLoading(true);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('processo_movimentacoes')
        .select(`
          id,
          data_movimento,
          movimento_titulo,
          movimento_cnj_codigo,
          created_at,
          processos (
            id,
            numero_processo,
            nome_cliente,
            status
          )
        `)
        .gte('data_movimento', sevenDaysAgo)
        .order('data_movimento', { ascending: false })
        .limit(30);

      if (error) {
        console.error('[MovimentosRecentes] erro:', error.message);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        // Deduplica por (processo_id + movimento_titulo + data) para evitar duplicatas visuais
        const seen = new Set<string>();
        const unique = data.filter((m: any) => {
          const key = `${m.processos?.id}_${m.movimento_titulo}_${m.data_movimento?.slice(0, 10)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const enriched = unique.map((m: any) => {
          const [result] = enrichMovements([{
            dataHora: m.data_movimento || '',
            nome: m.movimento_titulo,
            codigo: m.movimento_cnj_codigo ? parseInt(m.movimento_cnj_codigo, 10) : undefined,
          }]);
          return {
            ...m,
            titulo_humano: result?.titulo_humano || m.movimento_titulo,
            categoria: result?.categoria || 'outros',
          };
        });

        setMovimentos(enriched);

        // lastSync = created_at mais recente
        const maxCreated = unique.reduce(
          (max: string, m: any) => (m.created_at > max ? m.created_at : max),
          unique[0].created_at
        );
        setLastSync(maxCreated);
      }

      setLoading(false);
    }

    fetchMovimentos();
  }, []);

  if (loading || movimentos.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/10">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center">
            <Activity className="h-3 w-3 text-primary" />
          </div>
          <span className="text-[11px] font-black text-foreground uppercase tracking-wider">
            Movimentos Recentes
          </span>
          <span className="h-4 min-w-4 px-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[9px] font-black flex items-center justify-center">
            {movimentos.length}
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">— últimos 7 dias</span>
        </div>

        {lastSync && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
            <Clock className="h-2.5 w-2.5" />
            <span>sync {formatUltimoSync(lastSync)}</span>
          </div>
        )}
      </div>

      {/* Scrollable cards */}
      <div className="flex items-stretch gap-2 px-3 py-2.5 overflow-x-auto">
        {movimentos.slice(0, 20).map((m) => {
          const colorClass = getCategoriaColor(m.categoria);
          const dataStr = formatDataCurta(m.data_movimento);
          const processo = m.processos;

          return (
            <button
              key={m.id}
              onClick={() => processo?.id && onProcessoSelect?.(processo.id)}
              className="shrink-0 flex flex-col gap-1.5 p-2.5 rounded-xl border border-border/40 bg-background hover:bg-muted/30 hover:border-primary/30 hover:shadow-sm transition-all duration-200 text-left w-[172px]"
            >
              {/* Top row: categoria badge + data */}
              <div className="flex items-center justify-between gap-1">
                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${colorClass}`}>
                  <CategoriaIcon categoria={m.categoria} />
                  {m.categoria}
                </span>
                {dataStr && (
                  <span className="text-[9px] text-muted-foreground shrink-0">{dataStr}</span>
                )}
              </div>

              {/* Movement title */}
              <p className="text-[11px] font-semibold text-foreground leading-tight line-clamp-2 min-h-[28px]">
                {m.titulo_humano}
              </p>

              {/* Processo info */}
              <div className="mt-auto pt-1 border-t border-border/30">
                <p className="text-[9px] text-muted-foreground font-mono truncate">
                  {numeroCurto(processo?.numero_processo)}
                </p>
                {processo?.nome_cliente && (
                  <p className="text-[9px] text-muted-foreground truncate mt-0.5">
                    {processo.nome_cliente.split(' ')[0]}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
