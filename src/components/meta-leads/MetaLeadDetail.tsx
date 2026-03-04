import { MetaFormLead, MetaFormLeadStatus, CrmMessage } from '@/types/metaFormLeads';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  User, Phone, Mail, MessageCircle, CheckCircle, XCircle, 
  Clock, ChevronDown, FileText, Calendar, Copy, ExternalLink,
  Megaphone, Target, Hash, ArrowRight, Sparkles
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

const statusConfig: Record<MetaFormLeadStatus, { label: string; bg: string; text: string; icon: any }> = {
  novo: { label: 'Novo', bg: 'bg-blue-50', text: 'text-blue-700 border-blue-200', icon: Sparkles },
  em_atendimento: { label: 'Em Atendimento', bg: 'bg-amber-50', text: 'text-amber-700 border-amber-200', icon: Clock },
  concluido: { label: 'Concluído', bg: 'bg-emerald-50', text: 'text-emerald-700 border-emerald-200', icon: CheckCircle },
  perdido: { label: 'Perdido', bg: 'bg-red-50', text: 'text-red-700 border-red-200', icon: XCircle },
};

// Known field labels for better display
const fieldLabels: Record<string, string> = {
  nome_completo: 'Nome Completo',
  phone_number: 'Telefone',
  email: 'E-mail',
  created_time: 'Data de Criação',
  campaign_name: 'Campanha',
  adset_name: 'Conjunto de Anúncios',
  ad_name: 'Anúncio',
};

