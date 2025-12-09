import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, CheckSquare, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTarefas, useTimesheet } from '@/hooks/useTarefas';
import { TarefaModal } from '@/components/tarefas/TarefaModal';
import { TimesheetModal } from '@/components/tarefas/TimesheetModal';
import { TarefasKanban } from '@/components/tarefas/TarefasKanban';
import { TimesheetTable } from '@/components/tarefas/TimesheetTable';

export default function TarefasPage() {
  const { tarefas, loading: loadingTarefas, updateTarefa, deleteTarefa } = useTarefas();
  const { registros, loading: loadingTimesheet } = useTimesheet();
  
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [timesheetModalOpen, setTimesheetModalOpen] = useState(false);

  // KPIs
  const tarefasPendentes = tarefas.filter(t => t.status === 'Pendente').length;
  const tarefasEmAndamento = tarefas.filter(t => t.status === 'Em Andamento').length;
  const tarefasConcluidas = tarefas.filter(t => t.status === 'Concluída').length;
  const tarefasUrgentes = tarefas.filter(t => t.prioridade === 'Urgente' && t.status !== 'Concluída').length;

  const totalHorasMes = registros.reduce((acc, r) => acc + r.duracao_minutos, 0) / 60;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tarefas & Timesheet</h1>
          <p className="text-muted-foreground">Gestão de tarefas e controle de horas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setTimesheetModalOpen(true)} variant="outline">
            <Clock className="h-4 w-4 mr-2" />
            Registrar Horas
          </Button>
          <Button onClick={() => setTarefaModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

      <TarefaModal open={tarefaModalOpen} onOpenChange={setTarefaModalOpen} />
      <TimesheetModal open={timesheetModalOpen} onOpenChange={setTimesheetModalOpen} />
    </div>
  );
}
