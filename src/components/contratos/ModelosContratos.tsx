import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Download, Eye, Plus, Scale, Building2, Users, Car, Home, Briefcase, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { useModelosContratos, ModeloContrato as DBModeloContrato } from '@/hooks/useModelosContratos';
import { UploadModeloModal } from './UploadModeloModal';
import { usePerfil } from '@/hooks/usePerfil';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ModeloPadrao {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  icon: React.ReactNode;
  conteudo: string;
}

const modelosPadrao: ModeloPadrao[] = [
  {
    id: 'padrao-1',
    nome: 'Contrato de Honorários Advocatícios',
    descricao: 'Modelo padrão para prestação de serviços jurídicos com cláusulas de honorários fixos e de êxito.',
    categoria: 'Honorários',
    icon: <Scale className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS

CONTRATANTE: [NOME DO CLIENTE], [nacionalidade], [estado civil], [profissão], portador(a) do RG nº [XXX] e CPF nº [XXX.XXX.XXX-XX], residente e domiciliado(a) na [Endereço completo].

CONTRATADO: [NOME DO ESCRITÓRIO/ADVOGADO], inscrito na OAB/[UF] sob o nº [XXXXX], com escritório profissional na [Endereço do escritório].

CLÁUSULA PRIMEIRA - DO OBJETO
O presente contrato tem por objeto a prestação de serviços advocatícios pelo CONTRATADO ao CONTRATANTE.

CLÁUSULA SEGUNDA - DOS HONORÁRIOS
Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO:
a) Honorários fixos no valor de R$ [VALOR];
b) Honorários de êxito correspondentes a [XX]% sobre o proveito econômico obtido.

[Local], [Data]

_______________________________
CONTRATANTE

_______________________________
CONTRATADO
OAB/[UF] nº [XXXXX]`,
  },
  {
    id: 'padrao-2',
    nome: 'Procuração Ad Judicia',
    descricao: 'Procuração para representação em processos judiciais com poderes especiais.',
    categoria: 'Procuração',
    icon: <FileText className="h-5 w-5" />,
    conteudo: `PROCURAÇÃO AD JUDICIA ET EXTRA

OUTORGANTE: [NOME COMPLETO], [qualificação completa].

OUTORGADO(A): [NOME DO ADVOGADO], OAB/[UF] sob o nº [XXXXX].

PODERES: Amplos poderes para o foro em geral, com a cláusula "AD JUDICIA ET EXTRA", podendo propor contra quem de direito as ações competentes e defendê-lo(a) nas contrárias, seguindo umas e outras até final decisão, usando dos recursos legais e acompanhando-os, conferindo-lhe ainda os poderes especiais para confessar, desistir, transigir, firmar compromissos ou acordos, receber e dar quitação.

[Local], [Data por extenso]

_______________________________
OUTORGANTE`,
  },
  {
    id: 'padrao-3',
    nome: 'Contrato Trabalhista',
    descricao: 'Modelo para ações trabalhistas com cláusulas específicas para reclamações.',
    categoria: 'Trabalhista',
    icon: <Briefcase className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - AÇÃO TRABALHISTA

CONTRATANTE: [NOME DO RECLAMANTE], [qualificação completa].
CONTRATADO: [NOME DO ADVOGADO], OAB/[UF] nº [XXXXX].

OBJETO: Propositura de RECLAMATÓRIA TRABALHISTA em face de [NOME DA EMPRESA].

DOS HONORÁRIOS:
Honorários de êxito no percentual de [XX]% sobre o valor bruto da condenação ou acordo.

[Local], [Data]

_______________________________
CONTRATANTE

_______________________________
CONTRATADO`,
  },
  {
    id: 'padrao-4',
    nome: 'Contrato Cível - Indenização',
    descricao: 'Modelo para ações de indenização por danos morais e materiais.',
    categoria: 'Cível',
    icon: <Users className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - AÇÃO DE INDENIZAÇÃO

CONTRATANTE: [NOME], [qualificação completa].
CONTRATADO: [NOME DO ADVOGADO], OAB/[UF] nº [XXXXX].

OBJETO: Propositura de AÇÃO DE INDENIZAÇÃO POR DANOS MORAIS E MATERIAIS.

DOS HONORÁRIOS:
a) Honorários fixos: R$ [VALOR];
b) Honorários de êxito: [XX]% sobre o valor da condenação/acordo.

[Local], [Data]

_______________________________
CONTRATANTE

