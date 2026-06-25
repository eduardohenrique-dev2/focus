type SupabaseLike = {
  from: (table: string) => any;
};

export type ContextModule =
  | "dashboard"
  | "tasks"
  | "projects"
  | "calendar"
  | "habits"
  | "goals"
  | "studies"
  | "flashcards"
  | "finance"
  | "notes"
  | "reminders"
  | "notifications"
  | "settings"
  | "conversation_history"
  | "ai_memory"
  | "knowledge_base";

export type ContextItem = {
  module: ContextModule;
  title: string;
  summary: string;
  priority: number;
  entityId?: string;
  entityType?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};

export type FocusContext = {
  generatedAt: string;
  userId: string;
  query: string;
  items: ContextItem[];
  moduleCounts: Record<ContextModule, number>;
  brief: string;
};

const MODULES: ContextModule[] = [
  "dashboard",
  "tasks",
  "projects",
  "calendar",
  "habits",
  "goals",
  "studies",
  "flashcards",
  "finance",
  "notes",
  "reminders",
  "notifications",
  "settings",
  "conversation_history",
  "ai_memory",
  "knowledge_base",
];

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
};

const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

function relevanceBoost(query: string, item: ContextItem) {
  const haystack = `${item.module} ${item.title} ${item.summary}`.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  return words.reduce((score, word) => score + (haystack.includes(word) ? 4 : 0), 0);
}

function addCount(counts: Record<ContextModule, number>, module: ContextModule) {
  counts[module] = (counts[module] ?? 0) + 1;
}

