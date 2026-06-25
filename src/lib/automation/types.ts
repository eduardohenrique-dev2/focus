import type { Json } from "@/integrations/supabase/types";

export type AutomationEventStatus = "received" | "queued" | "processing" | "processed" | "ignored" | "failed";
export type AutomationWorkflowStatus = "draft" | "active" | "paused" | "archived";
export type AutomationIntegrationStatus = "available" | "draft" | "connected" | "disabled" | "error";
export type AutomationWebhookDirection = "incoming" | "outgoing";
export type AutomationExecutionStatus = "queued" | "running" | "success" | "failed" | "skipped";

export type AutomationEventType =
  | "task.created"
  | "task.updated"
  | "task.completed"
  | "habit.completed"
  | "calendar.created"
  | "calendar.updated"
  | "goal.completed"
  | "study.review.completed"
  | "note.created"
  | "user.login"
  | "user.logout"
  | "finance.created"
  | string;

export type AutomationEventInput = {
  userId: string;
  type: AutomationEventType;
  source: string;
  payload?: Json;
  status?: AutomationEventStatus;
  occurredAt?: string;
};

export type AutomationCondition = {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "exists" | "greater_than" | "less_than";
  value?: Json;
};

export type AutomationAction = {
  type: string;
  target?: string;
  config?: Json;
};

export type ProviderDefinition = {
  provider: string;
  name: string;
  description: string;
  authType: "oauth2" | "api_key" | "webhook" | "bot_token" | "custom" | "not_configured";
  status: AutomationIntegrationStatus;
  capabilities: string[];
};
