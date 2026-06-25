import { buildFocusContext, type ContextItem, type FocusContext } from "./context-engine";
import { learnFromMessage, recordShortTermMemory } from "./memory-engine";

type SupabaseLike = {
  from: (table: string) => any;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type FocusAIInput = {
  supabase: SupabaseLike;
  userId: string;
  conversationId: string;
  messages: ChatMessage[];
};

type FocusAIResult = {
  reply: string;
  context: FocusContext;
};

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  tasks: "Tarefas",
  projects: "Projetos",
  calendar: "Calendario",
  habits: "Habitos",
  goals: "Metas",
  studies: "Estudos",
  flashcards: "Flashcards",
  finance: "Financas",
  notes: "Notas",
  reminders: "Lembretes",
  notifications: "Notificacoes",
  settings: "Configuracoes",
  conversation_history: "Historico de conversas",
  ai_memory: "Memoria da IA",
  knowledge_base: "Base de conhecimento",
};

const HELP_PATTERNS = ["o que devo", "prioridade", "priorizar", "hoje", "agora", "plano", "planejar"];

function getLastUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function hasIntent(query: string, terms: string[]) {
  const lower = query.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function groupByModule(items: ContextItem[]) {
  return items.reduce<Record<string, ContextItem[]>>((acc, item) => {
    acc[item.module] = acc[item.module] ?? [];
    acc[item.module].push(item);
    return acc;
  }, {});
}

function renderItem(item: ContextItem) {
  return `- **${item.title}**: ${item.summary}`;
}

function buildEvidenceSection(context: FocusContext) {
  const grouped = groupByModule(context.items.slice(0, 35));
  const sections = Object.entries(grouped)
    .filter(([, items]) => items.length > 0)
    .map(([module, items]) => {
      const body = items.slice(0, 5).map(renderItem).join("\n");
      return `**${MODULE_LABELS[module] ?? module}**\n${body}`;
    });

  return sections.join("\n\n");
}

function buildActionPlan(context: FocusContext) {
  const actionable = context.items
    .filter((item) => ["tasks", "calendar", "reminders", "habits", "goals", "projects", "flashcards"].includes(item.module))
    .slice(0, 8);

  if (!actionable.length) return "";

  return [
    "**Plano sugerido com base no FOCUS**",
    ...actionable.slice(0, 5).map((item, index) => `${index + 1}. ${item.title} - ${item.summary}`),
  ].join("\n");
}

function buildModuleAnswer(context: FocusContext, module: string) {
  const items = context.items.filter((item) => item.module === module).slice(0, 10);
  if (!items.length) return "";

  return [
    `Encontrei estes dados em **${MODULE_LABELS[module] ?? module}**:`,
    items.map(renderItem).join("\n"),
  ].join("\n\n");
}

function buildFallback(context: FocusContext) {
  const searched = Object.entries(context.moduleCounts)
    .filter(([, count]) => count > 0)
    .map(([module, count]) => `${MODULE_LABELS[module] ?? module} (${count})`)
    .join(", ");

  return [
    "Nao encontrei informacao suficiente no FOCUS para responder com seguranca.",
    searched ? `Procurei nos modulos com dados disponiveis: ${searched}.` : "Procurei nos modulos locais, mas ainda nao ha dados cadastrados para essa pergunta.",
    "Tambem considerei memoria local, historico de conversas e base de conhecimento.",
    "Me passe mais contexto ou cadastre a informacao em um modulo do sistema para eu usar isso nas proximas respostas.",
  ].join("\n\n");
}

function composeLocalReply(context: FocusContext) {
  const query = context.query.toLowerCase();
  const hasContext = context.items.length > 0;

  const moduleIntents: Array<[string, string[]]> = [
    ["tasks", ["tarefa", "tarefas", "pendente"]],
    ["projects", ["projeto", "projetos", "card"]],
    ["calendar", ["agenda", "calendario", "evento"]],
    ["habits", ["habito", "habitos", "rotina"]],
    ["goals", ["meta", "metas", "objetivo"]],
    ["studies", ["estudo", "estudos", "pomodoro", "materia"]],
    ["flashcards", ["flashcard", "revisao"]],
    ["finance", ["financa", "financas", "saldo", "gasto", "dinheiro"]],
    ["notes", ["nota", "notas", "anotacao"]],
    ["reminders", ["lembrete", "lembretes"]],
    ["notifications", ["notificacao", "notificacoes"]],
    ["settings", ["configuracao", "perfil", "preferencia"]],
    ["ai_memory", ["memoria", "lembra"]],
    ["knowledge_base", ["conhecimento", "regra", "processo"]],
  ];

  for (const [module, terms] of moduleIntents) {
    if (hasIntent(query, terms)) {
      const answer = buildModuleAnswer(context, module);
      if (answer) {
        return `${answer}\n\n${buildEvidenceSection(context) ? "**Contexto relacionado**\n" + buildEvidenceSection(context) : ""}`.trim();
      }
    }
  }

  if (hasIntent(query, HELP_PATTERNS)) {
    const plan = buildActionPlan(context);
    if (plan) return `${plan}\n\n**Por que isso**\n${buildEvidenceSection(context)}`.trim();
  }

  if (!hasContext) return buildFallback(context);

  const evidence = buildEvidenceSection(context);
  if (!evidence) return buildFallback(context);

  return [
    "Analisei o contexto interno do FOCUS antes de responder.",
    evidence,
    "Se quiser uma resposta mais especifica, diga qual modulo ou decisao voce quer priorizar.",
  ].join("\n\n");
}

export async function runFocusAI(input: FocusAIInput): Promise<FocusAIResult> {
  const userMessage = getLastUserMessage(input.messages);
  const context = await buildFocusContext(input.supabase, input.userId, userMessage);

  await recordShortTermMemory(input.supabase, {
    userId: input.userId,
    conversationId: input.conversationId,
    userMessage,
    recentContext: context.items,
  });

  await learnFromMessage(input.supabase, {
    userId: input.userId,
    conversationId: input.conversationId,
    userMessage,
    recentContext: context.items,
  });

  const reply = composeLocalReply(context);
  return { reply, context };
}
