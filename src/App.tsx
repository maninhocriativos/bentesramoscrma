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
import LeadDetailPage from "./pages/LeadDetailPage";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
            <Route path="/tarefas" element={<TarefasPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PerfilProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
