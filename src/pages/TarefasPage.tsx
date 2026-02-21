import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, CheckSquare, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTarefas, useTimesheet } from '@/hooks/useTarefas';
import { TarefaModal } from '@/components/tarefas/TarefaModal';
import { TarefaDetailModal } from '@/components/tarefas/TarefaDetailModal';
import { TimesheetModal } from '@/components/tarefas/TimesheetModal';
import { TarefasKanban } from '@/components/tarefas/TarefasKanban';
import { TimesheetTable } from '@/components/tarefas/TimesheetTable';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Tarefa } from '@/types/tarefas';

export default function TarefasPage() {
  const { tarefas, loading: loadingTarefas, updateTarefa, deleteTarefa } = useTarefas();
  const { registros, loading: loadingTimesheet } = useTimesheet();
  
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [timesheetModalOpen, setTimesheetModalOpen] = useState(false);
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null);
  const [detailTarefa, setDetailTarefa] = useState<Tarefa | null>(null);

  const handleSelectTarefa = (tarefa: Tarefa) => {
    setDetailTarefa(tarefa);
  };

  const handleEditFromDetail = (tarefa: Tarefa) => {
    setDetailTarefa(null);
    setSelectedTarefa(tarefa);
    setTarefaModalOpen(true);
  };

  const handleNewTarefa = () => {
    setSelectedTarefa(null);
    setTarefaModalOpen(true);
  };

  // KPIs
  const tarefasPendentes = tarefas.filter(t => t.status === 'Pendente').length;
  const tarefasEmAndamento = tarefas.filter(t => t.status === 'Em Andamento').length;
  const tarefasConcluidas = tarefas.filter(t => t.status === 'Concluída').length;
  const tarefasUrgentes = tarefas.filter(t => t.prioridade === 'Urgente' && t.status !== 'Concluída').length;

  const totalHorasMes = registros.reduce((acc, r) => acc + r.duracao_minutos, 0) / 60;

  return (
    <AppLayout>
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Tarefas & Timesheet</h1>
          <p className="text-sm text-muted-foreground">Gestão de tarefas e controle de horas</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={() => setTimesheetModalOpen(true)} variant="outline" size="sm" className="flex-1 sm:flex-none">
            <Clock className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden md:inline">Registrar</span> Horas
          </Button>
          <Button onClick={handleNewTarefa} size="sm" className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden md:inline">Nova</span> Tarefa
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            <CheckSquare className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tarefasPendentes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tarefasEmAndamento}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{tarefasConcluidas}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Urgentes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{tarefasUrgentes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Horas (Mês)</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHorasMes.toFixed(1)}h</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="kanban" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kanban">Quadro de Tarefas</TabsTrigger>
          <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <TarefasKanban 
            tarefas={tarefas} 
            loading={loadingTarefas}
            onUpdateTarefa={updateTarefa}
            onDeleteTarefa={deleteTarefa}
            onSelectTarefa={handleSelectTarefa}
          />
        </TabsContent>

        <TabsContent value="timesheet">
          <Card>
            <CardHeader>
              <CardTitle>Controle de Horas</CardTitle>
            </CardHeader>
            <CardContent>
              <TimesheetTable registros={registros} loading={loadingTimesheet} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TarefaDetailModal open={!!detailTarefa} onOpenChange={(o) => !o && setDetailTarefa(null)} tarefa={detailTarefa} onEdit={handleEditFromDetail} />
      <TarefaModal open={tarefaModalOpen} onOpenChange={setTarefaModalOpen} tarefa={selectedTarefa} onDelete={deleteTarefa} />
      <TimesheetModal open={timesheetModalOpen} onOpenChange={setTimesheetModalOpen} />
    </div>
    </AppLayout>
  );
}
