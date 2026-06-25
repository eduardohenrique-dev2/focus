import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowLeft, GripVertical, X } from "lucide-react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSaveStatus } from "@/hooks/use-autosave";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Projetos — FOCUS" }] }),
  component: ProjectsPage,
});

type Project = { id: string; name: string; status: string; color?: string | null };
type Column = { id: string; project_id: string; name: string; order_index: number };
type Card = { id: string; project_id: string; column_id: string; title: string; description: string | null; order_index: number };

function ProjectsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { status, set } = useAutoSaveStatus();
  const [name, setName] = useState("");
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await supabase.from("projects").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = async () => {
    if (!name.trim() || !user) return;
    set("saving");
    const { data, error } = await supabase.from("projects").insert({ user_id: user.id, name: name.trim() }).select().single();
    if (error) { set("error"); toast.error(error.message); return; }
    await supabase.from("project_columns").insert([
      { project_id: data.id, user_id: user.id, name: "A fazer", order_index: 0 },
      { project_id: data.id, user_id: user.id, name: "Em progresso", order_index: 1 },
      { project_id: data.id, user_id: user.id, name: "Concluído", order_index: 2 },
    ]);
    set("saved"); setName(""); qc.invalidateQueries({ queryKey: ["projects"] });
  };
  const remove = async (id: string) => { await supabase.from("projects").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["projects"] }); };

  if (activeProject) return <ProjectBoard project={activeProject} onBack={() => setActiveProject(null)} />;

  return (
    <AppShell title="Projetos" subtitle={`${projects.length} projetos`} status={status}>
      <div className="flex gap-2 mb-6">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Novo projeto" className="flex-1 h-10 bg-surface border border-border-subtle rounded-lg px-3.5 text-sm outline-none focus:border-primary/40" />
        <button onClick={create} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="size-4" />Criar</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => (
          <button key={p.id} onClick={() => setActiveProject(p as Project)}
            className="text-left bg-surface border border-border-subtle hover:border-primary/40 rounded-2xl p-5 group transition-colors">
            <div className="flex items-start justify-between">
              <h3 className="font-medium">{p.name}</h3>
              <span onClick={(e) => { e.stopPropagation(); remove(p.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive cursor-pointer"><Trash2 className="size-3.5" /></span>
            </div>
            <p className="text-[11px] font-mono uppercase text-muted-foreground mt-2">{p.status}</p>
          </button>
        ))}
        {projects.length === 0 && (
          <div className="col-span-full text-center py-16 text-sm text-muted-foreground">Crie seu primeiro projeto acima.</div>
        )}
      </div>
    </AppShell>
  );
}

