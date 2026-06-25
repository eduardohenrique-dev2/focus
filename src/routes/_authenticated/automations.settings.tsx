import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AutomationHero, AutomationNav, AutomationPanel } from "@/components/automation/automation-hub";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSaveStatus } from "@/hooks/use-autosave";

export const Route = createFileRoute("/_authenticated/automations/settings")({
  head: () => ({ meta: [{ title: "Configuracoes - Automacoes - FOCUS" }] }),
  component: AutomationSettings,
});

function AutomationSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { status, set } = useAutoSaveStatus();
  const [apiKey, setApiKey] = useState("");
  const [timeout, setTimeoutValue] = useState(30000);
  const [logLevel, setLogLevel] = useState("info");
  const [debugMode, setDebugMode] = useState(false);
  const [retention, setRetention] = useState(30);

  const { data: settings } = useQuery({
    queryKey: ["automation-settings"],
    queryFn: async () => (await supabase.from("automation_settings").select("*").eq("user_id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  useEffect(() => {
    if (!settings) return;
    setApiKey(settings.api_key ?? "");
    setTimeoutValue(settings.timeout_ms);
    setLogLevel(settings.log_level);
    setDebugMode(settings.debug_mode);
    setRetention(settings.retention_days);
  }, [settings?.id]);

  const save = async () => {
    if (!user) return;
    set("saving");
    const { error } = await supabase.from("automation_settings").upsert({
      user_id: user.id,
      api_key: apiKey || null,
      timeout_ms: timeout,
      log_level: logLevel,
      debug_mode: debugMode,
      retention_days: retention,
      security: { require_tokens: true, allow_unsigned_webhooks: false },
    }, { onConflict: "user_id" });
    if (error) {
      set("error");
      toast.error(error.message);
      return;
    }
    set("saved");
    qc.invalidateQueries({ queryKey: ["automation-settings"] });
    toast.success("Configuracoes salvas.");
  };

  return (
    <AppShell title="Configuracoes de Automacoes" subtitle="Seguranca, timeout e logs" status={status}>
      <AutomationNav />
      <AutomationHero
        eyebrow="Settings"
        title="Parametros globais para a infraestrutura de automacoes."
        description="Essas configuracoes serao usadas por webhooks, n8n e conectores externos nas proximas etapas."
      />

      <AutomationPanel title="Configuracoes globais">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Chave da API</span>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Gerada futuramente"
              className="h-10 w-full rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40" />
          </label>
          <label className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Timeout (ms)</span>
            <input value={timeout} onChange={(e) => setTimeoutValue(Number(e.target.value) || 30000)} inputMode="numeric"
              className="h-10 w-full rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40" />
          </label>
          <label className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Nivel de log</span>
            <select value={logLevel} onChange={(e) => setLogLevel(e.target.value)}
              className="h-10 w-full rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40">
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Retencao de logs (dias)</span>
            <input value={retention} onChange={(e) => setRetention(Number(e.target.value) || 30)} inputMode="numeric"
              className="h-10 w-full rounded-lg border border-border-subtle bg-background px-3 text-sm outline-none focus:border-primary/40" />
          </label>
        </div>

        <label className="mt-5 flex items-center gap-3 rounded-xl border border-border-subtle bg-background/60 p-3">
          <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} className="size-4 accent-primary" />
          <span>
            <span className="block text-sm">Modo Debug</span>
            <span className="text-xs text-muted-foreground">Registra payloads e detalhes de execucao para auditoria durante desenvolvimento.</span>
          </span>
        </label>

        <div className="mt-5 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <Shield className="size-4 text-primary" />
          Webhooks assinados e tokens obrigatorios ficam preparados por padrao. A validacao real entra na sprint de endpoints.
        </div>

        <button onClick={save} className="mt-5 h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          Salvar configuracoes
        </button>
      </AutomationPanel>
    </AppShell>
  );
}
