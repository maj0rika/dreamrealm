import { getWorld } from "@/lib/db/worlds";
import { getWorldLocations } from "@/lib/db/locations";
import { getWorldEntities } from "@/lib/db/entities";
import { getEntityRelationships } from "@/lib/db/relationships";
import { getLatestTurns } from "@/lib/db/turns";
import { createServerClient } from "@/lib/db/supabase-server";
import {
    createEmbeddingVector,
    searchSimilarMemories,
} from "@/lib/memory/embeddings";
import { getFlashbackEvents } from "@/lib/db/events";
import type { Entity, Location, Relationship, Turn, FlashbackInfo, StoryDirection } from "@/types/world";

export interface ContextResult {
    contextText: string;
    flashback: FlashbackInfo | null;
}

/**
 * 턴 처리를 위한 컨텍스트 조립
 * 월드 정보 + 현재 위치 + NPC + 관계 + 벡터 검색 + 최근 턴 + 세션 요약 + 플래시백
 */
export async function buildContext(
    worldId: string,
    userInput: string
): Promise<ContextResult> {
    const supabase = await createServerClient();

    // 병렬로 데이터 조회
    const [world, locations, entities, recentTurns] = await Promise.all([
        getWorld(worldId),
        getWorldLocations(worldId),
        getWorldEntities(worldId),
        getLatestTurns(worldId, 6),
    ]);

    // 주인공 찾기
    const protagonist = entities.find(
        (e) => e.entity_type === "protagonist"
    );
    if (!protagonist) throw new Error("주인공을 찾을 수 없습니다");

    // 현재 위치
    const currentLocation = locations.find(
        (l) => l.id === protagonist.location_id
    );

    // 현재 위치의 NPC들
    const npcsAtLocation = entities.filter(
        (e) =>
            e.entity_type === "npc" &&
            e.location_id === protagonist.location_id &&
            e.is_alive
    );

    // 주인공과 NPC 관계 조회
    const relationships = await getEntityRelationships(protagonist.id);

    // 벡터 검색 — 관련 기억 Top-5
    let relevantMemories: string[] = [];
    try {
        const queryEmbedding = await createEmbeddingVector(userInput);
        const memories = await searchSimilarMemories(
            worldId,
            queryEmbedding,
            5
        );
        relevantMemories = memories.map((m) => m.content);
    } catch {
        // 임베딩 실패 시 무시 (메모리가 없는 초기 상태 등)
    }

    // 최신 세션 요약 조회
    const { data: latestSummary } = await supabase
        .from("session_summaries")
        .select("summary, cliffhanger")
        .eq("world_id", worldId)
        .order("to_turn", { ascending: false })
        .limit(1)
        .single();

    // 플래시백 확인: 현재 위치에 미표시 중요 이벤트가 있는지
    let flashback: FlashbackInfo | null = null;
    if (currentLocation) {
        try {
            const flashbackEvents = await getFlashbackEvents(worldId, currentLocation.id);
            if (flashbackEvents.length > 0) {
                const fbEvent = flashbackEvents[0];
                // 해당 이벤트의 턴 이미지 조회
                let fbImageUrl: string | null = null;
                if (fbEvent.turn_id) {
                    const { data: fbTurn } = await supabase
                        .from("turns")
                        .select("image_url")
                        .eq("id", fbEvent.turn_id)
                        .single();
                    fbImageUrl = fbTurn?.image_url ?? null;
                }
                flashback = {
                    eventId: fbEvent.id,
                    description: fbEvent.description,
                    importance: fbEvent.importance,
                    imageUrl: fbImageUrl,
                };
            }
        } catch {
            // 플래시백 조회 실패 시 무시
        }
    }

    // 컨텍스트 텍스트 조립
    const contextText = assembleContextText({
        world,
        currentLocation,
        protagonist,
        npcsAtLocation,
        relationships,
        recentTurns,
        relevantMemories,
        latestSummary,
        locations,
        flashback,
        storyDirection: world.story_direction || null,
    });

    return { contextText, flashback };
}

