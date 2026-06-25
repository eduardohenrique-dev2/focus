-- =========================
-- FOCUS V2 SPRINT 2 - N8N CONNECTOR
-- Secure, decoupled bridge between FOCUS Automation Hub and n8n.
-- =========================

CREATE TABLE IF NOT EXISTS public.automation_n8n_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  server_url TEXT NOT NULL DEFAULT '',
  api_key TEXT,
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  allowed_origins TEXT[] NOT NULL DEFAULT '{}',
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  status TEXT NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured', 'connected', 'unavailable', 'auth_error', 'timeout', 'error', 'disabled')),
  last_test_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_response_ms INTEGER,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_n8n_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own automation n8n connections all"
  ON public.automation_n8n_connections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER automation_n8n_connections_updated
  BEFORE UPDATE ON public.automation_n8n_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_automation_n8n_connections_user_status
  ON public.automation_n8n_connections(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_n8n_connections_secret
  ON public.automation_n8n_connections(webhook_secret);

CREATE TABLE IF NOT EXISTS public.automation_delivery_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.automation_events(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.automation_n8n_connections(id) ON DELETE SET NULL,
  destination TEXT NOT NULL DEFAULT 'n8n',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'dead_letter')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 6,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_delivery_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own automation delivery queue all"
  ON public.automation_delivery_queue
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER automation_delivery_queue_updated
  BEFORE UPDATE ON public.automation_delivery_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_automation_delivery_queue_due
  ON public.automation_delivery_queue(status, next_retry_at, destination);
CREATE INDEX IF NOT EXISTS idx_automation_delivery_queue_user_status
  ON public.automation_delivery_queue(user_id, status, created_at DESC);

ALTER TABLE public.automation_execution_logs
  ADD COLUMN IF NOT EXISTS request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS destination TEXT,
  ADD COLUMN IF NOT EXISTS response_status INTEGER;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_n8n_connections;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_delivery_queue;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
