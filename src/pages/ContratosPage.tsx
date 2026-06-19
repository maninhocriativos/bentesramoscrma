import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { ContratosKPIs } from '@/components/contratos/ContratosKPIs';
import { ContratosAnalytics } from '@/components/contratos/ContratosAnalytics';
import { ContratosTable } from '@/components/contratos/ContratosTable';
import { ModelosContratos } from '@/components/contratos/ModelosContratos';
import { EnviarKitModal } from '@/components/contratos/EnviarKitModal';
import { ZapsignContratosKPIs } from '@/components/contratos/ZapsignContratosKPIs';
import { ZapsignContratosTable } from '@/components/contratos/ZapsignContratosTable';
import { CriarContratoZapsignModal } from '@/components/contratos/CriarContratoZapsignModal';
import { useZapsignContratos, type ContratoZapsignComStatus, type TipoOrigemZapsign } from '@/hooks/useZapsignContratos';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileText, FolderOpen, Clock, CheckCircle2, XCircle, Zap, Plus, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function normalizePhone(p: string): string {
  return p.replace(/\D/g, '').slice(-11);
}

export interface ContratoClicksign {
  id: string;
  key: string;
  filename: string;
  status: string;
  created_at: string;
  updated_at: string;
  signers: Array<{
    key: string;
    email: string;
    name: string;
    signed_at: string | null;
  }>;
}

export interface ContratoComStatus {
  id: string;
  leadId?: string;
  leadNome: string;
  leadEmail: string | null;
  signatarioNome: string | null;
  tipoAcao: string | null;
  linkContrato: string;
  status: string;
  lastUpdate: string | null;
  key?: string;
  tipoOrigem?: string | null;
}

const mapClicksignStatus = (doc: any): string => {
  if (doc.status === 'closed') return 'Finalizado';
  if (doc.status === 'canceled') return 'Cancelado';
  if (doc.status === 'running') {
    const signers = doc.signers || [];
    const allSigned = signers.length > 0 && signers.every((s: any) => s.signed_at);
    const anySigned = signers.some((s: any) => s.signed_at);
    if (allSigned) return 'Assinado';
    if (anySigned) return 'Assinatura Parcial';
    return 'Aguardando Assinatura';
  }
  return 'Documento Enviado';
};

const TABS_CLICKSIGN = [
  { id: 'todos',       label: 'Todos',       icon: FileText,     color: 'text-[#c9a96e]'  },
  { id: 'em-processo', label: 'Em Processo', icon: Clock,        color: 'text-amber-500'  },
  { id: 'finalizados', label: 'Finalizados', icon: CheckCircle2, color: 'text-emerald-500' },
  { id: 'cancelados',  label: 'Cancelados',  icon: XCircle,      color: 'text-zinc-400'   },
  { id: 'modelos',     label: 'Modelos',     icon: FolderOpen,   color: 'text-[#c9a96e]'  },
];

const TABS_ZAPSIGN = [
  { id: 'zapsign-todos',           label: 'Todos',           icon: FileText,     color: 'text-cyan-600'  },
  { id: 'zapsign-em-assinatura',   label: 'Em Assinatura',   icon: Clock,        color: 'text-amber-500'  },
  { id: 'zapsign-assinados',       label: 'Assinados',       icon: CheckCircle2, color: 'text-emerald-500' },
  { id: 'zapsign-cancelados',      label: 'Cancelados',      icon: XCircle,      color: 'text-zinc-400'   },
  { id: 'zapsign-modelos',         label: 'Modelos',         icon: FolderOpen,   color: 'text-cyan-600'  },
];

