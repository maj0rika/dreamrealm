import { createServerClient } from "@/lib/db/supabase";
import { getWorld } from "@/lib/db/worlds";
import { getLatestTurns } from "@/lib/db/turns";
import { getWorldLocations } from "@/lib/db/locations";
import { getWorldEntities } from "@/lib/db/entities";
import { callAI } from "@/lib/ai/client";
import { buildOpeningSceneMessages } from "@/lib/ai/prompts/opening-scene";
import { turnResponseSchema } from "@/lib/ai/schemas";

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
            (e) => (e.entity_type as string) === "protagonist"
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

                // 월드 스펙에서 재생성을 위한 최소 정보 구성
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

        return Response.json({
            world,
            lastTurn,
            currentLocation,
        });
    } catch (error) {
        console.error("세션 복원 오류:", error);
        return Response.json(
            { error: "세션 복원 중 오류가 발생했습니다" },
            { status: 500 }
        );
    }
}
