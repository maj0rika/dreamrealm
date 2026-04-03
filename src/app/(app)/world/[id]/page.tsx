"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { NarrationDisplay } from "@/components/explore/NarrationDisplay";
import { ChoiceButtons } from "@/components/explore/ChoiceButtons";
import { FreeInput } from "@/components/explore/FreeInput";
import { LocationBadge } from "@/components/explore/LocationBadge";
import type { World, Turn, TurnResponse, Choice, Mood, Location } from "@/types/world";

// 분위기별 그라데이션 (상단 헤더 오버레이)
const MOOD_GRADIENTS: Record<Mood, string> = {
    tense: "from-red-950/80 to-transparent",
    calm: "from-emerald-950/60 to-transparent",
    mysterious: "from-purple-950/80 to-transparent",
    joyful: "from-amber-950/60 to-transparent",
    melancholic: "from-blue-950/80 to-transparent",
    fearful: "from-red-950/90 to-transparent",
    romantic: "from-pink-950/70 to-transparent",
    comedic: "from-orange-950/60 to-transparent",
    epic: "from-indigo-950/80 to-transparent",
    neutral: "from-slate-900/60 to-transparent",
};

// 장르 기반 폴백 그라데이션 (이미지 없을 때 풍부한 배경)
const GENRE_GRADIENTS: Record<string, string> = {
    fantasy: "from-indigo-900/60 via-purple-950/40 to-emerald-950/30",
    "sci-fi": "from-cyan-900/50 via-blue-950/40 to-slate-950",
    horror: "from-red-950/60 via-gray-950 to-black",
    romance: "from-pink-900/40 via-rose-950/30 to-amber-950/20",
    "slice-of-life": "from-sky-900/40 via-teal-950/30 to-emerald-950/20",
    mystery: "from-slate-800/60 via-zinc-950 to-black",
    "post-apocalyptic": "from-orange-950/40 via-stone-950 to-black",
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

    const [world, setWorld] = useState<World | null>(null);
    const [narration, setNarration] = useState("");
    const [choices, setChoices] = useState<Choice[]>([]);
    const [mood, setMood] = useState<Mood>("neutral");
    const [locationName, setLocationName] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imagePolling, setImagePolling] = useState(false);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [typingDone, setTypingDone] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // 이미지 폴링 정리
    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    // 턴 이미지 비동기 폴링 (3초 간격, 최대 8회 = 24초)
    function pollTurnImage(turnNumber: number) {
        if (pollingRef.current) clearInterval(pollingRef.current);

        setImagePolling(true);
        let attempts = 0;
        const maxAttempts = 8;

        pollingRef.current = setInterval(async () => {
            attempts++;
            if (attempts > maxAttempts) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                pollingRef.current = null;
                setImagePolling(false);
                return;
            }

            try {
                const res = await fetch(
                    `/api/worlds/${id}/image?type=turn&turn=${turnNumber}`
                );
                if (!res.ok) return;

                const data: { imageUrl: string | null } = await res.json();
                if (data.imageUrl) {
                    setImageUrl(data.imageUrl);
                    setImageLoaded(false);
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    pollingRef.current = null;
                    setImagePolling(false);
                }
            } catch {
                // 네트워크 에러 무시
            }
        }, 3000);
    }

    // 턴 응답 처리
    function applyTurnResponse(response: TurnResponse, turn: Turn) {
        setNarration(response.narration);
        setChoices(response.choices);
        setMood(response.mood);
        setTypingDone(false);
        setImageLoaded(false);

        if (turn.image_url) {
            setImageUrl(turn.image_url);
        } else if (response.generate_image) {
            // 이미지가 아직 없지만 생성 중 — 폴링 시작
            pollTurnImage(turn.turn_number);
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

    const genre = world?.genre ?? "fantasy";
    const genreGradient = GENRE_GRADIENTS[genre] ?? GENRE_GRADIENTS.fantasy;
    const moodGradient = MOOD_GRADIENTS[mood];
    const inputDisabled = processing || !typingDone;

    return (
        <div className="flex h-screen flex-col bg-[#08080d]">
            {/* 상단 이미지 영역 (30~45vh) */}
            <div className="relative h-[30vh] shrink-0 overflow-hidden md:h-[45vh]">
                {/* 폴백: 장르 분위기 그라데이션 */}
                <div className={`absolute inset-0 bg-gradient-to-br ${genreGradient}`} />

                {/* 분위기 오버레이 */}
                <div className={`absolute inset-0 bg-gradient-to-b ${moodGradient}`} />

                {/* 실제 이미지 */}
                {imageUrl && (
                    <Image
                        src={imageUrl}
                        alt="장면"
                        fill
                        className={`object-cover transition-opacity duration-700 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                        onLoad={() => setImageLoaded(true)}
                        sizes="100vw"
                        priority
                    />
                )}

                {/* 이미지 로딩 shimmer */}
                {imageUrl && !imageLoaded && (
                    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03]" />
                )}

                {/* 하단 페이드: 이미지→텍스트 영역 자연 전환 */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#08080d] to-transparent" />

                {/* 위치 배지 — 좌상단 */}
                {locationName && <LocationBadge locationName={locationName} />}

                {/* 이미지 생성 중 인디케이터 — 우상단 */}
                {imagePolling && (
                    <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-sm">
                        <div className="size-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                        <span className="text-xs text-white/60">이미지 생성 중</span>
                    </div>
                )}
            </div>

            {/* 하단 텍스트/선택지 영역 */}
            <div className="flex flex-1 flex-col overflow-hidden bg-[#08080d]">
                {/* 서술 텍스트 — 스크롤 가능, 여유 패딩 */}
                <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
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

                {/* 선택지 + 입력 — 하단 고정 */}
                <div className="shrink-0 border-t border-white/5 bg-[#08080d]/95 px-4 pb-6 pt-4 backdrop-blur-sm">
                    <div className="mx-auto max-w-2xl">
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
            </div>
        </div>
    );
}
