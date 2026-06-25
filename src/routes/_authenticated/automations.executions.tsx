import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AutomationHero, AutomationNav, AutomationPanel, EmptyState, StatusBadge } from "@/components/automation/automation-hub";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/automations/executions")({
  head: () => ({ meta: [{ title: "Execucoes - Automacoes - FOCUS" }] }),
  component: AutomationExecutions,
});

function AutomationExecutions() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [destinationFilter, setDestinationFilter] = useState("all");
  const { data: logs = [] } = useQuery({
    queryKey: ["automation-execution-logs", statusFilter, destinationFilter],
    queryFn: async () => {
      let query = supabase.from("automation_execution_logs").select("*").order("created_at", { ascending: false }).limit(120);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (destinationFilter !== "all") query = query.eq("destination", destinationFilter);
      return (await query).data ?? [];
    },
  });

  return (
    <AppShell title="Historico de Execucoes" subtitle="Execution Log">
      <AutomationNav />
      <AutomationHero
        eyebrow="Execution Log"
        title="Auditoria central para workflows, eventos e webhooks."
        description="Cada execucao registra tempo, resultado, erro, payload, workflow, evento e usuario. Isso sera essencial para debug e n8n."
      />

      <AutomationPanel title="Filtros">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40">
            <option value="all">Todos os status</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
          <select value={destinationFilter} onChange={(e) => setDestinationFilter(e.target.value)}
            className="h-10 rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40">
            <option value="all">Todos os destinos</option>
            <option value="n8n">n8n</option>
            <option value="focus">FOCUS</option>
          </select>
        </div>
      </AutomationPanel>

      <div className="mt-6">
      {logs.length === 0 ? (
        <EmptyState title="Nenhuma execucao registrada" description="O Automation Engine gravara dry-runs e execucoes reais nesta tabela." icon={History} />
      ) : (
        <AutomationPanel title="Historico">
          <div className="divide-y divide-border-subtle">
            {logs.map((log) => (
              <div key={log.id} className="grid grid-cols-1 gap-2 py-3 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center">
                <StatusBadge status={log.status} />
                <div className="min-w-0">
                  <p className="truncate text-sm">Workflow: {log.workflow_id ?? "sem workflow"}</p>
                  <p className="truncate text-xs text-muted-foreground">Evento: {log.event_id ?? "sem evento"} / Webhook: {log.webhook_id ?? "sem webhook"}</p>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">{log.duration_ms ?? 0}ms</p>
                <p className="font-mono text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</p>
                {log.error && <p className="lg:col-span-4 text-xs text-destructive">{log.error}</p>}
              </div>
            ))}
          </div>
        </AutomationPanel>
      )}
      </div>
    </AppShell>
  );
}
