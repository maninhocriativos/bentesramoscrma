import { Lead } from '@/types/leads';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  X, User, Phone, Mail, MapPin, Briefcase, DollarSign, Calendar, 
  MessageCircle, FileSignature, ExternalLink, Clock, Tag, Building,
  Sparkles, CalendarCheck, AlertTriangle, Send, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { EnviarContratoModal } from '@/components/contratos/EnviarContratoModal';

interface LeadSidePanelProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenFullModal: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  'Lead Frio': 'bg-slate-100 text-slate-700 border-slate-200',
  'Em Atendimento': 'bg-blue-100 text-blue-700 border-blue-200',
  'Em Negociação': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Aguardando Contrato': 'bg-amber-100 text-amber-700 border-amber-200',
  'Contrato Assinado': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Ganho': 'bg-green-100 text-green-700 border-green-200',
  'Perdido': 'bg-red-100 text-red-700 border-red-200',
};

const formatCurrency = (value: number | null): string => {
  if (!value) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function LeadSidePanel({ lead, isOpen, onClose, onOpenFullModal }: LeadSidePanelProps) {
  const navigate = useNavigate();
  const [isContratoModalOpen, setIsContratoModalOpen] = useState(false);

  if (!lead) return null;

  const statusColor = STATUS_COLORS[lead.status || ''] || 'bg-muted text-muted-foreground';
  const showContractButton = lead.status === 'Aguardando Contrato' && !lead.link_contrato;

  const handleWhatsApp = () => {
    if (lead.telefone) {
      const phone = lead.telefone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    }
  };

  const handleCall = () => {
    if (lead.telefone) {
      const phone = lead.telefone.replace(/\D/g, '');
      window.location.href = `tel:+55${phone}`;
    }
  };

  const handleEmail = () => {
    if (lead.email) {
      window.location.href = `mailto:${lead.email}`;
    }
  };

  const handleViewFull = () => {
    navigate(`/leads/${lead.id}`);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Side Panel */}
      <div 
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-md bg-card border-l shadow-2xl z-50",
          "transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground truncate max-w-[200px]">
                {lead.nome || 'Sem nome'}
              </h2>
              <Badge variant="outline" className={cn("text-[10px] mt-0.5", statusColor)}>
                {lead.status || 'Sem status'}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-4 space-y-5">
            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-16 flex-col gap-1"
                onClick={handleCall}
                disabled={!lead.telefone}
              >
                <Phone className="w-4 h-4 text-green-600" />
                <span className="text-[10px]">Ligar</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-16 flex-col gap-1"
                onClick={handleWhatsApp}
                disabled={!lead.telefone}
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px]">WhatsApp</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-16 flex-col gap-1"
                onClick={handleEmail}
                disabled={!lead.email}
              >
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="text-[10px]">Email</span>
              </Button>
            </div>

            {/* Contract Button */}
            {showContractButton && (
              <Button 
                className="w-full bg-gold hover:bg-gold/90 text-gold-foreground gap-2"
                onClick={() => setIsContratoModalOpen(true)}
              >
                <FileSignature className="w-4 h-4" />
                Gerar Contrato
              </Button>
            )}

            <Separator />

            {/* Contact Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Contato
              </h3>
              
              {lead.telefone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{lead.telefone}</span>
                </div>
              )}
              
              {lead.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate">{lead.email}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Case Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Informações do Caso
              </h3>
              
              {lead.tipo_acao && (
                <div className="flex items-center gap-3 text-sm">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <span>{lead.tipo_acao}</span>
                </div>
              )}
              
              <div className="flex items-center gap-3 text-sm">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-emerald-600">
                  {formatCurrency(lead.valor_causa)}
                </span>
              </div>
              
              {lead.origem && (
                <div className="flex items-center gap-3 text-sm">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <Badge variant="secondary" className="text-xs">
                    {lead.origem}
                  </Badge>
                </div>
              )}
            </div>

            <Separator />

            {/* Timeline Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Histórico
              </h3>
              
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>
                  Criado {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
              
              {lead.updated_at && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>
                    Atualizado {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              )}
            </div>

            {/* AI Summary */}
            {lead.resumo_ia && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Resumo IA
                  </h3>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {lead.resumo_ia}
                  </p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-card">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={onOpenFullModal}
            >
              Editar
            </Button>
            <Button 
              className="flex-1 gap-1"
              onClick={handleViewFull}
            >
              Ver Completo
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <EnviarContratoModal
        isOpen={isContratoModalOpen}
        onClose={() => setIsContratoModalOpen(false)}
        onSuccess={() => setIsContratoModalOpen(false)}
        preSelectedLead={{ id: lead.id, nome: lead.nome || '', email: lead.email, telefone: lead.telefone }}
      />
    </>
  );
}
