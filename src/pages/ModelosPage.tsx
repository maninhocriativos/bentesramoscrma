import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageTransition } from '@/components/layouts/PageTransition';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { usePetitionModels } from '@/hooks/usePetitionModels';
import { supabase } from '@/integrations/supabase/client';
import type { PetitionModel, PetitionType } from '@/types/peticoes';
import type { VariablesMap } from '@/types/peticoes';
import {
  FileText,
  Upload,
  MoreVertical,
  Star,
  StarOff,
  Trash2,
  Settings,
  Eye,
  CheckCircle,
  XCircle,
  FileType,
  Loader2,
  Save,
  ArrowLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

// Campos disponíveis para mapeamento
const PAYLOAD_FIELDS = [
  { value: 'client.nome_completo', label: 'Nome Completo' },
  { value: 'client.cpf', label: 'CPF' },
  { value: 'client.rg', label: 'RG' },
  { value: 'client.estado_civil', label: 'Estado Civil' },
  { value: 'client.profissao', label: 'Profissão' },
  { value: 'client.nacionalidade', label: 'Nacionalidade' },
  { value: 'client.email', label: 'E-mail' },
  { value: 'client.telefone', label: 'Telefone' },
  { value: 'endereco.cep', label: 'CEP' },
  { value: 'endereco.rua', label: 'Rua' },
  { value: 'endereco.numero', label: 'Número' },
  { value: 'endereco.complemento', label: 'Complemento' },
  { value: 'endereco.bairro', label: 'Bairro' },
  { value: 'endereco.cidade', label: 'Cidade' },
  { value: 'endereco.uf', label: 'UF' },
  { value: 'banco.banco_nome', label: 'Nome do Banco' },
  { value: 'banco.banco_cnpj', label: 'CNPJ do Banco' },
  { value: 'banco.agencia', label: 'Agência' },
  { value: 'banco.conta', label: 'Conta' },
  { value: 'banco.produto', label: 'Produto Bancário' },
  { value: 'valores.valor_cobrado', label: 'Valor Cobrado' },
  { value: 'valores.valor_total', label: 'Valor Total' },
  { value: 'valores.parcelas', label: 'Parcelas' },
];

export default function ModelosPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { models, loading, fetchModels, uploadModel, updateModel, setAsDefault, deleteModel } = usePetitionModels();
  
  const [petitionTypes, setPetitionTypes] = useState<PetitionType[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<PetitionModel | null>(null);
  const [activeTab, setActiveTab] = useState('todos');
  
  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Mapping state
  const [variablesMap, setVariablesMap] = useState<VariablesMap>({});
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);
  const [savingMap, setSavingMap] = useState(false);

  useEffect(() => {
    fetchPetitionTypes();
  }, []);

  const fetchPetitionTypes = async () => {
    const { data, error } = await supabase
      .from('petition_types')
      .select('*')
      .eq('enabled', true)
      .order('title');

    if (!error && data) {
      setPetitionTypes(data as PetitionType[]);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle || !uploadType) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos antes de enviar',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    const result = await uploadModel(uploadFile, uploadTitle, uploadType);
    setUploading(false);

    if (result) {
      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadType('');
      toast({
        title: 'Modelo enviado',
        description: 'O texto será extraído em background.',
      });
    }
  };

  const openMappingModal = (model: PetitionModel) => {
    setSelectedModel(model);
    setVariablesMap(model.variables_map || {});
    
    // Detectar variáveis no texto extraído
    if (model.extracted_text) {
      const regex = /\{\{([^}]+)\}\}/g;
      const matches = model.extracted_text.match(regex) || [];
      const vars = [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))];
      setDetectedVariables(vars);
    } else {
      setDetectedVariables([]);
    }
    
    setMappingModalOpen(true);
  };

  const handleSaveMapping = async () => {
    if (!selectedModel) return;
    
    setSavingMap(true);
    const success = await updateModel(selectedModel.id, { variables_map: variablesMap });
    setSavingMap(false);
    
    if (success) {
      setMappingModalOpen(false);
      toast({
        title: 'Mapeamento salvo',
        description: 'As variáveis foram mapeadas com sucesso.',
      });
    }
  };

  const handleToggleActive = async (model: PetitionModel) => {
    await updateModel(model.id, { is_active: !model.is_active });
  };

  const handleSetDefault = async (model: PetitionModel) => {
    if (model.petition_type_slug) {
      await setAsDefault(model.id, model.petition_type_slug);
    }
  };

  const handleDelete = async (model: PetitionModel) => {
    if (confirm('Tem certeza que deseja excluir este modelo?')) {
      await deleteModel(model.id);
    }
  };

  const filteredModels = activeTab === 'todos' 
    ? models 
    : models.filter(m => m.petition_type_slug === activeTab);

  const getTypeTitle = (slug: string | null) => {
    if (!slug) return 'Sem tipo';
    const type = petitionTypes.find(t => t.slug === slug);
    return type?.title || slug;
  };

  return (
    <AppLayout>
      <PageTransition>
        <div className="container mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/peticoes')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Modelos de Petição
                </h1>
                <p className="text-muted-foreground">
                  Gerencie os modelos que a Isa usa para gerar petições
                </p>
              </div>
            </div>
            <Button onClick={() => setUploadModalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Modelo
            </Button>
          </div>

          {/* Tabs por tipo */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              {petitionTypes.map((type) => (
                <TabsTrigger key={type.slug} value={type.slug}>
                  {type.title}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {activeTab === 'todos' ? 'Todos os Modelos' : getTypeTitle(activeTab)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredModels.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum modelo encontrado</p>
                      <Button
                        variant="link"
                        onClick={() => setUploadModalOpen(true)}
                      >
                        Fazer upload do primeiro modelo
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Modelo</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Versão</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Extração</TableHead>
                          <TableHead>Variáveis</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredModels.map((model) => (
                          <TableRow key={model.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileType className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{model.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {model.file_type?.toUpperCase()}
                                  </p>
                                </div>
                                {model.is_default && (
                                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {getTypeTitle(model.petition_type_slug)}
                              </Badge>
                            </TableCell>
                            <TableCell>{model.version || 'v1'}</TableCell>
                            <TableCell>
                              {model.is_active ? (
                                <Badge className="bg-green-500/10 text-green-600 border-green-200">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Inativo
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {model.extracted_text ? (
                                <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">
                                  Extraído
                                </Badge>
                              ) : (
                                <Badge variant="outline">Pendente</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {model.variables_map && Object.keys(model.variables_map).length > 0 ? (
                                <Badge className="bg-purple-500/10 text-purple-600 border-purple-200">
                                  {Object.keys(model.variables_map).length} vars
                                </Badge>
                              ) : (
                                <Badge variant="outline">Não mapeado</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(model.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => window.open(model.file_url, '_blank')}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Visualizar Arquivo
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openMappingModal(model)}>
                                    <Settings className="h-4 w-4 mr-2" />
                                    Mapear Variáveis
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleToggleActive(model)}>
                                    {model.is_active ? (
                                      <>
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Desativar
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Ativar
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleSetDefault(model)}>
                                    {model.is_default ? (
                                      <>
                                        <StarOff className="h-4 w-4 mr-2" />
                                        Remover Padrão
                                      </>
                                    ) : (
                                      <>
                                        <Star className="h-4 w-4 mr-2" />
                                        Definir como Padrão
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDelete(model)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Upload Modal */}
          <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload de Modelo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file">Arquivo (DOCX ou PDF)</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".docx,.pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Nome do Modelo</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Petição Inicial - Juros Abusivos v2"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo de Petição</Label>
                  <Select value={uploadType} onValueChange={setUploadType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {petitionTypes.map((type) => (
                        <SelectItem key={type.slug} value={type.slug}>
                          {type.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setUploadModalOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleUpload} disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Enviar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Mapping Modal */}
          <Dialog open={mappingModalOpen} onOpenChange={setMappingModalOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Mapear Variáveis - {selectedModel?.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {detectedVariables.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma variável detectada no modelo.</p>
                    <p className="text-sm">
                      Use o formato {'{{variavel}}'} no seu documento.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Mapeie cada variável do modelo para um campo do formulário de petição.
                    </p>
                    <div className="space-y-3">
                      {detectedVariables.map((variable) => (
                        <div key={variable} className="flex items-center gap-4">
                          <div className="w-1/3">
                            <code className="bg-muted px-2 py-1 rounded text-sm">
                              {`{{${variable}}}`}
                            </code>
                          </div>
                          <div className="w-2/3">
                            <Select
                              value={variablesMap[variable] || ''}
                              onValueChange={(value) =>
                                setVariablesMap({ ...variablesMap, [variable]: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o campo" />
                              </SelectTrigger>
                              <SelectContent>
                                {PAYLOAD_FIELDS.map((field) => (
                                  <SelectItem key={field.value} value={field.value}>
                                    {field.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setMappingModalOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveMapping} disabled={savingMap}>
                    {savingMap ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Mapeamento
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageTransition>
    </AppLayout>
  );
}
