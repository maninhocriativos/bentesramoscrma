import { useContratosFechados } from '@/hooks/useContratosFechados';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Handshake, CheckCircle2, XCircle, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Widget leve pro registro manual do botão "Contrato Fechado" no chat — alimenta o
// Dashboard com o mesmo dado já cruzado com ZapSign/ClickSign (useContratosFechados).
export function ContratosManuaisWidget() {
  const { resumo, isLoading } = useContratosFechados();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardContent className="pt-6 flex items-center justify-center h-24">
          <p className="text-sm text-muted-foreground">Carregando registros manuais...</p>
        </CardContent>
      </Card>
    );
  }

  if (resumo.total === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-emerald-600" />
          <h3 className="font-semibold text-foreground">Fechados no Chat</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/contratos')}
          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
        >
          Ver todos →
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Total registrado</p>
            <p className="text-2xl font-bold">{resumo.total}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <p className="text-xs text-emerald-700">Confirmados</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{resumo.confirmados}</p>
          </CardContent>
        </Card>
        <Card className={resumo.metaPendente > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-border'}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Send className={resumo.metaPendente > 0 ? 'h-3.5 w-3.5 text-amber-600' : 'h-3.5 w-3.5 text-muted-foreground'} />
              <p className={resumo.metaPendente > 0 ? 'text-xs text-amber-700' : 'text-xs text-muted-foreground'}>Meta pendente</p>
            </div>
            <p className={resumo.metaPendente > 0 ? 'text-2xl font-bold text-amber-600' : 'text-2xl font-bold'}>{resumo.metaPendente}</p>
          </CardContent>
        </Card>
      </div>

      {resumo.naoConfirmados > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          {resumo.naoConfirmados} registro{resumo.naoConfirmados > 1 ? 's' : ''} online sem documento assinado encontrado no ZapSign/ClickSign.
        </div>
      )}
    </div>
  );
}
