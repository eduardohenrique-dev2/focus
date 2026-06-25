import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Atividade — FOCUS" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { data = [] } = useQuery({
    queryKey: ["activity"],
    queryFn: async () => (await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  return (
    <AppShell title="Atividade" subtitle="Histórico do sistema">
      <div className="bg-surface border border-border-subtle rounded-2xl divide-y divide-border-subtle">
        {data.length === 0 ? <div className="p-12 text-center text-sm text-muted-foreground"><History className="size-6 mx-auto mb-2 opacity-50" />Sem registros ainda.</div>
          : data.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-center gap-3 text-sm">
              <span className="font-mono text-[10px] text-muted-foreground w-24">{new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="font-medium">{a.action}</span>
              <span className="text-muted-foreground text-xs">{a.entity_type}</span>
            </div>
          ))}
      </div>
    </AppShell>
  );
}
