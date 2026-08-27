// Tela de administração de modelos (v2 — backend Cloudflare). Substitui a
// edição manual direto no banco: sobe o .docx, analisa {{marcadores}} e
// imagens do corpo 100% no navegador (docxAnalyzer.ts, via pizzip — não
// depende do Worker pra essa parte), nomeia print slots, e cadastra dentro
// da categoria escolhida (ou cria uma nova, inline). O modelo criado aparece
// imediatamente no catálogo de /peticoes-v2, porque as duas telas leem o
// mesmo estado mock (peticoesV2Client.ts) — no backend real isso vira um
// POST /api/models multipart pro Worker, que salva no R2 + insere no D1.
import { useState, useEffect, useCallback } from 'react';
import {
  Upload, FileText, Plus, Pencil, Trash2, ImageIcon, CheckCircle2,
  Loader2, AlertCircle, Sparkles, X, Building2,
} from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { analisarArquivoModelo, type ImagemDetectada as ImagemAnalise } from '@/lib/docxAnalyzer';
import * as api from '@/lib/peticoesV2Client';
import type { ActionType, PetitionModelV2, PrintSlot } from '@/lib/peticoesV2Client';

interface ImagemDetectada extends ImagemAnalise { label: string }

interface ModeloFormState {
  actionTypeId: string;
  nome: string;
  descricao: string;
  tags: string;
  isDefault: boolean;
  isActive: boolean;
}
const FORM_VAZIO: ModeloFormState = { actionTypeId: '', nome: '', descricao: '', tags: '', isDefault: false, isActive: true };

