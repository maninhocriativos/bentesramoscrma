import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { ContratosKPIs } from '@/components/contratos/ContratosKPIs';
import { ContratosTable } from '@/components/contratos/ContratosTable';
import { ModelosContratos } from '@/components/contratos/ModelosContratos';
import { GerarContratoModal } from '@/components/contratos/GerarContratoModal';
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

// Map Clicksign status to our status
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
  { id: 'todos', label: 'Todos', icon: FileText },
  { id: 'em-processo', label: 'Em Processo', icon: Clock },
  { id: 'finalizados', label: 'Finalizados', icon: CheckCircle2 },
  { id: 'cancelados', label: 'Cancelados', icon: XCircle },
  { id: 'modelos', label: 'Modelos', icon: FolderOpen },
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

      if (error) {
        console.error('Error fetching from Clicksign:', error);
        throw error;
      }

      const documents = data?.documents || [];
      const docKeys: string[] = documents.map((d: any) => d?.key).filter(Boolean);
      const linksByDocKey = new Map<string, string>();
      const signerByDocKey = new Map<string, string>();
      const leadIdByDocKey = new Map<string, string>();

      if (docKeys.length > 0) {
        const { data: reminders, error: remindersError } = await supabase
          .from('contract_reminders')
          .select('document_key, contract_link, signer_name, document_name, lead_id')
          .in('document_key', docKeys);

        if (remindersError) {
          console.warn('Could not load contract data from DB:', remindersError);
        } else {
          for (const r of reminders || []) {
            if (r?.document_key) {
              if (r.contract_link && !linksByDocKey.has(r.document_key)) {
                linksByDocKey.set(r.document_key, r.contract_link);
              }
              if (r.signer_name && !signerByDocKey.has(r.document_key)) {
                signerByDocKey.set(r.document_key, r.signer_name);
              }
              if (r.lead_id && !leadIdByDocKey.has(r.document_key)) {
                leadIdByDocKey.set(r.document_key, r.lead_id);
              }
            }
          }
        }
      }

      // Fetch tipo_origem for linked leads
      const leadIds = [...new Set(leadIdByDocKey.values())].filter(Boolean);
      const tipoOrigemByLeadId = new Map<string, string>();
      if (leadIds.length > 0) {
        const { data: leadsData } = await supabase
          .from('leads_juridicos')
          .select('id, tipo_origem')
          .in('id', leadIds);
        for (const l of leadsData || []) {
          if (l.tipo_origem) tipoOrigemByLeadId.set(l.id, l.tipo_origem);
        }
      }

      // Fallback: for documents without lead_id, try to match by signer phone/email
      const unmatchedDocs = documents.filter((doc: any) => {
        const key = doc?.key;
        return key && !leadIdByDocKey.has(key);
      });

      if (unmatchedDocs.length > 0) {
        // Collect signer emails and phones from unmatched docs
        const signerEmails: string[] = [];
        const signerPhones: string[] = [];
        for (const doc of unmatchedDocs) {
          for (const s of doc.signers || []) {
            if (s.email) signerEmails.push(s.email.toLowerCase());
            if (s.phone_number) {
              const cleaned = String(s.phone_number).replace(/\D/g, '');
              if (cleaned.length >= 10) signerPhones.push(cleaned);
            }
          }
        }

        // Search leads by email or phone
        const fallbackLeads: Array<{ id: string; tipo_origem: string | null; email: string | null; telefone: string | null }> = [];
        if (signerEmails.length > 0) {
          const { data } = await supabase
            .from('leads_juridicos')
            .select('id, tipo_origem, email, telefone')
            .in('email', signerEmails);
          if (data) fallbackLeads.push(...data);
        }
        if (signerPhones.length > 0) {
          // Try matching by phone suffix (last 8-9 digits)
          const suffixes = signerPhones.map(p => p.slice(-9));
          for (const suffix of suffixes) {
            const { data } = await supabase
              .from('leads_juridicos')
              .select('id, tipo_origem, email, telefone')
              .like('telefone', `%${suffix}`);
            if (data) fallbackLeads.push(...data);
          }
        }

        // Build lookup maps from fallback results
        const tipoOrigemByEmail = new Map<string, { leadId: string; tipoOrigem: string }>();
        const tipoOrigemByPhoneSuffix = new Map<string, { leadId: string; tipoOrigem: string }>();
        for (const l of fallbackLeads) {
          if (l.tipo_origem) {
            if (l.email) tipoOrigemByEmail.set(l.email.toLowerCase(), { leadId: l.id, tipoOrigem: l.tipo_origem });
            if (l.telefone) {
              const suffix = l.telefone.replace(/\D/g, '').slice(-9);
              tipoOrigemByPhoneSuffix.set(suffix, { leadId: l.id, tipoOrigem: l.tipo_origem });
            }
          }
        }

        // Assign to unmatched documents
        for (const doc of unmatchedDocs) {
          const key = doc?.key;
          if (!key) continue;
          for (const s of doc.signers || []) {
            if (s.email) {
              const match = tipoOrigemByEmail.get(s.email.toLowerCase());
              if (match) {
                leadIdByDocKey.set(key, match.leadId);
                tipoOrigemByLeadId.set(match.leadId, match.tipoOrigem);
                break;
              }
            }
            if (s.phone_number) {
              const suffix = String(s.phone_number).replace(/\D/g, '').slice(-9);
              const match = tipoOrigemByPhoneSuffix.get(suffix);
              if (match) {
                leadIdByDocKey.set(key, match.leadId);
                tipoOrigemByLeadId.set(match.leadId, match.tipoOrigem);
                break;
              }
            }
          }
        }
      }

      const mappedContracts: ContratoComStatus[] = documents.map((doc: any) => {
        const key: string | undefined = doc?.key;
        const linkContrato = (key && linksByDocKey.get(key)) || (key ? `https://app.clicksign.com/sign/${key}` : 'https://app.clicksign.com');
        const dbSignerName = key ? signerByDocKey.get(key) : null;
        const apiSigners = doc.signers || [];
        const apiSignerNames = apiSigners.map((s: any) => s.name).filter(Boolean);
        const signatarioNome = dbSignerName || (apiSignerNames.length > 0 ? apiSignerNames.join(', ') : null);
        const pathParts = (doc.path || '').split('/').filter(Boolean);
        const categoria = pathParts.length > 1 ? pathParts[0] : null;
        const leadEmail = doc.signers?.[0]?.email || null;
        const leadId = key ? leadIdByDocKey.get(key) : undefined;
        const tipoOrigem = leadId ? tipoOrigemByLeadId.get(leadId) || null : null;
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
        if (a.lastUpdate && b.lastUpdate) {
          return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
        }
        return 0;
      });

      setContratos(mappedContracts);
      
      if (showToast) {
        toast({ title: 'Contratos atualizados', description: `${mappedContracts.length} documentos encontrados.` });
      }
    } catch (error: any) {
      console.error('Error fetching contracts:', error);
      if (showToast) {
        toast({ title: 'Erro ao buscar contratos', description: error.message || 'Não foi possível conectar ao Clicksign.', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchContractsFromClicksign();
    const interval = setInterval(() => { fetchContractsFromClicksign(false); }, 300000);
    return () => clearInterval(interval);
  }, [fetchContractsFromClicksign]);

  const handleRefresh = () => { fetchContractsFromClicksign(false, true); };

  const filteredContratos = contratos.filter(contrato => {
    switch (activeTab) {
      case 'em-processo':
        return ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'].includes(contrato.status);
      case 'finalizados':
        return ['Assinado', 'Finalizado'].includes(contrato.status);
      case 'cancelados':
        return ['Cancelado', 'Recusado', 'Prazo Expirado'].includes(contrato.status);
      default:
        return true;
    }
  });

  const trafegoFinalizados = contratos.filter(c => c.tipoOrigem === 'trafego' && ['Assinado', 'Finalizado'].includes(c.status)).length;

  const kpiData = {
    emProcesso: contratos.filter(c => ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'].includes(c.status)).length,
    recusados: contratos.filter(c => c.status === 'Recusado').length,
    finalizados: contratos.filter(c => ['Assinado', 'Finalizado'].includes(c.status)).length,
    cancelados: contratos.filter(c => ['Cancelado', 'Prazo Expirado'].includes(c.status)).length,
    total: contratos.length,
    trafegoFinalizados,
  };

  const getTabCount = (tabId: string) => {
    switch (tabId) {
      case 'todos': return contratos.length;
      case 'em-processo': return kpiData.emProcesso;
      case 'finalizados': return kpiData.finalizados;
      case 'cancelados': return kpiData.cancelados;
      case 'modelos': return null;
      default: return null;
    }
  };

  return (
    <AppLayout>
      <AppHeader title="Contratos" />
      
      <div className="flex-1 px-4 md:px-6 lg:px-8 py-4 space-y-4 animate-fade-in overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando contratos...</p>
          </div>
        ) : (
          <>
            {/* KPI Bar + Actions */}
            <ContratosKPIs
              data={kpiData}
              onRefresh={handleRefresh}
              onSendContract={() => setEnviarModalOpen(true)}
              refreshing={refreshing}
            />

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 bg-muted/50 rounded-lg overflow-x-auto">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const count = getTabCount(tab.id);
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all",
                      isActive
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {count !== null && (
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full",
                        isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            {activeTab === 'modelos' ? (
              <ModelosContratos />
            ) : (
              <ContratosTable contratos={filteredContratos} />
            )}
          </>
        )}
      </div>

      <GerarContratoModal
        isOpen={enviarModalOpen}
        onClose={() => setEnviarModalOpen(false)}
        onSuccess={handleRefresh}
      />
    </AppLayout>
  );
}
