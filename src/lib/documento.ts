// Máscara e validação de documentos brasileiros (CPF / CNPJ).

/** Aplica a pontuação conforme o usuário digita: CPF 000.000.000-00, CNPJ 00.000.000/0000-00. */
export function formatCpfCnpj(value: string): string {
  const d = (value || '').replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Só CPF (000.000.000-00). */
export function formatCpf(value: string): string {
  const d = (value || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function isValidCpf(value: string): boolean {
  const c = (value || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i], 10) * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0;
  if (r !== parseInt(c[9], 10)) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i], 10) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  return r === parseInt(c[10], 10);
}

export function isValidCnpj(value: string): boolean {
  const c = (value || '').replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    let s = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) { s += parseInt(c[len - i], 10) * pos--; if (pos < 2) pos = 9; }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(c[12], 10) && calc(13) === parseInt(c[13], 10);
}

/** Valida CPF (11 díg.) ou CNPJ (14 díg.). Retorna false para tamanhos incompletos. */
export function isValidCpfCnpj(value: string): boolean {
  const d = (value || '').replace(/\D/g, '');
  if (d.length === 11) return isValidCpf(value);
  if (d.length === 14) return isValidCnpj(value);
  return false;
}

/** true quando o documento tem tamanho completo (11 ou 14 díg.) mas é inválido — para feedback visual. */
export function isCpfCnpjInvalidoCompleto(value: string): boolean {
  const d = (value || '').replace(/\D/g, '');
  return (d.length === 11 || d.length === 14) && !isValidCpfCnpj(value);
}
