import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Upload, X, Sparkles } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AnaliseConfig } from '@/types/extratos';

const BANCOS = [
  'Bradesco', 'Itaú', 'Caixa Econômica Federal', 'Banco do Brasil',
  'Santander', 'Nubank', 'BMG', 'Consignado INSS', 'Outro',
];

const CATEGORIAS: Record<string, string[]> = {
  'Seguros': [
    'SEGURO PRESTAMISTA', 'SEGURO PROTEÇÃO FINANCEIRA', 'SEGURO MAIS PROTECAO',
    'SEGURO AP- BRADESCO', 'SEGURO CART DEB BRADESCO', 'SEGURO UNIMED- BRADESCO',
    'SEG PROTECAO CHEQUE ESP', 'SEGURADORA SECON', 'SERVICO CARTAO PROTEGIDO',
    'BRADESCO AUTO-RE', 'BRADESCO SEG-RESID/OUTROS', 'BRADESCO VIDA E PREVIDENCIA',
    'BRADESCO VIDA PREV-SEG. VIDA', 'BRADESCO VIDA PREV-SEG.VIDA',
    'SABEMI SEGURADO', 'LIBERTY SEGUROS', 'ASPECIR', 'ASPECIR - UNIAO SEGURADORA',
    'PREVISUL', 'VIZA PREV SEGUROS', 'VIDA E PREVIDENCIA', 'MORA VIDA E PREVIDENCIA',
    'AQUISICAO/DEVOLUCAO-SEG',
    // termos genéricos (matching amplo)
    'Seguro de Vida', 'Seguro Residencial', 'Seguro Auto', 'Seguro Cartão',
    'Seguro Desemprego', 'Seguro Acidentes Pessoais',
  ],
  'Tarifas e Extratos': [
    'TARIFA BANCARIA', 'TARIFA BANCARIA (saquepessoal)', 'TARIFA EMISSAO EXTRATO',
    'TAR 2 VIA CARTAO DEBITO', 'TAR ADIANT.DEPOSITANTE', 'TAR DEMONSTR CONSOLIDADO',
    '2VIA DE EXTRATO', 'SEGUNDA VIA', 'EMISSÃO EXTRATO', 'EMISSÃO EXTRATOS UNIFICADO',
    'EXTRATO MÊS', 'EXTRATOmes(E)', 'EXTRATOmovimento(E)',
    'ANUIDADE DE CARTÃO DE CRÉDITO', 'CARTAO CREDITO ANUIDADE', 'DOC/TED INTERNET',
    'SAQUE correspondente', 'SAQUEpessoal', 'SAQUEterminal', 'ADIANT.DEPOSITANTE',
  ],
  'Cestas e Pacotes de Serviços': [
    'CESTA', 'CESTA B. EXPRESSO', 'CESTA B.EXPRESSO', 'CESTA BENEFICIARIO 1',
    'CESTA BRADESCO EXPRE', 'CESTA CELULAR', 'CESTA CLASSIC', 'CESTA CLASSIC MAIS',
    'CESTA DE SERVIÇOS', 'CESTA ESTUDANTIL', 'Cesta Exclus Mais', 'CESTA EXCLUS. MAX',
    'CESTA EXCLUSIVE', 'CESTA EXCLUSIVE 1', 'CESTA EXPRESSO 4 - R', 'CESTA FACIL ECONOMICA',
    'Cesta Facil MAIS', 'CESTA FACIL MASTER', 'CESTA POUPANCA 1', 'CESTA PRIME CLASSICA',
    'CESTA UNIVERSITARIA', 'VR.PARCIAL CESTA B.EXPRESSO1', 'VR.PARCIAL CESTA B.EXPRESSO4',
    'VR.PARCIAL CESTA FACIL ECONO', 'PACOTE DE SERVIÇOS', 'BX', 'Bx.ant.fin/emp',
  ],
  'Capitalização, Clubes e Assistências': [
    'TITULO DE CAPITALIZACAO', 'SOROCRED', 'SUDAMERICA CLUBE DE SERVICOS',
    'SEBRASEG CLUBE DE BENEFICIOS', 'BINCLUB SERVICOS DE ADMINISTRACA',
    'ODONTOPREV S/A', 'CREFISA SA CREDITO FINANCIAMENTO', 'JBCRED SOCIEDADE',
    'PSERV', 'EAGLE', 'PADRONIZADO PRIORITARIOS I',
  ],
  'Pagamentos Eletrônicos e Cobranças': [
    'PAGTO ELETRON COBRANCA', 'PAGTO ELETRON COBRANCA (ACE SEGURADORA S/A)',
    'PAGTO ELETRON COBRANCA (BRADES RESI)', 'PAGTO ELETRON COBRANCA (centro de assistencia)',
    'PAGTO ELETRON COBRANCA (DENTAL SAUDE)', 'PAGTO ELETRON COBRANCA (EAGLE)',
    'PAGTO ELETRON COBRANCA (PSERV)', 'PAGTO ELETRON COBRANCA (VIDA PRE)',
    'PAGTO ELETRON COBRANCA CENASP', 'RECEBIMENTO FORNECEDOR',
  ],
  'Encargos e Mora': [
    'ENCARGOS', 'ENCARGO SALDO VINCULADO', 'ENCARGOS SALDO VINCULADO',
    'ENCARGOS DESCOBERTO CC', 'ENCARGOS EXCESSO LIMITE', 'ENCARGOS LIMITE DE CRED',
    'ENCARGOS LIMITE DE CREDITO', 'MORA CARTAO', 'MORA CARTAO DE CREDITO',
    'MORA CONTA DE TELEFONE', 'MORA CRED PESS', 'MORA CREDITO PESSOAL', 'Mora Cta Telef',
    'MORA DE OPERACAO', 'MORA ENC DESCOBERTO C.C', 'MORA ENCARGOS', 'MORA OPERAÇÃO DE CRÉDITO',
    'OPERACOES VENCIDAS', 'GASTOS CARTAO DE CREDITO', 'Gasto c Credito',
    'PROVISAO GASTO CART CRED', 'LANCAMENTO A DEBITO',
  ],
  'Crédito e Operações': [
    'PARC CRED PESS', 'PARCELA CREDITO PESSOAL', 'PARCELA OPER DE CREDITO',
  ],
  'Outros Lançamentos': [
    'APLIC.INVEST FACIL', 'APLICAÇÃO AUTOMÁTICA', 'APLICACAO CDB',
    'REGULARIZACAO LANCAMENTO', 'REGULARIZAÇÃO MANUAL', 'REORGANIZACAO FINANCEIRA', 'MSG',
    'Débitos Não Identificados', 'Cobranças Duplicadas', 'Valores Divergentes do Contrato',
  ],
};

