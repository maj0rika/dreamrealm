import { z } from "zod";

/** AI가 생성하는 NPC 행동 규칙 스키마 */
const behaviorRulesSchema = z.object({
    core_drive: z.string(),
    personality_axes: z.object({
        boldness: z.number().min(0).max(1),
        loyalty: z.number().min(0).max(1),
        curiosity: z.number().min(0).max(1),
        honesty: z.number().min(0).max(1),
    }),
    goals: z.array(z.string()),
    behavioral_triggers: z.array(
        z.object({
            condition: z.string(),
            action: z.string(),
            weight: z.number().min(0).max(1),
        })
    ),
    speech_style: z.string(),
    knowledge: z.array(z.string()),
    secrets: z.array(z.string()),
});

/** AI가 생성하는 장소 스키마 */
const generatedLocationSchema = z.object({
    name: z.string(),
    description: z.string(),
    visual_anchor: z.string().default(""),
    properties: z.record(z.string(), z.unknown()).optional(),
    connected_to_names: z.array(z.string()),
});

/** AI가 생성하는 NPC 스키마 */
const generatedNpcSchema = z.object({
    name: z.string(),
    entity_type: z.literal("npc"),
    description: z.string(),
    personality: z.string(),
    location_name: z.string(),
    behavior_rules: behaviorRulesSchema,
});

/** AI가 생성하는 주인공 스키마 */
const generatedProtagonistSchema = z.object({
    name: z.string(),
    description: z.string(),
    inventory: z.array(z.string()),
    status: z.record(z.string(), z.string()),
});

/** AI world-generator 응답 스키마 */
export const generatedWorldSpecSchema = z.object({
    name: z.string(),
    name_en: z.string(),
    genre: z.string(),
    tone: z.string(),
    description: z.string(),
    rules: z.array(z.string()),
    starting_location: generatedLocationSchema,
    additional_locations: z.array(generatedLocationSchema),
    protagonist: generatedProtagonistSchema,
    npcs: z.array(generatedNpcSchema).min(3),
    image_prompt: z.string(),
});

export type GeneratedWorldSpec = z.infer<typeof generatedWorldSpecSchema>;

/** 선택지 스키마 */
const choiceSchema = z.object({
    id: z.number(),
    text: z.string(),
});

/** 관계 변경 스키마 — AI가 다양한 키 이름으로 보낼 수 있으므로 유연하게 처리 */
const relationshipChangeSchema = z.object({
    entity_name: z.string().optional().default(""),
    name: z.string().optional(),
    relationship_type: z.string().optional().default("stranger"),
    type: z.string().optional(),
    strength_delta: z.number().optional().default(0),
    delta: z.number().optional(),
    change: z.number().optional(),
    reason: z.string().optional().default(""),
}).transform((rc) => ({
    entity_name: rc.entity_name || rc.name || "",
    relationship_type: rc.relationship_type || rc.type || "stranger",
    strength_delta: rc.strength_delta || rc.delta || rc.change || 0,
    reason: rc.reason || "",
}));

/** 이벤트 스키마 */
const eventSchema = z.object({
    description: z.string().default(""),
    importance: z.number().min(1).max(10).default(1),
    participants: z.array(z.string()).default([]),
});

/** AI turn 응답 스키마 — LLM 출력 변동에 대응하여 기본값 적용 */
export const turnResponseSchema = z.object({
    narration: z.string(),
    choices: z.array(choiceSchema).min(1).max(5),
    mood: z.string().default("neutral"),
    location_changed: z.union([z.string(), z.boolean(), z.null()]).transform((v) => {
        if (typeof v === "string" && v.length > 0) return v;
        return null;
    }).default(null),
    items_gained: z.array(z.string()).default([]),
    items_lost: z.array(z.string()).default([]),
    relationship_changes: z.array(relationshipChangeSchema).default([]),
    event: eventSchema.default({ description: "", importance: 1, participants: [] }),
    generate_image: z.boolean().default(false),
    image_prompt: z.string().optional().default(""),
});

export type GeneratedTurnResponse = z.infer<typeof turnResponseSchema>;

/** 시간 경과 사건 스키마 */
const timePassageEventSchema = z.object({
    time_description: z.string(),
    description: z.string(),
    importance: z.number().min(1).max(10).default(3),
    entities_involved: z.array(z.string()).default([]),
    location_name: z.string().optional().default(""),
    state_changes: z.object({
        entity_moves: z.array(z.object({
            entity_name: z.string(),
            to_location: z.string(),
        })).default([]),
        relationship_changes: z.array(z.object({
            entity_name: z.string(),
            target_name: z.string(),
            delta: z.number(),
            reason: z.string(),
        })).default([]),
        items_added: z.array(z.string()).default([]),
        items_removed: z.array(z.string()).default([]),
    }).default({
        entity_moves: [],
        relationship_changes: [],
        items_added: [],
        items_removed: [],
    }),
});

export const timePassageResponseSchema = z.object({
    events: z.array(timePassageEventSchema).default([]),
    summary: z.string().default(""),
});

export type TimePassageResponse = z.infer<typeof timePassageResponseSchema>;

/** 스토리 작가 방향 지시서 스키마 */
export const storyDirectionSchema = z.object({
    current_act: z.enum(["발단", "위기", "절정", "결말"]).default("발단"),
    tension_level: z.number().min(0).max(1).default(0.2),
    active_threads: z.array(z.string()).min(1).default(["메인 스토리"]),
    next_beats: z.array(z.string()).default([]),
    foreshadowing: z.array(z.string()).default([]),
    avoid: z.array(z.string()).default([]),
    estimated_climax_turn: z.number().default(35),
    ending_outline: z.string().default(""),
    resolved_threads: z.array(z.string()).default([]),
});

export type GeneratedStoryDirection = z.infer<typeof storyDirectionSchema>;

/** API 요청 스키마 */
export const createWorldRequestSchema = z.object({
    genre: z.string().min(1).max(50),
    prompt: z.string().min(1).max(1000),
    art_style: z.enum([
        "epic-fantasy", "sci-fi-concept", "dark-gothic",
        "watercolor-romance", "anime-vibrant", "noir-mystery",
        "post-apocalyptic",
    ]).optional(),
});
