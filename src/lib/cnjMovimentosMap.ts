/**
 * Dicionário de traduções de códigos CNJ para texto humano
 * Fonte: Tabelas Processuais Unificadas do CNJ
 */

export interface CnjMovimentoInfo {
  titulo: string;
  descricao: string;
  categoria: 'andamento' | 'decisao' | 'despacho' | 'sentenca' | 'recurso' | 'audiencia' | 'citacao' | 'intimacao' | 'julgamento' | 'outros';
  badge: string;
}

export const cnjMovimentosMap: Record<string, CnjMovimentoInfo> = {
  // Distribuição e Redistribuição
  "26": {
    titulo: "Distribuição",
    descricao: "O processo foi distribuído ou redistribuído para uma unidade judicial.",
    categoria: "andamento",
    badge: "CNJ 26"
  },
  "36": {
    titulo: "Redistribuição",
    descricao: "O processo foi redistribuído para outra vara ou unidade judicial.",
    categoria: "andamento",
    badge: "CNJ 36"
  },
  
  // Citações e Intimações
  "12": {
    titulo: "Citação",
    descricao: "Ato pelo qual se chama a juízo o réu ou interessado para se defender.",
    categoria: "citacao",
    badge: "CNJ 12"
  },
  "60": {
    titulo: "Expedição de Mandado",
    descricao: "Foi expedido mandado judicial para cumprimento.",
    categoria: "citacao",
    badge: "CNJ 60"
  },
  "61": {
    titulo: "Juntada de Mandado",
    descricao: "Mandado foi juntado aos autos após cumprimento.",
    categoria: "citacao",
    badge: "CNJ 61"
  },
  "85": {
    titulo: "Intimação",
    descricao: "Ato pelo qual se dá ciência à parte de atos e termos do processo.",
    categoria: "intimacao",
    badge: "CNJ 85"
  },
  
  // Audiências
  "970": {
    titulo: "Audiência Designada",
    descricao: "Foi designada data para realização de audiência.",
    categoria: "audiencia",
    badge: "CNJ 970"
  },
  "971": {
    titulo: "Audiência Realizada",
    descricao: "A audiência foi realizada conforme designado.",
    categoria: "audiencia",
    badge: "CNJ 971"
  },
  "972": {
    titulo: "Audiência Cancelada",
    descricao: "A audiência previamente designada foi cancelada.",
    categoria: "audiencia",
    badge: "CNJ 972"
  },
  "11": {
    titulo: "Audiência",
    descricao: "Registro de audiência no processo.",
    categoria: "audiencia",
    badge: "CNJ 11"
  },
  
  // Decisões e Despachos
  "67": {
    titulo: "Despacho",
    descricao: "Despacho proferido pelo juiz para dar andamento ao processo.",
    categoria: "despacho",
    badge: "CNJ 67"
  },
  "3": {
    titulo: "Decisão",
    descricao: "Decisão interlocutória proferida no processo.",
    categoria: "decisao",
    badge: "CNJ 3"
  },
  "193": {
    titulo: "Decisão Interlocutória",
    descricao: "Decisão que resolve questão incidente sem encerrar o processo.",
    categoria: "decisao",
    badge: "CNJ 193"
  },
  
  // Sentenças
  "22": {
    titulo: "Sentença",
    descricao: "Sentença proferida pelo juiz, decidindo o mérito da causa.",
    categoria: "sentenca",
    badge: "CNJ 22"
  },
  "848": {
    titulo: "Sentença com Resolução de Mérito",
    descricao: "Sentença que julga o mérito do pedido.",
    categoria: "sentenca",
    badge: "CNJ 848"
  },
  "849": {
    titulo: "Sentença sem Resolução de Mérito",
    descricao: "Sentença que extingue o processo sem julgar o mérito.",
    categoria: "sentenca",
    badge: "CNJ 849"
  },
  
  // Recursos
  "50": {
    titulo: "Recurso",
    descricao: "Recurso interposto contra decisão judicial.",
    categoria: "recurso",
    badge: "CNJ 50"
  },
  "198": {
    titulo: "Apelação",
    descricao: "Recurso de apelação interposto contra sentença.",
    categoria: "recurso",
    badge: "CNJ 198"
  },
  "199": {
    titulo: "Agravo de Instrumento",
    descricao: "Recurso contra decisão interlocutória.",
    categoria: "recurso",
    badge: "CNJ 199"
  },
  "237": {
    titulo: "Embargos de Declaração",
    descricao: "Recurso para esclarecer obscuridade, contradição ou omissão.",
    categoria: "recurso",
    badge: "CNJ 237"
  },
  
  // Julgamentos
  "442": {
    titulo: "Julgamento",
    descricao: "Julgamento realizado no processo.",
    categoria: "julgamento",
    badge: "CNJ 442"
  },
  "443": {
    titulo: "Trânsito em Julgado",
    descricao: "A decisão transitou em julgado, não cabendo mais recursos.",
    categoria: "julgamento",
    badge: "CNJ 443"
  },
  
  // Petições e Documentos
  "581": {
    titulo: "Petição",
    descricao: "Petição juntada aos autos do processo.",
    categoria: "andamento",
    badge: "CNJ 581"
  },
  "60001": {
    titulo: "Petição Inicial",
    descricao: "Petição inicial do processo foi protocolada.",
    categoria: "andamento",
    badge: "CNJ 60001"
  },
  "852": {
    titulo: "Contestação",
    descricao: "Contestação apresentada pelo réu.",
    categoria: "andamento",
    badge: "CNJ 852"
  },
  "861": {
    titulo: "Réplica",
    descricao: "Réplica apresentada pelo autor.",
    categoria: "andamento",
    badge: "CNJ 861"
  },
  
  // Movimentações de Conclusão
  "51": {
    titulo: "Conclusão",
    descricao: "Autos conclusos ao juiz para análise e decisão.",
    categoria: "andamento",
    badge: "CNJ 51"
  },
  "1013": {
    titulo: "Conclusos para Despacho",
    descricao: "Autos encaminhados ao juiz para despacho.",
    categoria: "andamento",
    badge: "CNJ 1013"
  },
  "1014": {
    titulo: "Conclusos para Decisão",
    descricao: "Autos encaminhados ao juiz para decisão.",
    categoria: "andamento",
    badge: "CNJ 1014"
  },
  "1015": {
    titulo: "Conclusos para Sentença",
    descricao: "Autos encaminhados ao juiz para prolação de sentença.",
    categoria: "andamento",
    badge: "CNJ 1015"
  },
  
  // Arquivamento e Baixa
  "246": {
    titulo: "Baixa Definitiva",
    descricao: "Processo baixado definitivamente.",
    categoria: "andamento",
    badge: "CNJ 246"
  },
  "245": {
    titulo: "Remessa",
    descricao: "Autos remetidos para outra instância ou unidade.",
    categoria: "andamento",
    badge: "CNJ 245"
  },
  "123": {
    titulo: "Arquivamento",
    descricao: "O processo foi arquivado.",
    categoria: "andamento",
    badge: "CNJ 123"
  },
  
  // Suspensão
  "265": {
    titulo: "Suspensão do Processo",
    descricao: "O processo foi suspenso.",
    categoria: "andamento",
    badge: "CNJ 265"
  },
  "266": {
    titulo: "Retomada do Processo",
    descricao: "O processo foi retomado após período de suspensão.",
    categoria: "andamento",
    badge: "CNJ 266"
  },
  
  // Cumprimento de Sentença
  "872": {
    titulo: "Cumprimento de Sentença",
    descricao: "Início da fase de cumprimento de sentença.",
    categoria: "andamento",
    badge: "CNJ 872"
  },
  "874": {
    titulo: "Penhora",
    descricao: "Bens foram penhorados para garantia da execução.",
    categoria: "andamento",
    badge: "CNJ 874"
  },
  
  // Acordo
  "220": {
    titulo: "Acordo/Transação",
    descricao: "As partes celebraram acordo no processo.",
    categoria: "decisao",
    badge: "CNJ 220"
  },
  "221": {
    titulo: "Homologação de Acordo",
    descricao: "Acordo entre as partes foi homologado pelo juiz.",
    categoria: "decisao",
    badge: "CNJ 221"
  }
};

