import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Download, Eye, Plus, Scale, Building2, Users, Car, Home, Briefcase, ExternalLink } from 'lucide-react';

interface ModeloContrato {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  icon: React.ReactNode;
  conteudo: string;
}

const modelosContratos: ModeloContrato[] = [
  {
    id: '1',
    nome: 'Contrato de Honorários Advocatícios',
    descricao: 'Modelo padrão para prestação de serviços jurídicos com cláusulas de honorários fixos e de êxito.',
    categoria: 'Honorários',
    icon: <Scale className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS

CONTRATANTE: [NOME DO CLIENTE], [nacionalidade], [estado civil], [profissão], portador(a) do RG nº [XXX] e CPF nº [XXX.XXX.XXX-XX], residente e domiciliado(a) na [Endereço completo].

CONTRATADO: [NOME DO ESCRITÓRIO/ADVOGADO], inscrito na OAB/[UF] sob o nº [XXXXX], com escritório profissional na [Endereço do escritório].

CLÁUSULA PRIMEIRA - DO OBJETO
O presente contrato tem por objeto a prestação de serviços advocatícios pelo CONTRATADO ao CONTRATANTE, consistentes em:
a) Consultoria jurídica;
b) Elaboração de peças processuais;
c) Acompanhamento processual;
d) Representação em audiências e sustentações orais.

CLÁUSULA SEGUNDA - DOS HONORÁRIOS
Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO:
a) Honorários fixos no valor de R$ [VALOR] ([valor por extenso]);
b) Honorários de êxito correspondentes a [XX]% ([percentual por extenso]) sobre o proveito econômico obtido.

CLÁUSULA TERCEIRA - DA FORMA DE PAGAMENTO
O pagamento dos honorários fixos será realizado da seguinte forma:
a) Entrada de R$ [VALOR] na assinatura deste contrato;
b) [X] parcelas de R$ [VALOR], com vencimento todo dia [XX] de cada mês.

CLÁUSULA QUARTA - DAS OBRIGAÇÕES DO CONTRATADO
São obrigações do CONTRATADO:
a) Prestar os serviços com dedicação e zelo profissional;
b) Manter o CONTRATANTE informado sobre o andamento do processo;
c) Observar os prazos processuais;
d) Guardar sigilo sobre as informações recebidas.

CLÁUSULA QUINTA - DAS OBRIGAÇÕES DO CONTRATANTE
São obrigações do CONTRATANTE:
a) Fornecer todos os documentos e informações necessários;
b) Efetuar o pagamento dos honorários nas datas acordadas;
c) Arcar com as custas processuais e demais despesas.

CLÁUSULA SEXTA - DA RESCISÃO
O presente contrato poderá ser rescindido:
a) Por acordo entre as partes;
b) Por inadimplemento de qualquer das cláusulas;
c) Por desistência do CONTRATANTE, caso em que serão devidos os honorários proporcionais.

CLÁUSULA SÉTIMA - DO FORO
Fica eleito o foro da Comarca de [CIDADE/UF] para dirimir quaisquer dúvidas decorrentes do presente contrato.

E, por estarem assim justos e contratados, firmam o presente instrumento em 02 (duas) vias de igual teor e forma.

[Local], [Data]

_______________________________
CONTRATANTE

_______________________________
CONTRATADO
OAB/[UF] nº [XXXXX]`,
  },
  {
    id: '2',
    nome: 'Procuração Ad Judicia',
    descricao: 'Procuração para representação em processos judiciais com poderes especiais.',
    categoria: 'Procuração',
    icon: <FileText className="h-5 w-5" />,
    conteudo: `PROCURAÇÃO AD JUDICIA ET EXTRA

OUTORGANTE: [NOME COMPLETO], [nacionalidade], [estado civil], [profissão], portador(a) da Cédula de Identidade RG nº [XXX] e inscrito(a) no CPF sob o nº [XXX.XXX.XXX-XX], residente e domiciliado(a) na [Endereço completo], CEP [XXXXX-XXX].

OUTORGADO(A): [NOME DO ADVOGADO], brasileiro(a), advogado(a), inscrito(a) na OAB/[UF] sob o nº [XXXXX], com escritório profissional na [Endereço do escritório], CEP [XXXXX-XXX].

PODERES: Por este instrumento particular de procuração, o OUTORGANTE nomeia e constitui o OUTORGADO como seu bastante procurador, a quem confere amplos poderes para o foro em geral, com a cláusula "AD JUDICIA ET EXTRA", podendo propor contra quem de direito as ações competentes e defendê-lo(a) nas contrárias, seguindo umas e outras até final decisão, usando dos recursos legais e acompanhando-os, conferindo-lhe ainda os poderes especiais para confessar, desistir, transigir, firmar compromissos ou acordos, receber e dar quitação, agindo em conjunto ou separadamente, podendo ainda substabelecer com ou sem reserva de iguais poderes, dando tudo por bom, firme e valioso.

