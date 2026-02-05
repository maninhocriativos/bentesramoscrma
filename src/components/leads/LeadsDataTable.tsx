import { Lead, LeadStatus } from '@/types/leads';
import { LeadsTableRow } from './LeadsTableRow';
import { cn } from '@/lib/utils';

interface LeadsDataTableProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onMoveStage: (leadId: string, newStatus: LeadStatus) => void;
  allStages: { status: LeadStatus; label: string }[];
}

export function LeadsDataTable({ leads, onLeadClick, onMoveStage, allStages }: LeadsDataTableProps) {
  if (leads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center">
          <p className="text-muted-foreground">Nenhum lead encontrado</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Tente ajustar os filtros</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden rounded-lg border bg-card">
      <div className="h-full overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
            <tr className="border-b">
              <th className="sticky left-0 z-20 bg-muted/80 backdrop-blur-sm text-left px-4 py-3 font-medium text-muted-foreground w-[180px] min-w-[180px]">
                Lead
              </th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[80px]">
                Linha
              </th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[130px]">
                WhatsApp
              </th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[100px]">
                Origem
              </th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[120px]">
                Status
              </th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[110px]">
                Último contato
              </th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[100px]">
                Valor
              </th>
              <th className="sticky right-0 z-20 bg-muted/80 backdrop-blur-sm text-center px-3 py-3 font-medium text-muted-foreground w-[100px]">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <LeadsTableRow
                key={lead.id}
                lead={lead}
                onClick={() => onLeadClick(lead)}
                onMoveStage={onMoveStage}
                allStages={allStages}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
