import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { PageTransition } from '@/components/layouts/PageTransition';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { Loader2, Menu } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: perfilLoading, needsOnboarding } = usePerfil();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || perfilLoading) {
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
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
          {/* Mobile trigger - only visible on small screens */}
          <div className="flex items-center gap-2 p-2 border-b border-border md:hidden">
            <SidebarTrigger className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
          </div>
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>
      
      {needsOnboarding && <OnboardingModal />}
    </SidebarProvider>
  );
}
