import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Download, Eye, Plus, Scale, Building2, Users, Car, Home, Briefcase, Trash2, Loader2, ExternalLink, FileSignature, Zap } from 'lucide-react';
import { useModelosContratos, ModeloContrato as DBModeloContrato } from '@/hooks/useModelosContratos';
import { UploadModeloModal } from './UploadModeloModal';
import { usePerfil } from '@/hooks/usePerfil';
import { cn } from '@/lib/utils';
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
  tipoModelo: 'contrato' | 'procuracao';
  icon: React.ReactNode;
  conteudo: string;
}

const modelosPadrao: ModeloPadrao[] = [
  {
    id: 'padrao-1', nome: 'Contrato de Honorários Advocatícios', descricao: 'Modelo padrão para prestação de serviços jurídicos com cláusulas de honorários fixos e de êxito.', categoria: 'Honorários', tipoModelo: 'contrato', icon: <Scale className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS\n\nCONTRATANTE: [NOME DO CLIENTE]...\nCONTRATADO: [NOME DO ESCRITÓRIO]...\n\nCLÁUSULA PRIMEIRA - DO OBJETO\n...\n\nCLÁUSULA SEGUNDA - DOS HONORÁRIOS\n...\n\n[Local], [Data]\n\n_______________________________\nCONTRATANTE\n\n_______________________________\nCONTRATADO`,
  },
  {
    id: 'padrao-2', nome: 'Procuração Ad Judicia', descricao: 'Procuração para representação em processos judiciais com poderes especiais.', categoria: 'Procuração', tipoModelo: 'procuracao', icon: <FileSignature className="h-5 w-5" />,
    conteudo: `PROCURAÇÃO AD JUDICIA ET EXTRA\n\nOUTORGANTE: [NOME COMPLETO]...\nOUTORGADO(A): [NOME DO ADVOGADO]...\n\nPODERES: Amplos poderes para o foro em geral...\n\n[Local], [Data]\n\n_______________________________\nOUTORGANTE`,
  },
  {
    id: 'padrao-3', nome: 'Contrato Trabalhista', descricao: 'Modelo para ações trabalhistas com cláusulas específicas.', categoria: 'Trabalhista', tipoModelo: 'contrato', icon: <Briefcase className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - AÇÃO TRABALHISTA\n\nCONTRATANTE: [NOME]...\nCONTRATADO: [NOME]...\n\nOBJETO: Propositura de RECLAMATÓRIA TRABALHISTA...\n\nDOS HONORÁRIOS:\nHonorários de êxito no percentual de [XX]%...\n\n[Local], [Data]`,
  },
  {
    id: 'padrao-4', nome: 'Contrato Cível - Indenização', descricao: 'Modelo para ações de indenização por danos morais e materiais.', categoria: 'Cível', tipoModelo: 'contrato', icon: <Users className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - AÇÃO DE INDENIZAÇÃO\n\nCONTRATANTE: [NOME]...\n\nOBJETO: Propositura de AÇÃO DE INDENIZAÇÃO...\n\n[Local], [Data]`,
  },
  {
    id: 'padrao-5', nome: 'Contrato Imobiliário', descricao: 'Modelo para ações imobiliárias, usucapião e disputas.', categoria: 'Imobiliário', tipoModelo: 'contrato', icon: <Home className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - AÇÃO IMOBILIÁRIA\n\nCONTRATANTE: [NOME]...\n\nOBJETO: Prestação de serviços na área imobiliária...\n\n[Local], [Data]`,
  },
  {
    id: 'padrao-6', nome: 'Contrato de Trânsito', descricao: 'Modelo para ações de trânsito e acidentes.', categoria: 'Trânsito', tipoModelo: 'contrato', icon: <Car className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - ACIDENTE DE TRÂNSITO\n\nCONTRATANTE: [NOME]...\n\nOBJETO: Propositura de ação judicial decorrente de acidente...\n\n[Local], [Data]`,
  },
  {
    id: 'padrao-7', nome: 'Contrato Empresarial', descricao: 'Modelo para ações empresariais e societárias.', categoria: 'Empresarial', tipoModelo: 'contrato', icon: <Building2 className="h-5 w-5" />,
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS - DIREITO EMPRESARIAL\n\nCONTRATANTE: [RAZÃO SOCIAL]...\n\nOBJETO: Prestação de serviços na área empresarial...\n\n[Local], [Data]`,
  },
  {
    id: 'padrao-8', nome: 'Procuração Previdenciária', descricao: 'Procuração específica para causas previdenciárias junto ao INSS.', categoria: 'Procuração', tipoModelo: 'procuracao', icon: <FileSignature className="h-5 w-5" />,
    conteudo: `PROCURAÇÃO AD JUDICIA ET EXTRA - PREVIDENCIÁRIA\n\nOUTORGANTE: [NOME COMPLETO]...\nOUTORGADO(A): [NOME DO ADVOGADO]...\n\nPODERES: Poderes para representar junto ao INSS...\n\n[Local], [Data]`,
  },
];