function formatFieldLabel(key: string): string {
  if (fieldLabels[key.toLowerCase()]) return fieldLabels[key.toLowerCase()];
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MetaLeadDetail({ lead, messages, messagesLoading, onUpdateStatus }: MetaLeadDetailProps) {
  const [idsOpen, setIdsOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const formFields = lead.form_fields && typeof lead.form_fields === 'object' 
    ? Object.entries(lead.form_fields as Record<string, unknown>).filter(([_, v]) => v != null && v !== '')
    : [];

  // Separate known contact fields from custom form fields
  const knownContactKeys = ['nome_completo', 'phone_number', 'email', 'created_time', 'campaign_name', 'adset_name', 'ad_name'];
  const customFields = formFields.filter(([key]) => !knownContactKeys.includes(key.toLowerCase()));

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const currentStatus = statusConfig[lead.status];
  const StatusIcon = currentStatus.icon;

  const source = lead.source === 'google_sheets' ? 'Sheets' : 'Meta';

  return (
    <div className="h-full flex flex-col">
      {/* Hero Header */}
      <div className="px-5 pt-5 pb-4 border-b bg-gradient-to-br from-card to-muted/30 shrink-0">
        <div className="flex items-start gap-4 mb-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 ring-2 ring-primary/10">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate leading-tight" title={lead.nome || 'Sem nome'}>
              {lead.nome || 'Sem nome'}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="outline" className={`${currentStatus.text} font-medium`}>
                <StatusIcon className="h-3.5 w-3.5 mr-1" />
                {currentStatus.label}
              </Badge>
              <Badge variant="secondary" className={`text-[10px] font-semibold ${source === 'Sheets' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>
                {source === 'Sheets' ? '📊' : '📋'} {source}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
          </div>
        </div>

        {/* Contact Cards */}
        <div className="grid grid-cols-1 gap-2">
          {lead.telefone && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-background/80 border group hover:border-primary/30 transition-colors">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="text-sm font-medium flex-1 truncate">{lead.telefone}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => copyToClipboard(lead.telefone!, 'Telefone')}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-background/80 border group hover:border-primary/30 transition-colors">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-sm font-medium flex-1 truncate">{lead.email}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => copyToClipboard(lead.email!, 'Email')}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-background/80 border">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">
              {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
        </div>
      </div>

      {/* CTA + Status Actions */}
      <div className="px-5 py-3 border-b space-y-2.5 shrink-0 bg-card">
        <Button 
          onClick={() => {
            const phone = lead.telefone?.replace(/\D/g, '');
            navigate(phone ? `/chat?phone=${phone}` : '/chat');
          }} 
          className="w-full h-11 text-sm font-semibold shadow-sm" 
          size="default"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Abrir no Chat Principal
          <ArrowRight className="h-4 w-4 ml-auto" />
        </Button>
        
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm"
            onClick={() => onUpdateStatus('em_atendimento')}
            disabled={lead.status === 'em_atendimento'}
            className={`text-xs h-9 transition-all ${lead.status === 'em_atendimento' ? 'bg-amber-50 border-amber-200' : 'hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700'}`}>
            <Clock className="h-3.5 w-3.5 mr-1" /> Atendimento
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => onUpdateStatus('concluido')}
            disabled={lead.status === 'concluido'}
            className={`text-xs h-9 transition-all ${lead.status === 'concluido' ? 'bg-emerald-50 border-emerald-200' : 'hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700'}`}>
            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Concluído
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => onUpdateStatus('perdido')}
            disabled={lead.status === 'perdido'}
            className={`text-xs h-9 transition-all ${lead.status === 'perdido' ? 'bg-red-50 border-red-200' : 'hover:bg-red-50 hover:border-red-200 hover:text-red-700'}`}>
            <XCircle className="h-3.5 w-3.5 mr-1" /> Perdido
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-5">
          {/* Form Fields - Redesigned as a clean table */}
          {formFields.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Dados do Formulário</h3>
                <Badge variant="secondary" className="text-[10px] ml-auto">{formFields.length} campos</Badge>
              </div>
              <div className="rounded-xl border bg-background overflow-hidden">
                {formFields.map(([key, value], idx) => (
                  <div 
                    key={key} 
                    className={`flex items-start gap-3 px-4 py-3 text-sm ${idx !== formFields.length - 1 ? 'border-b' : ''} hover:bg-muted/30 transition-colors`}
                  >
                    <span className="text-muted-foreground text-xs font-medium min-w-[140px] pt-0.5 shrink-0">
                      {formatFieldLabel(key)}
                    </span>
                    <span className="font-medium text-foreground flex-1 break-words text-right">
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campaign Info - Redesigned */}
          {(lead.campaign_name || lead.campaign_id || lead.ad_name || lead.form_id) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Megaphone className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Dados da Campanha</h3>
              </div>
              <div className="rounded-xl border bg-background overflow-hidden">
                {lead.campaign_name && (
                  <div className="flex items-center gap-3 px-4 py-3 text-sm border-b">
                    <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground text-xs font-medium min-w-[80px]">Campanha</span>
                    <span className="font-medium text-foreground flex-1 text-right truncate">{lead.campaign_name}</span>
                  </div>
                )}
                {lead.ad_name && (
                  <div className="flex items-center gap-3 px-4 py-3 text-sm border-b">
                    <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground text-xs font-medium min-w-[80px]">Anúncio</span>
                    <span className="font-medium text-foreground flex-1 text-right truncate">{lead.ad_name}</span>
                  </div>
                )}
                {lead.adset_name && (
                  <div className="flex items-center gap-3 px-4 py-3 text-sm border-b">
                    <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground text-xs font-medium min-w-[80px]">Conjunto</span>
                    <span className="font-medium text-foreground flex-1 text-right truncate">{lead.adset_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground text-xs font-medium min-w-[80px]">Fonte</span>
                  <span className="font-medium text-foreground flex-1 text-right">{lead.form_id || source}</span>
                </div>
              </div>
            </div>
          )}

          {/* Message History */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Histórico de Mensagens</h3>
            </div>
            <div className="rounded-xl border bg-background overflow-hidden p-4">
              <MetaLeadMessageHistory messages={messages} loading={messagesLoading} />
            </div>
          </div>

          {/* IDs Collapsible */}
          <Collapsible open={idsOpen} onOpenChange={setIdsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
                <span className="text-xs">IDs Técnicos</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${idsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="bg-muted/40 rounded-xl p-4 space-y-1.5 text-xs font-mono break-all border">
                <p><span className="text-muted-foreground">meta_lead_id:</span> {lead.meta_lead_id}</p>
                {lead.form_id && <p><span className="text-muted-foreground">form_id:</span> {lead.form_id}</p>}
                {lead.campaign_id && <p><span className="text-muted-foreground">campaign_id:</span> {lead.campaign_id}</p>}
                {lead.ad_id && <p><span className="text-muted-foreground">ad_id:</span> {lead.ad_id}</p>}
                {lead.adset_id && <p><span className="text-muted-foreground">adset_id:</span> {lead.adset_id}</p>}
                {lead.linked_lead_id && <p><span className="text-muted-foreground">linked_lead_id:</span> {lead.linked_lead_id}</p>}
                {lead.dedupe_key && <p><span className="text-muted-foreground">dedupe_key:</span> {lead.dedupe_key}</p>}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