_______________________________
CONTRATADO`,
  },
  {
    id: 'padrao-5',
    nome: 'Contrato Imobiliário',
    descricao: 'Modelo para ações imobiliárias, usucapião e disputas de propriedade.',
    categoria: 'Imobiliário',
    icon: <Home className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - AÇÃO IMOBILIÁRIA

CONTRATANTE: [NOME], [qualificação completa].
CONTRATADO: [NOME DO ADVOGADO], OAB/[UF] nº [XXXXX].

OBJETO: Prestação de serviços jurídicos na área imobiliária.

IMÓVEL: [Endereço completo e matrícula]

DOS HONORÁRIOS:
a) Honorários fixos: R$ [VALOR];
b) Honorários de êxito: [XX]% sobre o valor do imóvel.

[Local], [Data]

_______________________________
CONTRATANTE

_______________________________
CONTRATADO`,
  },
  {
    id: 'padrao-6',
    nome: 'Contrato de Trânsito',
    descricao: 'Modelo para ações de trânsito, acidentes e indenizações.',
    categoria: 'Trânsito',
    icon: <Car className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - ACIDENTE DE TRÂNSITO

CONTRATANTE: [NOME], [qualificação completa].
CONTRATADO: [NOME DO ADVOGADO], OAB/[UF] nº [XXXXX].

OBJETO: Propositura de ação judicial decorrente de acidente de trânsito.

DADOS DO ACIDENTE:
Data: [DATA]
Local: [ENDEREÇO]
Veículo: [MARCA/MODELO], Placa [XXX-XXXX]

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
    id: 'padrao-7',
    nome: 'Contrato Empresarial',
    descricao: 'Modelo para ações empresariais e societárias.',
    categoria: 'Empresarial',
    icon: <Building2 className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - DIREITO EMPRESARIAL

CONTRATANTE: [RAZÃO SOCIAL], CNPJ [XX.XXX.XXX/XXXX-XX].
CONTRATADO: [NOME DO ESCRITÓRIO], OAB/[UF] nº [XXXXX].

OBJETO: Prestação de serviços jurídicos na área empresarial.

DOS HONORÁRIOS:
a) Honorários mensais de consultoria: R$ [VALOR]/mês;
b) Honorários por processo judicial: R$ [VALOR] + [XX]% sobre êxito.

DA VIGÊNCIA: 12 (doze) meses, renovável automaticamente.

[Local], [Data]

_______________________________
CONTRATANTE

_______________________________
CONTRATADO`,
  },
];

const getCategoryIcon = (categoria: string) => {
  switch (categoria) {
    case 'Honorários': return <Scale className="h-5 w-5" />;
    case 'Procuração': return <FileText className="h-5 w-5" />;
    case 'Trabalhista': return <Briefcase className="h-5 w-5" />;
    case 'Cível': return <Users className="h-5 w-5" />;
    case 'Imobiliário': return <Home className="h-5 w-5" />;
    case 'Trânsito': return <Car className="h-5 w-5" />;
    case 'Empresarial': return <Building2 className="h-5 w-5" />;
    default: return <FileText className="h-5 w-5" />;
  }
};

export function ModelosContratos() {
  const { modelos, loading, uploadModelo, deleteModelo } = useModelosContratos();
  const { canDelete } = usePerfil();
  const [selectedModelo, setSelectedModelo] = useState<ModeloPadrao | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDownload = (modelo: ModeloPadrao) => {
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

  const handlePreview = (modelo: ModeloPadrao) => {
    setSelectedModelo(modelo);
    setPreviewOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await deleteModelo(deleteId);
    setDeleting(false);
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      {/* Custom Models Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Meus Modelos</h3>
            <p className="text-sm text-muted-foreground">
              Modelos de contrato enviados pela equipe
            </p>
          </div>
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Enviar Modelo
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : modelos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modelos.map((modelo) => (
              <Card key={modelo.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      {getCategoryIcon(modelo.categoria)}
                    </div>
                    <span className="text-xs bg-muted px-2 py-1 rounded-full">
                      {modelo.categoria}
                    </span>
                  </div>
                  <CardTitle className="text-base mt-3">{modelo.nome}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {modelo.descricao || modelo.arquivo_nome}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      asChild
                    >
                      <a href={modelo.arquivo_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Abrir
                      </a>
                    </Button>
                    {canDelete && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setDeleteId(modelo.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum modelo personalizado enviado ainda.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Enviar primeiro modelo
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Default Models Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Modelos Padrão</h3>
          <p className="text-sm text-muted-foreground">
            Modelos de contrato prontos para uso
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modelosPadrao.map((modelo) => (
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

      {/* Upload Modal */}
      <UploadModeloModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={uploadModelo}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O modelo será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
