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

const todayLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" }).toUpperCase();

function Dashboard() {
  const { user } = useAuth();
  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split("@")[0] ?? "Eduardo";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", "dashboard"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  const { data: habits = [] } = useQuery({
    queryKey: ["habits", "dashboard"],
    queryFn: async () => {
      const { data } = await supabase.from("habits").select("*").eq("archived", false);
      return data ?? [];
    },
  });
  const { data: events = [] } = useQuery({
    queryKey: ["events", "today"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const { data } = await supabase.from("calendar_events").select("*")
        .gte("start_at", start.toISOString()).lte("start_at", end.toISOString()).order("start_at");
      return data ?? [];
    },
  });

  const completed = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length || 1;
  const pct = Math.round((completed / total) * 100);
  const today = tasks.filter((t) => t.status !== "done" && t.status !== "archived").slice(0, 5);

  return (
    <AppShell title={`${greet}, ${name}.`} subtitle={`Status do sistema · ${todayLabel}`}>
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="col-span-12 lg:col-span-8 bg-surface/40 border border-border-subtle rounded-2xl p-6 md:p-8 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 size-64 bg-primary/10 blur-[100px] rounded-full" />
          <div className="relative">
            <p className="text-xs font-mono text-primary uppercase tracking-widest mb-2">Foco do dia</p>
            <h2 className="text-3xl md:text-4xl font-light">{today.length > 0 ? today[0].title : "Tudo limpo. Que tal criar uma nova meta?"}</h2>
            <p className="text-muted-foreground mt-2 text-sm">{today.length} tarefas pendentes · {completed} concluídas hoje</p>
            <div className="flex gap-2 mt-6">
              <Link to="/tasks" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="size-4" />Nova tarefa</Link>
              <Link to="/notes" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-sm">Nova nota</Link>
            </div>
          </div>
        </motion.div>

        <div className="col-span-12 lg:col-span-4 bg-surface border border-border-subtle rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-sm">Conclusão</h3>
            <span className="text-[10px] font-mono text-primary uppercase flex items-center gap-1"><TrendingUp className="size-3" />{pct}%</span>
          </div>
          <div className="relative size-32 mx-auto">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" className="stroke-muted" />
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-primary" strokeDasharray={`${(pct * 264) / 100} 264`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-mono">{pct}%</span>
              <span className="text-[10px] text-muted-foreground uppercase">{completed}/{total - 1 === 0 ? 0 : total}</span>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 bg-surface border border-border-subtle rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-medium text-sm">Tarefas em aberto</h3>
            <Link to="/tasks" className="text-xs text-primary flex items-center gap-1">Ver todas <ArrowRight className="size-3" /></Link>
          </div>
          {today.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma tarefa pendente.</p>
          ) : (
            <ul className="space-y-1">
              {today.map((t) => (
                <li key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5">
                  <div className="size-2 rounded-full bg-primary/70" />
                  <span className="text-sm flex-1 truncate">{t.title}</span>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">{t.priority}</span>
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
              {habits.slice(0, 5).map((h) => (
                <li key={h.id} className="flex items-center gap-3">
                  <Flame className="size-3.5 text-primary" />
                  <span className="text-sm flex-1 truncate">{h.name}</span>
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
              <p className="text-sm text-muted-foreground mt-1">Use o botão flutuante no canto inferior direito para conversar, planejar, resumir notas e analisar sua produtividade.</p>
            </div>
            <CheckCircle2 className="size-5 text-primary" />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Link to="/calendar" className="text-xs text-primary hover:underline">{events.length} eventos hoje</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
