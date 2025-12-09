import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Phone, Mail, Calendar, Globe, FileText, MessageSquare, Scale, DollarSign, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Lead } from '@/types/leads';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { LeadInteracoesTab } from '@/components/leads/LeadInteracoesTab';
import { LeadDocumentosTab } from '@/components/leads/LeadDocumentosTab';
import { LeadProcessosTab } from '@/components/leads/LeadProcessosTab';
import { LeadFinanceiroTab } from '@/components/leads/LeadFinanceiroTab';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusColors: Record<string, string> = {
  'Lead Frio': 'bg-slate-500',
  'Em Atendimento': 'bg-blue-500',
  'Aguardando Contrato': 'bg-amber-500',
  'Contrato Assinado': 'bg-emerald-500',
  'Ganho': 'bg-green-600',
  'Perdido': 'bg-red-500',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchLead = async () => {
      const { data, error } = await supabase
        .from('leads_juridicos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching lead:', error);
        navigate('/leads');
        return;
      }

      setLead(data as Lead);
      setLoading(false);
    };

    fetchLead();
  }, [id, navigate]);

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!lead) {
    return null;
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/leads')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-foreground">{lead.nome}</h1>
            <p className="text-sm text-muted-foreground">
              Cliente desde {format(new Date(lead.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <Badge className={`${statusColors[lead.status]} text-white`}>
            {lead.status}
          </Badge>
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Informações de Contato
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p className="text-sm font-medium">{lead.telefone || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{lead.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Origem</p>
                  <p className="text-sm font-medium">{lead.origem || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Última Atualização</p>
                  <p className="text-sm font-medium">
                    {lead.updated_at 
                      ? format(new Date(lead.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
            {lead.resumo_ia && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Resumo IA</p>
                <p className="text-sm">{lead.resumo_ia}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="interacoes" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="interacoes" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Interações</span>
            </TabsTrigger>
            <TabsTrigger value="documentos" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documentos</span>
            </TabsTrigger>
            <TabsTrigger value="processos" className="gap-2">
              <Scale className="h-4 w-4" />
              <span className="hidden sm:inline">Processos</span>
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Financeiro</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="interacoes" className="mt-6">
            <LeadInteracoesTab clienteId={lead.id} />
          </TabsContent>

          <TabsContent value="documentos" className="mt-6">
            <LeadDocumentosTab clienteId={lead.id} />
          </TabsContent>

          <TabsContent value="processos" className="mt-6">
            <LeadProcessosTab clienteId={lead.id} />
          </TabsContent>

          <TabsContent value="financeiro" className="mt-6">
            <LeadFinanceiroTab clienteId={lead.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}