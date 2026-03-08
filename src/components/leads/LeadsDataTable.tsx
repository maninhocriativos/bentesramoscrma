import { Lead, LeadStatus } from '@/types/leads';
import { LeadsTableRow } from './LeadsTableRow';
import { Users } from 'lucide-react';

interface LeadsDataTableProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onMoveStage: (leadId: string, newStatus: LeadStatus) => void;
  allStages: { status: LeadStatus; label: string }[];
}

export function LeadsDataTable({ leads, onLeadClick, onMoveStage, allStages }: LeadsDataTableProps) {
  if (leads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center">
            <Users className="h-5 w-5 text-muted-foreground/60" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum lead encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">Tente ajustar os filtros ou adicione um novo lead</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="h-full overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/50 backdrop-blur-sm border-b">
              <th className="sticky left-0 z-20 bg-muted/50 backdrop-blur-sm text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-[200px] min-w-[200px]">
                Lead
              </th>
              <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-[100px]">
                Linha
              </th>
              <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-[140px]">
                Telefone
              </th>
              <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-[100px]">
                Origem
              </th>
              <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-[130px]">
                Etapa
              </th>
              <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-[110px]">
                Contato
              </th>
              <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-[100px]">
                Valor
              </th>
              <th className="sticky right-0 z-20 bg-muted/50 backdrop-blur-sm text-center px-3 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-[120px]">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {leads.map((lead, index) => (
              <LeadsTableRow
                key={lead.id}
                lead={lead}
                onClick={() => onLeadClick(lead)}
                onMoveStage={onMoveStage}
                allStages={allStages}
                index={index}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
