import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePerfil } from '@/hooks/usePerfil';
import { Users, Shield, Database } from 'lucide-react';

export default function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { canAccessSettings, loading } = usePerfil();

  useEffect(() => {
    if (!loading && !canAccessSettings) {
      navigate('/dashboard');
    }
  }, [canAccessSettings, loading, navigate]);

  if (!canAccessSettings) {
    return null;
  }

  return (
    <AppLayout>
      <AppHeader title="Configurações" />
      
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="rounded-xl shadow-soft hover:shadow-soft-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Usuários</CardTitle>
                  <CardDescription>Gerenciar usuários do sistema</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Adicione, edite ou remova usuários e defina seus cargos.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-soft hover:shadow-soft-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/20">
                  <Shield className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Permissões</CardTitle>
                  <CardDescription>Controle de acesso</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure as permissões para cada cargo do sistema.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-soft hover:shadow-soft-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Database className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Dados</CardTitle>
                  <CardDescription>Backup e exportação</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Exporte dados e faça backup das informações do sistema.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl shadow-soft">
          <CardHeader>
            <CardTitle>Hierarquia de Cargos</CardTitle>
            <CardDescription>Permissões de cada cargo no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <h4 className="font-semibold text-primary">Administrador</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Acesso total: pode ver tudo, cadastrar, editar e excluir leads e processos. Acesso às configurações.
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                <h4 className="font-semibold text-accent-foreground">Advogado</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Acesso restrito: vê apenas os processos onde é advogado responsável. Pode cadastrar e editar.
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-muted border border-border">
                <h4 className="font-semibold text-muted-foreground">Secretaria</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Acesso operacional: pode cadastrar e editar leads e processos, mas não pode excluir.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
