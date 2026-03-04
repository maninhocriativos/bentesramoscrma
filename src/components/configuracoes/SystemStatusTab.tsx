import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, MessageSquare, CreditCard, FileSignature, Database } from 'lucide-react';
import { BackupChatCard } from './BackupChatCard';

export function SystemStatusTab() {
  const supabaseUrl = 'https://qgenaltkjtlvwfgykpxq.supabase.co';

  return (
    <div className="space-y-6">
      {/* Status da Conexão */}
      <Card className="rounded-xl shadow-soft">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Database className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Status da Conexão</CardTitle>
              <CardDescription>Conexão com o banco de dados</CardDescription>
            </div>
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Conectado
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">URL do Supabase</Label>
            <Input 
              value={supabaseUrl} 
              readOnly 
              className="rounded-xl bg-muted/50 font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Integrações Futuras */}
      <Card className="rounded-xl shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Integrações Externas</CardTitle>
          <CardDescription>Configure as APIs de serviços externos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Z-API WhatsApp */}
          <div className="p-4 rounded-lg bg-muted/30 border border-dashed">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h4 className="font-medium">Z-API (WhatsApp)</h4>
                <p className="text-xs text-muted-foreground">Automação de mensagens</p>
              </div>
              <Badge variant="outline" className="ml-auto">Em breve</Badge>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Token Z-API</Label>
              <Input 
                placeholder="Informe o token da Z-API" 
                disabled 
                className="rounded-xl bg-muted/50"
              />
            </div>
          </div>

          {/* Asaas */}
          <div className="p-4 rounded-lg bg-muted/30 border border-dashed">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium">Asaas (Financeiro)</h4>
                <p className="text-xs text-muted-foreground">Cobranças e pagamentos</p>
              </div>
              <Badge variant="outline" className="ml-auto">Em breve</Badge>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Token Asaas</Label>
              <Input 
                placeholder="Informe o token da Asaas" 
                disabled 
                className="rounded-xl bg-muted/50"
              />
            </div>
          </div>

          {/* Clicksign */}
          <div className="p-4 rounded-lg bg-muted/30 border border-dashed">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <FileSignature className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium">Clicksign</h4>
                <p className="text-xs text-muted-foreground">Assinatura digital de documentos</p>
              </div>
              <Badge variant="outline" className="ml-auto">Em breve</Badge>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Webhook Clicksign</Label>
              <Input 
                placeholder="URL do webhook será gerada aqui" 
                disabled 
                className="rounded-xl bg-muted/50"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <BackupChatCard />
    </div>
  );
}
