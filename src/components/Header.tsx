import { LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo-bentes-ramos.png';

interface HeaderProps {
  onNewLead?: () => void;
}

export function Header({ onNewLead }: HeaderProps) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-50 w-full glass shadow-soft">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img 
            src={logo} 
            alt="Bentes Ramos" 
            className="h-[60px] w-auto object-contain"
          />
        </div>

        <div className="flex items-center gap-3">
          {onNewLead && (
            <Button 
              onClick={onNewLead}
              className="rounded-xl bg-primary hover:bg-primary/90 shadow-soft"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Lead
            </Button>
          )}
          
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:block">
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
