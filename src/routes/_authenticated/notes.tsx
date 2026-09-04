import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSaveStatus, useDebounced } from "@/hooks/use-autosave";
import { toast } from "sonner";
import type { Note } from "@/lib/types";

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

  // Debounce também o ID. Assim, ao trocar de nota, o conteúdo da nota anterior
  // nunca é salvo por engano na nova nota enquanto os campos ainda estão atualizando.
  const debouncedId = useDebounced(activeId, 600);
  const debouncedTitle = useDebounced(title, 600);
  const debouncedContent = useDebounced(content, 600);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = notes.find((note) => note.id === activeId);

  useEffect(() => {
    if (!debouncedId || !user) return;

    const serverNote = notes.find((note) => note.id === debouncedId);
    if (!serverNote) return;
    if (
      debouncedTitle === serverNote.title &&
      debouncedContent === (serverNote.content ?? "")
    ) {
      return;
    }

    let cancelled = false;

    const save = async () => {
      set("saving");
      const { error } = await supabase
        .from("notes")
        .update({ title: debouncedTitle, content: debouncedContent })
        .eq("id", debouncedId)
        .eq("user_id", user.id);

      if (cancelled) return;
      if (error) {
        set("error");
        toast.error(error.message);
        return;
      }

      set("saved");
      await qc.invalidateQueries({ queryKey: ["notes", user.id] });
    };

    void save();
    return () => {
      cancelled = true;
    };
  }, [debouncedId, debouncedTitle, debouncedContent, notes, user, qc, set]);

  const selectNote = (note: Note) => {
    setActiveId(note.id);
    setTitle(note.title);
    setContent(note.content ?? "");
  };

  const create = async () => {
    if (!user) {
      toast.error("Sua sessão ainda não está pronta. Tente novamente.");
      return;
    }

    set("saving");
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: user.id, title: "Nova nota", content: "" })
      .select()
      .single();

    if (error) {
      set("error");
      toast.error(error.message);
      return;
    }

    set("saved");
    setActiveId(data.id);
    setTitle(data.title);
    setContent(data.content ?? "");
    await qc.invalidateQueries({ queryKey: ["notes", user.id] });
  };

  const remove = async (id: string) => {
    if (!user) return;

    set("saving");
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      set("error");
      toast.error(error.message);
      return;
    }

    set("saved");
    if (activeId === id) {
      setActiveId(null);
      setTitle("");
      setContent("");
    }
    await qc.invalidateQueries({ queryKey: ["notes", user.id] });
  };

  return (
    <AppShell
      title="Notas"
      subtitle={`${notes.length} notas`}
      status={status}
      actions={
        <button
          onClick={create}
          disabled={!user}
          className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Plus className="size-4" />Nova
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 min-h-[60vh]">
        <aside className="bg-surface border border-border-subtle rounded-2xl p-2 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">Sem notas ainda.</p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className={`group flex items-start gap-1 rounded-lg ${
                  activeId === note.id
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-white/5 text-muted-foreground"
                }`}
              >
                <button
                  onClick={() => selectNote(note)}
                  className="flex-1 min-w-0 text-left p-3 text-sm"
                >
                  <p className="font-medium truncate">{note.title || "Sem título"}</p>
                  <p className="text-[11px] truncate opacity-70">
                    {(note.content ?? "").slice(0, 60) || "Vazia"}
                  </p>
                </button>
                <button
                  onClick={() => remove(note.id)}
                  aria-label={`Excluir ${note.title || "nota"}`}
                  className="mt-3 mr-2 p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </aside>

        <section className="bg-surface border border-border-subtle rounded-2xl p-6">
          {!active ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Selecione ou crie uma nota.
            </div>
          ) : (
            <>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Título"
                className="w-full bg-transparent text-2xl font-light outline-none mb-4 placeholder:text-muted-foreground"
              />
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Escreva livremente. Salvamento automático ativo."
                className="w-full bg-transparent text-sm outline-none min-h-[50vh] resize-none placeholder:text-muted-foreground leading-relaxed"
              />
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
