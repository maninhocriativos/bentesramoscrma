import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ExternalLink, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ContratoZapsignComStatus } from '@/hooks/useZapsignContratos';

interface ZapsignContratosTableProps {
  contratos: ContratoZapsignComStatus[];
  isLoading: boolean;
  activeTab: string;
}

const statusColors: Record<string, string> = {
  'Assinado': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Assinatura Parcial': 'bg-blue-50 text-blue-700 border-blue-200',
  'Com Rejeição': 'bg-red-50 text-red-700 border-red-200',
  'Aguardando Assinatura': 'bg-amber-50 text-amber-700 border-amber-200',
  'Cancelado': 'bg-zinc-50 text-zinc-700 border-zinc-200',
  'Rejeitado': 'bg-red-50 text-red-700 border-red-200',
  'Expirado': 'bg-orange-50 text-orange-700 border-orange-200',
};

const origemColors: Record<string, string> = {
  'trafego': 'bg-blue-50 text-blue-700 border-blue-200',
  'bentes_ramos': 'bg-purple-50 text-purple-700 border-purple-200',
};

export function ZapsignContratosTable({
  contratos,
  isLoading,
  activeTab,
}: ZapsignContratosTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [origemFilter, setOrigemFilter] = useState<string>('todas');

  // Filtrar contratos por abas
  const filteredByTab = useMemo(() => {
    return contratos.filter((contrato) => {
      switch (activeTab) {
        case 'zapsign-todos':
          return true;
        case 'zapsign-em-assinatura':
          return contrato.statusLocal === 'Aguardando Assinatura';
        case 'zapsign-assinados':
          return contrato.statusLocal === 'Assinado';
        case 'zapsign-cancelados':
          return contrato.statusLocal === 'Cancelado' ||
            contrato.statusLocal === 'Rejeitado' ||
            contrato.statusLocal === 'Expirado';
        default:
          return true;
      }
    });
  }, [contratos, activeTab]);

  // Filtrar por busca e origem
  const filteredContratos = useMemo(() => {
    return filteredByTab.filter((contrato) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        (contrato.name?.toLowerCase().includes(searchLower) || false) ||
        (contrato.leadNome?.toLowerCase().includes(searchLower) || false) ||
        (contrato.leadEmail?.toLowerCase().includes(searchLower) || false);

      const matchesOrigem =
        origemFilter === 'todas' || contrato.tipoOrigem === origemFilter;

      return matchesSearch && matchesOrigem;
    });
  }, [filteredByTab, searchTerm, origemFilter]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, título do contrato..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={origemFilter} onValueChange={setOrigemFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Filtrar por origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            <SelectItem value="trafego">Tráfego</SelectItem>
            <SelectItem value="bentes_ramos">Bentes Ramos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-border">
        {filteredContratos.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12 text-center">
              <div className="text-muted-foreground">
                <p className="font-medium">Nenhum contrato encontrado</p>
                <p className="text-sm">
                  Crie um novo contrato ou ajuste os filtros
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Contrato</TableHead>
                <TableHead className="font-semibold">Signatário</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Origem</TableHead>
                <TableHead className="font-semibold">Criado</TableHead>
                <TableHead className="font-semibold">Assinado</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContratos.map((contrato) => (
                <TableRow key={contrato.id} className="hover:bg-muted/50">
                  <TableCell className="max-w-sm">
                    <div>
                      <p className="font-medium truncate">{contrato.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ID: {contrato.id.substring(0, 8)}...
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div>
                      <p className="text-sm">
                        {contrato.leadNome || contrato.signers?.[0]?.name || '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contrato.leadEmail ||
                          contrato.signers?.[0]?.email ||
                          '-'}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusColors[contrato.statusLocal || 'Pendente']}
                    >
                      {contrato.statusLocal || 'Pendente'}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    {contrato.tipoOrigem ? (
                      <Badge
                        variant="outline"
                        className={origemColors[contrato.tipoOrigem]}
                      >
                        {contrato.tipoOrigem === 'trafego'
                          ? 'Tráfego'
                          : 'Bentes Ramos'}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  <TableCell className="text-sm">
                    {format(
                      new Date(contrato.created_at),
                      'dd/MM/yyyy HH:mm',
                      { locale: ptBR }
                    )}
                  </TableCell>

                  <TableCell className="text-sm">
                    {contrato.signers?.[0]?.signed_at
                      ? format(
                          new Date(contrato.signers[0].signed_at),
                          'dd/MM/yyyy HH:mm',
                          { locale: ptBR }
                        )
                      : '-'}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-8 w-8 p-0"
                    >
                      <a
                        href={contrato.signers?.[0]?.sign_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir documento"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Rodapé com contagem */}
      <div className="text-sm text-muted-foreground">
        {filteredContratos.length} de {filteredByTab.length} contrato(s)
      </div>
    </div>
  );
}
