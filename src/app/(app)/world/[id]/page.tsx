"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { NarrationDisplay } from "@/components/explore/NarrationDisplay";
import { ChoiceButtons } from "@/components/explore/ChoiceButtons";
import { FreeInput } from "@/components/explore/FreeInput";
import { LocationBadge } from "@/components/explore/LocationBadge";
import type { World, Turn, TurnResponse, Choice, Mood, Location } from "@/types/world";

// 분위기별 그라데이션
const MOOD_GRADIENTS: Record<Mood, string> = {
    tense: "from-red-950/80 to-zinc-950",
    calm: "from-emerald-950/60 to-zinc-950",
    mysterious: "from-purple-950/80 to-zinc-950",
    joyful: "from-amber-950/60 to-zinc-950",
    melancholic: "from-blue-950/80 to-zinc-950",
    fearful: "from-red-950/90 to-zinc-950",
    romantic: "from-pink-950/70 to-zinc-950",
    comedic: "from-orange-950/60 to-zinc-950",
    epic: "from-indigo-950/80 to-zinc-950",
    neutral: "from-slate-900/60 to-zinc-950",
};

interface ResumeData {
    world: World;
    lastTurn: Turn | null;
    currentLocation: Location | null;
}

interface TurnApiResponse {
    turn: Turn;
    response: TurnResponse;
}

export default function WorldExplorePage() {
    const { id } = useParams<{ id: string }>();

    const [, setWorld] = useState<World | null>(null);
    const [narration, setNarration] = useState("");
    const [choices, setChoices] = useState<Choice[]>([]);
    const [mood, setMood] = useState<Mood>("neutral");
    const [locationName, setLocationName] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [typingDone, setTypingDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 세션 복원
    useEffect(() => {
        async function resume() {
            const res = await fetch(`/api/worlds/${id}/resume`);
            if (!res.ok) {
                setError("세계 데이터를 불러오지 못했습니다.");
                setLoading(false);
                return;
            }

            const data: ResumeData = await res.json();
            setWorld(data.world);

            if (data.currentLocation) {
                setLocationName(data.currentLocation.name);
            }

            if (data.lastTurn) {
                const resp = data.lastTurn.ai_response;
                setNarration(resp.narration);
                setChoices(resp.choices);
                setMood(resp.mood);
                if (data.lastTurn.image_url) {
                    setImageUrl(data.lastTurn.image_url);
                }
            }

            setLoading(false);
        }

        resume();
    }, [id]);

    // 턴 응답 처리
    function applyTurnResponse(response: TurnResponse, turn: Turn) {
        setNarration(response.narration);
        setChoices(response.choices);
        setMood(response.mood);
        setTypingDone(false);
        if (turn.image_url) {
            setImageUrl(turn.image_url);
        }
    }

    // 턴 전송
    async function sendTurn(input: string) {
        setProcessing(true);
        setTypingDone(false);
        setError(null);

        const res = await fetch(`/api/worlds/${id}/turn`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input }),
        });

        if (res.ok) {
            const data: TurnApiResponse = await res.json();
            applyTurnResponse(data.response, data.turn);
        } else {
            setError("응답을 생성하지 못했습니다. 다시 시도해 주세요.");
        }

        setProcessing(false);
    }

    function handleChoiceSelect(choice: Choice) {
        sendTurn(choice.text);
    }

    function handleFreeInput(text: string) {
        sendTurn(text);
    }

    const handleTypingComplete = useCallback(() => {
        setTypingDone(true);
    }, []);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#08080d]">
                <div className="flex flex-col items-center gap-3">
                    <div className="size-8 animate-spin rounded-full border-2 border-[#7c6aff] border-t-transparent" />
                    <p className="text-sm text-zinc-500">세계에 접속 중...</p>
                </div>
            </div>
        );
    }

    if (error && !narration) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#08080d]">
                <p className="text-sm text-red-400">{error}</p>
            </div>
        );
    }

    const gradient = MOOD_GRADIENTS[mood];
    const inputDisabled = processing || !typingDone;

    return (
        <div className="flex min-h-screen flex-col bg-[#08080d]">
            {/* 상단: 장면 이미지 or 분위기 그라데이션 + 위치 배지 */}
            <div className="relative h-48 shrink-0 overflow-hidden md:h-56">
                {imageUrl ? (
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${imageUrl})` }}
                    />
                ) : (
                    <div
                        className={`absolute inset-0 bg-gradient-to-b ${gradient}`}
                    />
                )}
                {/* 하단 페이드 */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#08080d] to-transparent" />
                {/* 위치 배지 */}
                {locationName && <LocationBadge locationName={locationName} />}
            </div>

            {/* 중앙: 서술 */}
            <div className="flex-1">
                <div className="mx-auto max-w-2xl">
                    {narration && (
                        <NarrationDisplay
                            key={narration}
                            text={narration}
                            onComplete={handleTypingComplete}
                        />
                    )}
                </div>
            </div>

            {/* 하단: 선택지 + 자유 입력 */}
            <div className="sticky bottom-0 mx-auto w-full max-w-2xl pb-6">
                {/* 에러 표시 */}
                {error && narration && (
                    <p className="mb-3 text-center text-sm text-red-400">{error}</p>
                )}

                {/* 처리 중 표시 */}
                {processing && (
                    <div className="mb-3 flex items-center justify-center gap-2 text-sm text-zinc-500">
                        <div className="size-4 animate-spin rounded-full border-2 border-[#7c6aff] border-t-transparent" />
                        <span>생각하는 중...</span>
                    </div>
                )}

                {/* 선택지 */}
                {choices.length > 0 && (
                    <div className="mb-3">
                        <ChoiceButtons
                            choices={choices}
                            onSelect={handleChoiceSelect}
                            disabled={inputDisabled}
                        />
                    </div>
                )}

                {/* 자유 입력 */}
                <FreeInput
                    onSubmit={handleFreeInput}
                    disabled={inputDisabled}
                />
            </div>
        </div>
    );
}
