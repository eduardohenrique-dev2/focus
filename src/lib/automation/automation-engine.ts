import type { AutomationCondition, AutomationExecutionStatus } from "./types";
import { markAutomationEventStatus } from "./event-engine";

type SupabaseLike = {
  from: (table: string) => any;
};

type AutomationEventRecord = {
  id: string;
  user_id: string;
  type: string;
  payload: unknown;
};

function getValue(payload: unknown, path: string) {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object" && key in value) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, payload);
}

function conditionMatches(condition: AutomationCondition, payload: unknown) {
  const value = getValue(payload, condition.field);

  switch (condition.operator) {
    case "exists":
      return value !== undefined && value !== null;
    case "equals":
      return value === condition.value;
    case "not_equals":
      return value !== condition.value;
    case "contains":
      return String(value ?? "").includes(String(condition.value ?? ""));
    case "greater_than":
      return Number(value) > Number(condition.value);
    case "less_than":
      return Number(value) < Number(condition.value);
    default:
      return false;
  }
}

function normalizeConditions(value: unknown): AutomationCondition[] {
  return Array.isArray(value) ? (value as AutomationCondition[]) : [];
}

export async function processAutomationEvent(supabase: SupabaseLike, event: AutomationEventRecord) {
  await markAutomationEventStatus(supabase, event.id, "processing");

  const { data: workflows, error } = await supabase
    .from("automation_workflows")
    .select("*")
    .eq("user_id", event.user_id)
    .eq("status", "active")
    .eq("trigger_type", event.type);

  if (error) {
    await markAutomationEventStatus(supabase, event.id, "failed", error.message);
    throw error;
  }

  if (!workflows?.length) {
    await markAutomationEventStatus(supabase, event.id, "ignored");
    return { matched: 0, executed: 0 };
  }

  let executed = 0;

  for (const workflow of workflows) {
    const started = Date.now();
    const conditions = normalizeConditions(workflow.conditions);
    const matches = conditions.every((condition) => conditionMatches(condition, event.payload));
    const status: AutomationExecutionStatus = matches ? "success" : "skipped";

    if (matches) executed += 1;

    await supabase.from("automation_execution_logs").insert({
      user_id: event.user_id,
      workflow_id: workflow.id,
      event_id: event.id,
      status,
      duration_ms: Date.now() - started,
      payload: event.payload ?? {},
      result: {
        dry_run: true,
        actions_planned: Array.isArray(workflow.actions) ? workflow.actions.length : 0,
        reason: matches ? "conditions_matched" : "conditions_not_matched",
      },
    });
  }

  await markAutomationEventStatus(supabase, event.id, "processed");
  return { matched: workflows.length, executed };
}
