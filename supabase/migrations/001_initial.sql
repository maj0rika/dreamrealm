-- DreamRealm 초기 스키마
-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. profiles (사용자 프로필)
-- ============================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'premium')),
    daily_generations_used INTEGER NOT NULL DEFAULT 0,
    daily_generations_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. worlds (월드)
-- ============================================================
CREATE TABLE worlds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    genre TEXT NOT NULL,
    world_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
    world_time JSONB NOT NULL DEFAULT '{"year":1,"month":1,"day":1,"hour":8,"time_of_day":"morning","calendar_system":"standard"}'::jsonb,
    cover_image_url TEXT,
    turn_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_worlds_user_id ON worlds(user_id);

-- ============================================================
-- 3. locations (장소)
-- ============================================================
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    connected_to UUID[] NOT NULL DEFAULT '{}',
    discovered BOOLEAN NOT NULL DEFAULT false,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_locations_world_id ON locations(world_id);

-- ============================================================
-- 4. entities (엔티티/NPC)
-- ============================================================
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'npc' CHECK (entity_type IN ('npc', 'creature', 'object', 'faction')),
    description TEXT NOT NULL DEFAULT '',
    personality TEXT NOT NULL DEFAULT '',
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
    behavior_rules JSONB NOT NULL DEFAULT '{"core_drive":"","personality_axes":{"boldness":0.5,"loyalty":0.5,"curiosity":0.5,"honesty":0.5},"goals":[],"behavioral_triggers":[],"speech_style":"","knowledge":[],"secrets":[]}'::jsonb,
    image_url TEXT,
    is_alive BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entities_world_id ON entities(world_id);
CREATE INDEX idx_entities_location_id ON entities(location_id);

-- ============================================================
-- 5. relationships (관계)
-- ============================================================
CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL DEFAULT '',
    strength INTEGER NOT NULL DEFAULT 0 CHECK (strength >= -10 AND strength <= 10),
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    decay_rate FLOAT NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_relationships_world_id ON relationships(world_id);
CREATE INDEX idx_relationships_entity_id ON relationships(entity_id);

-- ============================================================
-- 6. events (이벤트)
-- ============================================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    turn_id UUID,
    description TEXT NOT NULL DEFAULT '',
    importance INTEGER NOT NULL DEFAULT 1 CHECK (importance >= 1 AND importance <= 10),
    entities_involved UUID[] NOT NULL DEFAULT '{}',
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    flashback_shown BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_world_id ON events(world_id);
CREATE INDEX idx_events_importance ON events(importance);

-- ============================================================
-- 7. turns (턴 히스토리)
-- ============================================================
CREATE TABLE turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL,
    user_input TEXT NOT NULL,
    ai_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_turns_world_id ON turns(world_id);
CREATE INDEX idx_turns_turn_number ON turns(world_id, turn_number);

-- events.turn_id FK (turns 테이블 생성 후 추가)
ALTER TABLE events ADD CONSTRAINT fk_events_turn_id FOREIGN KEY (turn_id) REFERENCES turns(id) ON DELETE SET NULL;

-- ============================================================
-- 8. session_summaries (세션 요약)
-- ============================================================
CREATE TABLE session_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    from_turn INTEGER NOT NULL,
    to_turn INTEGER NOT NULL,
    summary TEXT NOT NULL,
    cliffhanger TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_summaries_world_id ON session_summaries(world_id);

-- ============================================================
-- 9. memory_embeddings (벡터 메모리)
-- ============================================================
CREATE TABLE memory_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'event',
    importance INTEGER NOT NULL DEFAULT 1 CHECK (importance >= 1 AND importance <= 10),
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_embeddings_world_id ON memory_embeddings(world_id);

-- HNSW 인덱스 (벡터 유사도 검색 최적화)
CREATE INDEX idx_memory_embeddings_hnsw ON memory_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================================
-- 10. turning_points (분기점)
-- ============================================================
CREATE TABLE turning_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    turn_id UUID NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
    player_choice TEXT NOT NULL,
    alternatives TEXT[] NOT NULL DEFAULT '{}',
    consequences TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_turning_points_world_id ON turning_points(world_id);

