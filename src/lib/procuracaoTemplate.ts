import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ProcuracaoData {
  // Cliente/Outorgante
  nome: string;
  nacionalidade?: string;
  estadoCivil?: string;
  profissao?: string;
  rg?: string;
  cpf?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
  
  // Objetivo da procuração
  objetivo?: string;
}

export interface OfficeData {
  officeName?: string;
  oabNumber?: string;
  oabState?: string;
  cnpj?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  email?: string;
  phone?: string;
  website?: string;
  lawyerName?: string;
  oabMain?: string;
  oabSecondary?: string;
}

export function formatQualificacao(data: ProcuracaoData): string {
  const parts: string[] = [];
  
  if (data.nome) parts.push(`<strong>${data.nome.toUpperCase()}</strong>`);
  if (data.nacionalidade) parts.push(data.nacionalidade);
  if (data.estadoCivil) parts.push(data.estadoCivil);
  if (data.profissao) parts.push(data.profissao);
  if (data.rg) parts.push(`portador(a) da cédula de identidade nº ${data.rg}`);
  if (data.cpf) parts.push(`inscrito(a) no CPF sob o nº ${data.cpf}`);
  
  let endereco = '';
  if (data.endereco) {
    endereco = `residente e domiciliado(a) na ${data.endereco}`;
    if (data.numero) endereco += `, nº ${data.numero}`;
    if (data.bairro) endereco += `, bairro: ${data.bairro}`;
    if (data.cep) endereco += `, CEP: ${data.cep}`;
    if (data.cidade && data.uf) endereco += `, ${data.cidade}/${data.uf}`;
  }
  if (endereco) parts.push(endereco);
  
  return parts.join(', ');
}

