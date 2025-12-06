import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePerfil } from '@/hooks/usePerfil';
import { UsersTable } from '@/components/configuracoes/UsersTable';
import { SystemStatusTab } from '@/components/configuracoes/SystemStatusTab';
import { Users, Server, Shield } from 'lucide-react';

export default function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { canAccessSettings, loading } = usePerfil();

  useEffect(() => {
    if (!loading && !canAccessSettings) {
      navigate('/dashboard');
    }
  }, [canAccessSettings, loading, navigate]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse text-muted-foreground">Carregando...</div>
        </div>
      </AppLayout>
    );
  }

  if (!canAccessSettings) {
    return null;
  }

  return (
    <AppLayout>
      <AppHeader title="Configurações" />
      
      <div className="flex-1 p-4 md:p-6">
        <Tabs defaultValue="usuarios" className="space-y-6">
          <TabsList className="rounded-xl">
            <TabsTrigger value="usuarios" className="rounded-lg gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="sistema" className="rounded-lg gap-2">
              <Server className="h-4 w-4" />
              Sistema
            </TabsTrigger>
            <TabsTrigger value="permissoes" className="rounded-lg gap-2">
              <Shield className="h-4 w-4" />
              Permissões
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios" className="space-y-4">
            <Card className="rounded-xl shadow-soft">
              <CardHeader>
                <CardTitle>Gerenciar Usuários</CardTitle>
                <CardDescription>
                  Visualize e edite os usuários cadastrados no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UsersTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sistema">
            <SystemStatusTab />
          </TabsContent>

          <TabsContent value="permissoes" className="space-y-4">
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
                      Acesso total: pode ver tudo, cadastrar, editar e excluir leads e processos. Acesso às configurações e gerenciamento de usuários.
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-secondary/20 border border-secondary/30">
                    <h4 className="font-semibold text-secondary-foreground">Advogado</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Acesso restrito: vê apenas os processos onde é advogado responsável. Pode cadastrar e editar leads e seus próprios processos.
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-muted border border-border">
                    <h4 className="font-semibold text-muted-foreground">Secretaria</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Acesso operacional: pode cadastrar e editar leads e processos, mas não pode excluir. Sem acesso às configurações.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