/**
 * Humaniza um campo técnico (tipo) removendo prefixos e formatando
 */
function humanizarTipo(tipo: string): string {
  if (!tipo) return '';
  
  // Remove prefixos técnicos comuns
  let humanizado = tipo
    .replace(/^tipo_de_/i, '')
    .replace(/^tipo_/i, '')
    .replace(/^movimentacao_/i, '')
    .replace(/^mov_/i, '')
    .replace(/_/g, ' ')
    .trim();
  
  // Capitaliza primeira letra de cada palavra
  humanizado = humanizado
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return humanizado;
}

export interface MovimentoEnriquecido {
  // Campos originais
  dataHora: string;
  nome: string;
  complemento?: string;
  codigo?: number;
  tipo?: string;
  
  // Campos enriquecidos
  titulo_humano: string;
  descricao_humana: string;
  badge: string;
  categoria: string;
}

/**
 * Enriquece uma lista de movimentações com traduções humanas
 */
export function enrichMovements(movements: Array<{
  dataHora: string;
  nome: string;
  complemento?: string;
  codigo?: number;
  tipo?: string;
}>): MovimentoEnriquecido[] {
  if (!movements || !Array.isArray(movements)) return [];
  
  return movements.map(mov => {
    const codigoStr = mov.codigo?.toString() || '';
    const mapEntry = cnjMovimentosMap[codigoStr];
    
    let titulo_humano: string;
    let descricao_humana: string;
    let badge: string;
    let categoria: string;
    
    if (mapEntry) {
      titulo_humano = mapEntry.titulo;
      descricao_humana = mapEntry.descricao;
      badge = mapEntry.badge;
      categoria = mapEntry.categoria;
      
      // Contexto extra: se for redistribuição (código 26 ou 36) e houver complemento
      if ((codigoStr === '26' || codigoStr === '36') && mov.complemento) {
        const complementoLower = mov.complemento.toLowerCase();
        if (complementoLower.includes('redistribu') || complementoLower.includes('unidade') || complementoLower.includes('vara')) {
          descricao_humana = "Processo redistribuído para outra unidade judicial.";
        }
      }
    } else {
      // Fallback quando não há tradução
      titulo_humano = mov.codigo 
        ? `Movimentação CNJ ${mov.codigo}` 
        : (mov.nome || 'Movimentação');
      
      descricao_humana = mov.tipo 
        ? humanizarTipo(mov.tipo)
        : (mov.complemento || mov.nome || '');
      
      badge = mov.codigo ? `CNJ ${mov.codigo}` : 'CNJ';
      categoria = 'outros';
    }
    
    return {
      ...mov,
      titulo_humano,
      descricao_humana,
      badge,
      categoria
    };
  });
}

