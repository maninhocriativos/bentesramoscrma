// Uma requisição isolada pode falhar por instabilidade transitória de rede
// (TypeError: Failed to fetch — falha antes de qualquer resposta do
// servidor, não é erro do Postgres/PostgREST) sem que a próxima tentativa
// falhe também. Reduz a chance de uma página específica derrubar a busca
// inteira quando várias páginas são pedidas em paralelo.
async function withRetry<T>(
  run: () => PromiseLike<{ data: T[] | null; error: any }>,
  attempts = 3,
): Promise<{ data: T[] | null; error: any }> {
  let lastError: any = null;
  for (let i = 0; i < attempts; i++) {
    const result = await run();
    if (!result.error) return result;
    lastError = result.error;
    // Só vale a pena tentar de novo erro de rede (nunca resolveu, sem
    // resposta) — erro real do Postgres/PostgREST repete na mesma hora.
    const isNetworkError = result.error instanceof TypeError || /fetch/i.test(String(result.error?.message || ''));
    if (!isNetworkError || i === attempts - 1) break;
    await new Promise(res => setTimeout(res, 400 * (i + 1)));
  }
  return { data: null, error: lastError };
}

// Busca todas as linhas de uma tabela contornando o teto de 1000 linhas por
// requisição do PostgREST. Dispara a primeira página, e enquanto ela vier
// cheia, busca as próximas em lotes paralelos (em vez de uma de cada vez) —
// reduz o tempo total de N round-trips sequenciais para ~2 na maioria dos casos.
export async function fetchAllPaginated<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000,
  concurrency = 4,
): Promise<{ data: T[]; error: any }> {
  const first = await withRetry(() => buildQuery(0, pageSize - 1));
  if (first.error) return { data: [], error: first.error };

  const rows: T[] = [...(first.data || [])];
  if (!first.data || first.data.length < pageSize) return { data: rows, error: null };

  let page = 1;
  while (true) {
    const batch = Array.from({ length: concurrency }, (_, i) => page + i);
    const results = await Promise.all(
      batch.map((p) => withRetry(() => buildQuery(p * pageSize, (p + 1) * pageSize - 1)))
    );

    let done = false;
    for (const r of results) {
      if (r.error) return { data: rows, error: r.error };
      rows.push(...(r.data || []));
      if (!r.data || r.data.length < pageSize) done = true;
    }
    if (done) break;
    page += concurrency;
  }

  return { data: rows, error: null };
}
