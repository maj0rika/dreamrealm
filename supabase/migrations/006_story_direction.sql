-- 스토리 디렉터: story_direction + completed_at
ALTER TABLE worlds ADD COLUMN story_direction JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE worlds ADD COLUMN completed_at TIMESTAMPTZ;
