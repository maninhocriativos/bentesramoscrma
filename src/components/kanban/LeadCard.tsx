import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lead } from '@/types/leads';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  isDragging?: boolean;
}

const ORIGEM_STYLES: Record<string, { bg: string; text: string }> = {
  Instagram: { bg: 'bg-pink-100', text: 'text-pink-700' },
  Google: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Site: { bg: 'bg-green-100', text: 'text-green-700' },
  Indicação: { bg: 'bg-purple-100', text: 'text-purple-700' },
  Outro: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

export function LeadCard({ lead, onClick, isDragging }: LeadCardProps) {
  const origemStyle = ORIGEM_STYLES[lead.origem || 'Outro'] || ORIGEM_STYLES.Outro;
  const resumoTruncado = lead.resumo_ia 
    ? lead.resumo_ia.length > 80 
      ? lead.resumo_ia.substring(0, 80) + '...' 
      : lead.resumo_ia
    : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card p-4 rounded-xl shadow-soft cursor-pointer transition-all duration-200",
        "hover:shadow-soft-lg hover:-translate-y-0.5",
        "border border-transparent hover:border-accent/30",
        isDragging && "opacity-50 rotate-2 scale-105 shadow-soft-lg"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-sm line-clamp-1">{lead.nome}</h4>
        {lead.origem && (
          <Badge 
            variant="secondary" 
            className={cn("text-xs shrink-0", origemStyle.bg, origemStyle.text)}
          >
            {lead.origem}
          </Badge>
        )}
      </div>
      
      {resumoTruncado && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {resumoTruncado}
        </p>
      )}
      
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {format(new Date(lead.created_at), "dd MMM yyyy", { locale: ptBR })}
        </span>
        {lead.link_contrato && (
          <Badge variant="outline" className="text-xs bg-accent/20 text-accent-foreground border-accent">
            Contrato
          </Badge>
        )}
      </div>
    </div>
  );
}
