import { z } from "zod";
import { createServerClient } from "@/lib/db/supabase-server";
import { callAI } from "@/lib/ai/client";
import { buildContext } from "@/lib/ai/context-builder";
import { buildNarratorMessages } from "@/lib/ai/prompts/narrator";
import { extractAndApplyState } from "@/lib/ai/state-extractor";
import { turnResponseSchema } from "@/lib/ai/schemas";
import { createTurn } from "@/lib/db/turns";
import { updateWorld, getWorld } from "@/lib/db/worlds";
import type { TurnResponse, Mood } from "@/types/world";

const turnRequestSchema = z.object({
    input: z.string().min(1).max(500),
    choiceId: z.number().optional(),
});

export async function POST(
    request: Request,
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

        // 입력 검증
        const body = await request.json();
        const parsed = turnRequestSchema.safeParse(body);
        if (!parsed.success) {
            return Response.json(
                { error: "잘못된 입력입니다" },
                { status: 400 }
            );
        }
        const { input } = parsed.data;

        // 월드 소유권 확인
        const world = await getWorld(worldId);
        if (world.user_id !== user.id) {
            return Response.json(
                { error: "접근 권한이 없습니다" },
                { status: 403 }
            );
        }

        // 사용자 플랜 조회
        const { data: profile } = await supabase
            .from("profiles")
            .select("plan")
            .eq("id", user.id)
            .single();
        const userPlan = profile?.plan ?? "free";

        // 컨텍스트 조립
        const contextText = await buildContext(worldId, input);

        // 내레이터 AI 호출
        const messages = buildNarratorMessages(contextText, input);
        const aiRaw = await callAI(messages, userPlan, { temperature: 0.8 });

        // AI 응답 파싱 및 검증
        let aiJson: unknown;
        try {
            aiJson = JSON.parse(aiRaw);
        } catch {
            return Response.json(
                { error: "AI 응답 JSON 파싱 실패" },
                { status: 502 }
            );
        }
        const aiParsed = turnResponseSchema.safeParse(aiJson);
        if (!aiParsed.success) {
            return Response.json(
                { error: "AI 응답 형식 오류" },
                { status: 502 }
            );
        }
        const aiResponse = aiParsed.data;

        const newTurnNumber = world.turn_count + 1;

        // 상태 변경 반영 (아이템, 위치, 관계, 이벤트)
        await extractAndApplyState(worldId, newTurnNumber, aiResponse);

        // DB 타입으로 변환
        const dbTurnResponse: TurnResponse = {
            narration: aiResponse.narration,
            choices: aiResponse.choices.map((c) => ({
                id: String(c.id),
                text: c.text,
                tone: "cautious" as const,
                risk_level: 1,
            })),
            mood: aiResponse.mood as Mood,
            items_gained: aiResponse.items_gained,
            items_lost: aiResponse.items_lost,
            location_changes: [],
            relationship_changes: aiResponse.relationship_changes.map(
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
                    description: aiResponse.event.description,
                    importance: aiResponse.event.importance,
                    entities_involved: aiResponse.event.participants,
                    location_id: "",
                },
            ],
            generate_image: aiResponse.generate_image,
            image_prompt: aiResponse.image_prompt,
        };

        // 턴 저장
        const turn = await createTurn({
            world_id: worldId,
            turn_number: newTurnNumber,
            user_input: input,
            ai_response: dbTurnResponse,
        });

        // turn_count 증가
        await updateWorld(worldId, { turn_count: newTurnNumber });

        // 10턴마다 세션 요약 비동기 생성 (await 안 함)
        if (newTurnNumber % 10 === 0) {
            generateSessionSummary(worldId, newTurnNumber).catch(() => {
                // 요약 실패는 게임 진행에 영향 없음
            });
        }

        return Response.json({ turn, response: dbTurnResponse });
    } catch (error) {
        console.error("턴 처리 오류:", error);
        return Response.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "턴 처리 중 오류가 발생했습니다",
            },
            { status: 500 }
        );
    }
}

/** 세션 요약 비동기 생성 (Groq 무료 티어 사용) */
async function generateSessionSummary(
    worldId: string,
    currentTurn: number
): Promise<void> {
    const supabase = await createServerClient();

    // 최근 10턴 조회
    const { data: turns } = await supabase
        .from("turns")
        .select("turn_number, user_input, ai_response")
        .eq("world_id", worldId)
        .order("turn_number", { ascending: false })
        .limit(10);

    if (!turns || turns.length === 0) return;

    const turnTexts = turns
        .reverse()
        .map(
            (t: { turn_number: number; user_input: string; ai_response: TurnResponse }) =>
                `[턴 ${t.turn_number}] 입력: ${t.user_input} → ${t.ai_response.narration}`
        )
        .join("\n");

    // Groq (무료) 로 요약 생성
    const summaryResponse = await callAI(
        [
            {
                role: "system",
                content:
                    '당신은 이야기 요약가입니다. 제공된 턴들을 한국어 3~5문장으로 요약하고, 마지막에 클리프행어(다음에 무슨 일이 일어날지 궁금하게 만드는 한 줄)를 추가하세요. JSON으로 출력: { "summary": "...", "cliffhanger": "..." }',
            },
            { role: "user", content: turnTexts },
        ],
        "free",
        { temperature: 0.5 }
    );

    const parsed = JSON.parse(summaryResponse);
    const fromTurn = currentTurn - turns.length + 1;

    await supabase.from("session_summaries").insert({
        world_id: worldId,
        from_turn: fromTurn,
        to_turn: currentTurn,
        summary: parsed.summary,
        cliffhanger: parsed.cliffhanger ?? null,
    });
}
