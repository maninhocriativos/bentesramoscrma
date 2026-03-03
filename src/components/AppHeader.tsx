import { LogOut, Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { NotificacoesBell } from '@/components/NotificacoesBell';

interface AppHeaderProps {
  title: string;
  onNewItem?: () => void;
  newItemLabel?: string;
}

export function AppHeader({ title, onNewItem, newItemLabel = 'Novo' }: AppHeaderProps) {
  const { signOut, user } = useAuth();
  const { cargo, fullName } = usePerfil();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const cargoColors: Record<string, string> = {
    'Administrador': 'bg-primary text-primary-foreground',
    'Gerente': 'bg-gold text-gold-foreground',
    'Advogado': 'bg-secondary text-secondary-foreground',
    'Secretaria': 'bg-muted text-muted-foreground',
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-card/80 backdrop-blur-md border-b border-border">
      <div className="flex h-14 md:h-16 items-center justify-between px-3 md:px-6 gap-2">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <SidebarTrigger className="md:hidden shrink-0" />
          <h1 className="text-base md:text-xl font-semibold text-foreground truncate">{title}</h1>
        </div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {onNewItem && (
            <Button 
              onClick={onNewItem}
              className="rounded-xl bg-primary hover:bg-primary/90 shadow-soft h-8 md:h-9 px-2.5 md:px-4"
              size="sm"
            >
              <Plus className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">{newItemLabel}</span>
            </Button>
          )}
          
          {user && (
            <div className="flex items-center gap-1.5 md:gap-3">
              <NotificacoesBell />
              <Badge className={`${cargoColors[cargo] || cargoColors['Secretaria']} rounded-lg text-[10px] md:text-xs px-1.5 md:px-2.5`}>
                {cargo}
              </Badge>
              <span className="text-sm text-muted-foreground hidden lg:block">
                {fullName || user.email}
              </span>
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleSignOut}
                className="rounded-xl border-border hover:bg-muted h-8 w-8 md:h-10 md:w-10"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