const ALL_ITEMS = Object.values(CATEGORIAS).flat();

interface Props {
  onSubmit: (config: AnaliseConfig) => void;
}

export function ExtratoConfigForm({ onSubmit }: Props) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [banco, setBanco] = useState('');
  const [bancoOutro, setBancoOutro] = useState('');
  const [dataInicial, setDataInicial] = useState<Date>();
  const [dataFinal, setDataFinal] = useState<Date>();
  const [tipos, setTipos] = useState<string[]>([...ALL_ITEMS]);
  const [nomeCliente, setNomeCliente] = useState('');
  const [cpf, setCpf] = useState('');
  const [numeroContrato, setNumeroContrato] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter(f => {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} excede 10MB`); return false; }
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) {
        toast.error(`${f.name}: formato não aceito`); return false;
      }
      return true;
    });
    setArquivos(prev => {
      const combined = [...prev, ...newFiles].slice(0, 5);
      if (prev.length + newFiles.length > 5) toast.warning('Máximo 5 arquivos');
      return combined;
    });
  }, []);

  const removeFile = (idx: number) => setArquivos(prev => prev.filter((_, i) => i !== idx));

  const toggleTipo = (item: string) => {
    setTipos(prev => prev.includes(item) ? prev.filter(t => t !== item) : [...prev, item]);
  };

  const setPeriodo = (months: number) => {
    setDataFinal(new Date());
    setDataInicial(subMonths(new Date(), months));
  };

  const handleSubmit = () => {
    if (arquivos.length === 0) { toast.error('Selecione pelo menos 1 extrato'); return; }
    if (!banco) { toast.error('Selecione o banco'); return; }
    if (tipos.length === 0) { toast.error('Selecione pelo menos 1 tipo de cobrança'); return; }
    const bancoFinal = banco === 'Outro' ? bancoOutro || 'Outro' : banco;
    onSubmit({
      arquivos,
      banco: bancoFinal,
      dataInicial: dataInicial ? format(dataInicial, 'yyyy-MM-dd') : '',
      dataFinal: dataFinal ? format(dataFinal, 'yyyy-MM-dd') : '',
      tiposCobranças: tipos,
      nomeCliente,
      cpf,
      numeroContrato,
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Configuração da Análise</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {/* Upload */}
        <div className="space-y-2">
          <Label>Upload de Extratos</Label>
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Arraste arquivos ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG • Máx 10MB • Até 5 arquivos</p>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => handleFiles(e.target.files)} />
          <p className="text-xs text-muted-foreground">{arquivos.length} de 5 arquivos selecionados</p>
          {arquivos.length > 0 && (
            <div className="space-y-1">
              {arquivos.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-3 py-1.5 text-sm">
                  <span className="truncate">{f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
                  <button onClick={() => removeFile(i)}><X className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Banco */}
        <div className="space-y-2">
          <Label>Banco do Extrato</Label>
          <Select value={banco} onValueChange={setBanco}>
            <SelectTrigger><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
            <SelectContent>
              {BANCOS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          {banco === 'Outro' && (
            <Input placeholder="Nome do banco" value={bancoOutro} onChange={e => setBancoOutro(e.target.value)} />
          )}
        </div>

        {/* Período */}
        <div className="space-y-2">
          <Label>Período de Análise</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            <Button variant="outline" size="sm" onClick={() => setPeriodo(3)}>Últimos 3 meses</Button>
            <Button variant="outline" size="sm" onClick={() => setPeriodo(6)}>Últimos 6 meses</Button>
            <Button variant="outline" size="sm" onClick={() => setPeriodo(12)}>Último ano</Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Data inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataInicial && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicial ? format(dataInicial, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataInicial} onSelect={setDataInicial} locale={ptBR} className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">Data final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataFinal && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFinal ? format(dataFinal, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataFinal} onSelect={setDataFinal} locale={ptBR} className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Tipos de cobrança */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Tipos de Cobrança para Verificar</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setTipos([...ALL_ITEMS])}>Todos</Button>
              <Button variant="outline" size="sm" onClick={() => setTipos([])}>Limpar</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(CATEGORIAS).map(([cat, items]) => (
              <div key={cat} className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{cat}</p>
                {items.map(item => (
                  <label key={item} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={tipos.includes(item)} onCheckedChange={() => toggleTipo(item)} />
                    <span className="leading-tight">{item}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Dados do cliente */}
        <div className="space-y-2">
          <Label>Informações do Cliente (opcional)</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input placeholder="Nome do cliente" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} />
            <Input placeholder="CPF" value={cpf} onChange={e => setCpf(e.target.value)} />
            <Input placeholder="Nº do contrato" value={numeroContrato} onChange={e => setNumeroContrato(e.target.value)} />
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit}>
          <Sparkles className="h-5 w-5 mr-2" />
          INICIAR ANÁLISE COM IA
        </Button>
      </CardContent>
    </Card>
  );
}
