import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Eye, Plus, Scale, Building2, Users, Car, Home, Briefcase } from 'lucide-react';

interface ModeloContrato {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  icon: React.ReactNode;
}

const modelosContratos: ModeloContrato[] = [
  {
    id: '1',
    nome: 'Contrato de Honorários Advocatícios',
    descricao: 'Modelo padrão para prestação de serviços jurídicos com cláusulas de honorários fixos e de êxito.',
    categoria: 'Honorários',
    icon: <Scale className="h-5 w-5" />,
  },
  {
    id: '2',
    nome: 'Procuração Ad Judicia',
    descricao: 'Procuração para representação em processos judiciais com poderes especiais.',
    categoria: 'Procuração',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    id: '3',
    nome: 'Contrato Trabalhista - Reclamação',
    descricao: 'Modelo para ações trabalhistas com cláusulas específicas para reclamações.',
    categoria: 'Trabalhista',
    icon: <Briefcase className="h-5 w-5" />,
  },
  {
    id: '4',
    nome: 'Contrato Cível - Indenização',
    descricao: 'Modelo para ações de indenização por danos morais e materiais.',
    categoria: 'Cível',
    icon: <Users className="h-5 w-5" />,
  },
  {
    id: '5',
    nome: 'Contrato Imobiliário',
    descricao: 'Modelo para ações imobiliárias, usucapião e disputas de propriedade.',
    categoria: 'Imobiliário',
    icon: <Home className="h-5 w-5" />,
  },
  {
    id: '6',
    nome: 'Contrato de Trânsito',
    descricao: 'Modelo para ações de trânsito, acidentes e indenizações.',
    categoria: 'Trânsito',
    icon: <Car className="h-5 w-5" />,
  },
  {
    id: '7',
    nome: 'Contrato Empresarial',
    descricao: 'Modelo para ações empresariais e societárias.',
    categoria: 'Empresarial',
    icon: <Building2 className="h-5 w-5" />,
  },
];

export function ModelosContratos() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Modelos de Contratos</h3>
          <p className="text-sm text-muted-foreground">
            Selecione um modelo para usar como base para novos contratos
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Modelo
        </Button>
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
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="h-4 w-4 mr-1" />
                  Visualizar
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Download className="h-4 w-4 mr-1" />
                  Baixar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-3 bg-muted rounded-full mb-3">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium">Criar modelo personalizado</h4>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Faça upload de um documento Word ou PDF para criar um novo modelo de contrato personalizado
            </p>
            <Button variant="outline" className="mt-4">
              Fazer Upload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
