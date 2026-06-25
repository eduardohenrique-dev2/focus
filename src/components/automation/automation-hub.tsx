import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Activity, Boxes, Code2, Gauge, History, Plug, Settings, Webhook, Workflow, Zap } from "lucide-react";

export const automationTabs = [
  { to: "/automations", label: "Dashboard", icon: Gauge },
  { to: "/automations/integrations", label: "Integracoes", icon: Plug },
  { to: "/automations/workflows", label: "Workflows", icon: Workflow },
  { to: "/automations/events", label: "Eventos", icon: Activity },
  { to: "/automations/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/automations/executions", label: "Execucoes", icon: History },
  { to: "/automations/settings", label: "Configuracoes", icon: Settings },
] as const;

export function AutomationNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mb-6 overflow-x-auto scrollbar-thin">
      <div className="flex min-w-max gap-1 rounded-2xl border border-border-subtle bg-surface/55 p-1">
        {automationTabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.to === "/automations" ? pathname === tab.to : pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function AutomationHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-transparent p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <Zap className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-light tracking-tight md:text-2xl">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon = Boxes,
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-3 text-2xl font-light tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = {
    active: "bg-primary/15 text-primary border-primary/20",
    connected: "bg-primary/15 text-primary border-primary/20",
    success: "bg-primary/15 text-primary border-primary/20",
    processed: "bg-primary/15 text-primary border-primary/20",
    available: "bg-blue-500/15 text-blue-300 border-blue-500/20",
    draft: "bg-muted text-muted-foreground border-border-subtle",
    queued: "bg-blue-500/15 text-blue-300 border-blue-500/20",
    running: "bg-blue-500/15 text-blue-300 border-blue-500/20",
    failed: "bg-destructive/15 text-destructive border-destructive/20",
    error: "bg-destructive/15 text-destructive border-destructive/20",
    disabled: "bg-muted text-muted-foreground border-border-subtle",
    paused: "bg-orange-500/15 text-orange-300 border-orange-500/20",
  }[status] ?? "bg-muted text-muted-foreground border-border-subtle";

  return <span className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${tone}`}>{status}</span>;
}

export function EmptyState({ title, description, icon: Icon = Code2 }: { title: string; description: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-subtle bg-surface/35 px-6 py-12 text-center">
      <Icon className="mx-auto size-7 text-muted-foreground" />
      <h3 className="mt-4 text-sm font-medium">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function AutomationPanel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
