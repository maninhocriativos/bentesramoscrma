import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  X, 
  Phone, 
  Mail, 
  Calendar, 
  MessageSquare, 
  FileText, 
  Clock,
  Bot,
  User,
  ChevronRight,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Interacao {
  id: string;
  tipo: string;
  resumo: string;
  detalhes?: string;
  direcao?: string;
  data_interacao: string;
  created_at: string;
}

interface Lead {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  status: string;
  resumo_ia?: string;
  tipo_acao?: string;
  valor_causa?: number;
  origem?: string;
  created_at: string;
}

interface Compromisso {
  id: string;
  titulo: string;
  data_inicio: string;
  tipo: string;
}

interface LeadContextPanelProps {
  leadId: string;
  onClose: () => void;
  onNavigateToLead?: () => void;
}

const LeadContextPanel = ({ leadId, onClose, onNavigateToLead }: LeadContextPanelProps) => {
  const [lead, setLead] = useState<Lead | null>(null);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLeadData();
  }, [leadId]);

  const loadLeadData = async () => {
    setIsLoading(true);
    try {
      // Carregar lead
      const { data: leadData } = await supabase
        .from('leads_juridicos')
        .select('*')
        .eq('id', leadId)
        .single();
      
      if (leadData) setLead(leadData as Lead);

      // Carregar interações (últimas 20)
      const { data: interacoesData } = await supabase
        .from('interacoes')
        .select('*')
        .eq('cliente_id', leadId)
        .order('data_interacao', { ascending: false })
        .limit(20);
      
      if (interacoesData) setInteracoes(interacoesData as Interacao[]);

      // Carregar próximos compromissos
      const { data: compromissosData } = await supabase
        .from('compromissos')
        .select('*')
        .eq('lead_id', leadId)
        .gte('data_inicio', new Date().toISOString())
        .order('data_inicio', { ascending: true })
        .limit(3);
      
      if (compromissosData) setCompromissos(compromissosData as Compromisso[]);
    } catch (error) {
      console.error('Erro ao carregar dados do lead:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Lead Frio': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      'Em Atendimento': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      'Em Negociação': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      'Aguardando Contrato': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      'Contrato Assinado': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      'Ganho': 'bg-green-500/10 text-green-500 border-green-500/20',
      'Perdido': 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo?.toLowerCase()) {
      case 'chat': return <MessageSquare className="h-3.5 w-3.5" />;
      case 'telefone': return <Phone className="h-3.5 w-3.5" />;
      case 'email': return <Mail className="h-3.5 w-3.5" />;
      case 'reunião': return <Calendar className="h-3.5 w-3.5" />;
      default: return <FileText className="h-3.5 w-3.5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="w-[320px] bg-white dark:bg-[#111B21] border-l border-[#E9EDEF] dark:border-[#222D34] flex items-center justify-center">
        <div className="animate-pulse text-[#667781]">Carregando...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="w-[320px] bg-white dark:bg-[#111B21] border-l border-[#E9EDEF] dark:border-[#222D34] flex flex-col items-center justify-center p-4">
        <AlertCircle className="h-8 w-8 text-[#667781] mb-2" />
        <p className="text-sm text-[#667781]">Lead não encontrado</p>
      </div>
    );
  }

  return (
    <div className="w-[320px] bg-white dark:bg-[#111B21] border-l border-[#E9EDEF] dark:border-[#222D34] flex flex-col">
      {/* Header */}
      <div className="h-[60px] px-4 flex items-center justify-between bg-[#F0F2F5] dark:bg-[#202C33] border-b border-[#E9EDEF] dark:border-[#222D34]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#00A884]" />
          <span className="font-medium text-[15px] text-[#111B21] dark:text-[#E9EDEF]">Contexto do Lead</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="h-8 w-8 rounded-full text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#E9EDEF] dark:hover:bg-[#374248]"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Info do Lead */}
          <div 
            className="p-3 rounded-lg bg-[#F0F2F5] dark:bg-[#202C33] cursor-pointer hover:bg-[#E9EDEF] dark:hover:bg-[#2A3942] transition-colors"
            onClick={onNavigateToLead}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-[15px] text-[#111B21] dark:text-[#E9EDEF] truncate">
                {lead.nome}
              </h3>
              <ChevronRight className="h-4 w-4 text-[#667781] shrink-0" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={`text-xs ${getStatusColor(lead.status)}`}>
                {lead.status}
              </Badge>
              {lead.origem && (
                <Badge variant="outline" className="text-xs bg-[#E9EDEF] dark:bg-[#374248] text-[#667781] border-0">
                  {lead.origem}
                </Badge>
              )}
            </div>
            {lead.tipo_acao && (
              <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                {lead.tipo_acao}
              </p>
            )}
            {lead.valor_causa && (
              <p className="text-xs text-[#00A884] font-medium mt-1">
                R$ {lead.valor_causa.toLocaleString('pt-BR')}
              </p>
            )}
          </div>

          {/* Resumo IA */}
          {lead.resumo_ia && (
            <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
              <div className="flex items-center gap-1.5 mb-2">
                <Bot className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Análise da Isa</span>
              </div>
              <p className="text-xs text-[#111B21] dark:text-[#E9EDEF] leading-relaxed">
                {lead.resumo_ia}
              </p>
            </div>
          )}

          {/* Próximos Compromissos */}
          {compromissos.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[#667781] dark:text-[#8696A0] uppercase tracking-wide mb-2">
                Próximos Compromissos
              </h4>
              <div className="space-y-2">
                {compromissos.map(c => (
                  <div key={c.id} className="p-2.5 rounded-lg bg-[#F0F2F5] dark:bg-[#202C33] border-l-2 border-[#00A884]">
                    <p className="text-sm font-medium text-[#111B21] dark:text-[#E9EDEF]">{c.titulo}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Calendar className="h-3 w-3 text-[#667781]" />
                      <span className="text-xs text-[#667781]">
                        {format(new Date(c.data_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico de Interações */}
          <div>
            <h4 className="text-xs font-medium text-[#667781] dark:text-[#8696A0] uppercase tracking-wide mb-2">
              Histórico de Interações ({interacoes.length})
            </h4>
            {interacoes.length === 0 ? (
              <p className="text-xs text-[#667781] dark:text-[#8696A0] italic">
                Nenhuma interação registrada
              </p>
            ) : (
              <div className="space-y-2">
                {interacoes.map(i => (
                  <div 
                    key={i.id} 
                    className="p-2.5 rounded-lg bg-[#F0F2F5] dark:bg-[#202C33] hover:bg-[#E9EDEF] dark:hover:bg-[#2A3942] transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 p-1 rounded ${
                        i.direcao === 'entrada' 
                          ? 'bg-blue-500/10 text-blue-500' 
                          : 'bg-emerald-500/10 text-emerald-500'
                      }`}>
                        {getTipoIcon(i.tipo)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-medium text-[#111B21] dark:text-[#E9EDEF]">
                            {i.tipo}
                          </span>
                          {i.direcao && (
                            <span className={`text-[10px] px-1 py-0.5 rounded ${
                              i.direcao === 'entrada' 
                                ? 'bg-blue-500/10 text-blue-500' 
                                : 'bg-emerald-500/10 text-emerald-500'
                            }`}>
                              {i.direcao === 'entrada' ? '← Entrada' : '→ Saída'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#667781] dark:text-[#8696A0] line-clamp-2">
                          {i.resumo}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-2.5 w-2.5 text-[#8696A0]" />
                          <span className="text-[10px] text-[#8696A0]">
                            {formatDistanceToNow(new Date(i.data_interacao), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default LeadContextPanel;
