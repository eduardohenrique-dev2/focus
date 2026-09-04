import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
    queryKey: ["reminders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", user.id)
        .order("remind_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendingCount = list.filter((reminder) => reminder.status === "pending").length;

  const create = async () => {
    if (!user || !title.trim() || !remindAt) return;

    const date = new Date(remindAt);
    if (Number.isNaN(date.getTime())) {
      toast.error("Informe uma data e hora válidas.");
      return;
    }

    set("saving");
    const { error } = await supabase.from("reminders").insert({
      user_id: user.id,
      title: title.trim(),
      remind_at: date.toISOString(),
    });

    if (error) {
      set("error");
      toast.error(error.message);
      return;
    }

    set("saved");
    setTitle("");
    setRemindAt("");
    await qc.invalidateQueries({ queryKey: ["reminders", user.id] });
  };

  const done = async (id: string) => {
    if (!user) return;
    set("saving");
    const { error } = await supabase
      .from("reminders")
      .update({ status: "done" })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      set("error");
      toast.error(error.message);
      return;
    }

    set("saved");
    await qc.invalidateQueries({ queryKey: ["reminders", user.id] });
  };

  const remove = async (id: string) => {
    if (!user) return;
    set("saving");
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      set("error");
      toast.error(error.message);
      return;
    }

    set("saved");
    await qc.invalidateQueries({ queryKey: ["reminders", user.id] });
  };

  return (
    <AppShell title="Lembretes" subtitle={`${pendingCount} pendentes`} status={status}>
      <div className="bg-surface border border-border-subtle rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void create()}
          placeholder="Lembrar de..."
          className="flex-1 h-10 bg-background border border-border-subtle rounded-lg px-3 text-sm"
        />
        <input
          type="datetime-local"
          value={remindAt}
          onChange={(event) => setRemindAt(event.target.value)}
          className="h-10 bg-background border border-border-subtle rounded-lg px-3 text-sm"
        />
        <button
          onClick={create}
          disabled={!user || !title.trim() || !remindAt}
          className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Plus className="size-4" />Criar
        </button>
      </div>

      <div className="bg-surface border border-border-subtle rounded-2xl divide-y divide-border-subtle">
        {list.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Sem lembretes.</p>
        ) : (
          list.map((reminder) => (
            <div key={reminder.id} className="flex items-center gap-3 px-4 py-3 group">
              <span
                className={`flex-1 text-sm ${
                  reminder.status === "done" ? "line-through text-muted-foreground" : ""
                }`}
              >
                {reminder.title}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {new Date(reminder.remind_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {reminder.status !== "done" && (
                <button
                  onClick={() => done(reminder.id)}
                  aria-label="Marcar como concluído"
                  className="size-7 rounded-md border border-border-subtle text-muted-foreground hover:text-primary"
                >
                  <Check className="size-3.5 mx-auto" />
                </button>
              )}
              <button
                onClick={() => remove(reminder.id)}
                aria-label="Excluir lembrete"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
