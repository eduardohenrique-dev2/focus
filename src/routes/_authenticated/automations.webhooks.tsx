import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Webhook } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AutomationHero, AutomationNav, AutomationPanel, EmptyState, StatusBadge } from "@/components/automation/automation-hub";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/automations/webhooks")({
  head: () => ({ meta: [{ title: "Webhooks - Automacoes - FOCUS" }] }),
  component: AutomationWebhooks,
});

function AutomationWebhooks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<"incoming" | "outgoing">("incoming");
  const [method, setMethod] = useState("POST");

  const { data: webhooks = [] } = useQuery({
    queryKey: ["automation-webhooks"],
    queryFn: async () => (await supabase.from("automation_webhooks").select("*").order("updated_at", { ascending: false })).data ?? [],
  });

  const createWebhook = async () => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("automation_webhooks").insert({
      user_id: user.id,
      name: name.trim(),
      direction,
      http_method: method,
      status: "draft",
      token: crypto.randomUUID(),
      url: direction === "incoming" ? null : "https://example.com/webhook",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    qc.invalidateQueries({ queryKey: ["automation-webhooks"] });
    toast.success("Webhook criado como rascunho.");
  };

  return (
    <AppShell title="Webhooks" subtitle="Webhook Manager">
      <AutomationNav />
      <AutomationHero
        eyebrow="Webhook Manager"
        title="Entrada e saida HTTP preparadas para automacoes externas."
        description="Esta sprint cria os registros e estados de webhooks. Nenhum endpoint publico ou chamada externa real foi conectado ainda."
      />

      <AutomationPanel title="Criar webhook estrutural">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_140px_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do webhook"
            className="h-10 rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40" />
          <select value={direction} onChange={(e) => setDirection(e.target.value as "incoming" | "outgoing")}
            className="h-10 rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40">
            <option value="incoming">Entrada</option>
            <option value="outgoing">Saida</option>
          </select>
          <select value={method} onChange={(e) => setMethod(e.target.value)}
            className="h-10 rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
          <button onClick={createWebhook} className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground flex items-center justify-center gap-2">
            <Plus className="size-4" />Criar
          </button>
        </div>
      </AutomationPanel>

      <div className="mt-6">
        {webhooks.length === 0 ? (
          <EmptyState title="Nenhum webhook criado" description="Crie rascunhos de entrada ou saida para preparar futuras conexoes com n8n e APIs REST." icon={Webhook} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="rounded-2xl border border-border-subtle bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">{webhook.name}</h3>
                    <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">{webhook.direction} / {webhook.http_method}</p>
                  </div>
                  <StatusBadge status={webhook.status} />
                </div>
                <div className="mt-4 space-y-2 text-xs">
                  <p className="truncate text-muted-foreground">URL: <span className="text-foreground">{webhook.url ?? "pendente"}</span></p>
                  <p className="truncate text-muted-foreground">Token: <span className="text-foreground">{webhook.token ? "gerado" : "pendente"}</span></p>
                  <p className="text-muted-foreground">Ultima execucao: {webhook.last_execution_at ? new Date(webhook.last_execution_at).toLocaleString("pt-BR") : "nunca"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
