import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSaveStatus } from "@/hooks/use-autosave";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Metas — FOCUS" }] }),
  component: GoalsPage,
});

function GoalsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { status, set } = useAutoSaveStatus();
  const [title, setTitle] = useState("");

  const { data: goals = [] } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => (await supabase.from("goals").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = async () => {
    if (!title.trim()) return;
    set("saving");
    const { error } = await supabase.from("goals").insert({ user_id: user!.id, title: title.trim() });
    if (error) set("error"); else { set("saved"); setTitle(""); qc.invalidateQueries({ queryKey: ["goals"] }); }
  };
  const setProgress = async (id: string, progress: number) => {
    set("saving");
    await supabase.from("goals").update({ progress, status: progress >= 100 ? "completed" : "active" }).eq("id", id);
    set("saved"); qc.invalidateQueries({ queryKey: ["goals"] });
  };
  const remove = async (id: string) => { await supabase.from("goals").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["goals"] }); };

  return (
    <AppShell title="Metas" subtitle={`${goals.length} ativas`} status={status}>
      <div className="flex gap-2 mb-6">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Nova meta (ex: Ler 24 livros este ano)"
          className="flex-1 h-10 bg-surface border border-border-subtle rounded-lg px-3.5 text-sm outline-none focus:border-primary/40" />
        <button onClick={create} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="size-4" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((g) => (
          <div key={g.id} className="bg-surface border border-border-subtle rounded-2xl p-5 group">
            <div className="flex items-start justify-between">
              <h3 className="font-medium flex-1">{g.title}</h3>
              <button onClick={() => remove(g.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5 font-mono"><span>PROGRESSO</span><span>{g.progress}%</span></div>
              <input type="range" min={0} max={100} value={g.progress} onChange={(e) => setProgress(g.id, Number(e.target.value))} className="w-full accent-primary" />
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
