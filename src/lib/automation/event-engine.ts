import type { AutomationEventInput } from "./types";
import { enqueueN8nDelivery, sendQueuedN8nDelivery } from "./n8n-connector";

type SupabaseLike = {
  from: (table: string) => any;
};

export async function emitAutomationEvent(supabase: SupabaseLike, input: AutomationEventInput) {
  const { data, error } = await supabase
    .from("automation_events")
    .insert({
      user_id: input.userId,
      type: input.type,
      source: input.source,
      payload: input.payload ?? {},
      status: input.status ?? "received",
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  const queued = await enqueueN8nDelivery(supabase, data);
  if (queued) {
    void sendQueuedN8nDelivery(supabase, queued);
  }
  return data;
}

export async function markAutomationEventStatus(
  supabase: SupabaseLike,
  eventId: string,
  status: "queued" | "processing" | "processed" | "ignored" | "failed",
  error?: string,
) {
  const { error: updateError } = await supabase
    .from("automation_events")
    .update({
      status,
      error: error ?? null,
      processed_at: ["processed", "ignored", "failed"].includes(status) ? new Date().toISOString() : null,
    })
    .eq("id", eventId);

  if (updateError) throw updateError;
}
