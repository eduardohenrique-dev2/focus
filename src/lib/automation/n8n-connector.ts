import type { Json } from "@/integrations/supabase/types";
import { signPayload } from "./security";

type SupabaseLike = {
  from: (table: string) => any;
};

type AutomationEventRecord = {
  id: string;
  user_id: string;
  type: string;
  source: string;
  payload: Json;
  occurred_at: string;
};

type N8nConnection = {
  id: string;
  user_id: string;
  server_url: string;
  api_key: string | null;
  webhook_secret: string;
  timeout_ms: number;
  status: string;
};

type DeliveryQueueItem = {
  id: string;
  user_id: string;
  event_id: string;
  connection_id: string | null;
  attempt_count: number;
  max_attempts: number;
  request_payload: Json;
};

export function normalizeN8nUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export function buildN8nEventPayload(event: AutomationEventRecord) {
  return {
    api_version: "focus.automation.v2",
    event: {
      id: event.id,
      type: event.type,
      user_id: event.user_id,
      occurred_at: event.occurred_at,
      source_module: event.source,
      payload: event.payload,
    },
    focus: {
      product: "FOCUS Life OS",
      module: "Automation Hub",
    },
  };
}

function nextRetryDate(attemptCount: number) {
  const seconds = Math.min(60 * 30, 2 ** Math.max(1, attemptCount) * 15);
  const date = new Date();
  date.setSeconds(date.getSeconds() + seconds);
  return date.toISOString();
}

async function readResponsePayload(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { text: text.slice(0, 2000) };
  }
}