[Local], [Data por extenso]

_______________________________
OUTORGANTE
[NOME COMPLETO]
CPF: [XXX.XXX.XXX-XX]`,
  },
  {
    id: '3',
    nome: 'Contrato Trabalhista - Reclamação',
    descricao: 'Modelo para ações trabalhistas com cláusulas específicas para reclamações.',
    categoria: 'Trabalhista',
    icon: <Briefcase className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - AÇÃO TRABALHISTA

CONTRATANTE: [NOME DO RECLAMANTE], brasileiro(a), [estado civil], [profissão], portador(a) do RG nº [XXX] e CPF nº [XXX.XXX.XXX-XX], CTPS nº [XXXXX], Série [XXX], residente e domiciliado(a) na [Endereço completo].

CONTRATADO: [NOME DO ADVOGADO], advogado(a), inscrito(a) na OAB/[UF] sob o nº [XXXXX], com escritório na [Endereço].

CLÁUSULA PRIMEIRA - DO OBJETO
O presente contrato tem por objeto a prestação de serviços advocatícios para propositura de RECLAMATÓRIA TRABALHISTA em face de [NOME DA EMPRESA RECLAMADA], CNPJ [XX.XXX.XXX/XXXX-XX], visando:
a) Verbas rescisórias não pagas ou pagas incorretamente;
b) Horas extras;
c) Adicional noturno;
d) FGTS não depositado;
e) Seguro-desemprego;
f) Demais direitos trabalhistas devidos.

CLÁUSULA SEGUNDA - DOS HONORÁRIOS
Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO honorários de êxito no percentual de [XX]% ([por extenso]) sobre o valor bruto da condenação ou acordo, incluindo:
a) Parcelas vencidas e vincendas;
b) Custas e honorários de sucumbência.

CLÁUSULA TERCEIRA - DO PAGAMENTO
Os honorários serão pagos no ato do recebimento dos créditos trabalhistas, seja por alvará judicial, acordo ou qualquer outra forma de pagamento.

CLÁUSULA QUARTA - DAS DESPESAS PROCESSUAIS
O CONTRATANTE se compromete a arcar com todas as despesas processuais, incluindo:
a) Custas judiciais (se houver);
b) Perícias técnicas;
c) Diligências externas.

CLÁUSULA QUINTA - DAS OBRIGAÇÕES
O CONTRATADO se compromete a:
a) Manter o CONTRATANTE informado sobre o andamento do processo;
b) Comparecer a todas as audiências designadas;
c) Atuar com dedicação e ética profissional.

[Local], [Data]

_______________________________
CONTRATANTE

_______________________________
CONTRATADO
OAB/[UF] nº [XXXXX]`,
  },
  {
    id: '4',
    nome: 'Contrato Cível - Indenização',
    descricao: 'Modelo para ações de indenização por danos morais e materiais.',
    categoria: 'Cível',
    icon: <Users className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - AÇÃO DE INDENIZAÇÃO

CONTRATANTE: [NOME], [qualificação completa].

CONTRATADO: [NOME DO ADVOGADO], OAB/[UF] nº [XXXXX].

OBJETO: Propositura de AÇÃO DE INDENIZAÇÃO POR DANOS MORAIS E MATERIAIS em face de [NOME DO RÉU/EMPRESA].

DOS FATOS:
[Descrição dos fatos que ensejam a ação de indenização]

DOS HONORÁRIOS:
a) Honorários fixos: R$ [VALOR];
b) Honorários de êxito: [XX]% sobre o valor da condenação/acordo.

DAS OBRIGAÇÕES:
O CONTRATADO se obriga a atuar com zelo e dedicação, mantendo o CONTRATANTE informado sobre o andamento processual.

O CONTRATANTE se obriga a fornecer todos os documentos e informações necessários para a propositura da ação.

[Local], [Data]

_______________________________
CONTRATANTE

