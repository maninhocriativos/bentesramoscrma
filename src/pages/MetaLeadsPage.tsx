import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { MetaLeadsHeader } from '@/components/meta-leads/MetaLeadsHeader';
import { MetaLeadsList } from '@/components/meta-leads/MetaLeadsList';
import { MetaLeadDetail } from '@/components/meta-leads/MetaLeadDetail';
import { useMetaFormLeads, useMetaFormChat } from '@/hooks/useMetaFormLeads';
import { MetaFormLead, MetaFormLeadStatus } from '@/types/metaFormLeads';
import { Loader2 } from 'lucide-react';

type ViewMode = 'list' | 'detail';

export default function MetaLeadsPage() {
  const { leads, loading, syncing, syncError, formIds, fetchLeads, syncFromMeta, updateLeadStatus } = useMetaFormLeads();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<MetaFormLeadStatus | 'all'>('all');
  const [filterFormId, setFilterFormId] = useState<string | 'all'>('all');
  const [selectedLead, setSelectedLead] = useState<MetaFormLead | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  const { messages, loading: messagesLoading } = useMetaFormChat(
    selectedLead?.id || null
  );

  // Filter leads
  const filteredLeads = useMemo(() => {
    let result = [...leads];

    if (filterStatus !== 'all') {
      result = result.filter((l) => l.status === filterStatus);
    }

    if (filterFormId !== 'all') {
      result = result.filter((l) => l.form_id === filterFormId);
    }

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (l) =>
          (l.nome?.toLowerCase() || '').includes(searchLower) ||
          (l.email?.toLowerCase() || '').includes(searchLower) ||
          (l.telefone || '').includes(search)
      );
    }

    return result;
  }, [leads, filterStatus, filterFormId, search]);

  const handleSelectLead = (lead: MetaFormLead) => {
    setSelectedLead(lead);
    setViewMode('detail');
  };

  const handleBackToList = () => {
    setSelectedLead(null);
    setViewMode('list');
  };

  const handleUpdateStatus = async (status: MetaFormLeadStatus) => {
    if (selectedLead) {
      await updateLeadStatus(selectedLead.id, status);
      setSelectedLead({ ...selectedLead, status });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando leads...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        <MetaLeadsHeader
          search={search}
          onSearchChange={setSearch}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          filterFormId={filterFormId}
          onFilterFormIdChange={setFilterFormId}
          formIds={formIds}
          totalLeads={filteredLeads.length}
          onRefresh={fetchLeads}
          onSync={syncFromMeta}
          syncing={syncing}
          syncError={syncError}
          leads={filteredLeads}
        />

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - List */}
          <div 
            className={`w-full md:w-[400px] border-r flex flex-col ${
              viewMode !== 'list' ? 'hidden md:flex' : ''
            }`}
          >
            <MetaLeadsList
              leads={filteredLeads}
              selectedId={selectedLead?.id || null}
              onSelect={handleSelectLead}
            />
          </div>

          {/* Right Panel - Detail */}
          <div 
            className={`flex-1 flex flex-col ${
              viewMode === 'list' ? 'hidden md:flex' : ''
            }`}
          >
            {!selectedLead ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">Selecione um lead</p>
                  <p className="text-sm">Clique em um lead na lista para ver os detalhes completos</p>
                </div>
              </div>
            ) : (
              <MetaLeadDetail
                lead={selectedLead}
                messages={messages}
                messagesLoading={messagesLoading}
                onUpdateStatus={handleUpdateStatus}
              />
            )}

            {viewMode !== 'list' && (
              <div className="md:hidden p-3 border-t">
                <button
                  onClick={handleBackToList}
                  className="text-sm text-primary underline"
                >
                  ← Voltar para lista
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