export async function getN8nConnection(supabase: SupabaseLike, userId: string) {
  const { data, error } = await supabase
    .from("automation_n8n_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as N8nConnection | null;
}

export async function enqueueN8nDelivery(supabase: SupabaseLike, event: AutomationEventRecord) {
  const connection = await getN8nConnection(supabase, event.user_id);
  if (!connection || connection.status === "disabled" || !connection.server_url) return null;

  const payload = buildN8nEventPayload(event);
  const { data, error } = await supabase
    .from("automation_delivery_queue")
    .insert({
      user_id: event.user_id,
      event_id: event.id,
      connection_id: connection.id,
      destination: "n8n",
      status: "queued",
      request_payload: payload,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function testN8nConnection(supabase: SupabaseLike, userId: string) {
  const connection = await getN8nConnection(supabase, userId);
  if (!connection || !connection.server_url) {
    return { ok: false as const, status: "not_configured", error: "Conexao n8n nao configurada." };
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), connection.timeout_ms);

  try {
    const url = `${normalizeN8nUrl(connection.server_url)}/webhook/focus-health`;
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(connection.api_key ? { Authorization: `Bearer ${connection.api_key}` } : {}),
      },
      body: JSON.stringify({
        api_version: "focus.automation.v2",
        type: "focus.connection.test",
        sent_at: new Date().toISOString(),
      }),
    });

    const responseMs = Date.now() - started;
    const status = response.status === 401 || response.status === 403 ? "auth_error" : response.ok ? "connected" : "unavailable";
    const responsePayload = await readResponsePayload(response);

    await supabase
      .from("automation_n8n_connections")
      .update({
        status,
        last_test_at: new Date().toISOString(),
        last_response_ms: responseMs,
        last_error: response.ok ? null : `HTTP ${response.status}`,
        metadata: { last_test_response: responsePayload },
      })
      .eq("id", connection.id);

    return { ok: response.ok, status, responseMs, responseStatus: response.status, responsePayload };
  } catch (error) {
    const status = error instanceof DOMException && error.name === "AbortError" ? "timeout" : "error";
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from("automation_n8n_connections")
      .update({
        status,
        last_test_at: new Date().toISOString(),
        last_response_ms: Date.now() - started,
        last_error: message,
      })
      .eq("id", connection.id);
    return { ok: false as const, status, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendQueuedN8nDelivery(supabase: SupabaseLike, queueItem: DeliveryQueueItem) {
  const connection = queueItem.connection_id
    ? ((await supabase.from("automation_n8n_connections").select("*").eq("id", queueItem.connection_id).single()).data as N8nConnection | null)
    : await getN8nConnection(supabase, queueItem.user_id);

  if (!connection || !connection.server_url || connection.status === "disabled") {
    await supabase
      .from("automation_delivery_queue")
      .update({
        status: "queued",
        last_error: "N8N connection unavailable",
        next_retry_at: nextRetryDate(queueItem.attempt_count + 1),
      })
      .eq("id", queueItem.id);
    return { ok: false as const, error: "N8N connection unavailable" };
  }

  const started = Date.now();
  const attempt = queueItem.attempt_count + 1;
  const body = JSON.stringify(queueItem.request_payload);
  const signature = await signPayload(body, connection.webhook_secret);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), connection.timeout_ms);

  await supabase
    .from("automation_delivery_queue")
    .update({ status: "processing", attempt_count: attempt, last_attempt_at: new Date().toISOString() })
    .eq("id", queueItem.id);

  try {
    const response = await fetch(`${normalizeN8nUrl(connection.server_url)}/webhook/focus-events`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-FOCUS-Webhook-Secret": connection.webhook_secret,
        "X-FOCUS-Signature": signature,
        "X-FOCUS-Event-Id": queueItem.event_id,
        ...(connection.api_key ? { Authorization: `Bearer ${connection.api_key}` } : {}),
      },
      body,
    });

    const responsePayload = await readResponsePayload(response);
    const duration = Date.now() - started;

    await supabase.from("automation_execution_logs").insert({
      user_id: queueItem.user_id,
      event_id: queueItem.event_id,
      status: response.ok ? "success" : "failed",
      destination: "n8n",
      duration_ms: duration,
      response_status: response.status,
      attempt_count: attempt,
      payload: queueItem.request_payload,
      request_payload: queueItem.request_payload,
      response_payload: responsePayload,
      error: response.ok ? null : `HTTP ${response.status}`,
      finished_at: new Date().toISOString(),
    });

    if (response.ok) {
      await supabase
        .from("automation_delivery_queue")
        .update({
          status: "sent",
          response_payload: responsePayload,
          last_error: null,
        })
        .eq("id", queueItem.id);
      await supabase
        .from("automation_n8n_connections")
        .update({ status: "connected", last_sync_at: new Date().toISOString(), last_response_ms: duration, last_error: null })
        .eq("id", connection.id);
      return { ok: true as const, responsePayload };
    }

    const dead = attempt >= queueItem.max_attempts;
    await supabase
      .from("automation_delivery_queue")
      .update({
        status: dead ? "dead_letter" : "queued",
        response_payload: responsePayload,
        last_error: `HTTP ${response.status}`,
        next_retry_at: dead ? new Date().toISOString() : nextRetryDate(attempt),
      })
      .eq("id", queueItem.id);
    return { ok: false as const, error: `HTTP ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const dead = attempt >= queueItem.max_attempts;
    await supabase.from("automation_execution_logs").insert({
      user_id: queueItem.user_id,
      event_id: queueItem.event_id,
      status: "failed",
      destination: "n8n",
      duration_ms: Date.now() - started,
      attempt_count: attempt,
      payload: queueItem.request_payload,
      request_payload: queueItem.request_payload,
      error: message,
      finished_at: new Date().toISOString(),
    });
    await supabase
      .from("automation_delivery_queue")
      .update({
        status: dead ? "dead_letter" : "queued",
        last_error: message,
        next_retry_at: dead ? new Date().toISOString() : nextRetryDate(attempt),
      })
      .eq("id", queueItem.id);
    return { ok: false as const, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function processDueN8nDeliveries(supabase: SupabaseLike, limit = 25) {
  const { data, error } = await supabase
    .from("automation_delivery_queue")
    .select("*")
    .eq("destination", "n8n")
    .eq("status", "queued")
    .lte("next_retry_at", new Date().toISOString())
    .order("created_at")
    .limit(limit);

  if (error) throw error;

  const results = [];
  for (const item of data ?? []) {
    results.push(await sendQueuedN8nDelivery(supabase, item));
  }
  return results;
}