_______________________________
CONTRATADO`,
  },
  {
    id: '5',
    nome: 'Contrato Imobiliário',
    descricao: 'Modelo para ações imobiliárias, usucapião e disputas de propriedade.',
    categoria: 'Imobiliário',
    icon: <Home className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - AÇÃO IMOBILIÁRIA

CONTRATANTE: [NOME], [qualificação completa].

CONTRATADO: [NOME DO ADVOGADO], OAB/[UF] nº [XXXXX].

OBJETO: Prestação de serviços jurídicos na área imobiliária, incluindo:
[ ] Ação de Usucapião
[ ] Adjudicação Compulsória
[ ] Ação Reivindicatória
[ ] Reintegração de Posse
[ ] Despejo
[ ] Revisão de Aluguel
[ ] Regularização de Imóvel

IMÓVEL OBJETO DA AÇÃO:
Endereço: [Endereço completo]
Matrícula: [Número] do [X]º CRI de [Cidade/UF]
Área: [XXX] m²

DOS HONORÁRIOS:
a) Honorários fixos: R$ [VALOR] (entrada + parcelas);
b) Honorários de êxito: [XX]% sobre o valor do imóvel ou proveito econômico.

[Local], [Data]

_______________________________
CONTRATANTE

_______________________________
CONTRATADO`,
  },
  {
    id: '6',
    nome: 'Contrato de Trânsito',
    descricao: 'Modelo para ações de trânsito, acidentes e indenizações.',
    categoria: 'Trânsito',
    icon: <Car className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - ACIDENTE DE TRÂNSITO

CONTRATANTE: [NOME], [qualificação completa].

CONTRATADO: [NOME DO ADVOGADO], OAB/[UF] nº [XXXXX].

OBJETO: Propositura de ação judicial decorrente de acidente de trânsito ocorrido em [DATA], no local [ENDEREÇO], visando:
a) Indenização por danos materiais no veículo;
b) Indenização por danos morais;
c) Lucros cessantes;
d) Despesas médicas e hospitalares;
e) Pensionamento (se aplicável).

DADOS DO ACIDENTE:
Data: [DATA]
Local: [ENDEREÇO]
Veículo do Contratante: [MARCA/MODELO], Placa [XXX-XXXX]
Veículo do Causador: [MARCA/MODELO], Placa [XXX-XXXX]
B.O. nº: [NÚMERO]

DOS HONORÁRIOS:
a) Honorários fixos: R$ [VALOR];
b) Honorários de êxito: [XX]% sobre o valor obtido.

[Local], [Data]

_______________________________
CONTRATANTE

_______________________________
CONTRATADO`,
  },
  {
    id: '7',
    nome: 'Contrato Empresarial',
    descricao: 'Modelo para ações empresariais e societárias.',
    categoria: 'Empresarial',
    icon: <Building2 className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - DIREITO EMPRESARIAL

CONTRATANTE: [RAZÃO SOCIAL], pessoa jurídica de direito privado, inscrita no CNPJ sob o nº [XX.XXX.XXX/XXXX-XX], com sede na [Endereço], neste ato representada por [NOME DO REPRESENTANTE LEGAL], [qualificação].

CONTRATADO: [NOME DO ESCRITÓRIO/ADVOGADO], OAB/[UF] nº [XXXXX].

OBJETO: Prestação de serviços jurídicos na área empresarial, incluindo:
[ ] Consultoria jurídica preventiva;
[ ] Elaboração e revisão de contratos;
[ ] Recuperação judicial/extrajudicial;
[ ] Dissolução societária;
[ ] Fusão/Cisão/Incorporação;
[ ] Cobrança judicial;
[ ] Defesa em processos.

DOS HONORÁRIOS:
a) Honorários mensais de consultoria: R$ [VALOR]/mês;
b) Honorários por processo judicial: R$ [VALOR] + [XX]% sobre êxito;
c) Elaboração de contratos: R$ [VALOR] por contrato.

DA VIGÊNCIA:
O presente contrato terá vigência de 12 (doze) meses, renovável automaticamente por igual período.

[Local], [Data]

_______________________________
CONTRATANTE
[NOME - CARGO]

_______________________________
CONTRATADO
OAB/[UF] nº [XXXXX]`,
  },
];

export function ModelosContratos() {
  const [selectedModelo, setSelectedModelo] = useState<ModeloContrato | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleDownload = (modelo: ModeloContrato) => {
    const blob = new Blob([modelo.conteudo], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${modelo.nome.toLowerCase().replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handlePreview = (modelo: ModeloContrato) => {
    setSelectedModelo(modelo);
    setPreviewOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Modelos de Contratos</h3>
          <p className="text-sm text-muted-foreground">
            Selecione um modelo para usar como base para novos contratos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modelosContratos.map((modelo) => (
          <Card key={modelo.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  {modelo.icon}
                </div>
                <span className="text-xs bg-muted px-2 py-1 rounded-full">
                  {modelo.categoria}
                </span>
              </div>
              <CardTitle className="text-base mt-3">{modelo.nome}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {modelo.descricao}
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handlePreview(modelo)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Visualizar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleDownload(modelo)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Baixar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedModelo?.icon}
              {selectedModelo?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg">
              {selectedModelo?.conteudo}
            </pre>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => selectedModelo && handleDownload(selectedModelo)}>
              <Download className="h-4 w-4 mr-2" />
              Baixar Modelo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
