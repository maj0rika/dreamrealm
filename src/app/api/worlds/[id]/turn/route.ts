import { createServerClient } from "@/lib/db/supabase";
import { getWorld } from "@/lib/db/worlds";
import { createTurn } from "@/lib/db/turns";
import type { TurnResponse } from "@/types/world";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createServerClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return Response.json({ error: "인증이 필요합니다" }, { status: 401 });
        }

        const world = await getWorld(id);
        if (world.user_id !== user.id) {
            return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });
        }

        const body = await request.json();
        const { input } = body as { input: string };

        if (!input || typeof input !== "string") {
            return Response.json({ error: "입력이 필요합니다" }, { status: 400 });
        }

        // TODO: Phase 6A에서 AI 파이프라인 연동
        // 현재는 턴 저장 구조만 준비 — AI 응답은 Phase 6A에서 구현
        const newTurnNumber = world.turn_count + 1;

        const placeholderResponse: TurnResponse = {
            narration: "AI 턴 처리가 아직 연결되지 않았습니다. Phase 6A 구현을 기다려주세요.",
            choices: [
                { id: "1", text: "계속 탐험한다", tone: "bold", risk_level: 1 },
                { id: "2", text: "주변을 살펴본다", tone: "cautious", risk_level: 1 },
                { id: "3", text: "이전 장소로 돌아간다", tone: "cautious", risk_level: 1 },
            ],
            mood: "neutral",
            items_gained: [],
            items_lost: [],
            location_changes: [],
            relationship_changes: [],
            events: [],
            generate_image: false,
        };

        const turn = await createTurn({
            world_id: id,
            turn_number: newTurnNumber,
            user_input: input,
            ai_response: placeholderResponse,
        });

        await supabase
            .from("worlds")
            .update({ turn_count: newTurnNumber })
            .eq("id", id);

        return Response.json({
            turn,
            response: placeholderResponse,
        });
    } catch (error) {
        console.error("턴 처리 오류:", error);
        return Response.json(
            { error: "턴 처리 중 오류가 발생했습니다" },
            { status: 500 }
        );
    }
}
