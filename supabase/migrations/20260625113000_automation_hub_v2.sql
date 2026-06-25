-- =========================
-- FOCUS V2 - AUTOMATION HUB
-- Infrastructure only: no external integrations are connected in this sprint.
-- =========================

CREATE TABLE IF NOT EXISTS public.automation_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'draft', 'connected', 'disabled', 'error')),
  auth_type TEXT NOT NULL DEFAULT 'not_configured',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_connected_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own automation integrations all"
  ON public.automation_integrations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER automation_integrations_updated
  BEFORE UPDATE ON public.automation_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_automation_integrations_user_status
  ON public.automation_integrations(user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own automation workflows all"
  ON public.automation_workflows
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER automation_workflows_updated
  BEFORE UPDATE ON public.automation_workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_automation_workflows_user_status
  ON public.automation_workflows(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_user_trigger
  ON public.automation_workflows(user_id, trigger_type);

CREATE TABLE IF NOT EXISTS public.automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'queued', 'processing', 'processed', 'ignored', 'failed')),
  error TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own automation events all"
  ON public.automation_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_automation_events_user_type
  ON public.automation_events(user_id, type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_events_user_status
  ON public.automation_events(user_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.automation_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  url TEXT,
  token TEXT,
  http_method TEXT NOT NULL DEFAULT 'POST' CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'disabled', 'error')),
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_execution_at TIMESTAMPTZ,
  last_status_code INTEGER,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own automation webhooks all"
  ON public.automation_webhooks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER automation_webhooks_updated
  BEFORE UPDATE ON public.automation_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_automation_webhooks_user_direction
  ON public.automation_webhooks(user_id, direction, status);

CREATE TABLE IF NOT EXISTS public.automation_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.automation_events(id) ON DELETE SET NULL,
  webhook_id UUID REFERENCES public.automation_webhooks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'success', 'failed', 'skipped')),
  duration_ms INTEGER,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_execution_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own automation execution logs all"
  ON public.automation_execution_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_automation_execution_logs_user_status
  ON public.automation_execution_logs(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_execution_logs_workflow
  ON public.automation_execution_logs(workflow_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key TEXT,
  security JSONB NOT NULL DEFAULT '{"require_tokens": true, "allow_unsigned_webhooks": false}'::jsonb,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  log_level TEXT NOT NULL DEFAULT 'info' CHECK (log_level IN ('debug', 'info', 'warn', 'error')),
  debug_mode BOOLEAN NOT NULL DEFAULT false,
  retention_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own automation settings all"
  ON public.automation_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER automation_settings_updated
  BEFORE UPDATE ON public.automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_integrations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_workflows;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_webhooks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_execution_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
