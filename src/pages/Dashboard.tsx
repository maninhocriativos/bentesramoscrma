import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { KPICards } from '@/components/dashboard/KPICards';
import { Charts } from '@/components/dashboard/Charts';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { LeadModal } from '@/components/LeadModal';
import { useAuth } from '@/hooks/useAuth';
import { useLeads } from '@/hooks/useLeads';
import { Lead } from '@/types/leads';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { leads, loading: leadsLoading } = useLeads();
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewLead, setIsNewLead] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsNewLead(false);
    setIsModalOpen(true);
  };

  const handleNewLead = () => {
    setSelectedLead(null);
    setIsNewLead(true);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLead(null);
    setIsNewLead(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onNewLead={handleNewLead} />
      
      <main className="container mx-auto px-4 py-6">
        {leadsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <KPICards leads={leads} />
            <Charts leads={leads} />
            
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-4">Pipeline de Leads</h2>
              <KanbanBoard leads={leads} onLeadClick={handleLeadClick} />
            </div>
          </>
        )}
      </main>

      <LeadModal
        lead={selectedLead}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        isNew={isNewLead}
      />
    </div>
  );
}
