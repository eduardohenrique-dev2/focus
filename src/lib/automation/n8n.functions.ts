import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { processDueN8nDeliveries, testN8nConnection } from "./n8n-connector";

const n8nConfigSchema = z.object({
  serverUrl: z.string().url().or(z.literal("")),
  apiKey: z.string().optional(),
  webhookSecret: z.string().min(16),
  allowedOrigins: z.array(z.string()).default([]),
  timeoutMs: z.number().int().min(1000).max(120000),
  status: z.string().optional(),
});

export const saveN8nConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => n8nConfigSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("automation_n8n_connections").upsert(
      {
        user_id: userId,
        server_url: data.serverUrl,
        api_key: data.apiKey || null,
        webhook_secret: data.webhookSecret,
        allowed_origins: data.allowedOrigins,
        timeout_ms: data.timeoutMs,
        status: data.status ?? (data.serverUrl ? "unavailable" : "not_configured"),
      },
      { onConflict: "user_id" },
    );

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const testN8nConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const result = await testN8nConnection(context.supabase, context.userId);
      return { ok: true as const, result };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  });

export const processN8nQueueFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const result = await processDueN8nDeliveries(context.supabase);
      return { ok: true as const, processed: result.length };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  });
