import { z } from "zod";
import { createServerClient } from "@/lib/db/supabase-server";
import { callAI } from "@/lib/ai/client";
import { buildContext } from "@/lib/ai/context-builder";
import { buildNarratorMessages } from "@/lib/ai/prompts/narrator";
import { buildStoryDirectionUpdateMessages } from "@/lib/ai/prompts/story-director";
import { extractAndApplyState } from "@/lib/ai/state-extractor";
import { updateEvent } from "@/lib/db/events";
import { turnResponseSchema, storyDirectionSchema } from "@/lib/ai/schemas";
import type { GeneratedTurnResponse } from "@/lib/ai/schemas";
import { createTurn } from "@/lib/db/turns";
import { updateWorld, getWorld } from "@/lib/db/worlds";
import { getWorldLocations } from "@/lib/db/locations";
import { getWorldEntities } from "@/lib/db/entities";
import { generateImage } from "@/lib/ai/image-generator";
import { uploadImageFromUrl } from "@/lib/storage/upload";
import { createEmbeddingVector, storeMemory } from "@/lib/memory/embeddings";
import type { TurnResponse, Mood, StoryDirection } from "@/types/world";
import type { Plan } from "@/types/user";

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

        // 컨텍스트 조립 (플래시백 정보 포함)
        const { contextText, flashback } = await buildContext(worldId, input);

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
            console.error("[turn] 스키마 검증 실패:", JSON.stringify(aiParsed.error.flatten()));
            console.error("[turn] AI 원본 응답:", JSON.stringify(aiJson).slice(0, 500));
            return Response.json(
                { error: "AI 응답 형식 오류", details: aiParsed.error.flatten() },
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

        // ─── 엔딩 감지: "결말" 막 + 중요 이벤트(≥7) = 클라이맥스 완료 ───
        const isEndingTurn =
            world.story_direction?.current_act === "결말" &&
            aiResponse.event.importance >= 7;

        if (isEndingTurn) {
            // completed_at 기록
            await supabase
                .from("worlds")
                .update({ completed_at: new Date().toISOString() })
                .eq("id", worldId);
            console.log("[ending] 월드 완결 처리:", worldId);
        }

        // 이미지 생성: 3층 프롬프트 (앵커 + 가변 + 아트스타일) + 장소 시드 고정
        console.log("[turn] generate_image:", aiResponse.generate_image, "location_changed:", aiResponse.location_changed, "image_prompt:", aiResponse.image_prompt?.slice(0, 50));
        if (aiResponse.generate_image && aiResponse.image_prompt) {
            // 주인공 현재 위치의 시각 앵커 + 시드 조회
            const [locations, entities] = await Promise.all([
                getWorldLocations(worldId),
                getWorldEntities(worldId),
            ]);
            const protagonist = entities.find((e) => e.entity_type === "protagonist");
            const currentLocation = protagonist?.location_id
                ? locations.find((l) => l.id === protagonist.location_id)
                : null;

            // Layer 1: 시각 앵커 (고정) + Layer 2: 가변 요소 (AI 생성) + Layer 3: 아트 스타일 (고정)
            const layers = [
                currentLocation?.visual_anchor,
                aiResponse.image_prompt,
                world.art_style,
            ].filter(Boolean).join(", ");

            generateAndSaveTurnImage(
                worldId,
                newTurnNumber,
                layers,
                currentLocation?.image_seed ?? undefined
            ).catch((err) => console.error("[turn-image] 생성 실패:", err));
        }

        // 10턴마다 세션 요약 비동기 생성 (await 안 함)
        if (newTurnNumber % 10 === 0) {
            generateSessionSummary(worldId, newTurnNumber).catch(() => {
                // 요약 실패는 게임 진행에 영향 없음
            });
        }

        // ─── 스토리 작가 재조정 (비동기 fire-and-forget) ───
        // 트리거: importance ≥ 5 OR 10턴 요약 시점
        const shouldUpdateDirection =
            aiResponse.event.importance >= 5 || newTurnNumber % 10 === 0;

        if (shouldUpdateDirection && world.story_direction?.current_act) {
            updateStoryDirection(
                worldId,
                world.story_direction!,
                aiResponse,
                input,
                newTurnNumber,
                userPlan
            ).catch((err) => console.error("[story-director] 재조정 실패:", err));
        }

        // 플래시백 이벤트 마킹 (중복 방지)
        if (flashback) {
            updateEvent(flashback.eventId, { flashback_shown: true }).catch(() => {});
        }

        return Response.json({
            turn,
            response: dbTurnResponse,
            flashback: flashback ?? undefined,
            locationChanged: aiResponse.location_changed ?? undefined,
            isEnding: isEndingTurn || undefined,
        });
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

/** 스토리 작가 재조정 — 비동기 */
async function updateStoryDirection(
    worldId: string,
    _currentDirection: StoryDirection,
    aiResponse: GeneratedTurnResponse,
    playerAction: string,
    currentTurn: number,
    userPlan: Plan
): Promise<void> {
    console.log("[story-director] 재조정 시작 — turn:", currentTurn, "importance:", aiResponse.event.importance);

    const supabase = await createServerClient();

    // C1: 레이스 컨디션 방지 — DB에서 최신 story_direction 재조회
    const { data: freshWorld } = await supabase
        .from("worlds")
        .select("story_direction")
        .eq("id", worldId)
        .single();

    const latestDirection = freshWorld?.story_direction as StoryDirection;
    if (!latestDirection?.current_act) return;

    // 최근 이벤트 조회 (최근 5개)
    const { data: recentEvents } = await supabase
        .from("events")
        .select("description, importance")
        .eq("world_id", worldId)
        .order("created_at", { ascending: false })
        .limit(5);

    // 최근 플레이어 행동 조회 (최근 5턴)
    const { data: recentTurns } = await supabase
        .from("turns")
        .select("user_input")
        .eq("world_id", worldId)
        .order("turn_number", { ascending: false })
        .limit(5);

    // 최신 세션 요약
    const { data: latestSummary } = await supabase
        .from("session_summaries")
        .select("summary")
        .eq("world_id", worldId)
        .order("to_turn", { ascending: false })
        .limit(1)
        .single();

    const messages = buildStoryDirectionUpdateMessages(
        latestDirection,
        (recentEvents ?? []).map((e: { description: string; importance: number }) => `[중요도${e.importance}] ${e.description}`),
        (recentTurns ?? []).map((t: { user_input: string }) => t.user_input),
        currentTurn,
        latestSummary?.summary ?? null
    );

    // W6: 내부 AI 호출은 외국어 보정 재시도 생략
    const raw = await callAI(messages, userPlan, { temperature: 0.6, skipKoreanCorrection: true });

    // C4: JSON.parse를 try-catch로 감싸 파싱 오류 방어
    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(raw);
    } catch {
        console.error("[story-director] JSON 파싱 실패:", raw.slice(0, 200));
        return;
    }
    const parsed = storyDirectionSchema.safeParse(parsedJson);

    if (!parsed.success) {
        console.warn("[story-director] 스키마 검증 실패:", parsed.error.flatten());
        return;
    }

    const newDirection = parsed.data;

    // AC5: 해결된 thread를 memory_embeddings에 아카이빙
    if (newDirection.resolved_threads && newDirection.resolved_threads.length > 0) {
        // W2: 성공적으로 아카이빙된 것만 추적하여 제거
        const archivedThreads: string[] = [];
        for (const thread of newDirection.resolved_threads) {
            try {
                const embedding = await createEmbeddingVector(thread);
                await storeMemory({
                    worldId,
                    content: `[해결된 서사] ${thread}`,
                    contentType: "resolved_thread",
                    importance: 6,
                    turnNumber: currentTurn,
                    embedding,
                });
                archivedThreads.push(thread);
                console.log("[story-director] thread 아카이빙:", thread.slice(0, 30));
            } catch {
                // 아카이빙 실패해도 계속 진행
            }
        }
        // 성공적으로 아카이빙된 것만 제거
        newDirection.resolved_threads = newDirection.resolved_threads.filter(
            (t) => !archivedThreads.includes(t)
        );
    }

    // story_direction 업데이트
    await supabase
        .from("worlds")
        .update({ story_direction: newDirection })
        .eq("id", worldId);

    console.log("[story-director] 재조정 완료 — act:", newDirection.current_act, "tension:", newDirection.tension_level);
}

/** 턴 이미지 비동기 생성 → Storage 업로드 → DB 업데이트 */
async function generateAndSaveTurnImage(
    worldId: string,
    turnNumber: number,
    prompt: string,
    seed?: number
): Promise<void> {
    console.log("[turn-image] 생성 시작 — turn:", turnNumber, "seed:", seed);
    const imageUrl = await generateImage(prompt, seed);
    if (!imageUrl) {
        console.error("[turn-image] 이미지 생성 실패 — null");
        return;
    }
    console.log("[turn-image] 업로드 시작...");

    const publicUrl = await uploadImageFromUrl(
        imageUrl,
        `${worldId}/turns/${turnNumber}.webp`
    );
    console.log("[turn-image] 업로드 완료:", publicUrl.slice(0, 80));

    const supabase = await createServerClient();
    const { error } = await supabase
        .from("turns")
        .update({ image_url: publicUrl })
        .eq("world_id", worldId)
        .eq("turn_number", turnNumber);

    if (error) {
        console.error("[turn-image] DB 업데이트 실패:", error.message);
    } else {
        console.log("[turn-image] DB 업데이트 완료 — turn:", turnNumber);
    }
}
