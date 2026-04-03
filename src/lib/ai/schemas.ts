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

/** 관계 변경 스키마 */
const relationshipChangeSchema = z.object({
    entity_name: z.string(),
    relationship_type: z.string(),
    strength_delta: z.number(),
    reason: z.string(),
});

/** 이벤트 스키마 */
const eventSchema = z.object({
    description: z.string(),
    importance: z.number().min(1).max(10),
    participants: z.array(z.string()),
});

/** AI turn 응답 스키마 */
export const turnResponseSchema = z.object({
    narration: z.string(),
    choices: z.array(choiceSchema).min(2).max(4),
    mood: z.string(),
    location_changed: z.string().nullable(),
    items_gained: z.array(z.string()),
    items_lost: z.array(z.string()),
    relationship_changes: z.array(relationshipChangeSchema),
    event: eventSchema,
    generate_image: z.boolean(),
    image_prompt: z.string().optional(),
});

export type GeneratedTurnResponse = z.infer<typeof turnResponseSchema>;

/** API 요청 스키마 */
export const createWorldRequestSchema = z.object({
    genre: z.string().min(1).max(50),
    prompt: z.string().min(1).max(1000),
});
