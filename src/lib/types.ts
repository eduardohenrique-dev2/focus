import type { Database } from "@/integrations/supabase/types";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Task = Tables<"tasks">;
export type Habit = Tables<"habits">;
export type HabitLog = Tables<"habit_logs">;
export type Note = Tables<"notes">;
export type CalendarEvent = Tables<"calendar_events">;
export type Goal = Tables<"goals">;
export type FinanceAccount = Tables<"finance_accounts">;
export type FinanceTransaction = Tables<"finance_transactions">;
export type Project = Tables<"projects">;
export type ProjectColumn = Tables<"project_columns">;
export type ProjectCard = Tables<"project_cards">;
export type StudySubject = Tables<"study_subjects">;
export type StudySession = Tables<"study_sessions">;
export type Flashcard = Tables<"flashcards">;
export type Reminder = Tables<"reminders">;
export type Notification = Tables<"notifications">;
export type AiConversation = Tables<"ai_conversations">;
export type AiMessage = Tables<"ai_messages">;
export type AiMemory = Tables<"ai_memories">;
export type AiKnowledgeBase = Tables<"ai_knowledge_base">;
export type Profile = Tables<"profiles">;
export type TaskCategory = Tables<"task_categories">;
export type ActivityLog = Tables<"activity_log">;
export type AutomationIntegration = Tables<"automation_integrations">;
export type AutomationWorkflow = Tables<"automation_workflows">;
export type AutomationEvent = Tables<"automation_events">;
export type AutomationWebhook = Tables<"automation_webhooks">;
export type AutomationExecutionLog = Tables<"automation_execution_logs">;
export type AutomationSettings = Tables<"automation_settings">;
export type AutomationN8nConnection = Tables<"automation_n8n_connections">;
export type AutomationDeliveryQueue = Tables<"automation_delivery_queue">;
