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
          <div className="mx-auto w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center">
            <Users className="h-6 w-6 text-muted-foreground/40" />
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
    <div className="flex-1 overflow-hidden rounded-xl border border-border/50 bg-card">
      <div className="h-full overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/30 border-b border-border/50">
              <th className="sticky left-0 z-20 bg-muted/30 text-left px-4 py-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider w-[220px] min-w-[220px]">
                Lead
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider w-[100px]">
                Linha
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider w-[130px]">
                Telefone
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider w-[100px]">
                Origem
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider w-[130px]">
                Etapa
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider w-[100px]">
                Contato
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider w-[100px]">
                Valor
              </th>
              <th className="sticky right-0 z-20 bg-muted/30 text-center px-3 py-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider w-[110px]">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
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
