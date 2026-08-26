import { Outlet } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';

// Layout de rota compartilhado: hoisted uma única vez em App.tsx pra que
// AppSidebar/PresenceProvider/ChatInterno não remontem a cada navegação
// (antes, cada página envolvia seu próprio <AppLayout>, e trocar de rota
// trocava o elemento inteiro, derrubando e recriando tudo isso sempre).
export function AppLayoutRoute() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
