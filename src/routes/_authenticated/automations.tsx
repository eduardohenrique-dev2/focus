import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Activity, CheckCircle2, Plug, Workflow, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AutomationHero, AutomationNav, AutomationPanel, EmptyState, StatCard, StatusBadge } from "@/components/automation/automation-hub";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({ meta: [{ title: "Automacoes - FOCUS" }] }),
  component: AutomationDashboard,
});

function todayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function AutomationDashboard() {
  const { data } = useQuery({
    queryKey: ["automation-dashboard"],
    queryFn: async () => {
      const [workflows, integrations, events, todayExecutions, errors, latestEvents, n8nConnection, queue, n8nLogs] = await Promise.all([
        supabase.from("automation_workflows").select("id,status"),
        supabase.from("automation_integrations").select("id,status"),
        supabase.from("automation_events").select("id,status"),
        supabase.from("automation_execution_logs").select("id,status").gte("created_at", todayIso()),
        supabase.from("automation_execution_logs").select("*").eq("status", "failed").order("created_at", { ascending: false }).limit(5),
        supabase.from("automation_events").select("*").order("occurred_at", { ascending: false }).limit(8),
        supabase.from("automation_n8n_connections").select("*").maybeSingle(),
        supabase.from("automation_delivery_queue").select("id,status").eq("destination", "n8n"),
        supabase.from("automation_execution_logs").select("duration_ms,status,destination").eq("destination", "n8n").order("created_at", { ascending: false }).limit(50),
      ]);

      return {
        workflows: workflows.data ?? [],
        integrations: integrations.data ?? [],
        events: events.data ?? [],
        todayExecutions: todayExecutions.data ?? [],
        errors: errors.data ?? [],
        latestEvents: latestEvents.data ?? [],
        n8nConnection: n8nConnection.data,
        queue: queue.data ?? [],
        n8nLogs: n8nLogs.data ?? [],
      };
    },
  });

  const workflows = data?.workflows ?? [];
  const integrations = data?.integrations ?? [];
  const events = data?.events ?? [];
  const todayExecutions = data?.todayExecutions ?? [];
  const errors = data?.errors ?? [];
  const latestEvents = data?.latestEvents ?? [];
  const n8nConnection = data?.n8nConnection;
  const queue = data?.queue ?? [];
  const n8nLogs = data?.n8nLogs ?? [];
  const connected = integrations.filter((item) => item.status === "connected").length;
  const avgN8nMs = n8nLogs.length ? Math.round(n8nLogs.reduce((sum, log) => sum + (log.duration_ms ?? 0), 0) / n8nLogs.length) : 0;

  return (
    <AppShell title="Automacoes" subtitle="Automation Hub V2">
      <AutomationNav />
      <AutomationHero
        eyebrow="FOCUS V2"
        title="Infraestrutura central para workflows, eventos e integracoes futuras."
        description="Esta sprint cria a fundacao local do Automation Hub. Telegram, Gmail, Google Calendar, WhatsApp, Discord, Slack, n8n e APIs REST entram nas proximas etapas sobre esta base."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Workflows" value={workflows.length} detail={`${workflows.filter((w) => w.status === "active").length} ativos`} icon={Workflow} />
        <StatCard label="Integracoes conectadas" value={connected} detail={`${integrations.length} registradas`} icon={Plug} />
        <StatCard label="Eventos executados" value={events.filter((e) => e.status === "processed").length} detail={`${events.length} eventos totais`} icon={Activity} />
        <StatCard label="Execucoes hoje" value={todayExecutions.length} detail={`${todayExecutions.filter((e) => e.status === "failed").length} falhas`} icon={Zap} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AutomationPanel title="Monitoramento n8n">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-background/60 p-3">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Conexao</p>
              <div className="mt-2"><StatusBadge status={n8nConnection?.status ?? "not_configured"} /></div>
            </div>
            <div className="rounded-xl bg-background/60 p-3">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Ultima sincronizacao</p>
              <p className="mt-2">{n8nConnection?.last_sync_at ? new Date(n8nConnection.last_sync_at).toLocaleString("pt-BR") : "nunca"}</p>
            </div>
            <div className="rounded-xl bg-background/60 p-3">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Eventos enviados</p>
              <p className="mt-2 text-lg font-light">{queue.filter((item) => item.status === "sent").length}</p>
            </div>
            <div className="rounded-xl bg-background/60 p-3">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Fila</p>
              <p className="mt-2 text-lg font-light">{queue.filter((item) => item.status === "queued").length}</p>
            </div>
            <div className="rounded-xl bg-background/60 p-3">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Erros n8n</p>
              <p className="mt-2 text-lg font-light">{n8nLogs.filter((log) => log.status === "failed").length}</p>
            </div>
            <div className="rounded-xl bg-background/60 p-3">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Tempo medio</p>
              <p className="mt-2 text-lg font-light">{avgN8nMs}ms</p>
            </div>
          </div>
        </AutomationPanel>

        <AutomationPanel title="Status dos servicos">
          <div className="space-y-3">
            {[
              ["Event Engine", "active", "Captura e normalizacao de eventos internos."],
              ["Automation Engine", "draft", "Processamento dry-run de regras, condicoes e acoes."],
              ["Webhook Manager", "draft", "Entrada e saida HTTP preparadas para proximas etapas."],
              ["Integration Manager", "available", "Catalogo pronto para conectar provedores externos."],
            ].map(([name, status, detail]) => (
              <div key={name} className="flex items-center gap-3 rounded-xl border border-border-subtle bg-background/50 p-3">
                <CheckCircle2 className="size-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{name}</p>
                  <p className="text-xs text-muted-foreground">{detail}</p>
                </div>
                <StatusBadge status={status} />
              </div>
            ))}
          </div>
        </AutomationPanel>

        <AutomationPanel title="Erros recentes">
          {errors.length === 0 ? (
            <EmptyState title="Nenhum erro recente" description="As execucoes com falha aparecerao aqui assim que workflows reais forem ativados." icon={AlertTriangle} />
          ) : (
            <div className="space-y-2">
              {errors.map((error) => (
                <div key={error.id} className="rounded-xl border border-border-subtle bg-background/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge status={error.status} />
                    <span className="font-mono text-[10px] text-muted-foreground">{new Date(error.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{error.error ?? "Falha sem mensagem registrada."}</p>
                </div>
              ))}
            </div>
          )}
        </AutomationPanel>
      </div>

      <div className="mt-6">
        <AutomationPanel title="Ultimos eventos">
          {latestEvents.length === 0 ? (
            <EmptyState title="Nenhum evento registrado" description="O Event Engine registrara eventos como task.created, habit.completed e user.login." icon={Activity} />
          ) : (
            <div className="divide-y divide-border-subtle">
              {latestEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 py-3">
                  <div className="size-2 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{event.type}</p>
                    <p className="truncate text-xs text-muted-foreground">{event.source}</p>
                  </div>
                  <StatusBadge status={event.status} />
                  <span className="hidden font-mono text-[10px] text-muted-foreground sm:block">{new Date(event.occurred_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          )}
        </AutomationPanel>
      </div>
    </AppShell>
  );
}
