import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Workflow } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AutomationHero, AutomationNav, AutomationPanel, EmptyState, StatusBadge } from "@/components/automation/automation-hub";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/automations/workflows")({
  head: () => ({ meta: [{ title: "Workflows - Automacoes - FOCUS" }] }),
  component: AutomationWorkflows,
});

function AutomationWorkflows() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("task.created");

  const { data: workflows = [] } = useQuery({
    queryKey: ["automation-workflows"],
    queryFn: async () => (await supabase.from("automation_workflows").select("*").order("updated_at", { ascending: false })).data ?? [],
  });

  const createWorkflow = async () => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("automation_workflows").insert({
      user_id: user.id,
      name: name.trim(),
      description: "Workflow estrutural criado no Automation Hub.",
      trigger_type: trigger,
      trigger_config: { event: trigger },
      conditions: [],
      actions: [],
      status: "draft",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    qc.invalidateQueries({ queryKey: ["automation-workflows"] });
    toast.success("Workflow criado como rascunho.");
  };

  return (
    <AppShell title="Workflows" subtitle="Automation Engine">
      <AutomationNav />
      <AutomationHero
        eyebrow="Workflow"
        title="Regras, condicoes e acoes prontas para evoluir."
        description="O editor visual ainda nao foi implementado. Nesta sprint, workflows existem como estruturas versionadas e ativaveis futuramente."
      />

      <AutomationPanel title="Criar workflow estrutural">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do workflow"
            className="h-10 rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40" />
          <select value={trigger} onChange={(e) => setTrigger(e.target.value)}
            className="h-10 rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40">
            <option value="task.created">task.created</option>
            <option value="task.updated">task.updated</option>
            <option value="task.completed">task.completed</option>
            <option value="habit.completed">habit.completed</option>
            <option value="calendar.created">calendar.created</option>
            <option value="goal.completed">goal.completed</option>
            <option value="note.created">note.created</option>
            <option value="finance.created">finance.created</option>
          </select>
          <button onClick={createWorkflow} className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground flex items-center justify-center gap-2">
            <Plus className="size-4" />Criar
          </button>
        </div>
      </AutomationPanel>

      <div className="mt-6">
        {workflows.length === 0 ? (
          <EmptyState title="Nenhum workflow criado" description="Crie rascunhos para validar triggers, condicoes e acoes antes do editor visual." icon={Workflow} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {workflows.map((workflow) => (
              <div key={workflow.id} className="rounded-2xl border border-border-subtle bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">{workflow.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{workflow.description}</p>
                  </div>
                  <StatusBadge status={workflow.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-background/60 p-3">
                    <p className="font-mono text-[10px] uppercase text-muted-foreground">Trigger</p>
                    <p className="mt-1">{workflow.trigger_type}</p>
                  </div>
                  <div className="rounded-xl bg-background/60 p-3">
                    <p className="font-mono text-[10px] uppercase text-muted-foreground">Versao</p>
                    <p className="mt-1">v{workflow.version}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
