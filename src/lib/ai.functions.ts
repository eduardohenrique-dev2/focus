import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runFocusAI } from "@/lib/ai/focus-ai-service";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(20000),
});

const inputSchema = z.object({
  conversationId: z.string().uuid().nullable(),
  messages: z.array(messageSchema).min(1).max(50),
  includeContext: z.boolean().optional().default(true),
  model: z.string().max(120).optional(),
});

export const chatWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let conversationId = data.conversationId;
    if (!conversationId) {
      const title = data.messages.find((message) => message.role === "user")?.content.slice(0, 60) ?? "Nova conversa";
      const { data: conv, error: convErr } = await supabase
        .from("ai_conversations")
        .insert({ user_id: userId, title })
        .select("id")
        .single();

      if (convErr || !conv) return { ok: false as const, error: "Falha ao criar conversa" };
      conversationId = conv.id;
    }

    const last = data.messages[data.messages.length - 1];
    if (last.role === "user") {
      await supabase.from("ai_messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "user",
        content: last.content,
      });
    }

    try {
      const { reply, context: focusContext } = await runFocusAI({
        supabase,
        userId,
        conversationId,
        messages: data.messages,
      });

      await supabase.from("ai_messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "assistant",
        content: reply,
      });

      await supabase
        .from("ai_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      return {
        ok: true as const,
        conversationId,
        reply,
        context: {
          generatedAt: focusContext.generatedAt,
          moduleCounts: focusContext.moduleCounts,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: msg };
    }
  });
