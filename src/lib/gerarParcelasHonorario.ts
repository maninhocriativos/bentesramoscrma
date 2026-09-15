import { Parcela } from '@/types/financeiro';

type ParcelaNova = Omit<Parcela, 'id' | 'created_at' | 'updated_at'>;

/**
 * Gera as parcelas reais de um honorário. Antes disso, `num_parcelas` era
 * só um número salvo no contrato — nada criava as linhas em `parcelas`,
 * então não havia o que cobrar/marcar como pago (achado explorando o
 * financeiro pra adicionar inadimplência/DRE, sem parcela real não tem o
 * que mostrar em nenhum dos dois).
 *
 * Regra (confirmada com o usuário): se houver `valor_entrada`, ela vira a
 * 1ª parcela vencendo na data do contrato; o saldo restante é dividido
 * pelas parcelas seguintes, cada uma vencendo 1 mês depois da anterior. Sem
 * entrada, todas as parcelas são iguais, mesma cadência mensal. "À Vista"
 * sempre vira 1 parcela única do valor total.
 */
export function gerarParcelasHonorario(input: {
  valor_total: number;
  valor_entrada: number | null;
  forma_pagamento: 'À Vista' | 'Parcelado';
  num_parcelas: number | null;
  data_contrato: string; // 'YYYY-MM-DD'
}, honorarioId: string): ParcelaNova[] {
  const base = (n: number, valor: number, vencimento: string): ParcelaNova => ({
    honorario_id: honorarioId,
    conta_bancaria_id: null,
    numero: n,
    valor: Math.round(valor * 100) / 100,
    data_vencimento: vencimento,
    data_pagamento: null,
    status: 'Pendente',
    forma_pagamento: null,
    comprovante_url: null,
  });

  // Vencimento da parcela N (1-indexed): data_contrato + (N-1) meses. Parseia
  // com T12:00:00 pra não sofrer shift de fuso (mesmo padrão já usado em
  // AnalyticsTab.tsx pra datas puramente de calendário).
  const vencimentoDaParcela = (n: number): string => {
    const d = new Date(`${input.data_contrato}T12:00:00`);
    d.setMonth(d.getMonth() + (n - 1));
    return d.toISOString().slice(0, 10);
  };

  if (input.forma_pagamento === 'À Vista') {
    return [base(1, input.valor_total, input.data_contrato)];
  }

  const numParcelas = Math.max(2, input.num_parcelas || 2);
  const entrada = input.valor_entrada || 0;
  const parcelas: ParcelaNova[] = [];
  let numero = 1;

  if (entrada > 0) {
    parcelas.push(base(numero, entrada, input.data_contrato));
    numero++;
  }

  const saldo = Math.round((input.valor_total - entrada) * 100) / 100;
  const restantes = entrada > 0 ? numParcelas - 1 : numParcelas;
  if (restantes <= 0) return parcelas;

  const valorCada = Math.floor((saldo / restantes) * 100) / 100;
  let somaLancada = 0;
  for (let i = 0; i < restantes; i++) {
    const ultima = i === restantes - 1;
    // A última absorve o resto do arredondamento, pra bater centavo a
    // centavo com valor_total.
    const valor = ultima ? Math.round((saldo - somaLancada) * 100) / 100 : valorCada;
    somaLancada += valor;
    parcelas.push(base(numero, valor, vencimentoDaParcela(numero)));
    numero++;
  }

  return parcelas;
}
