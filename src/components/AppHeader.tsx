import { LogOut, Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';

interface AppHeaderProps {
  title: string;
  onNewItem?: () => void;
  newItemLabel?: string;
}

export function AppHeader({ title, onNewItem, newItemLabel = 'Novo' }: AppHeaderProps) {
  const { signOut, user } = useAuth();
  const { cargo } = usePerfil();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const cargoColors: Record<string, string> = {
    'Administrador': 'bg-primary text-primary-foreground',
    'Advogado': 'bg-accent text-accent-foreground',
    'Secretaria': 'bg-muted text-muted-foreground',
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-card/80 backdrop-blur-md border-b border-border">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="md:hidden" />
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          {onNewItem && (
            <Button 
              onClick={onNewItem}
              className="rounded-xl bg-primary hover:bg-primary/90 shadow-soft"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              {newItemLabel}
            </Button>
          )}
          
          {user && (
            <div className="flex items-center gap-3">
              <Badge className={`${cargoColors[cargo] || cargoColors['Secretaria']} rounded-lg`}>
                {cargo}
              </Badge>
              <span className="text-sm text-muted-foreground hidden lg:block">
                {user.email}
              </span>
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleSignOut}
                className="rounded-xl border-border hover:bg-muted"
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
