import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronRight, Sparkles } from 'lucide-react';
import { usePerfil } from '@/hooks/usePerfil';
import { useAuth } from '@/hooks/useAuth';
import { menuSections, canShowMenuItem } from '@/config/navigation';

// Tabs primárias já cobertas pela MobileTabBar — evita duplicar no "Mais".
const PRIMARY_URLS = new Set(['/dashboard', '/bem-vindo', '/processos', '/leads', '/chat', '/intimacoes']);

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMoreSheet({ open, onOpenChange }: MobileMoreSheetProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const {
    canAccessSettings, canAccessProcessos, canAccessLeads,
    canAccessDashboard, canAccessFinanceiro, canAccessPage, pagePermissions,
    fullName, cargo,
  } = usePerfil();

  const flags = {
    canAccessSettings, canAccessProcessos, canAccessLeads,
    canAccessDashboard, canAccessFinanceiro, canAccessPage, pagePermissions,
  };

  const handleNavigate = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };

  const handleSignOut = async () => {
    onOpenChange(false);
    await signOut();
    navigate('/auth');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] overflow-hidden flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 text-left">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <span className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </span>
            {fullName || 'Menu'}
            {cargo && <span className="text-xs font-normal text-muted-foreground">· {cargo}</span>}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {menuSections.map((section) => {
            const items = section.items.filter(
              (item) => !PRIMARY_URLS.has(item.url) && canShowMenuItem(flags, item.visibility, item.url)
            );
            if (items.length === 0) return null;
            return (
              <div key={section.label} className="mb-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 px-1 mb-1.5">
                  {section.label}
                </div>
                <div className="rounded-2xl bg-muted/40 overflow-hidden">
                  {items.map((item, i) => (
                    <button
                      key={item.url}
                      onClick={() => handleNavigate(item.url)}
                      className="w-full flex items-center gap-3 px-3 py-3 text-left border-b border-border/60 last:border-b-0 active:bg-muted/70"
                    >
                      <item.icon className="h-[18px] w-[18px] text-primary shrink-0" />
                      <span className="flex-1 text-sm text-foreground">{item.title}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl bg-destructive/10 text-destructive font-medium text-sm mt-2"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sair
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
