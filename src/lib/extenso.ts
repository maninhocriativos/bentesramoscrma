// Conversão de números para extenso em português (BR).
// Usado no gerador de petições para preencher automaticamente os campos "por extenso".

const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

// Extenso de um grupo de 0 a 999.
function grupoPorExtenso(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';

  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];

  if (c > 0) partes.push(CENTENAS[c]);

  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }

  return partes.join(' e ');
}

/** Número inteiro (0 a 999.999.999) por extenso. */
export function inteiroPorExtenso(numero: number): string {
  const n = Math.floor(Math.abs(numero));
  if (n === 0) return 'zero';

  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const centenas = n % 1000;

  const partes: string[] = [];

  if (milhoes > 0) {
    partes.push(milhoes === 1 ? 'um milhão' : `${grupoPorExtenso(milhoes)} milhões`);
  }
  if (milhares > 0) {
    // O escritório usa o padrão "um mil ..." (ex.: "um mil, duzentos e oitenta e seis reais").
    partes.push(milhares === 1 ? 'um mil' : `${grupoPorExtenso(milhares)} mil`);
  }
  if (centenas > 0) {
    partes.push(grupoPorExtenso(centenas));
  }

  // Regras de conexão com "e" (ex.: "dois mil e cinco", "mil e duzentos").
  let texto = partes[0];
  for (let i = 1; i < partes.length; i++) {
    const anterior = partes[i - 1];
    const atual = partes[i];
    // Usa "e" quando o bloco final é < 100 ou múltiplo exato de 100.
    const ultimoValor = i === partes.length - 1 ? centenas : milhares;
    const usaE = ultimoValor < 100 || ultimoValor % 100 === 0;
    texto += (usaE ? ' e ' : ', ') + atual;
    void anterior;
  }
  return texto;
}

// Converte "2.000,05" | "2000.05" | "2000,05" | number → número.
function parseValor(input: string | number): number {
  if (typeof input === 'number') return input;
  const limpo = String(input).replace(/[^\d,.-]/g, '').trim();
  if (!limpo) return NaN;
  // Se tem vírgula, ela é o separador decimal (padrão BR).
  if (limpo.includes(',')) {
    return parseFloat(limpo.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(limpo);
}

/** Valor monetário por extenso: 2000.05 → "dois mil reais e cinco centavos". */
export function reaisPorExtenso(input: string | number): string {
  const valor = parseValor(input);
  if (isNaN(valor)) return '';

  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);

  const partes: string[] = [];
  if (inteiro > 0) {
    partes.push(`${inteiroPorExtenso(inteiro)} ${inteiro === 1 ? 'real' : 'reais'}`);
  }
  if (centavos > 0) {
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  }
  if (partes.length === 0) return 'zero reais';
  return partes.join(' e ');
}
