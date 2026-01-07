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

export const MANAUS_TIMEZONE = TIMEZONE;