function ProjectBoard({ project, onBack }: { project: Project; onBack: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { status, set } = useAutoSaveStatus();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newColName, setNewColName] = useState("");

  const { data: columns = [] } = useQuery<Column[]>({
    queryKey: ["project-columns", project.id],
    queryFn: async () => (await supabase.from("project_columns").select("*").eq("project_id", project.id).order("order_index")).data as Column[] ?? [],
  });
  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["project-cards", project.id],
    queryFn: async () => (await supabase.from("project_cards").select("*").eq("project_id", project.id).order("order_index")).data as Card[] ?? [],
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`board-${project.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_cards", filter: `project_id=eq.${project.id}` },
        () => qc.invalidateQueries({ queryKey: ["project-cards", project.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_columns", filter: `project_id=eq.${project.id}` },
        () => qc.invalidateQueries({ queryKey: ["project-columns", project.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, project.id, qc]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const findCard = (id: string) => cards.find((c) => c.id === id);
  const activeCard = activeId ? findCard(activeId) : null;

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const card = findCard(String(active.id));
    if (!card) return;
    const overId = String(over.id);
    const targetCol = columns.find((c) => c.id === overId)?.id ?? findCard(overId)?.column_id;
    if (!targetCol || targetCol === card.column_id) return;
    set("saving");
    const { error } = await supabase.from("project_cards").update({ column_id: targetCol }).eq("id", card.id);
    if (error) { set("error"); toast.error(error.message); }
    else { set("saved"); qc.invalidateQueries({ queryKey: ["project-cards", project.id] }); }
  };

  const addCard = async (columnId: string, title: string) => {
    if (!title.trim() || !user) return;
    const order = cards.filter((c) => c.column_id === columnId).length;
    set("saving");
    const { error } = await supabase.from("project_cards").insert({
      project_id: project.id, column_id: columnId, user_id: user.id, title: title.trim(), order_index: order,
    });
    if (error) { set("error"); toast.error(error.message); }
    else { set("saved"); qc.invalidateQueries({ queryKey: ["project-cards", project.id] }); }
  };
  const removeCard = async (id: string) => {
    await supabase.from("project_cards").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["project-cards", project.id] });
  };

  const addColumn = async () => {
    if (!newColName.trim() || !user) return;
    set("saving");
    const { error } = await supabase.from("project_columns").insert({
      project_id: project.id, user_id: user.id, name: newColName.trim(), order_index: columns.length,
    });
    if (error) { set("error"); toast.error(error.message); }
    else { set("saved"); setNewColName(""); qc.invalidateQueries({ queryKey: ["project-columns", project.id] }); }
  };
  const removeColumn = async (id: string) => {
    if (!confirm("Remover esta coluna e todos os cards dentro dela?")) return;
    await supabase.from("project_cards").delete().eq("column_id", id);
    await supabase.from("project_columns").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["project-columns", project.id] });
    qc.invalidateQueries({ queryKey: ["project-cards", project.id] });
  };

  return (
    <AppShell title={project.name} subtitle={`${cards.length} cards · ${columns.length} colunas`} status={status}
      actions={<button onClick={onBack} className="h-10 px-3 border border-border-subtle rounded-lg text-sm flex items-center gap-2"><ArrowLeft className="size-4" />Projetos</button>}>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colCards = cards.filter((c) => c.column_id === col.id);
            return (
              <BoardColumn key={col.id} column={col} cards={colCards}
                onAddCard={(t) => addCard(col.id, t)}
                onRemoveCard={removeCard}
                onRemoveColumn={() => removeColumn(col.id)}
              />
            );
          })}
          <div className="shrink-0 w-72">
            <div className="bg-surface/40 border border-dashed border-border-subtle rounded-2xl p-3 flex gap-2">
              <input value={newColName} onChange={(e) => setNewColName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addColumn()}
                placeholder="Nova coluna" className="flex-1 h-9 bg-background border border-border-subtle rounded-lg px-3 text-sm outline-none focus:border-primary/40" />
              <button onClick={addColumn} className="h-9 px-3 bg-primary text-primary-foreground rounded-lg text-sm"><Plus className="size-4" /></button>
            </div>
          </div>
        </div>
        <DragOverlay>
          {activeCard ? <CardShell title={activeCard.title} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </AppShell>
  );
}

function BoardColumn({ column, cards, onAddCard, onRemoveCard, onRemoveColumn }: {
  column: Column; cards: Card[];
  onAddCard: (title: string) => void; onRemoveCard: (id: string) => void; onRemoveColumn: () => void;
}) {
  const { setNodeRef, isOver } = useSortable({ id: column.id });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  return (
    <div ref={setNodeRef} className={`shrink-0 w-72 bg-surface/60 border rounded-2xl p-3 transition-colors ${isOver ? "border-primary/50 bg-primary/5" : "border-border-subtle"}`}>
      <div className="flex items-center justify-between px-1 mb-3 group">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{column.name} · {cards.length}</span>
        <button onClick={onRemoveColumn} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[60px]">
          <AnimatePresence>
            {cards.map((c) => (
              <SortableCard key={c.id} card={c} onRemove={() => onRemoveCard(c.id)} />
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
      {adding ? (
        <form onSubmit={(e) => { e.preventDefault(); onAddCard(title); setTitle(""); setAdding(false); }} className="mt-2 space-y-2">
          <textarea autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onAddCard(title); setTitle(""); setAdding(false); } if (e.key === "Escape") setAdding(false); }}
            placeholder="Título do card..." rows={2}
            className="w-full bg-background border border-border-subtle rounded-lg px-2.5 py-2 text-sm outline-none focus:border-primary/40 resize-none" />
          <div className="flex gap-2">
            <button type="submit" className="h-8 px-3 bg-primary text-primary-foreground rounded-md text-xs font-medium">Adicionar</button>
            <button type="button" onClick={() => setAdding(false)} className="h-8 px-2 text-muted-foreground"><X className="size-3.5" /></button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2 w-full text-left px-2 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-background/60 rounded-md flex items-center gap-1.5">
          <Plus className="size-3.5" />Adicionar card
        </button>
      )}
    </div>
  );
}

function SortableCard({ card, onRemove }: { card: Card; onRemove: () => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <motion.div ref={setNodeRef} style={style} layout
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="bg-background border border-border-subtle rounded-xl p-2.5 group flex items-start gap-2">
      <button {...attributes} {...listeners} className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing mt-0.5"><GripVertical className="size-3.5" /></button>
      <p className="text-sm flex-1">{card.title}</p>
      <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
    </motion.div>
  );
}

function CardShell({ title, dragging }: { title: string; dragging?: boolean }) {
  return (
    <div className={`bg-background border rounded-xl p-2.5 ${dragging ? "border-primary/60 shadow-2xl shadow-primary/20 rotate-2" : "border-border-subtle"}`}>
      <p className="text-sm">{title}</p>
    </div>
  );
}