const getCategoryIcon = (categoria: string) => {
  switch (categoria) {
    case 'Honorários': return <Scale className="h-5 w-5" />;
    case 'Procuração': return <FileSignature className="h-5 w-5" />;
    case 'Trabalhista': return <Briefcase className="h-5 w-5" />;
    case 'Cível': return <Users className="h-5 w-5" />;
    case 'Imobiliário': return <Home className="h-5 w-5" />;
    case 'Trânsito': return <Car className="h-5 w-5" />;
    case 'Empresarial': return <Building2 className="h-5 w-5" />;
    default: return <FileText className="h-5 w-5" />;
  }
};

// Determine if a DB model is a procuração based on category/name
const isProcuracao = (modelo: DBModeloContrato) =>
  modelo.categoria === 'Procuração' || modelo.nome.toLowerCase().includes('procuração');

function ModeloCard({ 
  nome, descricao, categoria, icon, onView, onDownload, onDelete, canDelete: canDeleteProp, isCustom, fileUrl 
}: {
  nome: string; descricao: string; categoria: string; icon: React.ReactNode;
  onView?: () => void; onDownload?: () => void; onDelete?: () => void;
  canDelete?: boolean; isCustom?: boolean; fileUrl?: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">{icon}</div>
          <span className="text-xs bg-muted px-2 py-1 rounded-full">{categoria}</span>
        </div>
        <CardTitle className="text-base mt-3">{nome}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">{descricao}</p>
        <div className="flex items-center gap-2">
          {isCustom && fileUrl ? (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Abrir
              </a>
            </Button>
          ) : (
            <>
              {onView && (
                <Button variant="outline" size="sm" className="flex-1" onClick={onView}>
                  <Eye className="h-4 w-4 mr-1" /> Visualizar
                </Button>
              )}
              {onDownload && (
                <Button variant="outline" size="sm" className="flex-1" onClick={onDownload}>
                  <Download className="h-4 w-4 mr-1" /> Baixar
                </Button>
              )}
            </>
          )}
          {canDeleteProp && onDelete && (
            <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ModelosContratos() {
  const { modelos, loading, uploadModelo, deleteModelo } = useModelosContratos();
  const { canDelete } = usePerfil();
  const [selectedModelo, setSelectedModelo] = useState<ModeloPadrao | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState<'clicksign' | 'zapsign' | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Group custom models by tipo e tipo de documento
  const { customContratos, customProcuracoes, customZapsign } = useMemo(() => {
    const contratos: DBModeloContrato[] = [];
    const procuracoes: DBModeloContrato[] = [];
    const zapsign: DBModeloContrato[] = [];
    modelos.forEach(m => {
      if ((m as any).tipo === 'zapsign') zapsign.push(m);
      else if (isProcuracao(m)) procuracoes.push(m);
      else contratos.push(m);
    });
    return { customContratos: contratos, customProcuracoes: procuracoes, customZapsign: zapsign };
  }, [modelos]);

  // Group default models
  const defaultContratos = modelosPadrao.filter(m => m.tipoModelo === 'contrato');
  const defaultProcuracoes = modelosPadrao.filter(m => m.tipoModelo === 'procuracao');

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

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await deleteModelo(deleteId);
    setDeleting(false);
    setDeleteId(null);
  };

  const renderSection = (
    title: string,
    subtitle: string,
    icon: React.ReactNode,
    customModels: DBModeloContrato[],
    defaultModels: ModeloPadrao[],
    uploadLabel: string,
    uploadTipo: 'clicksign' | 'zapsign' = 'clicksign',
  ) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(uploadTipo)}>
          <Plus className="h-4 w-4 mr-1" /> {uploadLabel}
        </Button>
      </div>

      {/* Custom models */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : customModels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {customModels.map(m => (
            <ModeloCard
              key={m.id}
              nome={m.nome}
              descricao={m.descricao || m.arquivo_nome}
              categoria={m.categoria}
              icon={getCategoryIcon(m.categoria)}
              isCustom
              fileUrl={m.arquivo_url}
              canDelete={canDelete}
              onDelete={() => setDeleteId(m.id)}
            />
          ))}
        </div>
      ) : (
        <div className="border border-dashed rounded-lg py-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhum modelo personalizado enviado</p>
        </div>
      )}

      {/* Default models */}
      {defaultModels.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Modelos padrão</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {defaultModels.map(m => (
              <ModeloCard
                key={m.id}
                nome={m.nome}
                descricao={m.descricao}
                categoria={m.categoria}
                icon={m.icon}
                onView={() => { setSelectedModelo(m); setPreviewOpen(true); }}
                onDownload={() => handleDownload(m)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Contratos Section */}
      {renderSection(
        'Modelos de Contrato',
        'Modelos de contrato de honorários e prestação de serviços',
        <Scale className="h-5 w-5" />,
        customContratos,
        defaultContratos,
        'Enviar Contrato',
      )}

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Procurações Section */}
      {renderSection(
        'Modelos de Procuração',
        'Modelos de procuração Ad Judicia et Extra',
        <FileSignature className="h-5 w-5" />,
        customProcuracoes,
        defaultProcuracoes,
        'Enviar Procuração',
        'clicksign',
      )}

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Zapsign Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-100 text-cyan-600">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                Modelos Zapsign
                <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-medium">Novo</span>
              </h3>
              <p className="text-xs text-muted-foreground">Modelos de contrato para assinatura digital via Zapsign</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setUploadOpen('zapsign')} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <Plus className="h-4 w-4 mr-1" /> Upload Zapsign
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : customZapsign.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {customZapsign.map(m => (
              <Card key={m.id} className="hover:shadow-md transition-shadow border-cyan-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-cyan-100 rounded-lg text-cyan-600">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full">Zapsign</span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{m.categoria}</span>
                    </div>
                  </div>
                  <CardTitle className="text-sm mt-3">{m.nome}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground line-clamp-2">{m.descricao || m.arquivo_nome}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
                      <a href={m.arquivo_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Visualizar
                      </a>
                    </Button>
                    {canDelete && (
                      <Button variant="outline" size="sm" onClick={() => setDeleteId(m.id)} className="text-destructive hover:text-destructive px-2">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-cyan-200 rounded-lg py-10 text-center bg-cyan-50/20">
            <Zap className="h-8 w-8 mx-auto text-cyan-300 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum modelo Zapsign enviado</p>
            <p className="text-xs text-muted-foreground mt-1">Faça upload de PDFs para usar na criação de contratos</p>
          </div>
        )}
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
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button onClick={() => selectedModelo && handleDownload(selectedModelo)}>
              <Download className="h-4 w-4 mr-2" /> Baixar Modelo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      <UploadModeloModal
        isOpen={uploadOpen !== null}
        onClose={() => setUploadOpen(null)}
        onUpload={(file, nome, descricao, categoria) =>
          uploadModelo(file, nome, descricao, categoria, uploadOpen || 'clicksign')
        }
        titulo={uploadOpen === 'zapsign' ? 'Upload Modelo Zapsign' : undefined}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
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