function assembleContextText(params: {
    world: Awaited<ReturnType<typeof getWorld>>;
    currentLocation: Location | undefined;
    protagonist: Entity;
    npcsAtLocation: Entity[];
    relationships: Relationship[];
    recentTurns: Turn[];
    relevantMemories: string[];
    latestSummary: { summary: string; cliffhanger: string | null } | null;
    locations: Location[];
    flashback: FlashbackInfo | null;
    storyDirection: StoryDirection | null;
}): string {
    const {
        world,
        currentLocation,
        protagonist,
        npcsAtLocation,
        relationships,
        recentTurns,
        relevantMemories,
        latestSummary,
        locations,
        flashback,
        storyDirection,
    } = params;

    const sections: string[] = [];

    // 월드 정보
    sections.push(`## 월드: ${world.name}
장르: ${world.genre}
분위기: ${world.world_spec.atmosphere}
세계 규칙: ${world.world_spec.rules.join(", ")}
현재 턴: ${world.turn_count}`);

    // 현재 위치
    if (currentLocation) {
        const connectedNames = currentLocation.connected_to
            .map((id) => locations.find((l) => l.id === id)?.name)
            .filter(Boolean);

        sections.push(`## 현재 위치: ${currentLocation.name}
${currentLocation.description}
연결된 장소: ${connectedNames.join(", ")}`);
    }

    // 주인공
    const inventoryStr = Array.isArray(protagonist.inventory)
        ? protagonist.inventory
              .map((item) => {
                  if (typeof item === "object" && item !== null && "name" in item) {
                      return (item as { name: string }).name;
                  }
                  return String(item);
              })
              .join(", ")
        : "없음";

    sections.push(`## 주인공: ${protagonist.name}
${protagonist.description}
소지품: ${inventoryStr}`);

    // NPC 정보 (behavior_rules 포함)
    if (npcsAtLocation.length > 0) {
        const npcDescriptions = npcsAtLocation.map((npc) => {
            const rel = relationships.find(
                (r) =>
                    r.target_entity_id === npc.id || r.entity_id === npc.id
            );
            const strength = rel?.strength ?? 0;
            const relType = rel?.relationship_type ?? "stranger";

            const rules = npc.behavior_rules;
            return `### ${npc.name} (${relType}, 호감도: ${strength})
${npc.description}
성격: ${npc.personality}
말투: ${rules.speech_style}
핵심 동기: ${rules.core_drive}
성격축: 대담함=${rules.personality_axes.boldness}, 충성=${rules.personality_axes.loyalty}, 호기심=${rules.personality_axes.curiosity}, 정직=${rules.personality_axes.honesty}
목표: ${rules.goals.join(", ")}
알고 있는 것: ${rules.knowledge.join(", ")}
비밀: ${rules.secrets.join(", ")}`;
        });

        sections.push(`## 이 장소의 NPC\n${npcDescriptions.join("\n\n")}`);
    }

    // 관련 기억
    if (relevantMemories.length > 0) {
        sections.push(
            `## 관련 기억\n${relevantMemories.map((m) => `- ${m}`).join("\n")}`
        );
    }

    // 세션 요약
    if (latestSummary) {
        sections.push(
            `## 이전 세션 요약\n${latestSummary.summary}${
                latestSummary.cliffhanger
                    ? `\n클리프행어: ${latestSummary.cliffhanger}`
                    : ""
            }`
        );
    }

    // 스토리 방향 (스토리 작가의 지시)
    if (storyDirection && storyDirection.current_act) {
        const directionParts = [`## 스토리 방향 (내레이터 참고용 — 플레이어에게 직접 노출하지 마)
현재 막: ${storyDirection.current_act} | 긴장도: ${storyDirection.tension_level}`];

        if (storyDirection.next_beats.length > 0) {
            directionParts.push(`다음 전개: ${storyDirection.next_beats.join(", ")}`);
        }
        if (storyDirection.foreshadowing.length > 0) {
            directionParts.push(`복선 (자연스럽게 삽입): ${storyDirection.foreshadowing.join(", ")}`);
        }
        if (storyDirection.avoid.length > 0) {
            directionParts.push(`금지 (절대 하지 마): ${storyDirection.avoid.join(", ")}`);
        }
        if (storyDirection.current_act === "절정" || storyDirection.current_act === "결말") {
            directionParts.push(`엔딩 윤곽: ${storyDirection.ending_outline}`);
            directionParts.push(`[중요] 선택지에 "이야기를 마무리한다" 계열 옵션을 자연스럽게 포함해줘. 강제하지 말고 하나의 선택지로.`);
        }

        sections.push(directionParts.join("\n"));
    }

    // 플래시백 (이 장소의 과거 중요 이벤트 — AI에게 회상 서술 유도)
    if (flashback) {
        sections.push(`## 플래시백 (이 장소에서 과거에 일어난 일)
"${flashback.description}"
→ 서술 시작 부분에 "문득 기억이 떠오른다..." 또는 "이곳에 서니 예전 일이 떠오른다..." 식으로 자연스럽게 회상을 포함해줘.
한두 문장이면 충분해. 회상 후 현재 장면으로 자연스럽게 돌아와.`);
    }

    // 최근 턴
    if (recentTurns.length > 0) {
        const turnHistory = recentTurns.map((t) => {
            const input =
                t.user_input === "[세계 시작]" ? "(세계 진입)" : t.user_input;
            return `[턴 ${t.turn_number}] 플레이어: ${input}\n내레이터: ${t.ai_response.narration}`;
        });
        sections.push(`## 최근 대화\n${turnHistory.join("\n\n")}`);
    }

    return sections.join("\n\n");
}
