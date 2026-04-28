/**
 * Helpers de fuso horário padronizados para America/Manaus (UTC-4)
 * Todas as funções da Isa devem usar estes helpers para formatar datas/horas.
 */

const TIMEZONE = 'America/Manaus';

/**
 * Formata data completa: "07/01/2026 às 14:30"
 */
export function formatarDataHora(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(',', ' às');
}

/**
 * Formata apenas data: "07/01/2026"
 */
export function formatarData(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formata apenas hora: "14:30"
 */
export function formatarHora(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('pt-BR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formata data por extenso: "terça-feira, 07 de janeiro"
 */
export function formatarDataExtenso(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

/**
 * Formata data por extenso com hora: "terça-feira, 07 de janeiro às 14:30"
 */
export function formatarDataHoraExtenso(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dataExtenso = d.toLocaleDateString('pt-BR', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const hora = formatarHora(d);
  return `${dataExtenso} às ${hora}`;
}

/**
 * Retorna a data atual no fuso de Manaus no formato YYYY-MM-DD
 */
export function getHojeManaus(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Retorna o início do dia atual em Manaus como Date (UTC)
 */
export function getInicioHojeUtc(): Date {
  const hojeManaus = getHojeManaus();
  return new Date(`${hojeManaus}T00:00:00-04:00`);
}

/**
 * Retorna o início de amanhã em Manaus como Date (UTC)
 */
export function getInicioAmanhaUtc(): Date {
  const inicioHoje = getInicioHojeUtc();
  return new Date(inicioHoje.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Formata data curta para mensagens: "terça, 07/01"
 */
export function formatarDataCurta(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    timeZone: TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

/**
 * Formata para exibição em tabelas/listas: "07 jan 2026"
 */
export function formatarDataAbreviada(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Retorna o início da próxima segunda-feira em Manaus como Date (UTC)
 * Usado para garantir que agendamentos só sejam feitos a partir da próxima semana
 */
export function getProximaSegundaUtc(): Date {
  const agora = new Date();
  // Converter para hora de Manaus para pegar o dia correto
  const hojeManaus = getHojeManaus();
  const dataManaus = new Date(`${hojeManaus}T00:00:00-04:00`);
  
  // Dia da semana em Manaus (0 = domingo, 1 = segunda, ...)
  const diaSemana = dataManaus.getDay();
  
  // Calcular quantos dias até a próxima segunda
  // Se hoje é segunda (1), próxima segunda é em 7 dias
  // Se hoje é terça (2), próxima segunda é em 6 dias
  // Se hoje é domingo (0), próxima segunda é em 1 dia
  const diasAteSegunda = diaSemana === 0 ? 1 : (8 - diaSemana);
  
  const proximaSegunda = new Date(dataManaus.getTime() + diasAteSegunda * 24 * 60 * 60 * 1000);
  return proximaSegunda;
}

/**
 * Verifica se uma data está na próxima semana ou posterior
 */
export function isDataNaProximaSemana(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const proximaSegunda = getProximaSegundaUtc();
  return d >= proximaSegunda;
}

/**
 * Formata a data da próxima segunda para exibição
 */
export function getProximaSegundaFormatada(): string {
  const proximaSegunda = getProximaSegundaUtc();
  return formatarData(proximaSegunda);
}

// ============================================================
// REGRAS DE AGENDAMENTO (ESPECIFICAÇÃO OFICIAL)
// ============================================================

/**
 * Dias permitidos para agendamento: Terça (2) e Quinta (4)
 */
export const DIAS_PERMITIDOS = [2, 4]; // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab

/**
 * Nomes dos dias da semana
 */
export const NOMES_DIAS: Record<number, string> = {
  0: 'domingo',
  1: 'segunda-feira',
  2: 'terça-feira',
  3: 'quarta-feira',
  4: 'quinta-feira',
  5: 'sexta-feira',
  6: 'sábado'
};

/**
 * Horário de funcionamento: 09:00 às 17:00
 * Almoço (bloqueio): 12:00 às 14:00
 * Duração: 1 hora
 * Intervalo: 1 hora entre atendimentos
 * 
 * Slots válidos: 09:00, 10:00, 11:00, 14:00, 15:00, 16:00
 */
export const HORARIOS_DISPONIVEIS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

/**
 * Verifica se o dia da semana é permitido para agendamento
 */
export function isDiaPermitido(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  // Obter dia da semana em Manaus
  const formatter = new Intl.DateTimeFormat('en-US', { 
    timeZone: TIMEZONE, 
    weekday: 'short' 
  });
  const diaSemanaStr = formatter.format(d);
  const diasMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  const diaSemana = diasMap[diaSemanaStr] ?? 0;
  
  return DIAS_PERMITIDOS.includes(diaSemana);
}

/**
 * Verifica se o horário está dentro do expediente e fora do almoço
 */
export function isHorarioValido(hora: string): boolean {
  return HORARIOS_DISPONIVEIS.includes(hora);
}

/**
 * Valida completamente um agendamento
 */
export interface ValidacaoAgendamento {
  valido: boolean;
  motivo?: string;
  sugestoes?: string[];
}

export function validarAgendamento(date: Date | string, hora?: string): ValidacaoAgendamento {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Verificar se está na próxima semana
  if (!isDataNaProximaSemana(d)) {
    const proximaSegunda = getProximaSegundaFormatada();
    return {
      valido: false,
      motivo: `Agendamentos devem ser para a PRÓXIMA SEMANA (a partir de ${proximaSegunda}).`,
      sugestoes: getProximosDiasDisponiveis(3)
    };
  }
  
  // Obter dia da semana em Manaus
  const formatter = new Intl.DateTimeFormat('en-US', { 
    timeZone: TIMEZONE, 
    weekday: 'short' 
  });
  const diaSemanaStr = formatter.format(d);
  const diasMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  const diaSemana = diasMap[diaSemanaStr] ?? d.getDay();
  
  // Verificar se é dia permitido
  if (!DIAS_PERMITIDOS.includes(diaSemana)) {
    const nomeDia = NOMES_DIAS[diaSemana];
    return {
      valido: false,
      motivo: `${nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1)} NÃO é dia de atendimento. Atendemos apenas Terça e Quinta.`,
      sugestoes: getProximosDiasDisponiveis(3)
    };
  }
  
  // Verificar horário se informado
  if (hora && !isHorarioValido(hora)) {
    return {
      valido: false,
      motivo: `Horário ${hora} não disponível. Horários válidos: ${HORARIOS_DISPONIVEIS.join(', ')} (duração 1h, intervalo 1h, almoço 12-14h).`,
      sugestoes: HORARIOS_DISPONIVEIS
    };
  }
  
  return { valido: true };
}

/**
 * Retorna os próximos N dias disponíveis para agendamento
 */
export function getProximosDiasDisponiveis(quantidade: number = 3): string[] {
  const dias: string[] = [];
  const proximaSegunda = getProximaSegundaUtc();
  let dataAtual = new Date(proximaSegunda);
  
  while (dias.length < quantidade) {
    const formatter = new Intl.DateTimeFormat('en-US', { 
      timeZone: TIMEZONE, 
      weekday: 'short' 
    });
    const diaSemanaStr = formatter.format(dataAtual);
    const diasMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const diaSemana = diasMap[diaSemanaStr] ?? dataAtual.getDay();
    
    if (DIAS_PERMITIDOS.includes(diaSemana)) {
      dias.push(formatarDataCurta(dataAtual) + ' (' + HORARIOS_DISPONIVEIS.join(', ') + ')');
    }
    
    dataAtual = new Date(dataAtual.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return dias;
}

/**
 * Gera sugestões de horários disponíveis para uma data
 */
export function getSugestoesHorarios(date: Date | string, horariosOcupados: string[] = []): string[] {
  const validacao = validarAgendamento(date);
  if (!validacao.valido) {
    return [];
  }
  
  return HORARIOS_DISPONIVEIS.filter(h => !horariosOcupados.includes(h));
}

export const MANAUS_TIMEZONE = TIMEZONE;
