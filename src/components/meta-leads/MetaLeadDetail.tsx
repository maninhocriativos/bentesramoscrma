import { MetaFormLead, MetaFormLeadStatus } from '@/types/metaFormLeads';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  User, Phone, Mail, MessageCircle, CheckCircle, XCircle, 
  Clock, ChevronDown, FileText 
} from 'lucide-react';
import { useState } from 'react';

interface MetaLeadDetailProps {
  lead: MetaFormLead;
  onOpenChat: () => void;
  onUpdateStatus: (status: MetaFormLeadStatus) => void;
}

export function MetaLeadDetail({ lead, onOpenChat, onUpdateStatus }: MetaLeadDetailProps) {
  const [idsOpen, setIdsOpen] = useState(false);

  // Parse form_fields for display
  const formFields = lead.form_fields && typeof lead.form_fields === 'object' 
    ? Object.entries(lead.form_fields).filter(([_, v]) => v != null)
    : [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{lead.nome || 'Sem nome'}</h2>
            <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
              📋 FORM META
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-sm">
          {lead.telefone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{lead.telefone}</span>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-b space-y-2">
        <Button onClick={onOpenChat} className="w-full" size="lg">
          <MessageCircle className="h-4 w-4 mr-2" />
          Abrir Chat
        </Button>
        
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateStatus('em_atendimento')}
            disabled={lead.status === 'em_atendimento'}
            className="text-xs"
          >
            <Clock className="h-3 w-3 mr-1" />
            Atendimento
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateStatus('concluido')}
            disabled={lead.status === 'concluido'}
            className="text-xs text-green-600 hover:text-green-700"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Concluído
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateStatus('perdido')}
            disabled={lead.status === 'perdido'}
            className="text-xs text-red-600 hover:text-red-700"
          >
            <XCircle className="h-3 w-3 mr-1" />
            Perdido
          </Button>
        </div>
      </div>

      {/* Form Fields */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {formFields.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Campos do Formulário
              </CardTitle>
            </CardHeader>
            <CardContent className="py-0 pb-3">
              <div className="space-y-2">
                {formFields.map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-muted-foreground capitalize">
                      {key.replace(/_/g, ' ')}:
                    </span>
                    <p className="font-medium">{String(value)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* IDs Collapsible */}
        <Collapsible open={idsOpen} onOpenChange={setIdsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="text-xs text-muted-foreground">IDs Técnicos</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${idsOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="bg-muted/50 rounded-md p-3 space-y-1 text-xs font-mono">
              <p><span className="text-muted-foreground">meta_lead_id:</span> {lead.meta_lead_id}</p>
              {lead.form_id && <p><span className="text-muted-foreground">form_id:</span> {lead.form_id}</p>}
              {lead.campaign_id && <p><span className="text-muted-foreground">campaign_id:</span> {lead.campaign_id}</p>}
              {lead.ad_id && <p><span className="text-muted-foreground">ad_id:</span> {lead.ad_id}</p>}
              {lead.adset_id && <p><span className="text-muted-foreground">adset_id:</span> {lead.adset_id}</p>}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
