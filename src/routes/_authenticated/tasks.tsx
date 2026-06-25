import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, X, Flag, Trash2, GripVertical } from "lucide-react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSaveStatus } from "@/hooks/use-autosave";
import { toast } from "sonner";
import type { Task } from "@/lib/types";

type Status = Task["status"];
type Priority = Task["priority"];

const cols: { id: Status; label: string }[] = [
  { id: "todo", label: "A fazer" },
  { id: "in_progress", label: "Em progresso" },
  { id: "done", label: "Concluído" },
];

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tarefas — FOCUS" }] }),
  component: TasksPage,
});

function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { status, set: setStatus } = useAutoSaveStatus();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("order_index").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("tasks-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["tasks"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const filtered = tasks.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()));

  const update = async (id: string, patch: Partial<Task>) => {
    setStatus("saving");
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) { setStatus("error"); toast.error(error.message); }
    else { setStatus("saved"); qc.invalidateQueries({ queryKey: ["tasks"] }); }
  };

  const remove = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const toggle = (t: Task) => update(t.id, { status: t.status === "done" ? "todo" : "done", completed_at: t.status === "done" ? null : new Date().toISOString() });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const findTask = (id: string) => tasks.find((t) => t.id === id);
  const activeTask = activeId ? findTask(activeId) : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const t = findTask(String(active.id));
    if (!t) return;
    const overId = String(over.id);
    // If dropped on a column id, move to that column.
    const targetStatus = (cols.find((c) => c.id === overId)?.id) ?? findTask(overId)?.status;
    if (targetStatus && targetStatus !== t.status) {
      await update(t.id, { status: targetStatus, completed_at: targetStatus === "done" ? new Date().toISOString() : null });
    }
  };

  return (
    <AppShell title="Tarefas" subtitle={`${filtered.length} no total · arraste entre colunas`} status={status}
      actions={<button onClick={() => setCreating(true)} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="size-4" />Nova</button>}>
      <div className="mb-6">
        <div className="h-10 bg-surface border border-border-subtle rounded-lg flex items-center px-3 gap-2">
          <Search className="size-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." className="bg-transparent flex-1 text-sm outline-none" />
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cols.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.id);
            return (
              <Column key={col.id} id={col.id} label={col.label} count={colTasks.length}>
                <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 min-h-[100px]">
                    {colTasks.map((t) => (
                      <SortableCard key={t.id} task={t} onToggle={() => toggle(t)} onRemove={() => remove(t.id)} onChangeStatus={(s) => update(t.id, { status: s })} />
                    ))}
                  </div>
                </SortableContext>
              </Column>
            );
          })}
        </div>
        <DragOverlay>
          {activeTask ? <CardShell task={activeTask} dragging /> : null}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {creating && <CreateModal onClose={() => setCreating(false)} onCreate={async (d) => {
          setStatus("saving");
          const { error } = await supabase.from("tasks").insert({ ...d, user_id: user!.id });
          if (error) { setStatus("error"); toast.error(error.message); }
          else { setStatus("saved"); qc.invalidateQueries({ queryKey: ["tasks"] }); setCreating(false); }
        }} />}
      </AnimatePresence>
    </AppShell>
  );
}

function Column({ id, label, count, children }: { id: Status; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useSortable({ id });
  return (
    <div ref={setNodeRef} className={`bg-surface/60 border rounded-2xl p-4 min-h-[280px] transition-colors ${isOver ? "border-primary/50 bg-primary/5" : "border-border-subtle"}`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  );
}

function SortableCard({ task, onToggle, onRemove, onChangeStatus }: { task: Task; onToggle: () => void; onRemove: () => void; onChangeStatus: (s: Status) => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="bg-background border border-border-subtle rounded-xl p-3 group">
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing mt-0.5"><GripVertical className="size-3.5" /></button>
        <button onClick={onToggle} className={`size-4 rounded border shrink-0 mt-0.5 ${task.status === "done" ? "bg-primary border-primary" : "border-border"}`} />
        <p className={`text-sm flex-1 ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
        <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 size-6 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
      </div>
      <div className="flex items-center gap-2 mt-2 ml-9">
        <span className={`text-[10px] flex items-center gap-1 ${task.priority === "high" || task.priority === "urgent" ? "text-primary" : "text-muted-foreground"}`}><Flag className="size-2.5" />{task.priority}</span>
        <select value={task.status} onChange={(e) => onChangeStatus(e.target.value as Status)}
          className="ml-auto bg-transparent text-[10px] font-mono text-muted-foreground border border-border-subtle rounded px-1.5 py-0.5">
          {cols.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
    </div>
  );
}

function CardShell({ task, dragging }: { task: Task; dragging?: boolean }) {
  return (
    <div className={`bg-background border rounded-xl p-3 ${dragging ? "border-primary/60 shadow-2xl shadow-primary/20 rotate-2" : "border-border-subtle"}`}>
      <p className="text-sm">{task.title}</p>
      <span className="text-[10px] font-mono text-muted-foreground">{task.priority}</span>
    </div>
  );
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: { title: string; priority: Priority; status: Status }) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.form initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => { e.preventDefault(); if (!title.trim()) return; await onCreate({ title: title.trim(), priority, status: "todo" }); }}
        className="w-full max-w-md bg-surface border border-border-subtle rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-lg">Nova tarefa</h2><button type="button" onClick={onClose}><X className="size-4" /></button></div>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito?"
          className="w-full bg-background border border-border-subtle rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary/40" />
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}
          className="w-full bg-background border border-border-subtle rounded-lg px-3 py-2.5 text-sm">
          <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="urgent">Urgente</option>
        </select>
        <button type="submit" className="w-full h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Criar</button>
      </motion.form>
    </motion.div>
  );
}