export function generateProcuracaoHtml(data: ProcuracaoData, office: OfficeData): string {
  const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const qualificacao = formatQualificacao(data);
  
  const objetivo = data.objetivo || 'defesa de seus interesses em juízo ou fora dele';
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Procuração Ad Judicia et Extra - ${data.nome}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm 2.5cm;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 18cm;
      margin: 0 auto;
      padding: 0;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #9B7B3C;
      padding-bottom: 20px;
    }
    .header-logo {
      max-height: 80px;
      margin-bottom: 5px;
    }
    .header h1, .header h2 {
      display: none;
    }
    .title {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      color: #1a365d;
      margin: 30px 0 25px 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .section {
      margin-bottom: 20px;
      text-align: justify;
    }
    .section-title {
      font-weight: bold;
      color: #1a365d;
      margin-bottom: 8px;
    }
    .poderes {
      background: #f8f9fa;
      padding: 15px 20px;
      border-left: 3px solid #c9a227;
      margin: 20px 0;
    }
    .lgpd, .antifraude {
      font-size: 10pt;
      color: #4a5568;
      margin-top: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .lgpd-title, .antifraude-title {
      font-weight: bold;
      color: #1a365d;
      margin-bottom: 8px;
      font-size: 10pt;
    }
    .data-local {
      text-align: center;
      margin: 40px 0 30px 0;
    }
    .assinatura {
      text-align: center;
      margin-top: 60px;
    }
    .assinatura-linha {
      border-top: 1px solid #1a1a1a;
      width: 300px;
      margin: 60px auto 10px auto;
    }
    .assinatura-nome {
      font-weight: bold;
      text-transform: uppercase;
    }
    .footer {
      margin-top: 40px;
      padding: 15px 20px;
      background: #2D2D2D;
      text-align: center;
      border-radius: 0 0 4px 4px;
    }
    .footer-line {
      margin: 3px 0;
      color: #B0B0B0;
      font-size: 9pt;
    }
    .footer-line strong {
      color: #C4A95B;
      font-size: 10pt;
      letter-spacing: 1px;
    }
    .footer-line a {
      color: #7BA4D4;
    }
  </style>
</head>
<body>
  <div class="header">
    <img class="header-logo" src="/images/logo-bentes-ramos-header.jpg" alt="Bentes Ramos - Advocacia e Consultoria Jurídica" />
  </div>

  <div class="title">INSTRUMENTO DE PROCURAÇÃO "AD JUDICIA ET EXTRA"</div>

  <div class="section">
    <span class="section-title">OUTORGANTE:</span> ${qualificacao}.
  </div>

  <div class="section">
    <p>Nomeia e constitui seus procuradores os outorgados abaixo qualificados:</p>
  </div>

  <div class="section">
    <span class="section-title">OUTORGADO:</span> A presente procuração é concedida aos advogados integrantes do escritório <strong>${office.officeName || 'BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA'}</strong>, inscrito na OAB/${office.oabState || 'AM'} sob o nº ${office.oabNumber || '115/2016'} e no CNPJ nº ${office.cnpj || '29.516.950/0001-55'}, com sede na ${office.address || 'Rua Salvador, nº 120, sala 708, 7º andar – Edifício Vieiralves Business Center'}, bairro: Adrianópolis, ${office.city || 'Manaus'}/${office.state || 'AM'}, CEP: ${office.zipCode || '69.057-040'}, que atuará através de seus advogados ${office.lawyerName || 'ANDREY AUGUSTO BENTES RAMOS'}, inscrito na OAB/${office.oabState || 'AM'} sob o nº ${office.oabMain || '7.526'}${office.oabSecondary ? ` e GUSTAVO DA SILVA GRILLO, inscrito na OAB/${office.oabState || 'AM'} sob o nº ${office.oabSecondary}` : ''}, com endereço eletrônico ${office.email || 'juridico@bentesramos.adv.br'} e telefone: ${office.phone || '(92) 3343-6173 / 99160-4348 / 98223-7330'}.
  </div>

  <div class="poderes">
    <div class="section-title">PODERES:</div>
    <p>Nos termos do art. 105 do Código de Processo Civil, os contidos na cláusula "ad judicia et extra", para, em nome do outorgante, em qualquer Juízo, Instância ou Tribunal, ou fora deles, defender seus interesses, podendo propor contra quem de direito as ações competentes e defender os interesses da outorgante nas contrárias, seguindo umas e outras, até final decisão, usando dos recursos legais e acompanhando-os, conferindo-lhes, ainda, <strong>PODERES ESPECIAIS</strong> para confessar, desistir, transigir, firmar compromissos ou acordos, receber e dar quitação, receber alvará, reconhecer procedência de pedido, renunciar a direito no qual se funda ação agindo em conjunto ou separadamente, podendo ainda substabelecer esta em outrem, com ou sem reservas de iguais poderes, pedir o benefício da Justiça Gratuita e assinar declaração de hipossuficiência econômica, dando tudo por bom, firme e valioso, a fim de ${objetivo}.</p>
  </div>

  <div class="lgpd">
    <div class="lgpd-title">Lei Geral de Proteção de Dados:</div>
    <p>Considerando a Lei Geral de Proteção de Dados, o OUTORGANTE declara ter ciência da necessidade dos dados aqui coletados e dá consentimento do uso dos seus dados pelos CONTRATADOS para a finalidade exclusiva de propositura de demanda judicial, em observância ao cumprimento das regras quanto à proteção de dados, diante dos princípios da necessidade, finalidade e/ou autodeterminação informativa, inclusive no tratamento de dados pessoais sensíveis, de acordo com obrigação legal de coleta dos dados.</p>
  </div>

  <div class="antifraude">
    <div class="antifraude-title">Declaração de Ciência sobre Tentativas de Fraude ("Golpe do Falso Advogado"):</div>
    <p>O(A) OUTORGANTE declara estar ciente de que não deve realizar qualquer pagamento ou transferência bancária em nome de custas, honorários ou qualquer outra finalidade sem prévia confirmação direta com os advogados constituídos nesta procuração, exclusivamente pelos canais de contato informados neste instrumento. Está devidamente orientada a não atender solicitações por meio de WhatsApp, e-mails ou ligações telefônicas não oficiais, especialmente em casos de pessoas se passando por advogados ou servidores do Judiciário. Esta cláusula visa prevenir prejuízos decorrentes do chamado "golpe do falso advogado", sendo a outorgante orientada a comunicar imediatamente o escritório em caso de tentativa suspeita.</p>
  </div>

  <div class="data-local">
    ${office.city || 'Manaus'}/${office.state || 'AM'}, ${dataAtual}.
  </div>

  <div class="assinatura">
    <div class="assinatura-linha"></div>
    <div class="assinatura-nome">${data.nome?.toUpperCase() || 'OUTORGANTE'}</div>
  </div>

  <div class="footer">
    <div class="footer-line"><strong>${office.officeName || 'BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA'}</strong></div>
    <div class="footer-line">End.: ${office.address || 'Rua Salvador, n° 120, sala 708, 7° andar – Edifício Vieiralves Business Center'} – bairro: Adrianópolis – ${office.city || 'Manaus'}/${office.state || 'AM'} – Cep: ${office.zipCode || '69.057-040'}</div>
    <div class="footer-line">Tel.: ${office.phone || '(92) 3343-6173'} – Cel.: (92) 98223-7330 / 98160-4348 · E-mail: <a href="mailto:${office.email || 'juridico@bentesramos.adv.br'}">${office.email || 'juridico@bentesramos.adv.br'}</a></div>
  </div>
</body>
</html>
`;
}