export default function ContratosPage() {
  const { toast } = useToast();
  const [contratos, setContratos] = useState<ContratoComStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('todos');
  const [enviarModalOpen, setEnviarModalOpen] = useState(false);
  const [provider, setProvider] = useState<'clicksign' | 'zapsign'>('clicksign');
  const [criarZapsignOpen, setCriarZapsignOpen] = useState(false);

  // Adapta os contratos do ClickSign para o MESMO painel de KPIs do ZapSign
  // (apenas reuso visual; os dados continuam 100% independentes do ZapSign).
  const contratosClicksignKpi = useMemo<ContratoZapsignComStatus[]>(() => {
    const toZapStatus = (label: string): ContratoZapsignComStatus['status'] => {
      if (label === 'Finalizado' || label === 'Assinado') return 'signed';
      if (label === 'Cancelado') return 'cancelled';
      if (label === 'Rejeitado') return 'rejected';
      if (label === 'Expirado') return 'expired';
      return 'pending';
    };
    return contratos.map((c) => ({
      id: c.key || c.id || '',
      name: c.leadNome || 'Documento',
      status: toZapStatus(c.status || ''),
      created_at: c.lastUpdate || new Date().toISOString(),
      signers: [],
      leadId: c.leadId,
      leadNome: c.signatarioNome || c.leadNome,
      leadEmail: c.leadEmail || undefined,
      leadPhone: undefined,
      tipoOrigem: (c.tipoOrigem as TipoOrigemZapsign) || 'indefinido',
      statusLocal: c.status === 'Finalizado' ? 'Assinado' : (c.status || 'Aguardando Assinatura'),
    })) as ContratoZapsignComStatus[];
  }, [contratos]);

  // Hook para Zapsign
  const { contratos: contratosZapsign, isLoading: loadingZapsign, isFetching: fetchingZapsign, refetch: refetchZapsign } = useZapsignContratos();

  const handleRefreshZapsign = useCallback(async () => {
    const res = await refetchZapsign();
    toast({
      title: 'Contratos atualizados',
      description: `${res.data?.length ?? 0} contratos sincronizados com o ZapSign`,
    });
  }, [refetchZapsign, toast]);

  const fetchContractsFromClicksign = useCallback(async (showLoading = true, showToast = false) => {
    if (showLoading) setLoading(true);
    setRefreshing(!showLoading);
    try {
      const { data, error } = await supabase.functions.invoke('clicksign', {
        body: { action: 'list_documents', page: 1 },
      });
      if (error) throw error;

      const documents = data?.documents || [];
      const docKeys: string[] = documents.map((d: any) => d?.key).filter(Boolean);
      const linksByDocKey = new Map<string, string>();
      const signerByDocKey = new Map<string, string>();
      const leadIdByDocKey = new Map<string, string>();

      // Detecção AMPLA de tráfego + normalização de nome (definidos antes pois
      // já são usados no casamento dos lembretes).
      const TRAFEGO_RE = /tráfego|trafego|meta|facebook|instagram|anúncio|anuncio|\bads\b/i;
      const isTrafego = (l: any) =>
        l?.tipo_origem === 'trafego' || l?.linha_whatsapp === 'trafego_isa' || TRAFEGO_RE.test(l?.origem || '');
      const normName = (s: string) =>
        (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
      const nameKeyOf = (s: string) => {
        const p = normName(s).split(' ').filter(Boolean);
        return p.length < 2 ? '' : `${p[0]} ${p[p.length - 1]}`;
      };

      // VÍNCULO EXATO por lead_id. O Kit é criado pela API v3 (grava lead_id no
      // contract_reminders sob o id v3 do documento), mas a listagem usa a API v1
      // com 'key' diferente → casar por document_key falha (e a coluna Signatário
      // fica vazia). Então buscamos TODOS os lembretes com lead_id e casamos pelo
      // NOME do signatário, que carrega o lead_id exato gravado na criação.
      const leadIdBySignerName = new Map<string, string>();   // normName/nameKey → lead_id
      const linkBySignerName   = new Map<string, string>();
      const signerByNameKey    = new Map<string, string>();
      const allReminderLeadIds = new Set<string>();
      {
        const { data: reminders } = await supabase
          .from('contract_reminders')
          .select('document_key, contract_link, signer_name, document_name, lead_id')
          .order('created_at', { ascending: false })
          .limit(3000);
        for (const r of reminders || []) {
          // por document_key (caso bata) — mantém comportamento antigo
          if (r?.document_key) {
            if (r.contract_link && !linksByDocKey.has(r.document_key)) linksByDocKey.set(r.document_key, r.contract_link);
            if (r.signer_name && !signerByDocKey.has(r.document_key)) signerByDocKey.set(r.document_key, r.signer_name);
            if (r.lead_id && !leadIdByDocKey.has(r.document_key)) leadIdByDocKey.set(r.document_key, r.lead_id);
          }
          // por NOME do signatário → lead_id (contorna o mismatch v1/v3)
          if (r?.lead_id && r?.signer_name) {
            allReminderLeadIds.add(r.lead_id);
            const nn = normName(r.signer_name);
            const k = nameKeyOf(r.signer_name);
            if (nn.length > 3 && !leadIdBySignerName.has(nn)) { leadIdBySignerName.set(nn, r.lead_id); signerByNameKey.set(nn, r.signer_name); if (r.contract_link) linkBySignerName.set(nn, r.contract_link); }
            if (k && !leadIdBySignerName.has(k)) { leadIdBySignerName.set(k, r.lead_id); signerByNameKey.set(k, r.signer_name); if (r.contract_link) linkBySignerName.set(k, r.contract_link); }
          }
        }
      }

      // Busca TODOS os leads e monta os conjuntos de tráfego (email, telefone,
      // nome exato e nome tolerante = primeiro+último). Antes só buscava leads de
      // tráfego literal e casava nome exato → muitos não pegavam a tag.
      const { data: allLeadsData } = await supabase
        .from('leads_juridicos')
        .select('id, nome, email, telefone, tipo_origem, origem, linha_whatsapp');
      const leadById      = new Map<string, any>();
      const leadByEmail   = new Map<string, any>();
      const leadByPhone   = new Map<string, any>();
      const leadByName    = new Map<string, any>();
      const leadByNameKey = new Map<string, any>();
      for (const l of (allLeadsData || []) as any[]) {
        if (l.id) leadById.set(l.id, l);
        if (l.email) { const e = l.email.toLowerCase().trim(); if (e && !leadByEmail.has(e)) leadByEmail.set(e, l); }
        if (l.telefone) { const n = normalizePhone(l.telefone); if (n.length >= 10 && !leadByPhone.has(n)) leadByPhone.set(n, l); }
        if (l.nome) { const nn = normName(l.nome); if (nn && !leadByName.has(nn)) leadByName.set(nn, l); const k = nameKeyOf(l.nome); if (k && !leadByNameKey.has(k)) leadByNameKey.set(k, l); }
      }
      // Mesma regra do ZapSign: lead vinculado de tráfego → 'trafego'; qualquer
      // outro lead vinculado → 'escritorio'; sem lead → 'indefinido'.
      const classifyOrigem = (lead: any): 'trafego' | 'escritorio' | 'indefinido' =>
        !lead ? 'indefinido' : (isTrafego(lead) ? 'trafego' : 'escritorio');

      const mappedContracts: ContratoComStatus[] = documents.map((doc: any) => {
        const key: string | undefined = doc?.key;
        const linkContrato =
          (key && linksByDocKey.get(key)) ||
          (key ? `https://app.clicksign.com/sign/${key}` : 'https://app.clicksign.com');
        const apiSigners = doc.signers || [];
        const apiSignerNames = apiSigners.map((s: any) => s.name).filter(Boolean);
        const pathParts = (doc.path || '').split('/').filter(Boolean);
        const categoria = pathParts.length > 1 ? pathParts[0] : null;
        const leadEmail = doc.signers?.[0]?.email || null;

        // Nomes candidatos limpos (arquivo + signatário), sem sufixo "- contrato N".
        const limpaNome = (raw: string) => normName(
          (raw || '')
            .replace(/\.[^/.]+$/, '')
            .replace(/^Kit\s*[-–—]\s*/i, '')
            .replace(/\s*[-–—]\s*contrato.*$/i, '')
            .replace(/\s*[-–—]\s*\d+\s*$/, ''),
        );
        const candidatos = Array.from(new Set(
          [doc.filename, key ? signerByDocKey.get(key) : null, ...apiSignerNames]
            .map(limpaNome)
            .filter((n) => n.length > 3),
        ));

        // lead_id EXATO: por document_key (se bater) ou pelo NOME do signatário
        // (contorna o mismatch v1/v3). Recupera também o nome do signatário.
        let leadId = key ? leadIdByDocKey.get(key) : undefined;
        let signerFromRemind: string | undefined;
        if (!leadId) {
          for (const nc of candidatos) {
            const lid = leadIdBySignerName.get(nc) || leadIdBySignerName.get(nameKeyOf(nc));
            if (lid) { leadId = lid; signerFromRemind = signerByNameKey.get(nc) || signerByNameKey.get(nameKeyOf(nc)); break; }
          }
        }

        const dbSignerName = (key ? signerByDocKey.get(key) : null) || signerFromRemind || null;
        const signatarioNome = dbSignerName || (apiSignerNames.length > 0 ? apiSignerNames.join(', ') : null);

        // Resolve o LEAD (objeto): por lead_id (exato) → email → telefone → nome
        // do signatário/arquivo. Depois classifica igual ao ZapSign.
        let resolvedLead: any = (leadId && leadById.get(leadId)) || null;
        if (!resolvedLead && leadEmail) resolvedLead = leadByEmail.get(leadEmail.toLowerCase().trim()) || null;
        if (!resolvedLead) {
          const np = normalizePhone(doc.signers?.[0]?.phone_number || '');
          if (np.length >= 10) resolvedLead = leadByPhone.get(np) || null;
        }
        if (!resolvedLead) {
          for (const nc of candidatos) {
            resolvedLead = leadByName.get(nc) || leadByNameKey.get(nameKeyOf(nc)) || null;
            if (resolvedLead) break;
          }
        }
        if (!leadId && resolvedLead?.id) leadId = resolvedLead.id;
        const tipoOrigem = classifyOrigem(resolvedLead);
        return {
          id: key,
          key,
          leadId,
          leadNome: doc.filename?.replace(/\.[^/.]+$/, '') || 'Documento',
          leadEmail,
          signatarioNome,
          tipoAcao: categoria,
          linkContrato,
          status: mapClicksignStatus(doc),
          lastUpdate: doc.updated_at || doc.created_at,
          tipoOrigem,
        };
      });

      mappedContracts.sort((a, b) => {
        if (a.lastUpdate && b.lastUpdate)
          return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
        return 0;
      });

      setContratos(mappedContracts);
      if (showToast)
        toast({ title: 'Contratos atualizados', description: `${mappedContracts.length} documentos encontrados.` });
    } catch (error: any) {
      if (showToast)
        toast({ title: 'Erro ao buscar contratos', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchContractsFromClicksign();
    const interval = setInterval(() => fetchContractsFromClicksign(false), 300000);
    return () => clearInterval(interval);
  }, [fetchContractsFromClicksign]);

  const handleRefresh = () => fetchContractsFromClicksign(false, true);

  const filteredContratos = contratos.filter(c => {
    switch (activeTab) {
      case 'em-processo': return ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'].includes(c.status);
      case 'finalizados':  return ['Assinado', 'Finalizado'].includes(c.status);
      case 'cancelados':   return ['Cancelado', 'Recusado', 'Prazo Expirado'].includes(c.status);
      default: return true;
    }
  });

  const trafegoTotal = contratos.filter(c => c.tipoOrigem === 'trafego').length;

  const kpiData = {
    emProcesso:  contratos.filter(c => ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'].includes(c.status)).length,
    recusados:   contratos.filter(c => c.status === 'Recusado').length,
    finalizados: contratos.filter(c => ['Assinado', 'Finalizado'].includes(c.status)).length,
    cancelados:  contratos.filter(c => ['Cancelado', 'Prazo Expirado'].includes(c.status)).length,
    total: contratos.length,
    trafegoFinalizados: trafegoTotal,
  };

  const getTabCount = (tabId: string) => {
    switch (tabId) {
      case 'todos':       return contratos.length;
      case 'em-processo': return kpiData.emProcesso;
      case 'finalizados': return kpiData.finalizados;
      case 'cancelados':  return kpiData.cancelados;
      default: return null;
    }
  };

  // Determinar se estamos em aba Zapsign
  const isZapsignTab = activeTab.startsWith('zapsign-');
  const isLoading = isZapsignTab ? loadingZapsign : loading;

  // Renderização para Zapsign
  const renderZapsignContent = () => {
    if (activeTab === 'zapsign-modelos') {
      return <ModelosContratos />;
    }
    return (
      <ZapsignContratosTable
        contratos={contratosZapsign}
        isLoading={loadingZapsign}
        activeTab={activeTab}
      />
    );
  };

  // Renderização para Clicksign
  const renderClicksignContent = () => {
    if (activeTab === 'modelos') {
      return <ModelosContratos />;
    }
    return <ContratosTable contratos={filteredContratos} onRefresh={handleRefresh} />;
  };

  return (
    <AppLayout>
      <AppHeader title="Contratos" />

      <div className="flex-1 px-4 md:px-6 lg:px-8 py-5 space-y-5 animate-fade-in overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="h-14 w-14 rounded-2xl bg-[#c9a96e]/10 flex items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#c9a96e]" />
            </div>
            <p className="text-sm text-muted-foreground">Carregando contratos...</p>
          </div>
        ) : (
          <>
            {/* Seletor de Provider */}
            <div className="flex gap-2 items-center">
              <button
                onClick={() => {
                  setProvider('clicksign');
                  setActiveTab('todos');
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  provider === 'clicksign'
                    ? 'bg-[#c9a96e] text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-[#c9a96e]/10'
                )}
              >
                <FileText className="h-4 w-4" />
                Clicksign
              </button>
              <button
                onClick={() => {
                  setProvider('zapsign');
                  setActiveTab('zapsign-todos');
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  provider === 'zapsign'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-cyan-600/10'
                )}
              >
                <Zap className="h-4 w-4" />
                Zapsign
                <Badge variant="outline" className="ml-1 text-xs">Nova</Badge>
              </button>
            </div>

            {/* Conteúdo específico do provider */}
            {isZapsignTab ? (
              <>
                {/* Zapsign Analytics e KPIs */}
                <ZapsignContratosKPIs
                  contratos={contratosZapsign}
                  isLoading={loadingZapsign}
                />

                {/* Ações Zapsign */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setCriarZapsignOpen(true)}
                      size="sm"
                      className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Criar Contrato
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshZapsign}
                    disabled={fetchingZapsign}
                    className="text-muted-foreground gap-2"
                  >
                    <RefreshCw className={cn('h-4 w-4', fetchingZapsign && 'animate-spin')} />
                    {fetchingZapsign ? 'Atualizando...' : 'Atualizar'}
                  </Button>
                </div>

                {/* Tabs Zapsign */}
                <div className="flex gap-1 overflow-x-auto pb-0.5">
                  {TABS_ZAPSIGN.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                          isActive
                            ? 'bg-cyan-600/20 text-cyan-600 shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-cyan-600/8'
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-cyan-600' : tab.color)} />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Conteúdo Zapsign */}
                {renderZapsignContent()}
              </>
            ) : (
              <>
                {/* KPIs no MESMO layout do ZapSign (dados do ClickSign) */}
                <ZapsignContratosKPIs
                  contratos={contratosClicksignKpi}
                  isLoading={loading}
                />

                {/* Ações ClickSign */}
                <div className="flex items-center justify-between">
                  <Button
                    onClick={() => setEnviarModalOpen(true)}
                    size="sm"
                    className="bg-[#c9a96e] hover:bg-[#b8975c] text-white gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Enviar Kit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRefresh()}
                    disabled={refreshing}
                    className="text-muted-foreground gap-2"
                  >
                    <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                    {refreshing ? 'Atualizando...' : 'Atualizar'}
                  </Button>
                </div>

                {/* Tabs Clicksign */}
                <div className="flex gap-1 overflow-x-auto pb-0.5">
                  {TABS_CLICKSIGN.map(tab => {
                    const Icon = tab.icon;
                    const count = getTabCount(tab.id);
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                          isActive
                            ? 'bg-[#3d2b1f] text-[#c9a96e] shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-[#c9a96e]/8'
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-[#c9a96e]' : tab.color)} />
                        <span className="hidden sm:inline">{tab.label}</span>
                        {count !== null && (
                          <span className={cn(
                            'text-[11px] px-1.5 py-0.5 rounded-full font-semibold min-w-[20px] text-center',
                            isActive
                              ? 'bg-[#c9a96e]/20 text-[#c9a96e]'
                              : 'bg-muted text-muted-foreground'
                          )}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Conteúdo Clicksign */}
                {renderClicksignContent()}
              </>
            )}
          </>
        )}
      </div>

      <EnviarKitModal
        isOpen={enviarModalOpen}
        onClose={() => setEnviarModalOpen(false)}
        onSuccess={handleRefresh}
      />

      <CriarContratoZapsignModal
        isOpen={criarZapsignOpen}
        onClose={() => setCriarZapsignOpen(false)}
        onSuccess={() => refetchZapsign()}
      />
    </AppLayout>
  );
}
