import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plug } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AutomationHero, AutomationNav, EmptyState, StatusBadge } from "@/components/automation/automation-hub";
import { FUTURE_INTEGRATION_PROVIDERS } from "@/lib/automation/providers";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/automations/integrations")({
  head: () => ({ meta: [{ title: "Integracoes - Automacoes - FOCUS" }] }),
  component: AutomationIntegrations,
});

function AutomationIntegrations() {
  const { data: integrations = [] } = useQuery({
    queryKey: ["automation-integrations"],
    queryFn: async () => (await supabase.from("automation_integrations").select("*").order("updated_at", { ascending: false })).data ?? [],
  });

  const statusByProvider = new Map(integrations.map((item) => [item.provider, item.status]));

  return (
    <AppShell title="Integracoes" subtitle="Integration Manager">
      <AutomationNav />
      <AutomationHero
        eyebrow="Integration Manager"
        title="Catalogo preparado para provedores externos."
        description="Nenhuma integracao real foi conectada nesta sprint. Esta tela define os provedores, estados, capacidades e pontos de evolucao."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {FUTURE_INTEGRATION_PROVIDERS.map((provider) => {
          const status = statusByProvider.get(provider.provider) ?? provider.status;
          return (
            <div key={provider.provider} className="rounded-2xl border border-border-subtle bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Plug className="size-5" />
                </div>
                <StatusBadge status={status} />
              </div>
              <h3 className="mt-4 text-sm font-medium">{provider.name}</h3>
              <p className="mt-2 min-h-10 text-xs text-muted-foreground">{provider.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {provider.capabilities.map((capability) => (
                  <span key={capability} className="rounded-full border border-border-subtle bg-background/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {capability}
                  </span>
                ))}
              </div>
              <p className="mt-4 font-mono text-[10px] uppercase text-muted-foreground">Auth: {provider.authType}</p>
              {provider.provider === "webhooks" && (
                <Link to="/automations/webhooks" className="mt-4 inline-flex h-8 items-center rounded-lg border border-border-subtle px-3 text-xs text-muted-foreground hover:bg-background hover:text-foreground">
                  Gerenciar webhooks
                </Link>
              )}
              {provider.provider === "rest_api" && (
                <span className="mt-4 inline-flex h-8 items-center rounded-lg border border-border-subtle px-3 text-xs text-muted-foreground">
                  Em breve
                </span>
              )}
            </div>
          );
        })}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Plug className="size-5" />
            </div>
            <StatusBadge status="available" />
          </div>
          <h3 className="mt-4 text-sm font-medium">n8n Connector</h3>
          <p className="mt-2 min-h-10 text-xs text-muted-foreground">Conector nativo para enviar e receber eventos via n8n.</p>
          <Link to="/automations/integrations/n8n" className="mt-4 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground">
            Configurar n8n
          </Link>
        </div>
      </div>

      <div className="mt-6">
        {integrations.length === 0 ? (
          <EmptyState
            title="Nenhuma conexao cadastrada"
            description="Quando uma integracao for conectada, seu estado local aparecera aqui sem alterar o catalogo de provedores futuros."
          />
        ) : null}
      </div>
    </AppShell>
  );
}
