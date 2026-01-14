import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PerfilProvider } from "@/contexts/PerfilContext";
import DashboardPage from "./pages/DashboardPage";
import LeadsPage from "./pages/LeadsPage";
import ProcessosPage from "./pages/ProcessosPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import AgendaPage from "./pages/AgendaPage";
import FinanceiroPage from "./pages/FinanceiroPage";
import DocumentosPage from "./pages/DocumentosPage";

import TarefasPage from "./pages/TarefasPage";
import ContratosPage from "./pages/ContratosPage";
import LeadDetailPage from "./pages/LeadDetailPage";
import AssistentePage from "./pages/AssistentePage";
import IsaAutonomaPage from "./pages/IsaAutonomaPage";
import ManyChatPage from "./pages/ManyChatPage";
import ApiHubPage from "./pages/ApiHubPage";
import ApiDocsPage from "./pages/ApiDocsPage";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import PoliticaPrivacidadePage from "./pages/PoliticaPrivacidadePage";
import TermosServicoPage from "./pages/TermosServicoPage";
import InstallPage from "./pages/InstallPage";
import PeticoesPage from "./pages/PeticoesPage";
import PeticaoEditarPage from "./pages/PeticaoEditarPage";
import PeticaoRevisaoPage from "./pages/PeticaoRevisaoPage";
import PeticaoSaidaPage from "./pages/PeticaoSaidaPage";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutos
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PerfilProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/processos" element={<ProcessosPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route path="/documentos" element={<DocumentosPage />} />
            
            <Route path="/contratos" element={<ContratosPage />} />
            <Route path="/tarefas" element={<TarefasPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/assistente" element={<AssistentePage />} />
            <Route path="/isa-autonoma" element={<IsaAutonomaPage />} />
            <Route path="/manychat" element={<ManyChatPage />} />
            <Route path="/api-hub" element={<ApiHubPage />} />
            <Route path="/api-docs" element={<ApiDocsPage />} />
            <Route path="/peticoes" element={<PeticoesPage />} />
            <Route path="/peticoes/nova" element={<PeticaoEditarPage />} />
            <Route path="/peticoes/:id/editar" element={<PeticaoEditarPage />} />
            <Route path="/peticoes/:id/revisao" element={<PeticaoRevisaoPage />} />
            <Route path="/peticoes/:id/saida" element={<PeticaoSaidaPage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/politica-privacidade" element={<PoliticaPrivacidadePage />} />
            <Route path="/termos-servico" element={<TermosServicoPage />} />
            <Route path="/install" element={<InstallPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PerfilProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
