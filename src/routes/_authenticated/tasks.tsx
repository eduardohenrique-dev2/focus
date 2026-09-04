import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, Flag, GripVertical, Plus, Search, Trash2, X } from "lucide-react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
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
type NewTask = {
  title: string;
  priority: Priority;
  status: Status;
  due_date: string | null;
};

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

  const queryKey = ["tasks", user?.id];
  const { data: tasks = [] } = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "archived")
        .order("order_index")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`tasks-rt-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const filtered = tasks.filter((task) =>
    task.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const update = async (id: string, patch: Partial<Task>) => {
    setStatus("saving");
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) {
      setStatus("error");
      toast.error(error.message);
      return false;
    }

    setStatus("saved");
    await qc.invalidateQueries({ queryKey });
    return true;
  };

  const changeStatus = async (task: Task, nextStatus: Status) => {
    await update(task.id, {
      status: nextStatus,
      completed_at:
        nextStatus === "done"
          ? task.completed_at ?? new Date().toISOString()
          : null,
    });
  };

  const remove = async (id: string) => {
    setStatus("saving");
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      setStatus("error");
      toast.error(error.message);
      return;
    }
    setStatus("saved");
    await qc.invalidateQueries({ queryKey });
  };

  const toggle = (task: Task) => changeStatus(task, task.status === "done" ? "todo" : "done");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const findTask = (id: string) => tasks.find((task) => task.id === id);
  const activeTask = activeId ? findTask(activeId) : null;

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const task = findTask(String(active.id));
    if (!task) return;

    const overId = String(over.id);
    const targetStatus =
      cols.find((column) => column.id === overId)?.id ?? findTask(overId)?.status;

    if (targetStatus && targetStatus !== task.status) {
      await changeStatus(task, targetStatus);
    }
  };

  const createTask = async (newTask: NewTask) => {
    if (!user) {
      toast.error("Sua sessão ainda não está pronta. Tente novamente.");
      return;
    }

    setStatus("saving");
    const { error } = await supabase.from("tasks").insert({
      ...newTask,
      user_id: user.id,
      completed_at: newTask.status === "done" ? new Date().toISOString() : null,
    });

    if (error) {
      setStatus("error");
      toast.error(error.message);
      return;
    }

    setStatus("saved");
    await qc.invalidateQueries({ queryKey });
    setCreating(false);
  };

  return (
    <AppShell
      title="Tarefas"
      subtitle={`${filtered.length} no total · arraste entre colunas`}
      status={status}
      actions={
        <button
          onClick={() => setCreating(true)}
          disabled={!user}
          className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Plus className="size-4" />Nova
        </button>
      }
    >
      <div className="mb-6">
        <div className="h-10 bg-surface border border-border-subtle rounded-lg flex items-center px-3 gap-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar..."
            className="bg-transparent flex-1 text-sm outline-none"
          />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cols.map((column) => {
            const columnTasks = filtered.filter((task) => task.status === column.id);
            return (
              <Column
                key={column.id}
                id={column.id}
                label={column.label}
                count={columnTasks.length}
              >
                <SortableContext
                  items={columnTasks.map((task) => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 min-h-[100px]">
                    {columnTasks.map((task) => (
                      <SortableCard
                        key={task.id}
                        task={task}
                        onToggle={() => toggle(task)}
                        onRemove={() => remove(task.id)}
                        onChangeStatus={(nextStatus) => changeStatus(task, nextStatus)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </Column>
            );
          })}
        </div>
        <DragOverlay>{activeTask ? <CardShell task={activeTask} dragging /> : null}</DragOverlay>
      </DndContext>

      <AnimatePresence>
        {creating && <CreateModal onClose={() => setCreating(false)} onCreate={createTask} />}
      </AnimatePresence>
    </AppShell>
  );
}

function Column({
  id,
  label,
  count,
  children,
}: {
  id: Status;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`bg-surface/60 border rounded-2xl p-4 min-h-[280px] transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : "border-border-subtle"
      }`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  );
}

function SortableCard({
  task,
  onToggle,
  onRemove,
  onChangeStatus,
}: {
  task: Task;
  onToggle: () => void;
  onRemove: () => void;
  onChangeStatus: (status: Status) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-background border border-border-subtle rounded-xl p-3 group"
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          aria-label="Arrastar tarefa"
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing mt-0.5"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          onClick={onToggle}
          aria-label={task.status === "done" ? "Reabrir tarefa" : "Concluir tarefa"}
          className={`size-4 rounded border shrink-0 mt-0.5 ${
            task.status === "done" ? "bg-primary border-primary" : "border-border"
          }`}
        />
        <p
          className={`text-sm flex-1 ${
            task.status === "done" ? "line-through text-muted-foreground" : ""
          }`}
        >
          {task.title}
        </p>
        <button
          onClick={onRemove}
          aria-label="Excluir tarefa"
          className="opacity-0 group-hover:opacity-100 size-6 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-2 ml-9">
        <span
          className={`text-[10px] flex items-center gap-1 ${
            task.priority === "high" || task.priority === "urgent"
              ? "text-primary"
              : "text-muted-foreground"
          }`}
        >
          <Flag className="size-2.5" />{task.priority}
        </span>
        {task.due_date && (
          <span className="text-[10px] flex items-center gap-1 text-muted-foreground">
            <CalendarClock className="size-2.5" />
            {new Date(task.due_date).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
        <select
          value={task.status}
          onChange={(event) => onChangeStatus(event.target.value as Status)}
          className="ml-auto bg-transparent text-[10px] font-mono text-muted-foreground border border-border-subtle rounded px-1.5 py-0.5"
        >
          {cols.map((column) => (
            <option key={column.id} value={column.id}>{column.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CardShell({ task, dragging }: { task: Task; dragging?: boolean }) {
  return (
    <div
      className={`bg-background border rounded-xl p-3 ${
        dragging ? "border-primary/60 shadow-2xl shadow-primary/20 rotate-2" : "border-border-subtle"
      }`}
    >
      <p className="text-sm">{task.title}</p>
      <span className="text-[10px] font-mono text-muted-foreground">{task.priority}</span>
    </div>
  );
}

function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (task: NewTask) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueAt, setDueAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.form
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!title.trim() || submitting) return;
          setSubmitting(true);
          try {
            await onCreate({
              title: title.trim(),
              priority,
              status: "todo",
              due_date: dueAt ? new Date(dueAt).toISOString() : null,
            });
          } finally {
            setSubmitting(false);
          }
        }}
        className="w-full max-w-md bg-surface border border-border-subtle rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg">Nova tarefa</h2>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="O que precisa ser feito?"
          className="w-full bg-background border border-border-subtle rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary/40"
        />
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as Priority)}
          className="w-full bg-background border border-border-subtle rounded-lg px-3 py-2.5 text-sm"
        >
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">Prazo (opcional)</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className="w-full bg-background border border-border-subtle rounded-lg px-3 py-2.5 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Criando..." : "Criar"}
        </button>
      </motion.form>
    </motion.div>
  );
}
