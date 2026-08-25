// Busca todas as linhas de uma tabela contornando o teto de 1000 linhas por
// requisição do PostgREST. Dispara a primeira página, e enquanto ela vier
// cheia, busca as próximas em lotes paralelos (em vez de uma de cada vez) —
// reduz o tempo total de N round-trips sequenciais para ~2 na maioria dos casos.
export async function fetchAllPaginated<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000,
  concurrency = 4,
): Promise<{ data: T[]; error: any }> {
  const first = await buildQuery(0, pageSize - 1);
  if (first.error) return { data: [], error: first.error };

  const rows: T[] = [...(first.data || [])];
  if (!first.data || first.data.length < pageSize) return { data: rows, error: null };

  let page = 1;
  while (true) {
    const batch = Array.from({ length: concurrency }, (_, i) => page + i);
    const results = await Promise.all(
      batch.map((p) => buildQuery(p * pageSize, (p + 1) * pageSize - 1))
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
