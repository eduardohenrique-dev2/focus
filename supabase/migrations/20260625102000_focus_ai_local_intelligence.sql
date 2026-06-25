-- =========================
-- FOCUS AI LOCAL INTELLIGENCE
-- Memory Engine + Knowledge Base
-- =========================

CREATE TABLE IF NOT EXISTS public.ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('short_term', 'long_term')),
  category TEXT NOT NULL CHECK (category IN ('conversation', 'preference', 'decision', 'process', 'pattern', 'action')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.700 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ai memories all"
  ON public.ai_memories
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER ai_memories_updated
  BEFORE UPDATE ON public.ai_memories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ai_memories_user_kind
  ON public.ai_memories(user_id, kind, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_memories_user_category
  ON public.ai_memories(user_id, category, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  source_module TEXT NOT NULL DEFAULT 'focus_ai',
  source_id UUID,
  status TEXT NOT NULL DEFAULT 'validated' CHECK (status IN ('validated', 'needs_review', 'conflicted', 'archived')),
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.700 CHECK (confidence >= 0 AND confidence <= 1),
  tags TEXT[] NOT NULL DEFAULT '{}',
  relationships JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ai knowledge all"
  ON public.ai_knowledge_base
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER ai_knowledge_base_updated
  BEFORE UPDATE ON public.ai_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_user_status
  ON public.ai_knowledge_base(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_user_category
  ON public.ai_knowledge_base(user_id, category, updated_at DESC);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_memories;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ALTER COLUMN preferred_ai_provider SET DEFAULT 'local',
  ALTER COLUMN preferred_ai_model SET DEFAULT 'local-context-engine';

UPDATE public.profiles
SET
  preferred_ai_provider = 'local',
  preferred_ai_model = 'local-context-engine'
WHERE preferred_ai_provider IS NULL
   OR preferred_ai_provider = 'openrouter';

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_knowledge_base;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
