import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSaveStatus } from "@/hooks/use-autosave";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => ({ meta: [{ title: "Hábitos — FOCUS" }] }),
  component: HabitsPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const last7 = () => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (6 - i));
  return d.toISOString().slice(0, 10);
});

function HabitsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { status, set } = useAutoSaveStatus();
  const [name, setName] = useState("");

  const { data: habits = [] } = useQuery({
    queryKey: ["habits"],
    queryFn: async () => (await supabase.from("habits").select("*").eq("archived", false).order("created_at")).data ?? [],
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["habit_logs"],
    queryFn: async () => (await supabase.from("habit_logs").select("*").gte("completed_date", last7()[0])).data ?? [],
  });

  const create = async () => {
    if (!name.trim()) return;
    set("saving");
    const { error } = await supabase.from("habits").insert({ user_id: user!.id, name: name.trim() });
    if (error) { set("error"); toast.error(error.message); }
    else { set("saved"); setName(""); qc.invalidateQueries({ queryKey: ["habits"] }); }
  };

  const toggleDay = async (habitId: string, date: string) => {
    set("saving");
    const existing = logs.find((l) => l.habit_id === habitId && l.completed_date === date);
    if (existing) {
      await supabase.from("habit_logs").delete().eq("id", existing.id);
    } else {
      await supabase.from("habit_logs").insert({ habit_id: habitId, user_id: user!.id, completed_date: date });
    }
    set("saved");
    qc.invalidateQueries({ queryKey: ["habit_logs"] });
  };

  const remove = async (id: string) => {
    await supabase.from("habits").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["habits"] });
  };

  const days = last7();

  return (
    <AppShell title="Hábitos" subtitle={`${habits.length} ativos`} status={status}>
      <div className="flex gap-2 mb-6">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Novo hábito (ex: Meditar 10min)"
          className="flex-1 h-10 bg-surface border border-border-subtle rounded-lg px-3.5 text-sm outline-none focus:border-primary/40" />
        <button onClick={create} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="size-4" />Adicionar</button>
      </div>

      <div className="bg-surface border border-border-subtle rounded-2xl overflow-hidden">
        {habits.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">Nenhum hábito ainda.</p>
        ) : (
          <table className="w-full">
            <thead className="border-b border-border-subtle">
              <tr className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
                <th className="text-left px-4 py-3">Hábito</th>
                {days.map((d) => <th key={d} className="px-2 py-3">{new Date(d).toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3)}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {habits.map((h) => (
                <tr key={h.id} className="border-b border-border-subtle group hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-sm">{h.name}</td>
                  {days.map((d) => {
                    const done = logs.some((l) => l.habit_id === h.id && l.completed_date === d);
                    return (
                      <td key={d} className="px-2 py-3 text-center">
                        <button onClick={() => toggleDay(h.id, d)}
                          className={`size-7 rounded-md border mx-auto flex items-center justify-center transition ${done ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary/50"}`}>
                          {done && <Check className="size-3.5" />}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2"><button onClick={() => remove(h.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
