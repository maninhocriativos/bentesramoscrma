import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PerfilProvider } from "@/contexts/PerfilContext";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

import RequireAuth from "@/components/auth/RequireAuth";
import { AppLayoutRoute } from "@/components/layouts/AppLayoutRoute";
import { SystemLockScreen } from "@/components/SystemLockScreen";
import { SYSTEM_LOCK_ENABLED } from "@/config/systemLock";

// Lazy-loaded pages
const DashboardPage            = lazyWithRetry(() => import("./pages/DashboardPage"));
const LeadsPage                = lazyWithRetry(() => import("./pages/LeadsPage"));
const ProcessosPage            = lazyWithRetry(() => import("./pages/ProcessosPage"));
const ConfiguracoesPage        = lazyWithRetry(() => import("./pages/ConfiguracoesPage"));
const AgendaPage               = lazyWithRetry(() => import("./pages/AgendaPage"));
const FinanceiroPage           = lazyWithRetry(() => import("./pages/FinanceiroPage"));
const DocumentosPage           = lazyWithRetry(() => import("./pages/DocumentosPage"));
const TarefasPage              = lazyWithRetry(() => import("./pages/TarefasPage"));
const ContratosPage            = lazyWithRetry(() => import("./pages/ContratosPage"));
const LeadDetailPage           = lazyWithRetry(() => import("./pages/LeadDetailPage"));
const AssistentePage           = lazyWithRetry(() => import("./pages/AssistentePage"));
const IsaAutonomaPage          = lazyWithRetry(() => import("./pages/IsaAutonomaPage"));
const ChatPage                 = lazyWithRetry(() => import("./pages/ChatPage"));
const ApiHubPage               = lazyWithRetry(() => import("./pages/ApiHubPage"));
const ApiDocsPage              = lazyWithRetry(() => import("./pages/ApiDocsPage"));
const MetaLeadsPage            = lazyWithRetry(() => import("./pages/MetaLeadsPage"));
const Auth                     = lazyWithRetry(() => import("./pages/Auth"));
const NotFound                 = lazyWithRetry(() => import("./pages/NotFound"));
const PoliticaPrivacidadePage  = lazyWithRetry(() => import("./pages/PoliticaPrivacidadePage"));
const TermosServicoPage        = lazyWithRetry(() => import("./pages/TermosServicoPage"));
const ExclusaoDadosPage        = lazyWithRetry(() => import("./pages/ExclusaoDadosPage"));
const InstallPage              = lazyWithRetry(() => import("./pages/InstallPage"));
const PeticoesPage             = lazyWithRetry(() => import("./pages/PeticoesPage"));
const PeticaoEditarPage        = lazyWithRetry(() => import("./pages/PeticaoEditarPage"));
const PeticaoRevisaoPage       = lazyWithRetry(() => import("./pages/PeticaoRevisaoPage"));
const PeticaoSaidaPage         = lazyWithRetry(() => import("./pages/PeticaoSaidaPage"));
const ModelosPage              = lazyWithRetry(() => import("./pages/ModelosPage"));
const PeticaoModeloEditorPage  = lazyWithRetry(() => import("./pages/PeticaoModeloEditorPage"));
const HistoricoAcessosPage     = lazyWithRetry(() => import("./pages/HistoricoAcessosPage"));
const HistoricoAtendimentoPage = lazyWithRetry(() => import("./pages/HistoricoAtendimentoPage"));
const IntimacoesPage           = lazyWithRetry(() => import("./pages/IntimacoesPage"));
const BemVindoPage             = lazyWithRetry(() => import("./pages/BemVindoPage"));
const ConferenciaExtratosPage  = lazyWithRetry(() => import("./pages/ConferenciaExtratosPage"));
const GoogleAuthCallback       = lazyWithRetry(() => import("./pages/GoogleAuthCallback"));
const FollowupPage             = lazyWithRetry(() => import("./pages/FollowupPage"));
const DadosPage                = lazyWithRetry(() => import("./pages/DadosPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect:   false,
      refetchOnMount:       false,
      staleTime:            5 * 60 * 1000,
      gcTime:               10 * 60 * 1000,
    },
  },
});

const PageFallback = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

function AppRoutes() {
  useServiceWorkerUpdate();

  return (
    <PerfilProvider>
      <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Public */}
          <Route path="/auth"                  element={<Auth />} />
          <Route path="/politica-privacidade"  element={<PoliticaPrivacidadePage />} />
          <Route path="/termos-servico"        element={<TermosServicoPage />} />
          <Route path="/exclusao-de-dados"     element={<ExclusaoDadosPage />} />
          <Route path="/install"              element={<InstallPage />} />
          <Route path="/google-auth-callback" element={<GoogleAuthCallback />} />

          {/* Protected */}
          <Route element={<RequireAuth />}>
            {/* /chat (ChatInbox) é tela cheia própria, sem AppSidebar — fica fora do AppLayoutRoute */}
            <Route path="/chat"                  element={<ChatPage />} />

            {/* Layout compartilhado: AppSidebar/PresenceProvider/ChatInterno montam uma
                única vez e sobrevivem à troca de rota entre essas páginas. */}
            <Route element={<AppLayoutRoute />}>
              <Route path="/dashboard"              element={<DashboardPage />} />
              <Route path="/leads"                  element={<LeadsPage />} />
              <Route path="/leads/:id"              element={<LeadDetailPage />} />
              <Route path="/processos"             element={<ProcessosPage />} />
              <Route path="/agenda"                element={<AgendaPage />} />
              <Route path="/financeiro"            element={<FinanceiroPage />} />
              <Route path="/documentos"            element={<DocumentosPage />} />
              <Route path="/contratos"             element={<ContratosPage />} />
              <Route path="/tarefas"               element={<TarefasPage />} />
              <Route path="/configuracoes"         element={<ConfiguracoesPage />} />
              <Route path="/assistente"            element={<AssistentePage />} />
              <Route path="/isa-autonoma"          element={<IsaAutonomaPage />} />
              <Route path="/meta-leads"            element={<MetaLeadsPage />} />
              <Route path="/api-hub"               element={<ApiHubPage />} />
              <Route path="/api-docs"              element={<ApiDocsPage />} />
              <Route path="/peticoes"              element={<PeticoesPage />} />
              <Route path="/peticoes/nova"         element={<PeticaoEditarPage />} />
              <Route path="/peticoes/:id/editar"   element={<PeticaoEditarPage />} />
              <Route path="/peticoes/:id/revisao"  element={<PeticaoRevisaoPage />} />
              <Route path="/peticoes/:id/saida"    element={<PeticaoSaidaPage />} />
              <Route path="/modelos"               element={<ModelosPage />} />
              <Route path="/peticoes/modelo-editor" element={<PeticaoModeloEditorPage />} />
              <Route path="/historico-acessos"     element={<HistoricoAcessosPage />} />
              <Route path="/historico-atendimento" element={<HistoricoAtendimentoPage />} />
              <Route path="/intimacoes"            element={<IntimacoesPage />} />
              <Route path="/bem-vindo"             element={<BemVindoPage />} />
              <Route path="/conferencia-extratos"  element={<ConferenciaExtratosPage />} />
              <Route path="/followup"              element={<FollowupPage />} />
              <Route path="/dados"                 element={<DadosPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </PerfilProvider>
  );
}

const UnlockedApp = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

const App = () =>
  SYSTEM_LOCK_ENABLED ? <SystemLockScreen /> : <UnlockedApp />;

export default App;