/**
 * Retorna a cor do badge baseada na categoria
 */
export function getCategoriaColor(categoria: string): string {
  const colors: Record<string, string> = {
    andamento: 'bg-blue-100 text-blue-800 border-blue-200',
    decisao: 'bg-purple-100 text-purple-800 border-purple-200',
    despacho: 'bg-slate-100 text-slate-800 border-slate-200',
    sentenca: 'bg-green-100 text-green-800 border-green-200',
    recurso: 'bg-orange-100 text-orange-800 border-orange-200',
    audiencia: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    citacao: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    intimacao: 'bg-pink-100 text-pink-800 border-pink-200',
    julgamento: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    outros: 'bg-gray-100 text-gray-800 border-gray-200'
  };
  
  return colors[categoria] || colors.outros;
}

/**
 * Retorna ícone sugerido baseado na categoria
 */
export function getCategoriaIcon(categoria: string): string {
  const icons: Record<string, string> = {
    andamento: 'FileText',
    decisao: 'Gavel',
    despacho: 'FileCheck',
    sentenca: 'Scale',
    recurso: 'ArrowUpRight',
    audiencia: 'Calendar',
    citacao: 'Mail',
    intimacao: 'Bell',
    julgamento: 'CheckCircle',
    outros: 'Circle'
  };
  
  return icons[categoria] || icons.outros;
}
