import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSaveStatus, useDebounced } from "@/hooks/use-autosave";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notas — FOCUS" }] }),
  component: NotesPage,
});

function NotesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { status, set } = useAutoSaveStatus();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const dTitle = useDebounced(title, 600);
  const dContent = useDebounced(content, 600);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data } = await supabase.from("notes").select("*").order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const active = notes.find((n) => n.id === activeId);
  useEffect(() => { if (active) { setTitle(active.title); setContent(active.content ?? ""); } }, [active?.id]);

  useEffect(() => {
    if (!activeId || !active) return;
    if (dTitle === active.title && dContent === (active.content ?? "")) return;
    (async () => {
      set("saving");
      const { error } = await supabase.from("notes").update({ title: dTitle, content: dContent }).eq("id", activeId);
      if (error) { set("error"); } else { set("saved"); qc.invalidateQueries({ queryKey: ["notes"] }); }
    })();
  }, [dTitle, dContent, activeId]);

  const create = async () => {
    const { data, error } = await supabase.from("notes").insert({ user_id: user!.id, title: "Nova nota", content: "" }).select().single();
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["notes"] });
    setActiveId(data.id);
  };

  const remove = async (id: string) => {
    await supabase.from("notes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notes"] });
    if (activeId === id) setActiveId(null);
  };

  return (
    <AppShell title="Notas" subtitle={`${notes.length} notas`} status={status}
      actions={<button onClick={create} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="size-4" />Nova</button>}>
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 min-h-[60vh]">
        <aside className="bg-surface border border-border-subtle rounded-2xl p-2 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">Sem notas ainda.</p>
          ) : notes.map((n) => (
            <button key={n.id} onClick={() => setActiveId(n.id)}
              className={`w-full text-left p-3 rounded-lg text-sm group flex items-start gap-2 ${activeId === n.id ? "bg-primary/10 text-foreground" : "hover:bg-white/5 text-muted-foreground"}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{n.title || "Sem título"}</p>
                <p className="text-[11px] truncate opacity-70">{(n.content ?? "").slice(0, 60) || "Vazia"}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); remove(n.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </button>
          ))}
        </aside>
        <section className="bg-surface border border-border-subtle rounded-2xl p-6">
          {!active ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Selecione ou crie uma nota.</div>
          ) : (
            <>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título"
                className="w-full bg-transparent text-2xl font-light outline-none mb-4 placeholder:text-muted-foreground" />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Escreva livremente. Salvamento automático ativo."
                className="w-full bg-transparent text-sm outline-none min-h-[50vh] resize-none placeholder:text-muted-foreground leading-relaxed" />
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
