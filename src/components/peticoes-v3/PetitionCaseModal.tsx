import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Building2, MapPin, Scale, FileText, CheckCircle, Loader2, Save } from 'lucide-react';
import type { PetitionTypeV3, PetitionCase } from '@/hooks/usePetitionV3';

const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const TIPOS_VARA = ['Juizado Especial Cível','Juizado Fazenda Pública','Vara Cível','Vara Federal','Vara da Fazenda Pública'];
const CONDICOES_ESPECIAIS = ['Idoso (60+)','Aposentado','Servidor Público','Militar','Pensionista','Professor','PCD','Nenhuma'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  petitionType: PetitionTypeV3;
  existingCase?: PetitionCase | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onGenerate: () => Promise<void>;
  saving?: boolean;
  generating?: boolean;
}

export default function PetitionCaseModal({
  open, onOpenChange, petitionType, existingCase, onSave, onGenerate, saving, generating,
}: Props) {
  const [activeTab, setActiveTab] = useState('cliente');
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (existingCase) {
      setForm({ ...existingCase });
    } else {
      setForm({
        cliente_nacionalidade: 'brasileiro(a)',
        cliente_uf: 'AM',
        estado: 'Amazonas',
        pedir_inversao_onus: true,
        pedir_justica_gratuita: true,
      });
    }
  }, [existingCase, open]);

  const set = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));
  const get = (key: string) => form[key] as string || '';
  const getBool = (key: string) => !!form[key];

  const setFatico = (key: string, value: string) => {
    const dados = (form.dados_faticos || {}) as Record<string, string>;
    set('dados_faticos', { ...dados, [key]: value });
  };
  const getFatico = (key: string) => ((form.dados_faticos || {}) as Record<string, string>)[key] || '';

  const fieldSchema = petitionType.field_schema || {};

  const handleSave = async () => {
    await onSave(form);
  };

  const tabs = [
    { id: 'cliente', label: 'Cliente', icon: User },
    { id: 'reu', label: 'Réu', icon: Building2 },
    { id: 'competencia', label: 'Competência', icon: MapPin },
    { id: 'fatos', label: 'Fatos', icon: FileText },
    { id: 'pedidos', label: 'Pedidos', icon: Scale },
    { id: 'docs', label: 'Documentos', icon: CheckCircle },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">{petitionType.nome}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {petitionType.descricao || 'Preencha os dados para gerar a petição'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-6 pt-3 border-b">
            <TabsList className="h-auto p-1 bg-muted/50 w-full justify-start gap-1 flex-wrap">
              {tabs.map(tab => (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs gap-1.5 px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <ScrollArea className="flex-1 max-h-[55vh]">
            <div className="p-6 space-y-5">
              {/* BLOCO A - CLIENTE */}
              <TabsContent value="cliente" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome Completo *</Label>
                    <Input value={get('cliente_nome')} onChange={e => set('cliente_nome', e.target.value)} placeholder="Nome completo do cliente" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CPF</Label>
                    <Input value={get('cliente_cpf')} onChange={e => set('cliente_cpf', e.target.value)} placeholder="000.000.000-00" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">RG</Label>
                    <Input value={get('cliente_rg')} onChange={e => set('cliente_rg', e.target.value)} placeholder="RG" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nacionalidade</Label>
                    <Input value={get('cliente_nacionalidade')} onChange={e => set('cliente_nacionalidade', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Naturalidade</Label>
                    <Input value={get('cliente_naturalidade')} onChange={e => set('cliente_naturalidade', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado Civil</Label>
                    <Select value={get('cliente_estado_civil')} onValueChange={v => set('cliente_estado_civil', v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{ESTADOS_CIVIS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profissão</Label>
                    <Input value={get('cliente_profissao')} onChange={e => set('cliente_profissao', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data de Nascimento</Label>
                    <Input type="date" value={get('cliente_data_nascimento')} onChange={e => set('cliente_data_nascimento', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Condição Especial</Label>
                    <Select value={get('cliente_condicao_especial')} onValueChange={v => set('cliente_condicao_especial', v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{CONDICOES_ESPECIAIS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Separator className="col-span-2" />
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Endereço</Label>
                    <Input value={get('cliente_endereco')} onChange={e => set('cliente_endereco', e.target.value)} placeholder="Rua, número" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bairro</Label>
                    <Input value={get('cliente_bairro')} onChange={e => set('cliente_bairro', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cidade</Label>
                    <Input value={get('cliente_cidade')} onChange={e => set('cliente_cidade', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">UF</Label>
                    <Select value={get('cliente_uf')} onValueChange={v => set('cliente_uf', v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CEP</Label>
                    <Input value={get('cliente_cep')} onChange={e => set('cliente_cep', e.target.value)} placeholder="00000-000" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Telefone</Label>
                    <Input value={get('cliente_telefone')} onChange={e => set('cliente_telefone', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">E-mail</Label>
                    <Input value={get('cliente_email')} onChange={e => set('cliente_email', e.target.value)} className="mt-1" />
                  </div>
                </div>
              </TabsContent>

              {/* BLOCO B - RÉU */}
              <TabsContent value="reu" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome / Razão Social do Réu *</Label>
                    <Input value={get('reu_nome')} onChange={e => set('reu_nome', e.target.value)} placeholder="Ex: Banco Bradesco S.A." className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CNPJ</Label>
                    <Input value={get('reu_cnpj')} onChange={e => set('reu_cnpj', e.target.value)} placeholder="00.000.000/0000-00" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo da Instituição</Label>
                    <Select value={get('reu_tipo')} onValueChange={v => set('reu_tipo', v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {['Banco','Financeira','Companhia Aérea','Ente Público Federal','Ente Público Estadual','Ente Público Municipal','Operadora de Saúde','Seguradora','Outro'].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Natureza da Relação</Label>
                    <Select value={get('reu_natureza_relacao')} onValueChange={v => set('reu_natureza_relacao', v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {['Consumo','Trabalhista','Administrativa','Previdenciária','Civil'].map(n => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Endereço do Réu</Label>
                    <Input value={get('reu_endereco')} onChange={e => set('reu_endereco', e.target.value)} className="mt-1" />
                  </div>
                </div>
              </TabsContent>

              {/* BLOCO C - COMPETÊNCIA */}
              <TabsContent value="competencia" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comarca</Label>
                    <Input value={get('comarca')} onChange={e => set('comarca', e.target.value)} placeholder="Ex: Manaus" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</Label>
                    <Input value={get('estado')} onChange={e => set('estado', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vara</Label>
                    <Input value={get('vara')} onChange={e => set('vara', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de Vara</Label>
                    <Select value={get('tipo_vara')} onValueChange={v => set('tipo_vara', v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{TIPOS_VARA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Separator className="col-span-2" />
                  <div className="col-span-2 flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <Label className="text-sm font-medium">Tramitação Preferencial</Label>
                      <p className="text-xs text-muted-foreground">Idoso, doença grave, PCD</p>
                    </div>
                    <Switch checked={getBool('tramitacao_preferencial')} onCheckedChange={v => set('tramitacao_preferencial', v)} />
                  </div>
                  {getBool('tramitacao_preferencial') && (
                    <div className="col-span-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fundamento da Prioridade</Label>
                      <Input value={get('fundamento_prioridade')} onChange={e => set('fundamento_prioridade', e.target.value)} placeholder="Ex: Idoso com 65 anos (Estatuto do Idoso)" className="mt-1" />
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* BLOCO D - DADOS FÁTICOS */}
              <TabsContent value="fatos" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {fieldSchema.contrato && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nº do Contrato</Label>
                      <Input value={getFatico('numero_contrato')} onChange={e => setFatico('numero_contrato', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.banco && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Banco / Instituição</Label>
                      <Input value={getFatico('banco_nome')} onChange={e => setFatico('banco_nome', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.beneficio_inss && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nº Benefício INSS</Label>
                      <Input value={getFatico('beneficio_inss')} onChange={e => setFatico('beneficio_inss', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.valor_cobrado && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor Cobrado (R$)</Label>
                      <Input type="number" value={getFatico('valor_cobrado')} onChange={e => setFatico('valor_cobrado', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.parcelas && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quantidade de Parcelas</Label>
                      <Input type="number" value={getFatico('parcelas')} onChange={e => setFatico('parcelas', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.periodo && (
                    <>
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Período Início</Label>
                        <Input type="date" value={getFatico('periodo_inicio')} onChange={e => setFatico('periodo_inicio', e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Período Fim</Label>
                        <Input type="date" value={getFatico('periodo_fim')} onChange={e => setFatico('periodo_fim', e.target.value)} className="mt-1" />
                      </div>
                    </>
                  )}
                  {fieldSchema.matricula && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Matrícula</Label>
                      <Input value={getFatico('matricula')} onChange={e => setFatico('matricula', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.cargo && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cargo</Label>
                      <Input value={getFatico('cargo')} onChange={e => setFatico('cargo', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.decreto && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Decreto/Portaria</Label>
                      <Input value={getFatico('decreto')} onChange={e => setFatico('decreto', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.periodo_retroativo && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Período Retroativo</Label>
                      <Input value={getFatico('periodo_retroativo')} onChange={e => setFatico('periodo_retroativo', e.target.value)} placeholder="Ex: Jan/2020 a Dez/2024" className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.patente && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Patente/Graduação</Label>
                      <Input value={getFatico('patente')} onChange={e => setFatico('patente', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.nivel && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nível/Classe</Label>
                      <Input value={getFatico('nivel')} onChange={e => setFatico('nivel', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.orgao && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Órgão</Label>
                      <Input value={getFatico('orgao')} onChange={e => setFatico('orgao', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.localizador && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Localizador</Label>
                      <Input value={getFatico('localizador')} onChange={e => setFatico('localizador', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.data_voo && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data do Voo</Label>
                      <Input type="date" value={getFatico('data_voo')} onChange={e => setFatico('data_voo', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.origem_destino && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Origem/Destino</Label>
                      <Input value={getFatico('origem_destino')} onChange={e => setFatico('origem_destino', e.target.value)} placeholder="Ex: Manaus → São Paulo" className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.companhia && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Companhia Aérea</Label>
                      <Input value={getFatico('companhia')} onChange={e => setFatico('companhia', e.target.value)} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.tempo_atraso && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tempo de Atraso</Label>
                      <Input value={getFatico('tempo_atraso')} onChange={e => setFatico('tempo_atraso', e.target.value)} placeholder="Ex: 8 horas" className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.descricao_falha && (
                    <div className="col-span-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descrição da Falha</Label>
                      <Textarea value={getFatico('descricao_falha')} onChange={e => setFatico('descricao_falha', e.target.value)} rows={3} className="mt-1" />
                    </div>
                  )}
                  {fieldSchema.data_ocorrencia && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data da Ocorrência</Label>
                      <Input type="date" value={getFatico('data_ocorrencia')} onChange={e => setFatico('data_ocorrencia', e.target.value)} className="mt-1" />
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* BLOCO E - PEDIDOS */}
              <TabsContent value="pedidos" className="mt-0 space-y-3">
                {[
                  { key: 'pedir_tutela_urgencia', label: 'Tutela de Urgência', desc: 'Pedido liminar/antecipação de tutela' },
                  { key: 'pedir_repeticao_indebito', label: 'Repetição de Indébito', desc: 'Devolução em dobro dos valores' },
                  { key: 'pedir_danos_morais', label: 'Danos Morais', desc: 'Indenização por dano moral' },
                  { key: 'pedir_inversao_onus', label: 'Inversão do Ônus da Prova', desc: 'Art. 6°, VIII do CDC' },
                  { key: 'pedir_justica_gratuita', label: 'Justiça Gratuita', desc: 'Gratuidade de justiça (Lei 1.060/50)' },
                  { key: 'tentativa_administrativa', label: 'Houve Tentativa Administrativa', desc: 'Reclamação prévia junto à instituição' },
                  { key: 'desinteresse_conciliacao', label: 'Desinteresse em Conciliação', desc: 'Desinteresse em audiência de conciliação' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={getBool(item.key)} onCheckedChange={v => set(item.key, v)} />
                  </div>
                ))}
                {getBool('pedir_danos_morais') && (
                  <div className="pl-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor Sugerido do Dano Moral (R$)</Label>
                    <Input type="number" value={get('valor_dano_moral')} onChange={e => set('valor_dano_moral', parseFloat(e.target.value) || 0)} className="mt-1 max-w-xs" />
                  </div>
                )}
              </TabsContent>

              {/* BLOCO F - DOCUMENTOS */}
              <TabsContent value="docs" className="mt-0 space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações do Advogado</Label>
                  <Textarea value={get('observacoes_advogado')} onChange={e => set('observacoes_advogado', e.target.value)} rows={3} placeholder="Instruções específicas para a geração..." className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fatos Adicionais</Label>
                  <Textarea value={get('fatos_adicionais')} onChange={e => set('fatos_adicionais', e.target.value)} rows={4} placeholder="Fatos relevantes que não se encaixam nos campos anteriores..." className="mt-1" />
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {petitionType.petition_categories?.nome || 'Categoria'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar Rascunho
            </Button>
            <Button onClick={onGenerate} disabled={generating || !get('cliente_nome')}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Scale className="h-4 w-4 mr-1" />}
              Gerar Petição
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
