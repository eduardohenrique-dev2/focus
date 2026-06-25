import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AutomationHero, AutomationNav, AutomationPanel, EmptyState, StatusBadge } from "@/components/automation/automation-hub";
import { emitAutomationEvent } from "@/lib/automation/event-engine";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/automations/events")({
  head: () => ({ meta: [{ title: "Eventos - Automacoes - FOCUS" }] }),
  component: AutomationEvents,
});

function AutomationEvents() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [type, setType] = useState("task.created");

  const { data: events = [] } = useQuery({
    queryKey: ["automation-events"],
    queryFn: async () => (await supabase.from("automation_events").select("*").order("occurred_at", { ascending: false }).limit(100)).data ?? [],
  });

  const createEvent = async () => {
    if (!user) return;
    try {
      await emitAutomationEvent(supabase, {
        userId: user.id,
        type,
        source: "automation_hub.manual",
        payload: { dry_run: true, created_from: "Automation Hub" },
      });
      qc.invalidateQueries({ queryKey: ["automation-events"] });
      toast.success("Evento registrado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao registrar evento");
    }
  };

  return (
    <AppShell title="Eventos" subtitle="Event Engine">
      <AutomationNav />
      <AutomationHero
        eyebrow="Event Engine"
        title="Barramento central de eventos internos."
        description="Eventos sao normalizados com tipo, origem, payload, status, usuario e data. Esta tela permite registrar eventos manuais de teste sem integrar servicos externos."
      />

      <AutomationPanel title="Registrar evento estrutural">
        <div className="flex flex-col gap-3 sm:flex-row">
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40">
            <option value="task.created">task.created</option>
            <option value="task.updated">task.updated</option>
            <option value="task.completed">task.completed</option>
            <option value="habit.completed">habit.completed</option>
            <option value="calendar.created">calendar.created</option>
            <option value="calendar.updated">calendar.updated</option>
            <option value="goal.completed">goal.completed</option>
            <option value="study.review.completed">study.review.completed</option>
            <option value="note.created">note.created</option>
            <option value="user.login">user.login</option>
            <option value="user.logout">user.logout</option>
            <option value="finance.created">finance.created</option>
          </select>
          <button onClick={createEvent} className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground flex items-center justify-center gap-2">
            <Plus className="size-4" />Registrar
          </button>
        </div>
      </AutomationPanel>

      <div className="mt-6">
        {events.length === 0 ? (
          <EmptyState title="Nenhum evento registrado" description="Eventos internos futuros serao emitidos pelos modulos do FOCUS e processados pelo Automation Engine." icon={Activity} />
        ) : (
          <AutomationPanel title="Eventos recentes">
            <div className="divide-y divide-border-subtle">
              {events.map((event) => (
                <div key={event.id} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-center">
                  <div>
                    <p className="text-sm">{event.type}</p>
                    <p className="text-xs text-muted-foreground">{event.source}</p>
                  </div>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{JSON.stringify(event.payload)}</p>
                  <StatusBadge status={event.status} />
                  <p className="font-mono text-[10px] text-muted-foreground">{new Date(event.occurred_at).toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>
          </AutomationPanel>
        )}
      </div>
    </AppShell>
  );
}
