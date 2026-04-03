import { createServerClient } from "@/lib/db/supabase-server";
import { getWorldEntities } from "@/lib/db/entities";
import { updateEntity } from "@/lib/db/entities";
import { getWorldLocations } from "@/lib/db/locations";
import { updateLocation } from "@/lib/db/locations";
import { createEvent } from "@/lib/db/events";
import {
    createEmbeddingVector,
    storeMemory,
} from "@/lib/memory/embeddings";
import type { GeneratedTurnResponse } from "@/lib/ai/schemas";

/**
 * AI 응답에서 상태 변경을 추출하고 DB에 반영
 */
export async function extractAndApplyState(
    worldId: string,
    turnNumber: number,
    aiResponse: GeneratedTurnResponse
): Promise<void> {
    const [entities, locations] = await Promise.all([
        getWorldEntities(worldId),
        getWorldLocations(worldId),
    ]);

    const protagonist = entities.find(
        (e) => e.entity_type === "protagonist"
    );
    if (!protagonist) throw new Error("주인공을 찾을 수 없습니다");

    // 아이템 변경 처리
    if (
        aiResponse.items_gained.length > 0 ||
        aiResponse.items_lost.length > 0
    ) {
        const currentInventory = Array.isArray(protagonist.inventory)
            ? [...protagonist.inventory]
            : [];

        // 아이템 추가
        for (const item of aiResponse.items_gained) {
            currentInventory.push({ name: item });
        }

        // 아이템 제거
        const lostNames = new Set(aiResponse.items_lost);
        const updatedInventory = currentInventory.filter((item) => {
            if (typeof item === "object" && item !== null && "name" in item) {
                return !lostNames.has((item as { name: string }).name);
            }
            return true;
        });

        await updateEntity(protagonist.id, { inventory: updatedInventory });
    }

    // 위치 변경 처리
    if (aiResponse.location_changed) {
        const newLocation = locations.find(
            (l) => l.name === aiResponse.location_changed
        );

        if (newLocation) {
            // 주인공 위치 업데이트
            await updateEntity(protagonist.id, {
                location_id: newLocation.id,
            });

            // 장소 발견 표시
            if (!newLocation.discovered) {
                await updateLocation(newLocation.id, { discovered: true });
            }
        }
    }

    // 관계 변경 처리
    if (aiResponse.relationship_changes.length > 0) {
        const supabase = await createServerClient();

        for (const change of aiResponse.relationship_changes) {
            // NPC 찾기
            const npc = entities.find((e) => e.name === change.entity_name);
            if (!npc) continue;

            // 기존 관계 조회
            const { data: existingRel } = await supabase
                .from("relationships")
                .select("*")
                .eq("world_id", worldId)
                .or(
                    `and(entity_id.eq.${protagonist.id},target_entity_id.eq.${npc.id}),and(entity_id.eq.${npc.id},target_entity_id.eq.${protagonist.id})`
                )
                .limit(1)
                .single();

            if (existingRel) {
                // 관계 강도 업데이트 (범위 제한: -10 ~ 10)
                const newStrength = Math.max(
                    -10,
                    Math.min(10, existingRel.strength + change.strength_delta)
                );

                // history에 추가
                const history = Array.isArray(existingRel.history)
                    ? [...existingRel.history]
                    : [];
                history.push({
                    turn: turnNumber,
                    delta: change.strength_delta,
                    reason: change.reason,
                    timestamp: new Date().toISOString(),
                });

                await supabase
                    .from("relationships")
                    .update({
                        relationship_type: change.relationship_type,
                        strength: newStrength,
                        history,
                    })
                    .eq("id", existingRel.id);
            }
        }
    }

    // 이벤트 저장
    const event = await createEvent({
        world_id: worldId,
        description: aiResponse.event.description,
        importance: aiResponse.event.importance,
        entities_involved: aiResponse.event.participants,
    });

    // 중요 이벤트 → 임베딩 생성
    if (aiResponse.event.importance >= 5) {
        try {
            const embedding = await createEmbeddingVector(
                aiResponse.event.description
            );
            await storeMemory({
                worldId,
                content: aiResponse.event.description,
                contentType: "event",
                importance: aiResponse.event.importance,
                turnNumber,
                embedding,
            });
        } catch {
            // 임베딩 실패 시 무시 — 게임 진행에 영향 없음
        }
    }

    // 분기점 저장 (importance >= 7)
    if (aiResponse.event.importance >= 7) {
        const supabase = await createServerClient();
        await supabase.from("turning_points").insert({
            world_id: worldId,
            turn_id: event.id,
            player_choice: aiResponse.narration.slice(0, 200),
            alternatives: aiResponse.choices.map((c) => c.text),
            consequences: aiResponse.event.description,
        });
    }
}
