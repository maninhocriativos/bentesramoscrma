/**
 * Busca de processo por texto livre — cliente, título E número, com ou sem
 * pontuação do CNJ.
 *
 * Antes, todos os campos de busca faziam só `numero_processo.ilike.%q%`, então
 * digitar "70491919220268220001" (sem pontos/traço) não achava
 * "7049191-92.2026.8.22.0001". Agora, quando a busca contém dígitos, também
 * compara com `processos.numero_processo_digits` (coluna gerada só com os
 * dígitos — migration 20260904120000).
 */

/** Só os dígitos de um texto ('' se não houver). */
export function somenteDigitos(texto: string | null | undefined): string {
  return (texto || '').replace(/\D/g, '');
}

/**
 * Escapa o que quebraria a sintaxe do `.or()` do PostgREST (vírgula/parênteses
 * separam condições) e os curingas do ILIKE.
 */
function escaparParaOr(texto: string): string {
  return texto.replace(/[,()]/g, ' ').replace(/[%_\\]/g, m => `\\${m}`).trim();
}

/**
 * Monta a string do `.or()` do Supabase pra buscar processos.
 *
 * @param q          texto digitado
 * @param colunas    colunas de texto a comparar com ILIKE (`nome_cliente`, `titulo_acao`, ...)
 * @returns          string pronta pra `.or(...)`, ou null se a busca ficou vazia após limpeza
 *
 * Ex.: buildProcessoSearchOr('7049191', ['nome_cliente'])
 *   → "nome_cliente.ilike.%7049191%,numero_processo.ilike.%7049191%,numero_processo_digits.ilike.%7049191%"
 */
export function buildProcessoSearchOr(q: string, colunas: string[]): string | null {
  const termo = escaparParaOr(q);
  if (!termo) return null;

  const partes = [...colunas, 'numero_processo'].map(c => `${c}.ilike.%${termo}%`);

  // Só vale comparar dígitos se sobrou dígito suficiente pra não casar com
  // tudo (2+ dígitos). Um "a" ou "-" não vira busca por número.
  const digitos = somenteDigitos(q);
  if (digitos.length >= 2) {
    partes.push(`numero_processo_digits.ilike.%${digitos}%`);
  }
  return partes.join(',');
}

/**
 * Versão client-side do mesmo critério, pra listas já carregadas em memória
 * (ex.: filtro da página de Processos). Casa pelo número formatado OU pelos
 * dígitos.
 */
export function numeroProcessoCasa(numero: string | null | undefined, q: string): boolean {
  if (!numero) return false;
  const termo = q.trim().toLowerCase();
  if (!termo) return true;
  if (numero.toLowerCase().includes(termo)) return true;
  const digitosBusca = somenteDigitos(q);
  return digitosBusca.length >= 2 && somenteDigitos(numero).includes(digitosBusca);
}