export default function PeticaoModelosAdminPageV2() {
  const { toast } = useToast();
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [models, setModels]           = useState<PetitionModelV2[]>([]);
  const [loading, setLoading]         = useState(true);

  const [form, setForm]                 = useState<ModeloFormState>(FORM_VAZIO);
  const [file, setFile]                 = useState<File | null>(null);
  const [analisando, setAnalisando]     = useState(false);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [imagens, setImagens]           = useState<ImagemDetectada[]>([]);
  const [salvando, setSalvando]         = useState(false);

  const [novoTipoOpen, setNovoTipoOpen]         = useState(false);
  const [novoTipoNome, setNovoTipoNome]         = useState('');
  const [novoTipoDescricao, setNovoTipoDescricao] = useState('');
  const [salvandoTipo, setSalvandoTipo]         = useState(false);

  const [editModel, setEditModel] = useState<PetitionModelV2 | null>(null);
  const [editForm, setEditForm]   = useState<ModeloFormState>(FORM_VAZIO);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [at, pm] = await Promise.all([api.fetchAllActionTypes(), api.fetchAllModels()]);
    setActionTypes(at);
    setModels(pm);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleFileChange = async (f: File | null) => {
    setFile(f);
    setPlaceholders([]);
    setImagens([]);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.docx')) {
      toast({ title: 'Formato inválido', description: 'Envie um arquivo .docx (não .doc, não .pdf).', variant: 'destructive' });
      setFile(null);
      return;
    }
    setAnalisando(true);
    try {
      const info = await analisarArquivoModelo(f);
      setPlaceholders(info.placeholders);
      setImagens(info.imagens.map(img => ({ ...img, label: '' })));
      if (!form.nome) setForm(prev => ({ ...prev, nome: f.name.replace(/\.docx$/i, '') }));
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao ler o modelo', description: 'Não consegui abrir esse .docx — confirme que não está corrompido.', variant: 'destructive' });
      setFile(null);
    } finally {
      setAnalisando(false);
    }
  };

  const resetForm = () => { setForm(FORM_VAZIO); setFile(null); setPlaceholders([]); setImagens([]); };

  const handleCreateActionType = async () => {
    if (!novoTipoNome.trim()) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    setSalvandoTipo(true);
    const at = await api.createActionType(novoTipoNome.trim(), novoTipoDescricao.trim());
    setSalvandoTipo(false);
    toast({ title: 'Tipo de ação criado', description: novoTipoNome });
    setNovoTipoOpen(false);
    setNovoTipoNome('');
    setNovoTipoDescricao('');
    await fetchAll();
    setForm(prev => ({ ...prev, actionTypeId: at.id }));
  };

  const handleSubmit = async () => {
    if (!form.actionTypeId) { toast({ title: 'Selecione o tipo de ação', variant: 'destructive' }); return; }
    if (!form.nome.trim()) { toast({ title: 'Dê um nome ao modelo', variant: 'destructive' }); return; }
    if (!file) { toast({ title: 'Selecione o arquivo .docx do modelo', variant: 'destructive' }); return; }
    setSalvando(true);
    try {
      const printSlots: PrintSlot[] = imagens.filter(img => img.label.trim()).map(img => ({ label: img.label.trim(), media_target: img.mediaTarget }));
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      await api.createModel({
        actionTypeId: form.actionTypeId, nome: form.nome.trim(), descricao: form.descricao.trim(),
        tags, templateFileName: file.name, printSlots: printSlots.length > 0 ? printSlots : null,
        isActive: form.isActive, isDefault: form.isDefault,
      });
      toast({ title: '✅ Modelo cadastrado', description: `${form.nome} já aparece no catálogo de /peticoes-v2.` });
      resetForm();
      await fetchAll();
    } catch (err) {
      toast({ title: 'Erro ao salvar modelo', description: err instanceof Error ? err.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const openEdit = (m: PetitionModelV2) => {
    setEditModel(m);
    setEditForm({ actionTypeId: m.action_type_id, nome: m.nome, descricao: m.descricao || '', tags: (m.tags || []).join(', '), isDefault: m.is_default, isActive: m.is_active });
  };

  const handleSaveEdit = async () => {
    if (!editModel) return;
    setSalvandoEdicao(true);
    try {
      const tags = editForm.tags.split(',').map(t => t.trim()).filter(Boolean);
      await api.updateModel(editModel.id, {
        actionTypeId: editForm.actionTypeId, nome: editForm.nome.trim(), descricao: editForm.descricao.trim(),
        tags, isActive: editForm.isActive, isDefault: editForm.isDefault,
      });
      toast({ title: 'Modelo atualizado' });
      setEditModel(null);
      await fetchAll();
    } catch (err) {
      toast({ title: 'Erro ao atualizar', description: err instanceof Error ? err.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const handleToggleActive = async (m: PetitionModelV2) => { await api.toggleModelActive(m.id); await fetchAll(); };

  const handleDelete = async (m: PetitionModelV2) => {
    if (!window.confirm(`Excluir o modelo "${m.nome}"? Petições já geradas com ele não são afetadas, mas ele deixa de aparecer pra novas petições.`)) return;
    await api.deleteModel(m.id);
    toast({ title: 'Modelo excluído' });
    await fetchAll();
  };

  return (
    <>
      <AppHeader title="Modelos de Petição (v2 — beta)" />
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            Versão beta — modelos cadastrados aqui ficam em memória (mock), mas a análise do .docx (marcadores + imagens) já é real.
          </div>

          <Card className="rounded-2xl border border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Plus className="h-5 w-5 text-primary" /> Cadastrar novo modelo
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Suba o .docx já com os marcadores <code className="text-xs bg-muted px-1 py-0.5 rounded">{'{{'}nome_do_campo{'}}'}</code>{' '}
                no lugar dos dados variáveis, mantendo o timbrado/logo/fonte originais do escritório.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Tipo de Ação</Label>
                  <div className="flex gap-2">
                    <Select value={form.actionTypeId} onValueChange={v => setForm(prev => ({ ...prev, actionTypeId: v }))}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{actionTypes.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" className="rounded-xl shrink-0" onClick={() => setNovoTipoOpen(true)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Nome do Modelo</Label>
                  <Input value={form.nome} onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))} placeholder="Ex: Venda Casada – INSS (Idoso)" className="rounded-xl" />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Descrição (opcional)</Label>
                <Textarea value={form.descricao} onChange={e => setForm(prev => ({ ...prev, descricao: e.target.value }))} placeholder="Contexto de quando usar este modelo" className="rounded-xl min-h-[60px]" />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Tags (separadas por vírgula)</Label>
                <Input value={form.tags} onChange={e => setForm(prev => ({ ...prev, tags: e.target.value }))} placeholder="INSS, Idoso, Tramitação Preferencial" className="rounded-xl" />
              </div>

              <div>
                <Label className="text-xs mb-1.5 block">Arquivo do Modelo (.docx)</Label>
                {!file ? (
                  <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer">
                    <Upload className="h-7 w-7 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">Clique para selecionar o .docx</span>
                    <input type="file" accept=".docx" className="hidden" onChange={e => handleFileChange(e.target.files?.[0] || null)} />
                  </label>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleFileChange(null)}><X className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>

              {analisando && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lendo marcadores e imagens do modelo...</div>
              )}

              {!analisando && placeholders.length > 0 && (
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {placeholders.length} marcador(es) detectado(s) — o formulário do gerador será montado automaticamente a partir deles
                  </p>
                  <div className="flex flex-wrap gap-1.5">{placeholders.map(p => <Badge key={p} variant="secondary" className="text-[10px] font-mono">{'{{'}{p}{'}}'}</Badge>)}</div>
                </div>
              )}

              {!analisando && imagens.length > 0 && (
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 space-y-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" /> {imagens.length} imagem(ns) no corpo do documento — nomeie apenas as que devem
                    receber o print do contrato do cliente. Deixe em branco qualquer imagem que faça parte fixa do texto.
                  </p>
                  <div className="space-y-2">
                    {imagens.map((img, i) => (
                      <div key={img.mediaTarget} className="flex items-center gap-3">
                        <span className="text-[11px] text-muted-foreground w-24 truncate shrink-0" title={img.mediaTarget}>{img.mediaTarget.replace('media/', '')}</span>
                        <Input value={img.label} onChange={e => setImagens(prev => prev.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                          placeholder="Deixe em branco pra não usar como print — ou nomeie, ex: Contrato do cliente" className="rounded-lg h-8 text-xs" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form.isActive} onCheckedChange={v => setForm(prev => ({ ...prev, isActive: !!v }))} /> Ativo (aparece no gerador)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form.isDefault} onCheckedChange={v => setForm(prev => ({ ...prev, isDefault: !!v }))} /> Modelo padrão desta ação
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm} className="rounded-xl" disabled={salvando}>Limpar</Button>
                <Button onClick={handleSubmit} disabled={salvando || analisando} className="rounded-xl gap-2 font-bold">
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Cadastrar Modelo
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/50 shadow-sm">
            <CardHeader><CardTitle className="text-lg font-bold">Modelos cadastrados</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead><TableHead>Tipo de Ação</TableHead><TableHead>Prints</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : models.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum modelo cadastrado ainda.</TableCell></TableRow>
                  ) : models.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-semibold text-sm">{m.nome}</p>
                            {m.is_default && <Badge variant="secondary" className="text-[10px] mt-0.5">Padrão</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {actionTypes.find(a => a.id === m.action_type_id)?.nome ?? '—'}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.print_slots_json && m.print_slots_json.length > 0
                          ? <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">{m.print_slots_json.length} slot(s) nomeado(s)</span>
                          : <span className="text-muted-foreground text-xs">sem slots</span>}
                      </TableCell>
                      <TableCell>
                        <button onClick={() => handleToggleActive(m)}>
                          <Badge className={cn('text-xs cursor-pointer', m.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200')}>
                            {m.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => handleDelete(m)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <Dialog open={novoTipoOpen} onOpenChange={setNovoTipoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Tipo de Ação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs mb-1.5 block">Nome</Label><Input value={novoTipoNome} onChange={e => setNovoTipoNome(e.target.value)} placeholder="Ex: Revisão de Contrato" className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1.5 block">Descrição (opcional)</Label><Textarea value={novoTipoDescricao} onChange={e => setNovoTipoDescricao(e.target.value)} className="rounded-xl" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoTipoOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleCreateActionType} disabled={salvandoTipo} className="rounded-xl">{salvandoTipo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editModel} onOpenChange={(o) => !o && setEditModel(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Modelo</DialogTitle></DialogHeader>
          {editModel && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1.5 block">Tipo de Ação</Label>
                <Select value={editForm.actionTypeId} onValueChange={v => setEditForm(prev => ({ ...prev, actionTypeId: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{actionTypes.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1.5 block">Nome</Label><Input value={editForm.nome} onChange={e => setEditForm(prev => ({ ...prev, nome: e.target.value }))} className="rounded-xl" /></div>
              <div><Label className="text-xs mb-1.5 block">Descrição</Label><Textarea value={editForm.descricao} onChange={e => setEditForm(prev => ({ ...prev, descricao: e.target.value }))} className="rounded-xl" /></div>
              <div><Label className="text-xs mb-1.5 block">Tags</Label><Input value={editForm.tags} onChange={e => setEditForm(prev => ({ ...prev, tags: e.target.value }))} className="rounded-xl" /></div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={editForm.isActive} onCheckedChange={v => setEditForm(prev => ({ ...prev, isActive: !!v }))} /> Ativo</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={editForm.isDefault} onCheckedChange={v => setEditForm(prev => ({ ...prev, isDefault: !!v }))} /> Padrão da ação</label>
              </div>
              {!editForm.actionTypeId && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Selecione um tipo de ação.</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModel(null)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={salvandoEdicao} className="rounded-xl">{salvandoEdicao ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
