import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";

export default function RequireAuth() {
  const location = useLocation();
  const { user, loading } = useAuth();

  // Só mostra loading screen na carga inicial (sem usuário ainda determinado)
  // Após login, loading nunca mais vira true — evita recarregar ao trocar aba
  if (loading) {
    return <AppLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
