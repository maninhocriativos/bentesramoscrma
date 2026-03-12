import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PerfilProvider } from "@/contexts/PerfilContext";

import RequireAuth from "@/components/auth/RequireAuth";

// Lazy-loaded pages
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const LeadsPage = lazy(() => import("./pages/LeadsPage"));
const ProcessosPage = lazy(() => import("./pages/ProcessosPage"));
const ConfiguracoesPage = lazy(() => import("./pages/ConfiguracoesPage"));
const AgendaPage = lazy(() => import("./pages/AgendaPage"));
const FinanceiroPage = lazy(() => import("./pages/FinanceiroPage"));
const DocumentosPage = lazy(() => import("./pages/DocumentosPage"));
const TarefasPage = lazy(() => import("./pages/TarefasPage"));
const ContratosPage = lazy(() => import("./pages/ContratosPage"));
const LeadDetailPage = lazy(() => import("./pages/LeadDetailPage"));
const AssistentePage = lazy(() => import("./pages/AssistentePage"));
const IsaAutonomaPage = lazy(() => import("./pages/IsaAutonomaPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const ApiHubPage = lazy(() => import("./pages/ApiHubPage"));
const ApiDocsPage = lazy(() => import("./pages/ApiDocsPage"));
const MetaLeadsPage = lazy(() => import("./pages/MetaLeadsPage"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PoliticaPrivacidadePage = lazy(() => import("./pages/PoliticaPrivacidadePage"));
const TermosServicoPage = lazy(() => import("./pages/TermosServicoPage"));
const InstallPage = lazy(() => import("./pages/InstallPage"));
const PeticoesPage = lazy(() => import("./pages/PeticoesPage"));
const PeticaoEditarPage = lazy(() => import("./pages/PeticaoEditarPage"));
const PeticaoRevisaoPage = lazy(() => import("./pages/PeticaoRevisaoPage"));
const PeticaoSaidaPage = lazy(() => import("./pages/PeticaoSaidaPage"));
const ModelosPage = lazy(() => import("./pages/ModelosPage"));
const PeticaoModeloEditorPage = lazy(() => import("./pages/PeticaoModeloEditorPage"));
const HistoricoAcessosPage = lazy(() => import("./pages/HistoricoAcessosPage"));
const IntimacoesPage = lazy(() => import("./pages/IntimacoesPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const PageFallback = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PerfilProvider>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Public */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/politica-privacidade" element={<PoliticaPrivacidadePage />} />
              <Route path="/termos-servico" element={<TermosServicoPage />} />
              <Route path="/install" element={<InstallPage />} />

              {/* Protected */}
              <Route element={<RequireAuth />}>
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
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/meta-leads" element={<MetaLeadsPage />} />
                <Route path="/api-hub" element={<ApiHubPage />} />
                <Route path="/api-docs" element={<ApiDocsPage />} />
                <Route path="/peticoes" element={<PeticoesPage />} />
                <Route path="/peticoes/nova" element={<PeticaoEditarPage />} />
                <Route path="/peticoes/:id/editar" element={<PeticaoEditarPage />} />
                <Route path="/peticoes/:id/revisao" element={<PeticaoRevisaoPage />} />
                <Route path="/peticoes/:id/saida" element={<PeticaoSaidaPage />} />
                <Route path="/modelos" element={<ModelosPage />} />
                <Route path="/peticoes/modelo-editor" element={<PeticaoModeloEditorPage />} />
                <Route path="/historico-acessos" element={<HistoricoAcessosPage />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </PerfilProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
