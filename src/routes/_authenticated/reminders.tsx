import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSaveStatus } from "@/hooks/use-autosave";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({ meta: [{ title: "Lembretes — FOCUS" }] }),
  component: RemindersPage,
});

function RemindersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { status, set } = useAutoSaveStatus();
  const [title, setTitle] = useState("");
  const [remindAt, setRemindAt] = useState("");

  const { data: list = [] } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => (await supabase.from("reminders").select("*").order("remind_at")).data ?? [],
  });

  const create = async () => {
    if (!title.trim() || !remindAt) return;
    set("saving");
    const { error } = await supabase.from("reminders").insert({ user_id: user!.id, title: title.trim(), remind_at: new Date(remindAt).toISOString() });
    if (error) set("error"); else { set("saved"); setTitle(""); setRemindAt(""); qc.invalidateQueries({ queryKey: ["reminders"] }); }
  };
  const done = async (id: string) => { await supabase.from("reminders").update({ status: "done" }).eq("id", id); qc.invalidateQueries({ queryKey: ["reminders"] }); };
  const remove = async (id: string) => { await supabase.from("reminders").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["reminders"] }); };

  return (
    <AppShell title="Lembretes" subtitle={`${list.length} agendados`} status={status}>
      <div className="bg-surface border border-border-subtle rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lembrar de..." className="flex-1 h-10 bg-background border border-border-subtle rounded-lg px-3 text-sm" />
        <input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} className="h-10 bg-background border border-border-subtle rounded-lg px-3 text-sm" />
        <button onClick={create} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="size-4" />Criar</button>
      </div>
      <div className="bg-surface border border-border-subtle rounded-2xl divide-y divide-border-subtle">
        {list.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Sem lembretes.</p>
          : list.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 group">
              <span className={`flex-1 text-sm ${r.status === "done" ? "line-through text-muted-foreground" : ""}`}>{r.title}</span>
              <span className="text-xs text-muted-foreground font-mono">{new Date(r.remind_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              {r.status !== "done" && <button onClick={() => done(r.id)} className="size-7 rounded-md border border-border-subtle text-muted-foreground hover:text-primary"><Check className="size-3.5 mx-auto" /></button>}
              <button onClick={() => remove(r.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </div>
          ))}
      </div>
    </AppShell>
  );
}
