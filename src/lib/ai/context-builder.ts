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
import type { Entity, Location, Relationship, Turn } from "@/types/world";

/**
 * 턴 처리를 위한 컨텍스트 조립
 * 월드 정보 + 현재 위치 + NPC + 관계 + 벡터 검색 + 최근 턴 + 세션 요약
 */
export async function buildContext(
    worldId: string,
    userInput: string
): Promise<string> {
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

    // 컨텍스트 텍스트 조립
    return assembleContextText({
        world,
        currentLocation,
        protagonist,
        npcsAtLocation,
        relationships,
        recentTurns,
        relevantMemories,
        latestSummary,
        locations,
    });
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
