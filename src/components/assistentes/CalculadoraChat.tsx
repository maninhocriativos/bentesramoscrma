import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Loader2, RotateCcw, User, Upload, File, X, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import isaAvatar from '@/assets/isa-avatar.png';

// Assistant ID para Isa Cálculo Bancário no GPT
const CALCULATOR_ASSISTANT_ID = 'asst_KiAQOjNUkOfTv1PI49xeK8uX';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UploadedFile {
  name: string;
  url: string;
  path: string;
}

const BANCOS = [
  { value: 'banco-do-brasil', label: 'Banco do Brasil' },
  { value: 'bradesco', label: 'Bradesco' },
  { value: 'itau', label: 'Itaú' },
  { value: 'santander', label: 'Santander' },
  { value: 'caixa', label: 'Caixa Econômica Federal' },
  { value: 'nubank', label: 'Nubank' },
  { value: 'inter', label: 'Banco Inter' },
  { value: 'original', label: 'Banco Original' },
  { value: 'pan', label: 'Banco Pan' },
  { value: 'safra', label: 'Banco Safra' },
  { value: 'btg', label: 'BTG Pactual' },
  { value: 'c6', label: 'C6 Bank' },
  { value: 'sicoob', label: 'Sicoob' },
  { value: 'sicredi', label: 'Sicredi' },
  { value: 'banrisul', label: 'Banrisul' },
  { value: 'outro', label: 'Outro' },
];

const STORAGE_KEY_CALC = 'isa-calc-chat-state';

export function CalculadoraChat() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CALC);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.messages?.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })) || [];
      } catch { return []; }
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CALC);
    if (saved) {
      try {
        return JSON.parse(saved).threadId || null;
      } catch { return null; }
    }
    return null;
  });
  const [selectedBank, setSelectedBank] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CALC);
    if (saved) {
      try {
        return JSON.parse(saved).selectedBank || '';
      } catch { return ''; }
    }
    return '';
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Persistir estado
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CALC, JSON.stringify({ messages, threadId, selectedBank }));
  }, [messages, threadId, selectedBank]);

  // Auto-scroll quando mensagens mudam ou loading muda
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (viewport) {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
        }
      }
    };
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  // Manter foco no input após enviar
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('extratos-bancarios')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('extratos-bancarios')
          .getPublicUrl(filePath);

        setUploadedFiles(prev => [...prev, {
          name: file.name,
          url: publicUrl,
          path: filePath,
        }]);

        toast({
          title: 'Arquivo enviado',
          description: `${file.name} foi carregado com sucesso.`,
        });
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível enviar o arquivo.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = async (file: UploadedFile) => {
    try {
      await supabase.storage
        .from('extratos-bancarios')
        .remove([file.path]);
      
      setUploadedFiles(prev => prev.filter(f => f.path !== file.path));
    } catch (error) {
      console.error('Erro ao remover arquivo:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Construir mensagem com contexto
    let fullMessage = input.trim();
    
    if (selectedBank && messages.length === 0) {
      const bancoLabel = BANCOS.find(b => b.value === selectedBank)?.label || selectedBank;
      fullMessage = `[Banco selecionado: ${bancoLabel}]\n\n${fullMessage}`;
    }

    if (uploadedFiles.length > 0 && messages.length === 0) {
      fullMessage = `[Arquivos anexados: ${uploadedFiles.map(f => f.name).join(', ')}]\n\n${fullMessage}`;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: fullMessage,
          threadId,
          assistantId: CALCULATOR_ASSISTANT_ID,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.threadId && !threadId) {
        setThreadId(data.threadId);
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao enviar mensagem',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setThreadId(null);
    setUploadedFiles([]);
    setSelectedBank('');
    localStorage.removeItem(STORAGE_KEY_CALC);
  };

  return (
    <div className="flex-1 flex flex-col max-h-[calc(100vh-180px)]">
      <Card className="flex-1 flex flex-col overflow-hidden mx-6 mb-6 mt-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <img 
              src={isaAvatar} 
              alt="Isa Cálculo Bancário"
              className="h-10 w-10 rounded-full object-cover object-top border border-border"
            />
            <div>
              <h3 className="font-medium text-foreground">Isa Cálculo Bancário</h3>
              <p className="text-xs text-muted-foreground">
                {isLoading ? 'Analisando...' : 'Análise de extratos bancários'}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="gap-2 text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
              Nova análise
            </Button>
          )}
        </div>

        {/* Config Panel - Só mostra se não tem mensagens */}
        {messages.length === 0 && (
          <div className="px-6 py-4 border-b bg-muted/30 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Seleção de banco */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <Landmark className="h-4 w-4" strokeWidth={1.5} />
                  Banco
                </Label>
                <Select value={selectedBank} onValueChange={setSelectedBank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {BANCOS.map((banco) => (
                      <SelectItem key={banco.value} value={banco.value}>
                        {banco.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Upload de arquivos */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <File className="h-4 w-4" strokeWidth={1.5} />
                  Extratos
                </Label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.csv"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" strokeWidth={1.5} />
                    )}
                    Enviar extratos
                  </Button>
                </div>
              </div>
            </div>

            {/* Arquivos enviados */}
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 text-sm border"
                  >
                    <File className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <button
                      onClick={() => removeFile(file)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full p-6" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <img 
                  src={isaAvatar} 
                  alt="Isa Cálculo Bancário"
                  className="h-20 w-20 rounded-full object-cover object-top border-2 border-border shadow-lg mb-5"
                />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Isa Cálculo Bancário
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  Selecione o banco, envie os extratos e descreva o que deseja calcular.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    'Calcular juros abusivos',
                    'Analisar taxas cobradas',
                    'Verificar encargos',
                  ].map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setInput(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="text-xs rounded-full"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex gap-3',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <img 
                        src={isaAvatar} 
                        alt="Isa"
                        className="h-8 w-8 rounded-full object-cover object-top shrink-0"
                      />
                    )}
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-3 text-sm',
                        msg.role === 'user'
                          ? 'bg-emerald-500 text-white rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <span className={cn(
                        "text-[10px] mt-1 block",
                        msg.role === 'user' ? 'text-white/70' : 'text-muted-foreground'
                      )}>
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {msg.role === 'user' && (
                      <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-secondary-foreground" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <img 
                      src={isaAvatar} 
                      alt="Isa"
                      className="h-8 w-8 rounded-full object-cover object-top shrink-0"
                    />
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 bg-emerald-500/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-2 w-2 bg-emerald-500/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="h-2 w-2 bg-emerald-500/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>

        {/* Input */}
        <div className="border-t p-4 bg-background">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Descreva o que deseja calcular..."
              disabled={isLoading}
              className="flex-1 h-12 rounded-xl"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-600"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2} />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
