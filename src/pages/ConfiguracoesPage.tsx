import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePerfil } from '@/hooks/usePerfil';
import { UsersTable } from '@/components/configuracoes/UsersTable';
import { SystemStatusTab } from '@/components/configuracoes/SystemStatusTab';
import { IntegracoesTab } from '@/components/configuracoes/IntegracoesTab';
import { OfficeSettingsTab } from '@/components/configuracoes/OfficeSettingsTab';
import { IsaPromptEditor } from '@/components/configuracoes/IsaPromptEditor';
import { ZApiInstancesManager } from '@/components/configuracoes/ZApiInstancesManager';
import { FiqOnIntegrationCard } from '@/components/configuracoes/FiqOnIntegrationCard';
import { Users, Server, Shield, Plug, Building2, Bot } from 'lucide-react';

export default function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { canAccessSettings, loading, roles } = usePerfil();

  

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

  console.log('ConfiguracoesPage: Rendering full page');

  return (
    <AppLayout>
      <AppHeader title="Configurações" />
      
      <div className="flex-1 p-4 md:p-6 animate-fade-in">
        <Tabs defaultValue="usuarios" className="space-y-6">
          <TabsList className="rounded-xl bg-card shadow-soft p-1 h-auto flex-wrap">
            <TabsTrigger 
              value="escritorio" 
              className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 px-4"
            >
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Escritório</span>
            </TabsTrigger>
            <TabsTrigger 
              value="usuarios" 
              className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 px-4"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger 
              value="integracoes" 
              className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 px-4"
            >
              <Plug className="h-4 w-4" />
              <span className="hidden sm:inline">Integrações & API</span>
            </TabsTrigger>
            <TabsTrigger 
              value="sistema" 
              className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 px-4"
            >
              <Server className="h-4 w-4" />
              <span className="hidden sm:inline">Sistema</span>
            </TabsTrigger>
            <TabsTrigger 
              value="permissoes" 
              className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 px-4"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Permissões</span>
            </TabsTrigger>
            <TabsTrigger 
              value="isa" 
              className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 px-4"
            >
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Isa IA</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="escritorio" className="animate-fade-in">
            <OfficeSettingsTab />
          </TabsContent>

          <TabsContent value="usuarios" className="space-y-4 animate-fade-in">
            <Card className="rounded-xl shadow-enterprise border-0 overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground">
                <CardTitle className="text-lg">Gerenciar Usuários</CardTitle>
                <CardDescription className="text-primary-foreground/70">
                  Visualize e edite os usuários cadastrados no sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <UsersTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integracoes" className="animate-fade-in space-y-6">
            <IntegracoesTab />
            <ZApiInstancesManager />
            <FiqOnIntegrationCard />
          </TabsContent>

          <TabsContent value="sistema" className="animate-fade-in">
            <SystemStatusTab />
          </TabsContent>

          <TabsContent value="permissoes" className="space-y-4 animate-fade-in">
            <Card className="rounded-xl shadow-enterprise border-0 overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground">
                <CardTitle className="text-lg">Hierarquia de Cargos</CardTitle>
                <CardDescription className="text-primary-foreground/70">
                  Permissões de cada cargo no sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 shadow-soft">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-3 h-3 rounded-full bg-primary"></div>
                      <h4 className="font-semibold text-primary">Administrador</h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Acesso total: pode ver tudo, cadastrar, editar e excluir leads e processos. Acesso às configurações e gerenciamento de usuários.
                    </p>
                  </div>
                  
                  <div className="p-5 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/30 shadow-soft">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-3 h-3 rounded-full bg-gold"></div>
                      <h4 className="font-semibold text-foreground">Gerente</h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Acesso gerencial: visualiza todos os leads e dashboard. Não tem acesso a processos jurídicos. Pode gerenciar equipe comercial.
                    </p>
                  </div>
                  
                  <div className="p-5 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/5 border border-secondary/30 shadow-soft">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-3 h-3 rounded-full bg-secondary"></div>
                      <h4 className="font-semibold text-foreground">Advogado</h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Acesso restrito: vê apenas os processos onde é advogado responsável. Pode cadastrar e editar leads e seus próprios processos.
                    </p>
                  </div>
                  
                  <div className="p-5 rounded-xl bg-gradient-to-br from-muted to-muted/50 border border-border shadow-soft">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-3 h-3 rounded-full bg-muted-foreground/50"></div>
                      <h4 className="font-semibold text-muted-foreground">Secretaria</h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Acesso operacional: pode cadastrar e editar leads e processos, mas não pode excluir. Sem acesso às configurações.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="isa" className="animate-fade-in">
            <IsaPromptEditor />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