-- ============================================================
-- 11. time_passage_logs (시간 경과 로그)
-- ============================================================
CREATE TABLE time_passage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    from_time JSONB NOT NULL,
    to_time JSONB NOT NULL,
    changes_applied JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_passage_logs_world_id ON time_passage_logs(world_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- profiles: 본인만 접근
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- worlds: 본인 소유만 접근
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own worlds" ON worlds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own worlds" ON worlds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own worlds" ON worlds FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own worlds" ON worlds FOR DELETE USING (auth.uid() = user_id);

-- locations: world 소유권 간접 확인
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own world locations" ON locations FOR ALL
    USING (EXISTS (SELECT 1 FROM worlds WHERE worlds.id = locations.world_id AND worlds.user_id = auth.uid()));

-- entities: world 소유권 간접 확인
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own world entities" ON entities FOR ALL
    USING (EXISTS (SELECT 1 FROM worlds WHERE worlds.id = entities.world_id AND worlds.user_id = auth.uid()));

-- relationships: world 소유권 간접 확인
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own world relationships" ON relationships FOR ALL
    USING (EXISTS (SELECT 1 FROM worlds WHERE worlds.id = relationships.world_id AND worlds.user_id = auth.uid()));

-- events: world 소유권 간접 확인
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own world events" ON events FOR ALL
    USING (EXISTS (SELECT 1 FROM worlds WHERE worlds.id = events.world_id AND worlds.user_id = auth.uid()));

-- turns: world 소유권 간접 확인
ALTER TABLE turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own world turns" ON turns FOR ALL
    USING (EXISTS (SELECT 1 FROM worlds WHERE worlds.id = turns.world_id AND worlds.user_id = auth.uid()));

-- session_summaries: world 소유권 간접 확인
ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own world session_summaries" ON session_summaries FOR ALL
    USING (EXISTS (SELECT 1 FROM worlds WHERE worlds.id = session_summaries.world_id AND worlds.user_id = auth.uid()));

-- memory_embeddings: world 소유권 간접 확인
ALTER TABLE memory_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own world memory_embeddings" ON memory_embeddings FOR ALL
    USING (EXISTS (SELECT 1 FROM worlds WHERE worlds.id = memory_embeddings.world_id AND worlds.user_id = auth.uid()));

-- turning_points: world 소유권 간접 확인
ALTER TABLE turning_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own world turning_points" ON turning_points FOR ALL
    USING (EXISTS (SELECT 1 FROM worlds WHERE worlds.id = turning_points.world_id AND worlds.user_id = auth.uid()));

-- time_passage_logs: world 소유권 간접 확인
ALTER TABLE time_passage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own world time_passage_logs" ON time_passage_logs FOR ALL
    USING (EXISTS (SELECT 1 FROM worlds WHERE worlds.id = time_passage_logs.world_id AND worlds.user_id = auth.uid()));

-- ============================================================
-- updated_at 자동 갱신 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_worlds_updated_at BEFORE UPDATE ON worlds FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_entities_updated_at BEFORE UPDATE ON entities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_relationships_updated_at BEFORE UPDATE ON relationships FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 벡터 유사도 검색 RPC 함수
-- ============================================================
CREATE OR REPLACE FUNCTION match_memories(
    query_embedding vector(1536),
    match_world_id UUID,
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    world_id UUID,
    content TEXT,
    content_type TEXT,
    importance INTEGER,
    embedding vector(1536),
    created_at TIMESTAMPTZ,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        me.id,
        me.world_id,
        me.content,
        me.content_type,
        me.importance,
        me.embedding,
        me.created_at,
        1 - (me.embedding <=> query_embedding) AS similarity
    FROM memory_embeddings me
    WHERE me.world_id = match_world_id
    ORDER BY me.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
