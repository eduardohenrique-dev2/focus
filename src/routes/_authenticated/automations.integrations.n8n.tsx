import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AutomationHero, AutomationNav, AutomationPanel, StatCard, StatusBadge } from "@/components/automation/automation-hub";
import { saveN8nConnection, testN8nConnectionFn, processN8nQueueFn } from "@/lib/automation/n8n.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/automations/integrations/n8n")({
  head: () => ({ meta: [{ title: "n8n - Integracoes - FOCUS" }] }),
  component: N8nIntegrationPage,
});

function N8nIntegrationPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const saveConnection = useServerFn(saveN8nConnection);
  const testConnection = useServerFn(testN8nConnectionFn);
  const processQueue = useServerFn(processN8nQueueFn);
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [allowedOrigins, setAllowedOrigins] = useState("");
  const [timeoutMs, setTimeoutMs] = useState(30000);
  const [testing, setTesting] = useState(false);

  const { data: connection } = useQuery({
    queryKey: ["automation-n8n-connection"],
    queryFn: async () => (await supabase.from("automation_n8n_connections").select("*").eq("user_id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  const { data: queue = [] } = useQuery({
    queryKey: ["automation-n8n-queue"],
    queryFn: async () => (await supabase.from("automation_delivery_queue").select("*").eq("destination", "n8n").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["automation-n8n-logs"],
    queryFn: async () => (await supabase.from("automation_execution_logs").select("*").eq("destination", "n8n").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  useEffect(() => {
    if (!connection) {
      setWebhookSecret(crypto.randomUUID().replace(/-/g, ""));
      return;
    }
    setServerUrl(connection.server_url ?? "");
    setApiKey(connection.api_key ?? "");
    setWebhookSecret(connection.webhook_secret);
    setAllowedOrigins(connection.allowed_origins?.join(", ") ?? "");
    setTimeoutMs(connection.timeout_ms);
  }, [connection?.id]);

  const save = async () => {
    const res = await saveConnection({
      data: {
        serverUrl,
        apiKey,
        webhookSecret,
        allowedOrigins: allowedOrigins.split(",").map((item) => item.trim()).filter(Boolean),
        timeoutMs,
      },
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Conexao n8n salva.");
    qc.invalidateQueries({ queryKey: ["automation-n8n-connection"] });
  };

  const test = async () => {
    setTesting(true);
    await save();
    const res = await testConnection({ data: undefined });
    setTesting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    qc.invalidateQueries({ queryKey: ["automation-n8n-connection"] });
    const status = res.result.status;
    if (status === "connected") toast.success("n8n conectado.");
    else if (status === "auth_error") toast.error("Erro de autenticacao no n8n.");
    else if (status === "timeout") toast.error("Timeout ao conectar no n8n.");
    else toast.error("n8n indisponivel.");
  };

  const retryQueue = async () => {
    const res = await processQueue({ data: undefined });
    if (res.ok) {
      toast.success(`${res.processed} entregas processadas.`);
      qc.invalidateQueries({ queryKey: ["automation-n8n-queue"] });
      qc.invalidateQueries({ queryKey: ["automation-n8n-logs"] });
    } else {
      toast.error(res.error);
    }
  };

  const sent = queue.filter((item) => item.status === "sent").length;
  const queued = queue.filter((item) => item.status === "queued").length;
  const failed = queue.filter((item) => item.status === "dead_letter" || item.status === "failed").length;
  const avgMs = logs.length
    ? Math.round(logs.reduce((sum, log) => sum + (log.duration_ms ?? 0), 0) / logs.length)
    : 0;

  return (
    <AppShell title="n8n Connector" subtitle="Integrações / n8n">
      <AutomationNav />
      <AutomationHero
        eyebrow="N8N Connector"
        title="Ponte segura entre FOCUS e n8n por webhooks e REST."
        description="O FOCUS emite eventos padronizados para o n8n e recebe callbacks assinados. Serviços como Telegram, Gmail e Google Calendar devem ficar do lado do n8n."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Status da conexao" value={connection?.status ?? "not_configured"} detail={connection?.last_error ?? "Sem erro registrado"} icon={ShieldCheck} />
        <StatCard label="Eventos enviados" value={sent} detail={`${queued} na fila`} icon={Send} />
        <StatCard label="Erros" value={failed} detail="dead letter/falhas" icon={RefreshCw} />
        <StatCard label="Tempo medio" value={`${avgMs}ms`} detail="ultimas respostas" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AutomationPanel title="Configuracao">
          <div className="grid grid-cols-1 gap-4">
            <label className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">URL do servidor</span>
              <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="https://n8n.seudominio.com"
                className="h-10 w-full rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40" />
            </label>
            <label className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">API Key (opcional)</span>
              <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Bearer token opcional"
                className="h-10 w-full rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40" />
            </label>
            <label className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Secret para Webhooks</span>
              <input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)}
                className="h-10 w-full rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40" />
            </label>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Timeout</span>
                <input value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value) || 30000)} inputMode="numeric"
                  className="h-10 w-full rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40" />
              </label>
              <label className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Origens permitidas</span>
                <input value={allowedOrigins} onChange={(e) => setAllowedOrigins(e.target.value)} placeholder="n8n.seudominio.com"
                  className="h-10 w-full rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40" />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={save} className="h-10 rounded-lg bg-surface px-4 text-sm border border-border-subtle hover:bg-background">
                Salvar
              </button>
              <button onClick={test} disabled={testing} className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {testing ? "Testando..." : "Testar Conexão"}
              </button>
              <button onClick={retryQueue} className="h-10 rounded-lg bg-surface px-4 text-sm border border-border-subtle hover:bg-background">
                Processar fila
              </button>
            </div>
          </div>
        </AutomationPanel>

        <AutomationPanel title="Estado">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={connection?.status ?? "not_configured"} />
            </div>
            <Info label="Ultimo teste" value={connection?.last_test_at ? new Date(connection.last_test_at).toLocaleString("pt-BR") : "nunca"} />
            <Info label="Ultima sincronizacao" value={connection?.last_sync_at ? new Date(connection.last_sync_at).toLocaleString("pt-BR") : "nunca"} />
            <Info label="Ultima resposta" value={connection?.last_response_ms ? `${connection.last_response_ms}ms` : "sem dados"} />
            <Info label="Endpoint de entrada" value="/api/public/webhooks/n8n" />
            <Info label="Endpoint esperado no n8n" value="/webhook/focus-events" />
          </div>
        </AutomationPanel>
      </div>

      <div className="mt-6">
        <AutomationPanel title="Fila de processamento">
          <div className="divide-y divide-border-subtle">
            {queue.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma entrega na fila.</p>
            ) : queue.map((item) => (
              <div key={item.id} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[auto_1fr_auto_auto] md:items-center">
                <StatusBadge status={item.status} />
                <p className="truncate text-sm">{item.event_id}</p>
                <p className="font-mono text-[10px] text-muted-foreground">tentativa {item.attempt_count}/{item.max_attempts}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </AutomationPanel>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate text-right font-mono text-xs">{value}</span>
    </div>
  );
}
