import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bot, Save, TestTube, History, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AiPrompt } from '@/types/stateMachine';

export function IsaPromptEditor() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [prompt, setPrompt] = useState<AiPrompt | null>(null);
  const [content, setContent] = useState('');
  const [greeting, setGreeting] = useState('');
  const [strictMode, setStrictMode] = useState(true);
  const [versions, setVersions] = useState<AiPrompt[]>([]);
  
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  useEffect(() => {
    loadPrompt();
  }, []);

  const loadPrompt = async () => {
    setLoading(true);
    try {
      // Buscar prompt atual (última versão)
      const { data, error } = await supabase
        .from('ai_prompts')
        .select('*')
        .eq('name', 'isa_system_prompt')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPrompt(data as unknown as AiPrompt);
        setContent(data.content);
        setGreeting(data.greeting_message || '');
        setStrictMode(data.strict_mode ?? true);
      }

      // Buscar versões anteriores
      const { data: allVersions } = await supabase
        .from('ai_prompts')
        .select('*')
        .eq('name', 'isa_system_prompt')
        .order('version', { ascending: false });

      if (allVersions) {
        setVersions(allVersions as unknown as AiPrompt[]);
      }
    } catch (error) {
      console.error('Error loading prompt:', error);
      toast({
        title: 'Erro ao carregar prompt',
        description: 'Não foi possível carregar as configurações da Isa.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextVersion = (prompt?.version || 0) + 1;

      const { error } = await supabase
        .from('ai_prompts')
        .insert({
          name: 'isa_system_prompt',
          content,
          greeting_message: greeting,
          strict_mode: strictMode,
          version: nextVersion,
          updated_by: 'admin'
        });

      if (error) throw error;

      toast({
        title: 'Prompt salvo!',
        description: `Versão ${nextVersion} criada com sucesso.`
      });

      loadPrompt();
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o prompt.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testInput.trim()) {
      toast({
        title: 'Digite uma mensagem',
        description: 'Insira uma mensagem de teste para simular a resposta da Isa.',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    setTestOutput('');
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          mensagem: `[TESTE DE PROMPT - NÃO GRAVAR]\n\nSystem Prompt:\n${content}\n\n---\nMensagem do usuário:\n${testInput}`,
          systemPromptOverride: content
        }
      });

      if (error) throw error;

      setTestOutput(data?.resposta || data?.response || 'Sem resposta');
    } catch (error) {
      console.error('Error testing prompt:', error);
      setTestOutput('Erro ao testar: ' + String(error));
    } finally {
      setTesting(false);
    }
  };

  const restoreVersion = (version: AiPrompt) => {
    setContent(version.content);
    setGreeting(version.greeting_message || '');
    setStrictMode(version.strict_mode);
    toast({
      title: 'Versão restaurada',
      description: `Conteúdo da versão ${version.version} carregado. Salve para criar uma nova versão.`
    });
  };

  if (loading) {
    return (
      <Card className="rounded-xl">
        <CardContent className="p-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-enterprise border-0 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Editor de Prompt da Isa</CardTitle>
              <CardDescription className="text-primary-foreground/80 text-sm">
                Configure o comportamento da assistente virtual
              </CardDescription>
            </div>
          </div>
          {prompt && (
            <Badge variant="secondary" className="bg-white/20 text-white">
              Versão {prompt.version}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <Tabs defaultValue="editor" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="editor" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="space-y-4">
            <div className="space-y-2">
              <Label>Mensagem Inicial / Saudação</Label>
              <Textarea
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                placeholder="Olá! Sou a Isa..."
                className="min-h-[80px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Primeira mensagem enviada quando o cliente inicia a conversa.
              </p>
            </div>

            <div className="space-y-2">
              <Label>System Prompt (Instruções da Isa)</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Você é Isa, assistente virtual..."
                className="min-h-[400px] font-mono text-sm resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Define como a Isa deve se comportar, responder e quais ações pode executar.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="space-y-1">
                <Label>Modo Rígido (State Machine)</Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, a Isa opera estritamente pelo estado do lead e não faz respostas livres.
                </p>
              </div>
              <Switch
                checked={strictMode}
                onCheckedChange={setStrictMode}
              />
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Guardrails Ativos</h4>
                  <ul className="text-sm text-amber-700 mt-2 space-y-1">
                    <li>• Nunca afirmar ilegalidade ou garantir resultado</li>
                    <li>• Linguagem condicional: "há indícios", "em tese"</li>
                    <li>• Papel de triagem e organização, não parecer jurídico</li>
                    <li>• Aviso de "triagem preliminar" em classificações</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="space-y-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={v.version === prompt?.version ? 'default' : 'outline'}>
                      v{v.version}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(v.updated_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {v.updated_by && (
                      <span className="text-xs text-muted-foreground">
                        por {v.updated_by}
                      </span>
                    )}
                  </div>
                  {v.version !== prompt?.version && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => restoreVersion(v)}
                    >
                      Restaurar
                    </Button>
                  )}
                </div>
              ))}
              {versions.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma versão anterior encontrada.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <TestTube className="h-4 w-4" />
                Testar Prompt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Testar Prompt da Isa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Mensagem de Teste</Label>
                  <Textarea
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="Digite uma mensagem para simular..."
                    className="min-h-[80px]"
                  />
                </div>
                <Button
                  onClick={handleTest}
                  disabled={testing}
                  className="w-full gap-2"
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Gerando resposta...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Gerar Resposta
                    </>
                  )}
                </Button>
                {testOutput && (
                  <div className="space-y-2">
                    <Label>Resposta da Isa</Label>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{testOutput}</p>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Nova Versão
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
