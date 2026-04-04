import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/badge';
import { ExtratoConfigForm } from '@/components/extratos/ExtratoConfigForm';
import { ExtratoResultado } from '@/components/extratos/ExtratoResultado';
import { ExtratoLoading } from '@/components/extratos/ExtratoLoading';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { AnaliseConfig, AnaliseResultado } from '@/types/extratos';

export type { AnaliseConfig, AnaliseResultado };

type PageState = 'initial' | 'processing' | 'result' | 'error';

export default function ConferenciaExtratosPage() {
  const { user } = useAuth();
  const [state, setState] = useState<PageState>('initial');
  const [loadingStep, setLoadingStep] = useState(0);
  const [resultado, setResultado] = useState<AnaliseResultado | null>(null);
  const [config, setConfig] = useState<AnaliseConfig | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAnalise = useCallback(async (cfg: AnaliseConfig) => {
    setConfig(cfg);
    setState('processing');
    setLoadingStep(0);

    try {
      // Step 1: Reading files
      const stepInterval = setInterval(() => {
        setLoadingStep(prev => Math.min(prev + 1, 3));
      }, 2000);

      let textoExtraido = '';
      const imagensBase64: Array<{ base64: string; mimeType: string; name: string }> = [];

      for (const file of cfg.arquivos) {
        if (file.type === 'application/pdf') {
          try {
            console.log('Extraindo texto do PDF:', file.name);
            const { extrairTextoPdf } = await import('@/lib/pdfExtractor');
            const texto = await extrairTextoPdf(file);
            console.log('Texto extraído com sucesso:', texto.length, 'chars');
            textoExtraido += `\n\n=== ARQUIVO: ${file.name} ===\n${texto}`;
          } catch (err) {
            console.error('Falha na extração do PDF, usando base64:', err);
            const buffer = await file.arrayBuffer();
            const base64 = btoa(
              new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), '')
            );
            imagensBase64.push({ base64, mimeType: file.type, name: file.name });
          }
        } else {
          const buffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), '')
          );
          imagensBase64.push({ base64, mimeType: file.type, name: file.name });
        }
      }

      console.log('textoExtraido total:', textoExtraido.length, 'chars');
      console.log('imagensBase64:', imagensBase64.length);

      const { data, error } = await supabase.functions.invoke('analyze-extrato', {
        body: {
          banco: cfg.banco,
          dataInicial: cfg.dataInicial,
          dataFinal: cfg.dataFinal,
          tiposCobranças: cfg.tiposCobranças,
          nomeCliente: cfg.nomeCliente,
          cpf: cfg.cpf,
          numeroContrato: cfg.numeroContrato,
          textoExtraido,
          imagensBase64,
        },
      });

      clearInterval(stepInterval);

      if (error) throw new Error(error.message || 'Erro ao analisar extrato');
      if (data?.error) throw new Error(data.error);

      setResultado(data as AnaliseResultado);
      setState('result');

      // Save to DB
      if (user) {
        await supabase.from('analises_extratos' as any).insert({
          usuario_id: user.id,
          banco: cfg.banco,
          periodo_inicio: cfg.dataInicial || null,
          periodo_fim: cfg.dataFinal || null,
          nome_cliente: cfg.nomeCliente || null,
          cpf_cliente: cfg.cpf || null,
          numero_contrato: cfg.numeroContrato || null,
          resultado_json: data,
        });
      }

      toast.success('Análise concluída com sucesso!');
    } catch (err: any) {
      console.error('Erro na análise:', err);
      setErrorMsg(err.message || 'Erro desconhecido');
      setState('error');
      toast.error(err.message || 'Erro ao processar análise');
    }
  }, [user]);

  const handleNovaAnalise = () => {
    setState('initial');
    setResultado(null);
    setConfig(null);
    setErrorMsg('');
  };

  return (
    <AppLayout>
      <AppHeader title="Conferência de Extratos" />
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Conferência de Extratos</h1>
            <p className="text-sm text-muted-foreground">
              Análise inteligente de cobranças indevidas em extratos bancários
            </p>
          </div>
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 ml-auto">
            IA Ativa
          </Badge>
        </div>

        {/* Config Form */}
        {(state === 'initial' || state === 'error') && (
          <ExtratoConfigForm onSubmit={handleAnalise} />
        )}

        {state === 'error' && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center space-y-2">
            <p className="text-destructive font-medium">{errorMsg}</p>
            <button onClick={handleNovaAnalise} className="text-sm underline text-muted-foreground">
              Tentar novamente
            </button>
          </div>
        )}

        {state === 'processing' && <ExtratoLoading step={loadingStep} />}

        {state === 'result' && resultado && config && (
          <ExtratoResultado
            resultado={resultado}
            config={config}
            onNovaAnalise={handleNovaAnalise}
          />
        )}
      </div>
    </AppLayout>
  );
}
