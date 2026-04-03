import { createServerClient } from "@/lib/db/supabase-server";
import { callAI } from "@/lib/ai/client";
import { buildWorldGeneratorMessages } from "@/lib/ai/prompts/world-generator";
import { buildOpeningSceneMessages } from "@/lib/ai/prompts/opening-scene";
import {
    createWorldRequestSchema,
    generatedWorldSpecSchema,
    turnResponseSchema,
} from "@/lib/ai/schemas";
import { createWorld } from "@/lib/db/worlds";
import { createLocation } from "@/lib/db/locations";
import { createEntity } from "@/lib/db/entities";
import { createRelationship } from "@/lib/db/relationships";
import { createTurn } from "@/lib/db/turns";
import { generateImage } from "@/lib/ai/image-generator";
import { uploadImageFromUrl } from "@/lib/storage/upload";
import { getDefaultArtStyle, getArtStyleById } from "@/lib/ai/art-styles";
import type { WorldSpec, TurnResponse, Mood } from "@/types/world";

export async function POST(request: Request) {
    try {
        // 인증 확인
        const supabase = await createServerClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return Response.json({ error: "인증이 필요합니다" }, { status: 401 });
        }

        // 사용자 프로필 조회 (플랜 확인)
        const { data: profile } = await supabase
            .from("profiles")
            .select("plan")
            .eq("id", user.id)
            .single();
        const userPlan = profile?.plan ?? "free";

        // 입력 검증
        const body = await request.json();
        const parsed = createWorldRequestSchema.safeParse(body);
        if (!parsed.success) {
            return Response.json(
                { error: "잘못된 입력입니다", details: parsed.error.flatten() },
                { status: 400 }
            );
        }
        const { genre, prompt, art_style: artStyleId } = parsed.data;

        // 아트 스타일 결정: 명시적 선택 → 장르 기본값
        const artStyleOption = artStyleId
            ? getArtStyleById(artStyleId) ?? getDefaultArtStyle(genre)
            : getDefaultArtStyle(genre);
        const artStyle = artStyleOption.prompt;

        // 1단계: 월드 생성 AI 호출
        const worldMessages = buildWorldGeneratorMessages(genre, prompt);
        const worldRaw = await callAI(worldMessages, userPlan, {
            temperature: 0.9,
            maxTokens: 4000,
        });

        let worldJson: unknown;
        try {
            worldJson = JSON.parse(worldRaw);
        } catch {
            return Response.json(
                { error: "월드 생성 실패: AI 응답 JSON 파싱 실패" },
                { status: 502 }
            );
        }
        const worldSpecParsed = generatedWorldSpecSchema.safeParse(worldJson);
        if (!worldSpecParsed.success) {
            return Response.json(
                { error: "월드 생성 실패: AI 응답 형식 오류" },
                { status: 502 }
            );
        }
        const generatedSpec = worldSpecParsed.data;

        // DB에 월드 저장
        const dbWorldSpec: WorldSpec = {
            genre: generatedSpec.genre as WorldSpec["genre"],
            theme: generatedSpec.tone,
            setting: generatedSpec.description,
            rules: generatedSpec.rules,
            atmosphere: generatedSpec.tone,
            initial_locations: [
                generatedSpec.starting_location.name,
                ...generatedSpec.additional_locations.map((l) => l.name),
            ],
            initial_entities: [
                generatedSpec.protagonist.name,
                ...generatedSpec.npcs.map((n) => n.name),
            ],
        };

        const world = await createWorld({
            user_id: user.id,
            name: generatedSpec.name,
            genre: generatedSpec.genre as WorldSpec["genre"],
            world_spec: dbWorldSpec,
            art_style: artStyle,
        });

        // 장소 저장 — 시작 장소 + 추가 장소
        const allLocations = [
            generatedSpec.starting_location,
            ...generatedSpec.additional_locations,
        ];

        // 1차: 모든 장소 생성 (connected_to는 이후 업데이트)
        const locationMap = new Map<string, string>(); // name → id
        for (const loc of allLocations) {
            const created = await createLocation({
                world_id: world.id,
                name: loc.name,
                description: loc.description,
                discovered: loc.name === generatedSpec.starting_location.name,
            });
            locationMap.set(loc.name, created.id);

            // 시각 앵커 + 이미지 시드 저장 (이미지 일관성)
            if (loc.visual_anchor) {
                const imageSeed = Math.floor(Math.random() * 2147483647);
                await supabase
                    .from("locations")
                    .update({ visual_anchor: loc.visual_anchor, image_seed: imageSeed })
                    .eq("id", created.id);
            }
        }

        // 2차: connected_to UUID 배열 업데이트
        for (const loc of allLocations) {
            const locationId = locationMap.get(loc.name);
            if (!locationId) continue;

            const connectedIds = loc.connected_to_names
                .map((name) => locationMap.get(name))
                .filter((id): id is string => id !== undefined);

            if (connectedIds.length > 0) {
                await supabase
                    .from("locations")
                    .update({ connected_to: connectedIds })
                    .eq("id", locationId);
            }
        }

        const startingLocationId = locationMap.get(
            generatedSpec.starting_location.name
        )!;

        // 주인공 저장
        const protagonist = await createEntity({
            world_id: world.id,
            name: generatedSpec.protagonist.name,
            entity_type: "protagonist",
            description: generatedSpec.protagonist.description,
            personality: "주인공",
            location_id: startingLocationId,
            inventory: generatedSpec.protagonist.inventory.map((item) => ({
                name: item,
            })),
            behavior_rules: {
                core_drive: "모험",
                personality_axes: {
                    boldness: 0.5,
                    loyalty: 0.5,
                    curiosity: 0.7,
                    honesty: 0.5,
                },
                goals: ["세계를 탐험한다"],
                behavioral_triggers: [],
                speech_style: "",
                knowledge: [],
                secrets: [],
            },
        });

        // NPC 저장 + 주인공과의 초기 관계 생성
        for (const npc of generatedSpec.npcs) {
            const npcLocationId = locationMap.get(npc.location_name);

            const entity = await createEntity({
                world_id: world.id,
                name: npc.name,
                entity_type: npc.entity_type,
                description: npc.description,
                personality: npc.personality,
                location_id: npcLocationId,
                behavior_rules: npc.behavior_rules,
            });

            // 주인공 ↔ NPC 초기 관계
            await createRelationship({
                world_id: world.id,
                entity_id: protagonist.id,
                target_entity_id: entity.id,
                relationship_type: "stranger",
                strength: 0,
            });
        }

        // 2단계: 시작 장면 생성
        const sceneMessages = buildOpeningSceneMessages(generatedSpec);
        const sceneRaw = await callAI(sceneMessages, userPlan, {
            temperature: 0.8,
        });

        let sceneJson: unknown;
        try {
            sceneJson = JSON.parse(sceneRaw);
        } catch {
            return Response.json(
                { error: "시작 장면 생성 실패: AI 응답 JSON 파싱 실패" },
                { status: 502 }
            );
        }
        const sceneParsed = turnResponseSchema.safeParse(sceneJson);
        if (!sceneParsed.success) {
            return Response.json(
                { error: "시작 장면 생성 실패: AI 응답 형식 오류" },
                { status: 502 }
            );
        }
        const generatedScene = sceneParsed.data;

        // TurnResponse DB 형식으로 변환
        const dbTurnResponse: TurnResponse = {
            narration: generatedScene.narration,
            choices: generatedScene.choices.map((c) => ({
                id: String(c.id),
                text: c.text,
                tone: "cautious" as const,
                risk_level: 1,
            })),
            mood: generatedScene.mood as Mood,
            items_gained: generatedScene.items_gained,
            items_lost: generatedScene.items_lost,
            location_changes: [],
            relationship_changes: generatedScene.relationship_changes.map(
                (rc) => ({
                    entity_id: "",
                    entity_name: rc.entity_name,
                    relationship_type: rc.relationship_type,
                    strength_delta: rc.strength_delta,
                    reason: rc.reason,
                })
            ),
            events: [
                {
                    description: generatedScene.event.description,
                    importance: generatedScene.event.importance,
                    entities_involved: generatedScene.event.participants,
                    location_id: startingLocationId,
                },
            ],
            generate_image: generatedScene.generate_image,
            image_prompt: generatedScene.image_prompt,
        };

        // 첫 턴 저장
        await createTurn({
            world_id: world.id,
            turn_number: 1,
            user_input: "[세계 시작]",
            ai_response: dbTurnResponse,
        });

        // turn_count 업데이트
        await supabase
            .from("worlds")
            .update({ turn_count: 1 })
            .eq("id", world.id);

        // 커버 이미지 비동기 생성 (fire-and-forget) — 아트 스타일 자동 append
        const coverPrompt = generatedSpec.image_prompt
            ? generatedSpec.image_prompt + ", " + artStyle
            : null;
        console.log("[cover-image] 생성 시작:", world.id, "prompt:", coverPrompt?.slice(0, 80));
        if (coverPrompt) {
            generateAndSaveCoverImage(world.id, coverPrompt).catch(
                (err) => console.error("[cover-image] 생성 실패:", err)
            );
        } else {
            console.warn("[cover-image] image_prompt가 없어서 스킵");
        }

        return Response.json({
            worldId: world.id,
            firstTurn: generatedScene,
        });
    } catch (error) {
        console.error("월드 생성 오류:", error);
        return Response.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "월드 생성 중 오류가 발생했습니다",
            },
            { status: 500 }
        );
    }
}

/** 커버 이미지 비동기 생성 → Storage 업로드 → DB 업데이트 */
async function generateAndSaveCoverImage(
    worldId: string,
    prompt: string
): Promise<void> {
    console.log("[cover-image] generateImage 호출 중...");
    const imageUrl = await generateImage(prompt);
    if (!imageUrl) {
        console.error("[cover-image] generateImage 실패 — null 반환");
        return;
    }
    console.log("[cover-image] 이미지 URL 획득:", imageUrl.slice(0, 80));

    try {
        console.log("[cover-image] Storage 업로드 시작...");
        const publicUrl = await uploadImageFromUrl(imageUrl, `${worldId}/cover.webp`);
        console.log("[cover-image] 업로드 성공:", publicUrl.slice(0, 80));

        const supabase = await createServerClient();
        const { error } = await supabase
            .from("worlds")
            .update({ cover_image_url: publicUrl })
            .eq("id", worldId);

        if (error) {
            console.error("[cover-image] DB 업데이트 실패:", error.message);
        } else {
            console.log("[cover-image] DB 업데이트 완료 — worldId:", worldId);
        }
    } catch (err) {
        console.error("[cover-image] 업로드/DB 에러:", err);
    }
}
