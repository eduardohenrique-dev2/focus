import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSaveStatus } from "@/hooks/use-autosave";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configuracoes - FOCUS" }] }),
  component: SettingsPage,
});

const AI_MODES = ["local-context-engine"];

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { status, set } = useAutoSaveStatus();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  const [model, setModel] = useState("local-context-engine");
  useEffect(() => {
    if (profile?.preferred_ai_model) setModel(profile.preferred_ai_model);
  }, [profile?.id]);

  const save = async (m: string) => {
    setModel(m);
    set("saving");
    const { error } = await supabase
      .from("profiles")
      .update({ preferred_ai_provider: "local", preferred_ai_model: m })
      .eq("user_id", user!.id);
    if (error) set("error");
    else {
      set("saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
    }
  };

  return (
    <AppShell title="Configuracoes" subtitle="Preferencias da plataforma" status={status}>
      <div className="max-w-xl bg-surface border border-border-subtle rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-border-subtle">
          <Sparkles className="size-5 text-primary" />
          <div>
            <h3 className="font-medium text-sm">Motor da IA</h3>
            <p className="text-xs text-muted-foreground">Context Engine local usando apenas dados do FOCUS.</p>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Modo</label>
          <select
            value={model}
            onChange={(e) => save(e.target.value)}
            className="mt-1.5 w-full bg-background border border-border-subtle rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary/40"
          >
            {AI_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground mt-2">
            A IA flutuante consulta Dashboard, tarefas, projetos, calendario, habitos, metas, estudos, flashcards,
            financas, notas, lembretes, notificacoes, configuracoes, historico de conversas e memoria local.
          </p>
        </div>
        <div className="text-[11px] text-muted-foreground space-y-1 pt-4 border-t border-border-subtle">
          <p>
            Tema: <span className="text-foreground">Dark moderno</span> (padrao)
          </p>
          <p>
            Salvamento automatico: <span className="text-primary">Ativo em toda a plataforma</span>
          </p>
          <p>
            Sincronizacao em tempo real: <span className="text-primary">Habilitada</span>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