export async function buildFocusContext(supabase: SupabaseLike, userId: string, query: string): Promise<FocusContext> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);

  const [
    profileR,
    tasksR,
    projectsR,
    projectCardsR,
    eventsR,
    habitsR,
    habitLogsR,
    goalsR,
    subjectsR,
    sessionsR,
    flashcardsR,
    accountsR,
    transactionsR,
    notesR,
    remindersR,
    notificationsR,
    conversationsR,
    memoriesR,
    knowledgeR,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("tasks").select("*").eq("user_id", userId).neq("status", "archived").order("updated_at", { ascending: false }).limit(80),
    supabase.from("projects").select("*").eq("user_id", userId).neq("status", "archived").order("updated_at", { ascending: false }).limit(40),
    supabase.from("project_cards").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(80),
    supabase.from("calendar_events").select("*").eq("user_id", userId).gte("start_at", startOfDay.toISOString()).lte("start_at", weekEnd.toISOString()).order("start_at").limit(50),
    supabase.from("habits").select("*").eq("user_id", userId).eq("archived", false).order("updated_at", { ascending: false }).limit(50),
    supabase.from("habit_logs").select("*").eq("user_id", userId).gte("completed_date", startOfDay.toISOString().slice(0, 10)).limit(100),
    supabase.from("goals").select("*").eq("user_id", userId).neq("status", "archived").order("updated_at", { ascending: false }).limit(50),
    supabase.from("study_subjects").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(40),
    supabase.from("study_sessions").select("*").eq("user_id", userId).order("started_at", { ascending: false }).limit(40),
    supabase.from("flashcards").select("*").eq("user_id", userId).order("next_review").limit(80),
    supabase.from("finance_accounts").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(20),
    supabase.from("finance_transactions").select("*").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(120),
    supabase.from("notes").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(80),
    supabase.from("reminders").select("*").eq("user_id", userId).neq("status", "dismissed").order("remind_at").limit(50),
    supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("ai_messages").select("role,content,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(40),
    supabase.from("ai_memories").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(80),
    supabase.from("ai_knowledge_base").select("*").eq("user_id", userId).eq("status", "validated").order("updated_at", { ascending: false }).limit(80),
  ]);

  const items: ContextItem[] = [];
  const counts = Object.fromEntries(MODULES.map((module) => [module, 0])) as Record<ContextModule, number>;

  const profile = profileR.data;
  if (profile) {
    items.push({
      module: "settings",
      title: "Preferencias do usuario",
      summary: `Nome: ${profile.display_name ?? "nao definido"}; tema: ${profile.theme ?? "padrao"}; fuso: ${profile.timezone ?? "nao definido"}; modelo preferido: ${profile.preferred_ai_model ?? "nao definido"}.`,
      priority: 55,
      entityId: profile.id,
      entityType: "profiles",
      updatedAt: profile.updated_at,
    });
    addCount(counts, "settings");
  }

  const tasks = tasksR.data ?? [];
  const openTasks = tasks.filter((task: any) => task.status !== "done");
  const urgentTasks = openTasks.filter((task: any) => task.priority === "urgent" || task.priority === "high");
  items.push({
    module: "dashboard",
    title: "Resumo operacional",
    summary: `${openTasks.length} tarefas abertas, ${urgentTasks.length} de alta prioridade, ${(eventsR.data ?? []).length} eventos nos proximos 7 dias, ${(goalsR.data ?? []).filter((goal: any) => goal.status === "active").length} metas ativas.`,
    priority: 90,
  });
  addCount(counts, "dashboard");

  tasks.forEach((task: any) => {
    const due = task.due_date ? ` vence em ${formatDate(task.due_date)}` : "";
    items.push({
      module: "tasks",
      title: task.title,
      summary: `${task.status}; prioridade ${task.priority}${due}${task.description ? `; ${task.description}` : ""}`,
      priority: task.priority === "urgent" ? 95 : task.priority === "high" ? 85 : task.status === "todo" ? 65 : 45,
      entityId: task.id,
      entityType: "tasks",
      updatedAt: task.updated_at,
      metadata: { status: task.status, priority: task.priority, projectId: task.project_id },
    });
    addCount(counts, "tasks");
  });

  (projectsR.data ?? []).forEach((project: any) => {
    const cards = (projectCardsR.data ?? []).filter((card: any) => card.project_id === project.id);
    items.push({
      module: "projects",
      title: project.name,
      summary: `${project.status}; ${cards.length} cards vinculados${project.description ? `; ${project.description}` : ""}`,
      priority: project.status === "active" ? 70 : 35,
      entityId: project.id,
      entityType: "projects",
      updatedAt: project.updated_at,
    });
    addCount(counts, "projects");
  });

  (projectCardsR.data ?? []).forEach((card: any) => {
    items.push({
      module: "projects",
      title: card.title,
      summary: `Card de projeto${card.due_date ? ` com prazo ${formatDate(card.due_date)}` : ""}${card.description ? `; ${card.description}` : ""}`,
      priority: card.due_date ? 68 : 45,
      entityId: card.id,
      entityType: "project_cards",
      updatedAt: card.updated_at,
    });
    addCount(counts, "projects");
  });

  (eventsR.data ?? []).forEach((event: any) => {
    items.push({
      module: "calendar",
      title: event.title,
      summary: `${new Date(event.start_at).toLocaleString("pt-BR")}${event.location ? ` em ${event.location}` : ""}${event.description ? `; ${event.description}` : ""}`,
      priority: new Date(event.start_at).toDateString() === now.toDateString() ? 90 : 70,
      entityId: event.id,
      entityType: "calendar_events",
      updatedAt: event.updated_at,
    });
    addCount(counts, "calendar");
  });

  const todayLogs = new Set((habitLogsR.data ?? []).map((log: any) => log.habit_id));
  (habitsR.data ?? []).forEach((habit: any) => {
    items.push({
      module: "habits",
      title: habit.name,
      summary: `${todayLogs.has(habit.id) ? "feito hoje" : "pendente hoje"}; meta ${habit.target_per_week ?? 0}x por semana${habit.description ? `; ${habit.description}` : ""}`,
      priority: todayLogs.has(habit.id) ? 35 : 72,
      entityId: habit.id,
      entityType: "habits",
      updatedAt: habit.updated_at,
    });
    addCount(counts, "habits");
  });

  (goalsR.data ?? []).forEach((goal: any) => {
    items.push({
      module: "goals",
      title: goal.title,
      summary: `${goal.status}; progresso ${goal.progress}%${goal.target_date ? `; prazo ${formatDate(goal.target_date)}` : ""}${goal.description ? `; ${goal.description}` : ""}`,
      priority: goal.status === "active" ? 78 : 40,
      entityId: goal.id,
      entityType: "goals",
      updatedAt: goal.updated_at,
    });
    addCount(counts, "goals");
  });

  (subjectsR.data ?? []).forEach((subject: any) => {
    const sessions = (sessionsR.data ?? []).filter((session: any) => session.subject_id === subject.id);
    items.push({
      module: "studies",
      title: subject.name,
      summary: `${sessions.length} sessoes recentes registradas.`,
      priority: sessions.length ? 55 : 35,
      entityId: subject.id,
      entityType: "study_subjects",
      updatedAt: subject.created_at,
    });
    addCount(counts, "studies");
  });

  (flashcardsR.data ?? []).forEach((card: any) => {
    const due = !card.next_review || new Date(card.next_review) <= now;
    items.push({
      module: "flashcards",
      title: card.front,
      summary: `Resposta cadastrada; ${due ? "revisao pendente" : `proxima revisao ${formatDate(card.next_review)}`}.`,
      priority: due ? 70 : 30,
      entityId: card.id,
      entityType: "flashcards",
      updatedAt: card.updated_at,
    });
    addCount(counts, "flashcards");
  });

  const accounts = accountsR.data ?? [];
  if (accounts.length) {
    const balance = accounts.reduce((sum: number, account: any) => sum + Number(account.balance ?? 0), 0);
    items.push({
      module: "finance",
      title: "Saldo financeiro",
      summary: `${accounts.length} contas com saldo total de ${balance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
      priority: 65,
    });
    addCount(counts, "finance");
  }

  (transactionsR.data ?? []).forEach((tx: any) => {
    items.push({
      module: "finance",
      title: tx.description ?? tx.category ?? "Transacao financeira",
      summary: `${tx.type}; ${Number(tx.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}; ${formatDate(tx.occurred_at)}${tx.category ? `; categoria ${tx.category}` : ""}`,
      priority: 35,
      entityId: tx.id,
      entityType: "finance_transactions",
      updatedAt: tx.created_at,
    });
    addCount(counts, "finance");
  });

  (notesR.data ?? []).forEach((note: any) => {
    items.push({
      module: "notes",
      title: note.title,
      summary: `${note.pinned ? "fixada; " : ""}${(note.content ?? "").slice(0, 500)}${note.tags?.length ? `; tags ${note.tags.join(", ")}` : ""}`,
      priority: note.pinned ? 78 : 48,
      entityId: note.id,
      entityType: "notes",
      updatedAt: note.updated_at,
    });
    addCount(counts, "notes");
  });

  (remindersR.data ?? []).forEach((reminder: any) => {
    items.push({
      module: "reminders",
      title: reminder.title,
      summary: `${reminder.status}; lembra em ${new Date(reminder.remind_at).toLocaleString("pt-BR")}${reminder.description ? `; ${reminder.description}` : ""}`,
      priority: reminder.status === "pending" ? 74 : 35,
      entityId: reminder.id,
      entityType: "reminders",
      updatedAt: reminder.updated_at,
    });
    addCount(counts, "reminders");
  });

  (notificationsR.data ?? []).forEach((notification: any) => {
    items.push({
      module: "notifications",
      title: notification.title,
      summary: `${notification.read ? "lida" : "nao lida"}; ${notification.body ?? ""}`,
      priority: notification.read ? 25 : 60,
      entityId: notification.id,
      entityType: "notifications",
      updatedAt: notification.created_at,
    });
    addCount(counts, "notifications");
  });

  (conversationsR.data ?? []).forEach((message: any) => {
    items.push({
      module: "conversation_history",
      title: message.role === "user" ? "Mensagem recente do usuario" : "Resposta recente da IA",
      summary: message.content.slice(0, 600),
      priority: message.role === "user" ? 50 : 35,
      updatedAt: message.created_at,
    });
    addCount(counts, "conversation_history");
  });

  (memoriesR.data ?? []).forEach((memory: any) => {
    items.push({
      module: "ai_memory",
      title: memory.title,
      summary: `${memory.kind}; ${memory.content}`,
      priority: memory.kind === "long_term" ? 82 : 58,
      entityId: memory.id,
      entityType: "ai_memories",
      updatedAt: memory.updated_at,
    });
    addCount(counts, "ai_memory");
  });

  (knowledgeR.data ?? []).forEach((entry: any) => {
    items.push({
      module: "knowledge_base",
      title: entry.title,
      summary: `${entry.category}; ${entry.content}`,
      priority: 84,
      entityId: entry.id,
      entityType: "ai_knowledge_base",
      updatedAt: entry.updated_at,
      metadata: { sourceModule: entry.source_module, confidence: entry.confidence },
    });
    addCount(counts, "knowledge_base");
  });

  const queryLower = query.toLowerCase();
  const moduleIntent: Partial<Record<ContextModule, string[]>> = {
    tasks: ["tarefa", "tarefas", "pendente", "fazer"],
    projects: ["projeto", "projetos", "card", "kanban"],
    calendar: ["agenda", "calendario", "evento", "hoje", "semana"],
    habits: ["habito", "habitos", "rotina"],
    goals: ["meta", "metas", "objetivo"],
    studies: ["estudo", "estudos", "pomodoro", "materia"],
    flashcards: ["flashcard", "revisao", "revisar"],
    finance: ["financa", "financas", "dinheiro", "saldo", "gasto"],
    notes: ["nota", "notas", "anotacao"],
    reminders: ["lembrete", "lembretes"],
    notifications: ["notificacao", "notificacoes"],
    settings: ["configuracao", "preferencia", "perfil"],
  };

  const prioritized = items
    .map((item) => ({
      ...item,
      priority:
        item.priority +
        relevanceBoost(query, item) +
        (includesAny(queryLower, moduleIntent[item.module] ?? []) ? 18 : 0),
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 120);

  const brief = prioritized
    .slice(0, 30)
    .map((item) => `- [${item.module}] ${item.title}: ${item.summary}`)
    .join("\n");

  return {
    generatedAt: now.toISOString(),
    userId,
    query,
    items: prioritized,
    moduleCounts: counts,
    brief,
  };
}
