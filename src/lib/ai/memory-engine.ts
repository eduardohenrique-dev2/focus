import type { ContextItem } from "./context-engine";

type SupabaseLike = {
  from: (table: string) => any;
};

export type MemoryKind = "short_term" | "long_term";
export type MemoryCategory = "conversation" | "preference" | "decision" | "process" | "pattern" | "action";

type MemoryInput = {
  userId: string;
  conversationId: string;
  userMessage: string;
  recentContext: ContextItem[];
};

const LONG_TERM_PATTERNS: Array<{ category: MemoryCategory; terms: string[]; title: string }> = [
  { category: "preference", terms: ["prefiro", "gosto de", "nao gosto", "quero sempre", "evite"], title: "Preferencia do usuario" },
  { category: "decision", terms: ["decidi", "ficou decidido", "vamos manter", "a decisao"], title: "Decisao importante" },
  { category: "process", terms: ["processo", "passo a passo", "sempre que", "workflow", "fluxo"], title: "Processo aprendido" },
  { category: "pattern", terms: ["percebi que", "normalmente", "costumo", "padrao"], title: "Padrao identificado" },
];

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

async function findConflict(supabase: SupabaseLike, userId: string, category: MemoryCategory, content: string) {
  const keyWords = normalize(content)
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .slice(0, 8);

  if (!keyWords.length) return null;

  const { data } = await supabase
    .from("ai_memories")
    .select("id,title,content,category")
    .eq("user_id", userId)
    .eq("kind", "long_term")
    .eq("category", category)
    .limit(40);

  return (data ?? []).find((memory: any) => {
    const existing = String(memory.content).toLowerCase();
    const overlap = keyWords.filter((word) => existing.includes(word)).length;
    const negates = existing.includes("nao ") !== content.toLowerCase().includes("nao ");
    return overlap >= 3 && negates;
  }) ?? null;
}

export async function recordShortTermMemory(supabase: SupabaseLike, input: MemoryInput) {
  const contextSnapshot = input.recentContext.slice(0, 12).map((item) => ({
    module: item.module,
    title: item.title,
    summary: item.summary,
  }));

  await supabase.from("ai_memories").insert({
    user_id: input.userId,
    conversation_id: input.conversationId,
    kind: "short_term",
    category: "conversation",
    title: "Conversa atual",
    content: normalize(input.userMessage),
    evidence: { context: contextSnapshot },
    confidence: 0.7,
  });
}

export async function learnFromMessage(supabase: SupabaseLike, input: MemoryInput) {
  const text = normalize(input.userMessage);
  const lower = text.toLowerCase();
  const matches = LONG_TERM_PATTERNS.filter((pattern) => hasAny(lower, pattern.terms));

  for (const match of matches) {
    if (text.length < 12) continue;

    const conflict = await findConflict(supabase, input.userId, match.category, text);
    const status = conflict ? "needs_review" : "validated";

    await supabase.from("ai_memories").insert({
      user_id: input.userId,
      conversation_id: input.conversationId,
      kind: "long_term",
      category: match.category,
      title: match.title,
      content: text,
      evidence: {
        source: "user_message",
        conflict_id: conflict?.id ?? null,
      },
      confidence: conflict ? 0.45 : 0.82,
    });

    await supabase.from("ai_knowledge_base").insert({
      user_id: input.userId,
      title: match.title,
      content: text,
      category: match.category,
      source_module: "ai_memory",
      source_id: input.conversationId,
      status,
      confidence: conflict ? 0.45 : 0.82,
      tags: [match.category],
      relationships: conflict ? { conflicts_with: conflict.id } : {},
    });
  }
}
