import { MetaFormLead, MetaFormLeadStatus, CrmMessage } from '@/types/metaFormLeads';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  User, Phone, Mail, MessageCircle, CheckCircle, XCircle, 
  Clock, ChevronDown, FileText, Calendar, Copy, ExternalLink,
  Megaphone, Target, Hash
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { MetaLeadMessageHistory } from './MetaLeadMessageHistory';

interface MetaLeadDetailProps {
  lead: MetaFormLead;
  messages: CrmMessage[];
  messagesLoading: boolean;
  onUpdateStatus: (status: MetaFormLeadStatus) => void;
}

const statusConfig: Record<MetaFormLeadStatus, { label: string; color: string; icon: any }> = {
  novo: { label: 'Novo', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock },
  em_atendimento: { label: 'Em Atendimento', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: MessageCircle },
  concluido: { label: 'Concluído', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  perdido: { label: 'Perdido', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
};

export function MetaLeadDetail({ lead, messages, messagesLoading, onUpdateStatus }: MetaLeadDetailProps) {
  const [idsOpen, setIdsOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const formFields = lead.form_fields && typeof lead.form_fields === 'object' 
    ? Object.entries(lead.form_fields).filter(([_, v]) => v != null && v !== '')
    : [];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const currentStatus = statusConfig[lead.status];
  const StatusIcon = currentStatus.icon;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-card shrink-0">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate" title={lead.nome || 'Sem nome'}>
              {lead.nome || 'Sem nome'}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className={currentStatus.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {currentStatus.label}
              </Badge>
              <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700">
                📋 META
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div className="grid grid-cols-1 gap-1.5 text-sm">
          {lead.telefone && (
            <div className="flex items-center gap-2 text-muted-foreground group">
              <Phone className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">{lead.telefone}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => copyToClipboard(lead.telefone!, 'Telefone')}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2 text-muted-foreground group">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">{lead.email}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => copyToClipboard(lead.email!, 'Email')}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>{format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
          {lead.last_contact_at && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Último contato: {format(new Date(lead.last_contact_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 border-b space-y-2 shrink-0">
        <Button 
          onClick={() => {
            const phone = lead.telefone?.replace(/\D/g, '');
            navigate(phone ? `/chat?phone=${phone}` : '/chat');
          }} 
          className="w-full" 
          size="default"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Abrir no Chat Principal
        </Button>
        
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm"
            onClick={() => onUpdateStatus('em_atendimento')}
            disabled={lead.status === 'em_atendimento'}
            className="text-xs">
            <Clock className="h-3 w-3 mr-1" /> Atendimento
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => onUpdateStatus('concluido')}
            disabled={lead.status === 'concluido'}
            className="text-xs text-green-600 hover:text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" /> Concluído
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => onUpdateStatus('perdido')}
            disabled={lead.status === 'perdido'}
            className="text-xs text-red-600 hover:text-red-700">
            <XCircle className="h-3 w-3 mr-1" /> Perdido
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Form Fields */}
          {formFields.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Dados do Formulário ({formFields.length} campos)
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 pb-3">
                <div className="space-y-2">
                  {formFields.map(([key, value]) => (
                    <div key={key} className="flex justify-between items-start gap-2 text-sm">
                      <span className="text-muted-foreground capitalize shrink-0">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <p className="font-medium text-right break-words">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campaign Info */}
          {(lead.campaign_id || lead.ad_id || lead.form_id) && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  Dados da Campanha
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 pb-3 space-y-1.5 text-sm">
                {lead.form_id && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Hash className="h-3 w-3 shrink-0" />
                    <span className="text-xs">Form: {lead.form_id}</span>
                  </div>
                )}
                {lead.campaign_id && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Target className="h-3 w-3 shrink-0" />
                    <span className="text-xs">Campanha: {lead.campaign_id}</span>
                  </div>
                )}
                {lead.ad_id && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Megaphone className="h-3 w-3 shrink-0" />
                    <span className="text-xs">Anúncio: {lead.ad_id}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Message History */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Histórico de Mensagens
              </CardTitle>
            </CardHeader>
            <CardContent className="py-0 pb-3">
              <MetaLeadMessageHistory messages={messages} loading={messagesLoading} />
            </CardContent>
          </Card>

          {/* IDs Collapsible */}
          <Collapsible open={idsOpen} onOpenChange={setIdsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="text-xs text-muted-foreground">IDs Técnicos</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${idsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="bg-muted/50 rounded-md p-3 space-y-1 text-xs font-mono break-all">
                <p><span className="text-muted-foreground">meta_lead_id:</span> {lead.meta_lead_id}</p>
                {lead.form_id && <p><span className="text-muted-foreground">form_id:</span> {lead.form_id}</p>}
                {lead.campaign_id && <p><span className="text-muted-foreground">campaign_id:</span> {lead.campaign_id}</p>}
                {lead.ad_id && <p><span className="text-muted-foreground">ad_id:</span> {lead.ad_id}</p>}
                {lead.adset_id && <p><span className="text-muted-foreground">adset_id:</span> {lead.adset_id}</p>}
                {lead.linked_lead_id && <p><span className="text-muted-foreground">linked_lead_id:</span> {lead.linked_lead_id}</p>}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
