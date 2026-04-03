/** 월드 장르 */
export type Genre = "fantasy" | "sci-fi" | "horror" | "romance" | "mystery" | "slice-of-life" | "post-apocalyptic";

/** 월드 시간 정보 */
export interface WorldTime {
    year: number;
    month: number;
    day: number;
    hour: number;
    time_of_day: "dawn" | "morning" | "afternoon" | "evening" | "night";
    calendar_system: string;
}

/** 월드 사양 JSONB */
export interface WorldSpec {
    genre: Genre;
    theme: string;
    setting: string;
    rules: string[];
    atmosphere: string;
    initial_locations: string[];
    initial_entities: string[];
}

/** 분위기 */
export type Mood = "tense" | "calm" | "mysterious" | "joyful" | "melancholic" | "fearful" | "romantic" | "comedic" | "epic" | "neutral";

/** 위치 변경 정보 */
export interface LocationChange {
    location_id: string;
    field: string;
    old_value: string;
    new_value: string;
}

/** 관계 변경 정보 */
export interface RelationshipChange {
    entity_id: string;
    entity_name: string;
    relationship_type: string;
    strength_delta: number;
    reason: string;
}

/** 이벤트 정보 */
export interface EventInfo {
    description: string;
    importance: number;
    entities_involved: string[];
    location_id: string;
}

/** 선택지 */
export interface Choice {
    id: string;
    text: string;
    tone: "bold" | "cautious" | "diplomatic" | "aggressive" | "compassionate" | "cunning";
    risk_level: number;
}

/** AI 턴 응답 */
export interface TurnResponse {
    narration: string;
    choices: Choice[];
    mood: Mood;
    items_gained: string[];
    items_lost: string[];
    location_changes: LocationChange[];
    relationship_changes: RelationshipChange[];
    events: EventInfo[];
    generate_image: boolean;
    image_prompt?: string;
}

/** 엔티티 타입 */
export type EntityType = "protagonist" | "npc" | "creature" | "object" | "faction";

/** NPC 성격 축 */
export interface PersonalityAxes {
    boldness: number;
    loyalty: number;
    curiosity: number;
    honesty: number;
}

/** NPC 행동 트리거 */
export interface BehavioralTrigger {
    condition: string;
    action: string;
    weight: number;
}

/** NPC 행동 규칙 (MiroFish 패턴) */
export interface BehaviorRules {
    core_drive: string;
    personality_axes: PersonalityAxes;
    goals: string[];
    behavioral_triggers: BehavioralTrigger[];
    speech_style: string;
    knowledge: string[];
    secrets: string[];
}

/** DB 테이블 행 타입들 */
export interface World {
    id: string;
    user_id: string;
    name: string;
    genre: Genre;
    world_spec: WorldSpec;
    world_time: WorldTime;
    cover_image_url: string | null;
    art_style: string | null;
    turn_count: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Location {
    id: string;
    world_id: string;
    name: string;
    description: string;
    connected_to: string[];
    discovered: boolean;
    image_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface Entity {
    id: string;
    world_id: string;
    name: string;
    entity_type: EntityType;
    description: string;
    personality: string;
    location_id: string | null;
    inventory: Record<string, unknown>[];
    behavior_rules: BehaviorRules;
    image_url: string | null;
    is_alive: boolean;
    created_at: string;
    updated_at: string;
}

export interface Relationship {
    id: string;
    world_id: string;
    entity_id: string;
    target_entity_id: string;
    relationship_type: string;
    strength: number;
    history: Record<string, unknown>[];
    decay_rate: number;
    created_at: string;
    updated_at: string;
}

export interface Event {
    id: string;
    world_id: string;
    turn_id: string | null;
    description: string;
    importance: number;
    entities_involved: string[];
    location_id: string | null;
    flashback_shown: boolean;
    created_at: string;
}

export interface Turn {
    id: string;
    world_id: string;
    turn_number: number;
    user_input: string;
    ai_response: TurnResponse;
    image_url: string | null;
    created_at: string;
}

export interface SessionSummary {
    id: string;
    world_id: string;
    from_turn: number;
    to_turn: number;
    summary: string;
    cliffhanger: string | null;
    created_at: string;
}

export interface MemoryEmbedding {
    id: string;
    world_id: string;
    content: string;
    content_type: string;
    importance: number;
    embedding: number[];
    created_at: string;
}

export interface TurningPoint {
    id: string;
    world_id: string;
    turn_id: string;
    player_choice: string;
    alternatives: string[];
    consequences: string;
    created_at: string;
}

export interface TimePassageLog {
    id: string;
    world_id: string;
    from_time: WorldTime;
    to_time: WorldTime;
    changes_applied: Record<string, unknown>;
    created_at: string;
}
