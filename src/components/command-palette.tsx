import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import {
  Search, LayoutDashboard, CheckSquare, Repeat, FileText, Calendar, Target,
  Wallet, GraduationCap, FolderKanban, Bell, Activity, Settings, User,
  Plus, Sparkles, LogOut, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type NavItem = { label: string; to: string; icon: React.ComponentType<{ className?: string }>; group: string; keywords?: string };

const NAV: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, group: "Navegar", keywords: "início home" },
  { label: "Tarefas", to: "/tasks", icon: CheckSquare, group: "Navegar", keywords: "todo kanban" },
  { label: "Hábitos", to: "/habits", icon: Repeat, group: "Navegar", keywords: "rotina" },
  { label: "Notas", to: "/notes", icon: FileText, group: "Navegar", keywords: "anotações markdown" },
  { label: "Calendário", to: "/calendar", icon: Calendar, group: "Navegar", keywords: "agenda eventos" },
  { label: "Metas", to: "/goals", icon: Target, group: "Navegar" },
  { label: "Finanças", to: "/finance", icon: Wallet, group: "Navegar", keywords: "dinheiro" },
  { label: "Estudos", to: "/studies", icon: GraduationCap, group: "Navegar", keywords: "pomodoro flashcards" },
  { label: "Projetos", to: "/projects", icon: FolderKanban, group: "Navegar" },
  { label: "Automacoes", to: "/automations", icon: Zap, group: "Navegar", keywords: "automation workflows webhooks eventos integracoes n8n" },
  { label: "Lembretes", to: "/reminders", icon: Bell, group: "Navegar" },
  { label: "Notificações", to: "/notifications", icon: Bell, group: "Navegar" },
  { label: "Atividade", to: "/activity", icon: Activity, group: "Navegar" },
  { label: "Perfil", to: "/profile", icon: User, group: "Navegar" },
  { label: "Configurações", to: "/settings", icon: Settings, group: "Navegar" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetch lightweight search data only when open
  const { data: tasks = [] } = useQuery({
    queryKey: ["cmdk-tasks"],
    enabled: open,
    queryFn: async () => (await supabase.from("tasks").select("id, title, status").order("updated_at", { ascending: false }).limit(30)).data ?? [],
  });
  const { data: notes = [] } = useQuery({
    queryKey: ["cmdk-notes"],
    enabled: open,
    queryFn: async () => (await supabase.from("notes").select("id, title").order("updated_at", { ascending: false }).limit(30)).data ?? [],
  });

  const run = (fn: () => void) => { setOpen(false); setSearch(""); setTimeout(fn, 50); };

  const quickActions = useMemo(() => [
    {
      label: "Nova tarefa",
      icon: Plus,
      perform: async () => {
        if (!search.trim() || !user) return navigate({ to: "/tasks" });
        await supabase.from("tasks").insert({ user_id: user.id, title: search.trim() });
        navigate({ to: "/tasks" });
      },
    },
    {
      label: "Nova nota",
      icon: Plus,
      perform: async () => {
        if (!user) return;
        const { data } = await supabase.from("notes").insert({ user_id: user.id, title: search.trim() || "Sem título" }).select().single();
        navigate({ to: "/notes" });
        void data;
      },
    },
    {
      label: "Perguntar à IA",
      icon: Sparkles,
      perform: () => {
        // open floating AI by dispatching custom event
        window.dispatchEvent(new CustomEvent("focus:open-ai", { detail: { prompt: search.trim() } }));
      },
    },
  ], [search, user, navigate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-xl bg-surface border border-border-subtle rounded-2xl shadow-2xl overflow-hidden">
        <Command label="Comandos" className="flex flex-col">
          <div className="flex items-center gap-2 px-4 border-b border-border-subtle">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              autoFocus
              placeholder="Buscar tarefas, notas, navegar, criar…"
              className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="text-[10px] font-mono text-muted-foreground border border-border-subtle rounded px-1.5 py-0.5">ESC</kbd>
          </div>
          <Command.List className="max-h-[55vh] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">Nada encontrado.</Command.Empty>

            <Command.Group heading="Ações rápidas" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground">
              {quickActions.map((a) => (
                <Command.Item key={a.label} value={`acao ${a.label} ${search}`} onSelect={() => run(a.perform)}
                  className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary">
                  <a.icon className="size-4" />
                  <span>{a.label}{search && ` "${search}"`}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Navegar" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground">
              {NAV.map((n) => (
                <Command.Item key={n.to} value={`nav ${n.label} ${n.keywords ?? ""}`} onSelect={() => run(() => navigate({ to: n.to }))}
                  className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary">
                  <n.icon className="size-4 text-muted-foreground" />
                  <span>{n.label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {tasks.length > 0 && (
              <Command.Group heading="Tarefas" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground">
                {tasks.map((t) => (
                  <Command.Item key={t.id} value={`task ${t.title}`} onSelect={() => run(() => navigate({ to: "/tasks" }))}
                    className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary">
                    <CheckSquare className="size-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{t.title}</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{t.status}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {notes.length > 0 && (
              <Command.Group heading="Notas" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground">
                {notes.map((n) => (
                  <Command.Item key={n.id} value={`note ${n.title}`} onSelect={() => run(() => navigate({ to: "/notes" }))}
                    className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{n.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Conta" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground">
              <Command.Item value="sair logout" onSelect={() => run(() => signOut())}
                className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer aria-selected:bg-destructive/10 aria-selected:text-destructive">
                <LogOut className="size-4" />
                <span>Sair</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
          <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle text-[10px] font-mono text-muted-foreground">
            <span>↑↓ navegar · ↵ executar</span>
            <span>⌘K para abrir</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
