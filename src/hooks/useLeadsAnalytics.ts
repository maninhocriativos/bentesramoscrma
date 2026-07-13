import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Campos mínimos para os gráficos da página de Dados.
const ANALYTICS_SELECT =
  'id,created_at,status,origem,tipo_acao,uf,profissao,valor_causa,is_lost,lost_at' as const;

export interface LeadAnalytics {
  id: string;
  created_at: string;
  status: string | null;
  origem: string | null;
  tipo_acao: string | null;
  uf: string | null;
  profissao: string | null;
  valor_causa: number | null;
  is_lost: boolean | null;
  lost_at: string | null;
}

interface ProcessoAnalytics {
  categoria_beneficiario: string | null;
  tribunal: string | null;
  status: string | null;
  cliente_id: string | null;
  data_nascimento_cliente: string | null;
}

export interface CategoriaCount { name: string; value: number }
export interface ExitoEstado { name: string; ganhos: number; perdidos: number }

// Faixa etária a partir de data_nascimento_cliente (campo novo — maioria dos
// processos existentes ainda não tem esse dado preenchido).
const AGE_ORDER = ['Menor de 18', '18-25', '26-35', '36-45', '46-60', '60+', 'Não informado'];
function ageBucket(dataNascimento: string | null): string {
  if (!dataNascimento) return 'Não informado';
  const dob = new Date(dataNascimento);
  if (isNaN(dob.getTime())) return 'Não informado';
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  if (age < 18) return 'Menor de 18';
  if (age <= 25) return '18-25';
  if (age <= 35) return '26-35';
  if (age <= 45) return '36-45';
  if (age <= 60) return '46-60';
  return '60+';
}

const CATEGORIA_ORDER = ['Servidor Público', 'Aposentado', 'Pensionista', 'Carteira Assinada', 'Aéreo', 'Outro', 'Não informado'];
const CATEGORIA_CONHECIDAS = new Set(['Servidor Público', 'Aposentado', 'Pensionista', 'Carteira Assinada', 'Aéreo']);

// Mapa tribunal estadual (TJ) → nome do estado. Tribunais federais/trabalhistas
// (TRF*, TRT*, STJ, STF, TST) cobrem mais de um estado — não forçamos um UF,
// aparecem agrupados pela própria sigla.
const TJ_UF: Record<string, string> = {
  TJAC: 'Acre', TJAL: 'Alagoas', TJAP: 'Amapá', TJAM: 'Amazonas', TJBA: 'Bahia', TJCE: 'Ceará',
  TJDFT: 'Distrito Federal', TJES: 'Espírito Santo', TJGO: 'Goiás', TJMA: 'Maranhão',
  TJMT: 'Mato Grosso', TJMS: 'Mato Grosso do Sul', TJMG: 'Minas Gerais', TJPA: 'Pará',
  TJPB: 'Paraíba', TJPR: 'Paraná', TJPE: 'Pernambuco', TJPI: 'Piauí', TJRJ: 'Rio de Janeiro',
  TJRN: 'Rio Grande do Norte', TJRS: 'Rio Grande do Sul', TJRO: 'Rondônia', TJRR: 'Roraima',
  TJSC: 'Santa Catarina', TJSP: 'São Paulo', TJSE: 'Sergipe', TJTO: 'Tocantins',
};

