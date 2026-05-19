import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { ContratosKPIs } from '@/components/contratos/ContratosKPIs';
import { ContratosAnalytics } from '@/components/contratos/ContratosAnalytics';
import { ContratosTable } from '@/components/contratos/ContratosTable';
import { ModelosContratos } from '@/components/contratos/ModelosContratos';
import { EnviarKitModal } from '@/components/contratos/EnviarKitModal';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileText, FolderOpen, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

const TABS = [
  { id: 'todos',       label: 'Todos',       icon: FileText,     color: 'text-[#c9a96e]'  },
  { id: 'em-processo', label: 'Em Processo', icon: Clock,        color: 'text-amber-500'  },
  { id: 'finalizados', label: 'Finalizados', icon: CheckCircle2, color: 'text-emerald-500' },
  { id: 'cancelados',  label: 'Cancelados',  icon: XCircle,      color: 'text-zinc-400'   },
  { id: 'modelos',     label: 'Modelos',     icon: FolderOpen,   color: 'text-[#c9a96e]'  },
];

export default function ContratosPage() {
  const { toast } = useToast();
  const [contratos, setContratos] = useState<ContratoComStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('todos');
  const [enviarModalOpen, setEnviarModalOpen] = useState(false);

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

      if (docKeys.length > 0) {
        const { data: reminders } = await supabase
          .from('contract_reminders')
          .select('document_key, contract_link, signer_name, document_name, lead_id')
          .in('document_key', docKeys);
        for (const r of reminders || []) {
          if (r?.document_key) {
            if (r.contract_link && !linksByDocKey.has(r.document_key))
              linksByDocKey.set(r.document_key, r.contract_link);
            if (r.signer_name && !signerByDocKey.has(r.document_key))
              signerByDocKey.set(r.document_key, r.signer_name);
            if (r.lead_id && !leadIdByDocKey.has(r.document_key))
              leadIdByDocKey.set(r.document_key, r.lead_id);
          }
        }
      }

      const leadIds = [...new Set(leadIdByDocKey.values())].filter(Boolean);
      const tipoOrigemByLeadId = new Map<string, string>();
      if (leadIds.length > 0) {
        const { data: leadsData } = await supabase
          .from('leads_juridicos')
          .select('id, tipo_origem, origem')
          .in('id', leadIds);
        for (const l of leadsData || []) {
          const isTraffic = l.tipo_origem === 'trafego' || (l.origem || '').includes('Tráfego');
          if (isTraffic) tipoOrigemByLeadId.set(l.id, 'trafego');
          else if (l.tipo_origem) tipoOrigemByLeadId.set(l.id, l.tipo_origem);
        }
      }

      // Busca todos os leads de tráfego para matching por email e nome
      const { data: trafegoLeadsData } = await supabase
        .from('leads_juridicos')
        .select('nome, email')
        .or('tipo_origem.eq.trafego,origem.ilike.*Tráfego*');
      const trafegoEmailSet = new Set<string>();
      const trafegoNomeSet  = new Set<string>();
      for (const l of (trafegoLeadsData || []) as any[]) {
        if (l.email) trafegoEmailSet.add(l.email.toLowerCase().trim());
        if (l.nome)  trafegoNomeSet.add(l.nome.toLowerCase().trim());
      }

      const mappedContracts: ContratoComStatus[] = documents.map((doc: any) => {
        const key: string | undefined = doc?.key;
        const linkContrato =
          (key && linksByDocKey.get(key)) ||
          (key ? `https://app.clicksign.com/sign/${key}` : 'https://app.clicksign.com');
        const dbSignerName = key ? signerByDocKey.get(key) : null;
        const apiSigners = doc.signers || [];
        const apiSignerNames = apiSigners.map((s: any) => s.name).filter(Boolean);
        const signatarioNome = dbSignerName || (apiSignerNames.length > 0 ? apiSignerNames.join(', ') : null);
        const pathParts = (doc.path || '').split('/').filter(Boolean);
        const categoria = pathParts.length > 1 ? pathParts[0] : null;
        const leadEmail = doc.signers?.[0]?.email || null;
        const leadId = key ? leadIdByDocKey.get(key) : undefined;

        // Determina origem: via lead_id → email → nome extraído do filename
        const tipoOrigem = (() => {
          if (leadId && tipoOrigemByLeadId.has(leadId)) return tipoOrigemByLeadId.get(leadId)!;
          if (leadEmail && trafegoEmailSet.has(leadEmail.toLowerCase().trim())) return 'trafego';
          const nomeFull = (doc.filename?.replace(/\.[^/.]+$/, '') || '');
          const nomeCliente = nomeFull.replace(/^Kit\s*[-–—]\s*/i, '').trim().toLowerCase();
          if (nomeCliente.length > 3 && trafegoNomeSet.has(nomeCliente)) return 'trafego';
          return null;
        })();
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

  return (
    <AppLayout>
      <AppHeader title="Contratos" />

      <div className="flex-1 px-4 md:px-6 lg:px-8 py-5 space-y-5 animate-fade-in overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="h-14 w-14 rounded-2xl bg-[#c9a96e]/10 flex items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#c9a96e]" />
            </div>
            <p className="text-sm text-muted-foreground">Carregando contratos...</p>
          </div>
        ) : (
          <>
            {/* Analytics de Contratos */}
            <ContratosAnalytics contratos={contratos} />

            {/* KPIs com gráfico */}
            <ContratosKPIs
              data={kpiData}
              onRefresh={handleRefresh}
              onSendContract={() => setEnviarModalOpen(true)}
              refreshing={refreshing}
            />

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {TABS.map(tab => {
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

            {/* Conteúdo da tab */}
            {activeTab === 'modelos'
              ? <ModelosContratos />
              : <ContratosTable contratos={filteredContratos} onRefresh={handleRefresh} />
            }
          </>
        )}
      </div>

      <EnviarKitModal
        isOpen={enviarModalOpen}
        onClose={() => setEnviarModalOpen(false)}
        onSuccess={handleRefresh}
      />
    </AppLayout>
  );
}
