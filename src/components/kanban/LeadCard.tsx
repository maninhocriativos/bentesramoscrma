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

const ORIGEM_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Instagram: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  Google: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  Site: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  Indicação: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  Outro: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
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
        "bg-card p-4 rounded-lg shadow-soft cursor-pointer transition-all duration-200",
        "hover:shadow-enterprise hover:-translate-y-0.5",
        "border border-border/50 hover:border-gold/40",
        isDragging && "opacity-50 rotate-2 scale-105 shadow-enterprise"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-sm line-clamp-1 text-foreground">{lead.nome}</h4>
        {lead.origem && (
          <span 
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
              origemStyle.bg, origemStyle.text, origemStyle.border
            )}
          >
            {lead.origem}
          </span>
        )}
      </div>
      
      {resumoTruncado && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
          {resumoTruncado}
        </p>
      )}
      
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <span className="text-xs text-muted-foreground">
          {format(new Date(lead.created_at), "dd MMM yyyy", { locale: ptBR })}
        </span>
        {lead.link_contrato && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gold/20 text-gold-foreground border border-gold/30">
            Contrato
          </span>
        )}
      </div>
    </div>
  );
}
