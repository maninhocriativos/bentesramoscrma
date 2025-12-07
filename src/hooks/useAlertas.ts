import { useMemo } from 'react';
import { Lead } from '@/types/leads';
import { Processo } from '@/types/processos';
import { differenceInDays, differenceInHours, isAfter, addDays } from 'date-fns';

export interface Alerta {
  id: string;
  tipo: 'risco' | 'prazo' | 'tarefa';
  titulo: string;
  descricao: string;
  prioridade: 'alta' | 'media' | 'baixa';
  leadId?: string;
  processoId?: string;
}

export function useAlertas(leads: Lead[], processos: Processo[]) {
  const alertas = useMemo(() => {
    const now = new Date();
    const result: Alerta[] = [];

    // 1. Leads estagnados (Em Atendimento há mais de 5 dias)
    leads.forEach(lead => {
      if (lead.status === 'Em Atendimento') {
        const lastUpdate = lead.updated_at ? new Date(lead.updated_at) : new Date(lead.created_at);
        const diasParado = differenceInDays(now, lastUpdate);
        
        if (diasParado >= 5) {
          result.push({
            id: `stagnant-${lead.id}`,
            tipo: 'risco',
            titulo: 'Lead Estagnado',
            descricao: `${lead.nome || 'Lead sem nome'} está parado há ${diasParado} dias`,
            prioridade: diasParado >= 7 ? 'alta' : 'media',
            leadId: lead.id,
          });
        }
      }

      // 2. Leads aguardando contrato sem link
      if (lead.status === 'Aguardando Contrato' && !lead.link_contrato) {
        result.push({
          id: `contract-${lead.id}`,
          tipo: 'tarefa',
          titulo: 'Contrato Pendente',
          descricao: `Falta gerar contrato para ${lead.nome || 'lead'}`,
          prioridade: 'media',
          leadId: lead.id,
        });
      }
    });

    // 3. Prazos próximos (processos - usando created_at como referência por enquanto)
    // Nota: Em um cenário real, você teria uma coluna de data_prazo
    processos.forEach(processo => {
      if (processo.status === 'Em Andamento' && processo.created_at) {
        // Simulando prazo como 30 dias após criação
        const prazoEstimado = addDays(new Date(processo.created_at), 30);
        const diasRestantes = differenceInDays(prazoEstimado, now);
        
        if (diasRestantes <= 3 && diasRestantes >= 0) {
          result.push({
            id: `deadline-${processo.id}`,
            tipo: 'prazo',
            titulo: 'Prazo Próximo',
            descricao: `${processo.titulo_acao || 'Processo'} vence em ${diasRestantes} dia(s)`,
            prioridade: diasRestantes <= 1 ? 'alta' : 'media',
            processoId: processo.id,
          });
        }
      }
    });

    // Ordenar por prioridade
    return result.sort((a, b) => {
      const prioridadeOrder = { alta: 0, media: 1, baixa: 2 };
      return prioridadeOrder[a.prioridade] - prioridadeOrder[b.prioridade];
    });
  }, [leads, processos]);

  return { alertas };
}

// Helper para determinar o status visual do lead (para indicadores coloridos)
export function getLeadIndicator(lead: Lead): 'red' | 'yellow' | 'green' | null {
  const now = new Date();
  const lastUpdate = lead.updated_at ? new Date(lead.updated_at) : new Date(lead.created_at);
  const createdAt = new Date(lead.created_at);
  
  const diasSemInteracao = differenceInDays(now, lastUpdate);
  const horasDesdeCreacao = differenceInHours(now, createdAt);

  // Sem interação há 7 dias = vermelho
  if (diasSemInteracao >= 7) {
    return 'red';
  }
  
  // Lead novo (menos de 24h) = amarelo
  if (horasDesdeCreacao < 24) {
    return 'yellow';
  }
  
  // Movimentado hoje = verde
  if (diasSemInteracao === 0) {
    return 'green';
  }

  return null;
}
