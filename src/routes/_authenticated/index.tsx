import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Flame, Plus, Sparkles, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — FOCUS" }] }),
  component: Dashboard,
});

function isSameLocalDay(value: string, reference = new Date()) {
  const date = new Date(value);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

function Dashboard() {
  const { user } = useAuth();
  const now = new Date();
  const name =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Usuário";
  const hour = now.getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const todayLabel = now
    .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })
    .toUpperCase();

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", "dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: habits = [] } = useQuery({
    queryKey: ["habits", "dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user.id)
        .eq("archived", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events", "today", user?.id, now.toISOString().slice(0, 10)],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_at", start.toISOString())
        .lte("start_at", end.toISOString())
        .order("start_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeTasks = tasks.filter((task) => task.status !== "archived");
  const pendingTasks = activeTasks.filter((task) => task.status !== "done");
  const tasksDueToday = pendingTasks.filter(
    (task) => task.due_date && isSameLocalDay(task.due_date, now),
  );
  const completedToday = activeTasks.filter(
    (task) =>
      task.status === "done" &&
      task.completed_at &&
      isSameLocalDay(task.completed_at, now),
  ).length;
  const completedTotal = activeTasks.filter((task) => task.status === "done").length;
  const total = activeTasks.length;
  const pct = total > 0 ? Math.round((completedTotal / total) * 100) : 0;
  const openPreview = pendingTasks.slice(0, 5);
  const focusTask = tasksDueToday[0];

  return (
    <AppShell title={`${greet}, ${name}.`} subtitle={`Status do sistema · ${todayLabel}`}>
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-12 lg:col-span-8 bg-surface/40 border border-border-subtle rounded-2xl p-6 md:p-8 relative overflow-hidden"
        >
          <div className="absolute -right-20 -top-20 size-64 bg-primary/10 blur-[100px] rounded-full" />
          <div className="relative">
            <p className="text-xs font-mono text-primary uppercase tracking-widest mb-2">Foco do dia</p>
            <h2 className="text-3xl md:text-4xl font-light">
              {focusTask?.title ?? "Nenhuma tarefa com vencimento para hoje."}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {tasksDueToday.length} para hoje · {completedToday} concluídas hoje
            </p>
            <div className="flex gap-2 mt-6">
              <Link
                to="/tasks"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <Plus className="size-4" />Nova tarefa
              </Link>
              <Link
                to="/notes"
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-sm"
              >
                Nova nota
              </Link>
            </div>
          </div>
        </motion.div>

        <div className="col-span-12 lg:col-span-4 bg-surface border border-border-subtle rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-sm">Conclusão geral</h3>
            <span className="text-[10px] font-mono text-primary uppercase flex items-center gap-1">
              <TrendingUp className="size-3" />{pct}%
            </span>
          </div>
          <div className="relative size-32 mx-auto">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" className="stroke-muted" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                className="stroke-primary"
                strokeDasharray={`${(pct * 264) / 100} 264`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-mono">{pct}%</span>
              <span className="text-[10px] text-muted-foreground uppercase">
                {completedTotal}/{total}
              </span>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 bg-surface border border-border-subtle rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-medium text-sm">Tarefas em aberto</h3>
            <Link to="/tasks" className="text-xs text-primary flex items-center gap-1">
              Ver todas <ArrowRight className="size-3" />
            </Link>
          </div>
          {openPreview.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma tarefa pendente.</p>
          ) : (
            <ul className="space-y-1">
              {openPreview.map((task) => (
                <li key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5">
                  <div className="size-2 rounded-full bg-primary/70" />
                  <span className="text-sm flex-1 truncate">{task.title}</span>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">
                    {task.priority}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="col-span-12 lg:col-span-5 bg-surface border border-border-subtle rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-medium text-sm">Hábitos</h3>
            <Link to="/habits" className="text-xs text-primary">Ver todos</Link>
          </div>
          {habits.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Crie seu primeiro hábito.</p>
          ) : (
            <ul className="space-y-3">
              {habits.slice(0, 5).map((habit) => (
                <li key={habit.id} className="flex items-center gap-3">
                  <Flame className="size-3.5 text-primary" />
                  <span className="text-sm flex-1 truncate">{habit.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="col-span-12 bg-gradient-to-br from-primary/15 to-transparent border border-primary/20 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="size-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium">FOCUS AI está pronta</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Use o botão flutuante no canto inferior direito para conversar, planejar, resumir notas e analisar sua produtividade.
              </p>
            </div>
            <CheckCircle2 className="size-5 text-primary" />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Link to="/calendar" className="text-xs text-primary hover:underline">
              {events.length} eventos hoje
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
