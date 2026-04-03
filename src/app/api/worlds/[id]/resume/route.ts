import { createServerClient } from "@/lib/db/supabase-server";
import { getWorld } from "@/lib/db/worlds";
import { getLatestTurns } from "@/lib/db/turns";
import { getWorldLocations } from "@/lib/db/locations";
import { getWorldEntities } from "@/lib/db/entities";
import { callAI } from "@/lib/ai/client";
import { buildOpeningSceneMessages } from "@/lib/ai/prompts/opening-scene";
import { buildTimePassageMessages } from "@/lib/ai/prompts/time-passage";
import { turnResponseSchema, timePassageResponseSchema } from "@/lib/ai/schemas";
import type { TimePassageEvent } from "@/types/world";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: worldId } = await params;

        // 인증 확인
        const supabase = await createServerClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return Response.json(
                { error: "인증이 필요합니다" },
                { status: 401 }
            );
        }

        // 월드 소유권 확인
        const world = await getWorld(worldId);
        if (world.user_id !== user.id) {
            return Response.json(
                { error: "접근 권한이 없습니다" },
                { status: 403 }
            );
        }

        // 최신 턴 조회
        const turns = await getLatestTurns(worldId, 1);
        const lastTurn = turns[0] ?? null;

        // 현재 위치 + 엔티티 조회
        const [locations, entities] = await Promise.all([
            getWorldLocations(worldId),
            getWorldEntities(worldId),
        ]);

        // 주인공의 현재 위치
        const protagonist = entities.find(
            (e) => e.entity_type === "protagonist"
        );
        const currentLocation = protagonist?.location_id
            ? locations.find((l) => l.id === protagonist.location_id) ?? null
            : null;

        // 턴이 없으면 시작 장면 재생성
        if (!lastTurn) {
            try {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("plan")
                    .eq("id", user.id)
                    .single();
                const userPlan = profile?.plan ?? "free";

                const minimalSpec = {
                    name: world.name,
                    name_en: world.name,
                    genre: world.genre,
                    tone: world.world_spec.atmosphere,
                    description: world.world_spec.setting,
                    rules: world.world_spec.rules,
                    starting_location: {
                        name: currentLocation?.name ?? "시작 지점",
                        description: currentLocation?.description ?? "",
                        visual_anchor: currentLocation?.visual_anchor ?? "",
                        connected_to_names: [] as string[],
                    },
                    additional_locations: [],
                    protagonist: {
                        name: protagonist?.name ?? "모험가",
                        description: protagonist?.description ?? "",
                        inventory: [] as string[],
                        status: { health: "good", mood: "curious" },
                    },
                    npcs: [] as Array<{
                        name: string;
                        entity_type: "npc";
                        description: string;
                        personality: string;
                        location_name: string;
                        behavior_rules: {
                            core_drive: string;
                            personality_axes: { boldness: number; loyalty: number; curiosity: number; honesty: number };
                            goals: string[];
                            behavioral_triggers: Array<{ condition: string; action: string; weight: number }>;
                            speech_style: string;
                            knowledge: string[];
                            secrets: string[];
                        };
                    }>,
                    image_prompt: "",
                };

                const messages = buildOpeningSceneMessages(minimalSpec);
                const aiRaw = await callAI(messages, userPlan);
                const sceneParsed = turnResponseSchema.safeParse(
                    JSON.parse(aiRaw)
                );

                if (sceneParsed.success) {
                    return Response.json({
                        world,
                        lastTurn: null,
                        currentLocation,
                        regeneratedScene: sceneParsed.data,
                    });
                }
            } catch {
                // 재생성 실패 시 빈 상태로 반환
            }
        }

        // ─── 시간 경과 사건 생성 (1시간+ 부재 시) ───
        let timePassageEvents: TimePassageEvent[] = [];

        if (lastTurn) {
            const lastTurnTime = new Date(lastTurn.created_at).getTime();
            const now = Date.now();
            const hoursElapsed = (now - lastTurnTime) / (1000 * 60 * 60);

            if (hoursElapsed >= 1) {
                try {
                    const { data: profile } = await supabase
                        .from("profiles")
                        .select("plan")
                        .eq("id", user.id)
                        .single();
                    const userPlan = profile?.plan ?? "free";

                    // NPC 정보 조립
                    const npcs = entities
                        .filter((e) => e.entity_type === "npc" && e.is_alive)
                        .map((npc) => {
                            const npcLocation = locations.find((l) => l.id === npc.location_id);
                            return {
                                name: npc.name,
                                description: npc.description,
                                personality: npc.personality,
                                locationName: npcLocation?.name ?? "알 수 없음",
                                behaviorRules: {
                                    core_drive: npc.behavior_rules.core_drive,
                                    goals: npc.behavior_rules.goals,
                                    speech_style: npc.behavior_rules.speech_style,
                                },
                            };
                        });

                    // 최근 세션 요약
                    const { data: latestSummary } = await supabase
                        .from("session_summaries")
                        .select("summary")
                        .eq("world_id", worldId)
                        .order("to_turn", { ascending: false })
                        .limit(1)
                        .single();

                    const messages = buildTimePassageMessages({
                        worldName: world.name,
                        genre: world.genre,
                        worldRules: world.world_spec.rules,
                        hoursElapsed: Math.round(hoursElapsed),
                        locations: locations.map((l) => ({ name: l.name, description: l.description })),
                        npcs,
                        recentSummary: latestSummary?.summary ?? null,
                    });

                    const aiRaw = await callAI(messages, userPlan, { temperature: 0.8 });
                    const parsed = timePassageResponseSchema.safeParse(JSON.parse(aiRaw));

                    if (parsed.success && parsed.data.events.length > 0) {
                        // 사건을 importance 높은 순으로 최대 5개 선별
                        const sortedEvents = parsed.data.events
                            .sort((a, b) => b.importance - a.importance)
                            .slice(0, 5);

                        // DB에 사건 상태 반영
                        for (const event of sortedEvents) {
                            // NPC 위치 이동 반영
                            for (const move of event.state_changes.entity_moves) {
                                const entity = entities.find((e) => e.name === move.entity_name);
                                const targetLocation = locations.find((l) => l.name === move.to_location);
                                if (entity && targetLocation) {
                                    await supabase
                                        .from("entities")
                                        .update({ location_id: targetLocation.id })
                                        .eq("id", entity.id);
                                }
                            }

                            // 관계 변경 반영
                            for (const rc of event.state_changes.relationship_changes) {
                                const entity = entities.find((e) => e.name === rc.entity_name);
                                const target = entities.find((e) => e.name === rc.target_name);
                                if (entity && target) {
                                    const { data: rel } = await supabase
                                        .from("relationships")
                                        .select("*")
                                        .eq("world_id", worldId)
                                        .or(
                                            `and(entity_id.eq.${entity.id},target_entity_id.eq.${target.id}),and(entity_id.eq.${target.id},target_entity_id.eq.${entity.id})`
                                        )
                                        .limit(1)
                                        .single();

                                    if (rel) {
                                        const newStrength = Math.max(-10, Math.min(10, rel.strength + rc.delta));
                                        await supabase
                                            .from("relationships")
                                            .update({ strength: newStrength })
                                            .eq("id", rel.id);
                                    }
                                }
                            }

                            // 이벤트 DB 저장
                            const locationForEvent = locations.find((l) => l.name === event.location_name);
                            await supabase.from("events").insert({
                                world_id: worldId,
                                description: event.description,
                                importance: event.importance,
                                entities_involved: event.entities_involved
                                    .map((name) => entities.find((e) => e.name === name)?.id)
                                    .filter((id): id is string => id !== undefined),
                                location_id: locationForEvent?.id ?? null,
                            });
                        }

                        // time_passage_logs 기록
                        await supabase.from("time_passage_logs").insert({
                            world_id: worldId,
                            from_time: world.world_time,
                            to_time: world.world_time,
                            changes_applied: {
                                hours_elapsed: Math.round(hoursElapsed),
                                events_generated: sortedEvents.length,
                                summary: parsed.data.summary,
                            },
                        });

                        // 클라이언트용 이벤트 변환
                        timePassageEvents = sortedEvents.map((e) => ({
                            time: e.time_description,
                            description: e.description,
                            importance: e.importance,
                            entitiesInvolved: e.entities_involved,
                        }));
                    }
                } catch (err) {
                    console.error("[resume] 시간 경과 사건 생성 실패:", err);
                    // 실패해도 정상 resume 진행
                }
            }
        }

        return Response.json({
            world,
            lastTurn,
            currentLocation,
            timePassageEvents: timePassageEvents.length > 0 ? timePassageEvents : undefined,
        });
    } catch (error) {
        console.error("세션 복원 오류:", error);
        return Response.json(
            { error: "세션 복원 중 오류가 발생했습니다" },
            { status: 500 }
        );
    }
}
