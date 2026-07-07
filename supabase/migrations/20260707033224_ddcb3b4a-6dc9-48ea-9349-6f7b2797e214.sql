ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS research jsonb,
  ADD COLUMN IF NOT EXISTS approved_pointers jsonb,
  ADD COLUMN IF NOT EXISTS package_markdown text,
  ADD COLUMN IF NOT EXISTS raw_content text,
  ADD COLUMN IF NOT EXISTS source_url text;