// Normaliza variações de escrita do mesmo tribunal ("TRT11" vs "TRT-11").
function normalizeTribunal(t: string): string {
  return t.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function tribunalLabel(tribunalRaw: string | null): string {
  if (!tribunalRaw || !tribunalRaw.trim()) return 'Não informado';
  const norm = normalizeTribunal(tribunalRaw);
  return TJ_UF[norm] || norm;
}

function isGanho(status: string | null) {
  return status === 'Ganho' || status === 'Contrato Assinado';
}
function isPerdido(status: string | null) {
  return status === 'Perdido';
}

// Busca TODAS as linhas de uma tabela (o PostgREST corta em ~1000 por requisição).
async function fetchAll<T>(table: string, select: string): Promise<{ rows: T[]; error: string | null }> {
  const PAGE = 1000;
  const rows: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.from(table as any).select(select).range(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    const batch = (data as T[]) || [];
    rows.push(...batch);
    if (batch.length < PAGE || rows.length >= 50000) break;
    from += PAGE;
  }
  return { rows, error: null };
}

export function useLeadsAnalytics() {
  const [leads, setLeads] = useState<LeadAnalytics[]>([]);
  const [categoriaProcessos, setCategoriaProcessos] = useState<CategoriaCount[]>([]);
  const [totalProcessos, setTotalProcessos] = useState(0);
  const [estadoProcessos, setEstadoProcessos] = useState<CategoriaCount[]>([]);
  const [exitoPorEstado, setExitoPorEstado] = useState<ExitoEstado[]>([]);
  const [exitoCobertura, setExitoCobertura] = useState({ comCliente: 0, total: 0 });
  const [idadeClientes, setIdadeClientes] = useState<CategoriaCount[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const loadedOnce = useRef(false);

  const fetchAllData = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);

    // Leads (todos os gráficos exceto o Perfil do Beneficiário e os de processos)
    const leadsRes = await fetchAll<LeadAnalytics>('leads_juridicos', ANALYTICS_SELECT);
    if (leadsRes.error) {
      toast({ title: 'Erro ao carregar leads', description: leadsRes.error, variant: 'destructive' });
    } else {
      setLeads(leadsRes.rows);
    }

    // Processos: Perfil do Beneficiário + Estado + Êxito por Estado + Idade dos Clientes.
    const procRes = await fetchAll<ProcessoAnalytics>('processos', 'categoria_beneficiario,tribunal,status,cliente_id,data_nascimento_cliente');
    if (!procRes.error) {
      const catMap: Record<string, number> = {};
      const estadoMap: Record<string, number> = {};
      const idadeMap: Record<string, number> = {};
      procRes.rows.forEach(p => {
        const rawCat = (p.categoria_beneficiario || '').trim();
        const catKey = !rawCat ? 'Não informado' : CATEGORIA_CONHECIDAS.has(rawCat) ? rawCat : 'Outro';
        catMap[catKey] = (catMap[catKey] || 0) + 1;

        const estadoKey = tribunalLabel(p.tribunal);
        estadoMap[estadoKey] = (estadoMap[estadoKey] || 0) + 1;

        const idadeKey = ageBucket(p.data_nascimento_cliente);
        idadeMap[idadeKey] = (idadeMap[idadeKey] || 0) + 1;
      });
      setCategoriaProcessos(CATEGORIA_ORDER.filter(k => catMap[k]).map(name => ({ name, value: catMap[name] })));
      setTotalProcessos(procRes.rows.length);
      setEstadoProcessos(Object.entries(estadoMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
      setIdadeClientes(AGE_ORDER.filter(k => idadeMap[k]).map(name => ({ name, value: idadeMap[name] })));

      // Êxito por estado: cruza o processo com o desfecho do LEAD vinculado
      // (processos.status ainda não tem Ganho/Perdido preenchido hoje).
      const leadStatusMap = new Map((leadsRes.rows || []).map(l => [l.id, l.status]));
      let comCliente = 0;
      const exitoMap: Record<string, { ganhos: number; perdidos: number }> = {};
      procRes.rows.forEach(p => {
        if (!p.cliente_id) return;
        const leadStatus = leadStatusMap.get(p.cliente_id);
        if (leadStatus === undefined) return;
        comCliente++;
        if (!isGanho(leadStatus) && !isPerdido(leadStatus)) return;
        const key = tribunalLabel(p.tribunal);
        const bucket = (exitoMap[key] ||= { ganhos: 0, perdidos: 0 });
        if (isGanho(leadStatus)) bucket.ganhos++; else bucket.perdidos++;
      });
      setExitoPorEstado(
        Object.entries(exitoMap)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => (b.ganhos + b.perdidos) - (a.ganhos + a.perdidos))
      );
      setExitoCobertura({ comCliente, total: procRes.rows.length });
    }

    loadedOnce.current = true;
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    leads, loading, categoriaProcessos, totalProcessos,
    estadoProcessos, exitoPorEstado, exitoCobertura, idadeClientes,
    refetch: fetchAllData,
  };
}
