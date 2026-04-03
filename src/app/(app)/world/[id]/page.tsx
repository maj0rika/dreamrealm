"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { NarrationDisplay } from "@/components/explore/NarrationDisplay";
import { ChoiceButtons } from "@/components/explore/ChoiceButtons";
import { FreeInput } from "@/components/explore/FreeInput";
import { LocationBadge } from "@/components/explore/LocationBadge";
import { TimelineOverlay } from "@/components/explore/TimelineOverlay";
import type { World, Turn, TurnResponse, Choice, Mood, Location, FlashbackInfo, TimePassageEvent } from "@/types/world";

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
    timePassageEvents?: TimePassageEvent[];
}

interface TurnApiResponse {
    turn: Turn;
    response: TurnResponse;
    flashback?: FlashbackInfo;
    locationChanged?: string;
    isEnding?: boolean;
}

export default function WorldExplorePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [world, setWorld] = useState<World | null>(null);
    const [narration, setNarration] = useState("");
    const [narrationInstant, setNarrationInstant] = useState(false);
    const [choices, setChoices] = useState<Choice[]>([]);
    const [mood, setMood] = useState<Mood>("neutral");
    const [locationName, setLocationName] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [prevImageUrl, setPrevImageUrl] = useState<string | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imagePolling, setImagePolling] = useState(false);
    const [flashbackImageUrl, setFlashbackImageUrl] = useState<string | null>(null);
    const [flashbackVisible, setFlashbackVisible] = useState(false);
    const [timePassageEvents, setTimePassageEvents] = useState<TimePassageEvent[] | null>(null);
    const [isCompleted, setIsCompleted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [typingDone, setTypingDone] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const flashbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flashbackFadeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 세션 복원 (StrictMode 중복 방지)
    const resumedRef = useRef(false);
    useEffect(() => {
        if (resumedRef.current) return;
        resumedRef.current = true;

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
                setNarrationInstant(true);
                setNarration(resp.narration);
                setChoices(resp.choices);
                setMood(resp.mood);
                // 이미지 우선순위: 턴 이미지 > 커버 이미지
                if (data.lastTurn.image_url) {
                    setImageUrl(data.lastTurn.image_url);
                    setPrevImageUrl(data.lastTurn.image_url);
                    setImageLoaded(true);
                } else if (data.world.cover_image_url) {
                    setImageUrl(data.world.cover_image_url);
                    setPrevImageUrl(data.world.cover_image_url);
                    setImageLoaded(true);
                }
            } else if (data.world.cover_image_url) {
                // 턴이 없어도 커버 이미지는 표시
                setImageUrl(data.world.cover_image_url);
                setPrevImageUrl(data.world.cover_image_url);
                setImageLoaded(true);
            }

            // 커버 이미지가 아직 없으면 폴링 (비동기 생성 대기)
            if (!data.world.cover_image_url && !data.lastTurn?.image_url) {
                pollCoverImage(id);
            }

            // 시간 경과 사건이 있으면 타임라인 표시
            if (data.timePassageEvents && data.timePassageEvents.length > 0) {
                setTimePassageEvents(data.timePassageEvents);
            }

            setLoading(false);
        }

        resume();
    }, [id]);

    // 커버 이미지 폴링 (비동기 생성 완료 대기)
    function pollCoverImage(worldId: string) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        let attempts = 0;
        pollingRef.current = setInterval(async () => {
            attempts++;
            if (attempts > 10) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                pollingRef.current = null;
                return;
            }
            try {
                const res = await fetch(`/api/worlds/${worldId}/image?type=cover`);
                if (!res.ok) return;
                const data: { imageUrl: string | null } = await res.json();
                if (data.imageUrl) {
                    setImageUrl(data.imageUrl);
                    setImageLoaded(false);
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
            } catch { /* ignore */ }
        }, 3000);
    }

    // 이미지 폴링 + 플래시백 타이머 정리
    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (flashbackTimeoutRef.current) clearTimeout(flashbackTimeoutRef.current);
            if (flashbackFadeoutRef.current) clearTimeout(flashbackFadeoutRef.current);
        };
    }, []);

    // 턴 이미지 비동기 폴링 (5초 후 시작, 3초 간격, 최대 10회)
    function pollTurnImage(turnNumber: number) {
        if (pollingRef.current) clearInterval(pollingRef.current);

        setImagePolling(true);
        let attempts = 0;
        const maxAttempts = 10;

        setTimeout(() => {
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
        }, 5000); // 첫 폴링 5초 딜레이
    }

    // 플래시백 연출: 과거 이미지가 반투명으로 2.5초 비친 후 페이드아웃
    function triggerFlashback(fbImageUrl: string) {
        // 이전 타이머 정리
        if (flashbackTimeoutRef.current) clearTimeout(flashbackTimeoutRef.current);
        if (flashbackFadeoutRef.current) clearTimeout(flashbackFadeoutRef.current);

        setFlashbackImageUrl(fbImageUrl);
        setFlashbackVisible(true);
        flashbackTimeoutRef.current = setTimeout(() => {
            setFlashbackVisible(false);
            flashbackFadeoutRef.current = setTimeout(() => setFlashbackImageUrl(null), 700);
        }, 2500);
    }

    // 턴 응답 처리
    function applyTurnResponse(response: TurnResponse, turn: Turn) {
        setNarrationInstant(false);
        setNarration(response.narration);
        setChoices(response.choices);
        setMood(response.mood);
        setTypingDone(false);

        // 이미지 처리: 이전 이미지를 유지하다가 새 이미지가 도착하면 교체
        if (turn.image_url) {
            // 새 이미지가 이미 준비됨 — 크로스페이드
            setImageLoaded(false);
            setImageUrl(turn.image_url);
        } else if (response.generate_image) {
            // 이미지 생성 중 — 기존 이미지 유지한 채 폴링 시작
            pollTurnImage(turn.turn_number);
        }
        // generate_image=false면: 이전 이미지 그대로 유지 (아무것도 안 함)
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
            if (data.isEnding) {
                setIsCompleted(true);
            }
            // 위치 변경 시 배지 업데이트
            if (data.locationChanged) {
                setLocationName(data.locationChanged);
            }
            // 플래시백 이미지 연출
            if (data.flashback?.imageUrl) {
                triggerFlashback(data.flashback.imageUrl);
            }
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
        <div className="relative flex h-screen flex-col bg-[#08080d]">
            {/* 시간 경과 타임라인 오버레이 */}
            {timePassageEvents && (
                <TimelineOverlay
                    events={timePassageEvents}
                    onDismiss={() => setTimePassageEvents(null)}
                />
            )}

            {/* 완결 오버레이 */}
            {isCompleted && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="mx-4 max-w-sm text-center">
                        <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">이야기가 끝났습니다</p>
                        <h2 className="mb-4 text-xl font-medium text-zinc-200">{world?.name}</h2>
                        <p className="mb-6 text-sm text-zinc-400">완결</p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setIsCompleted(false)}
                                className="rounded-lg border border-zinc-700 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
                            >
                                계속 탐험하기
                            </button>
                            <button
                                onClick={() => router.push("/dashboard")}
                                className="rounded-lg bg-[#7c6aff] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6b5ce7]"
                            >
                                대시보드로 돌아가기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 상단 이미지 영역 (30~45vh) */}
            <div className="relative h-[30vh] shrink-0 overflow-hidden md:h-[45vh]">
                {/* 폴백: 장르 분위기 그라데이션 */}
                <div className={`absolute inset-0 bg-gradient-to-br ${genreGradient}`} />

                {/* 분위기 오버레이 */}
                <div className={`absolute inset-0 bg-gradient-to-b ${moodGradient}`} />

                {/* 이전 이미지 (크로스페이드 — 새 이미지 로드 전까지 유지) */}
                {prevImageUrl && prevImageUrl !== imageUrl && !imageLoaded && (
                    <Image
                        src={prevImageUrl}
                        alt=""
                        fill
                        className="object-cover opacity-100"
                        sizes="100vw"
                    />
                )}

                {/* 현재 이미지 (페이드인) */}
                {imageUrl && (
                    <Image
                        src={imageUrl}
                        alt="장면"
                        fill
                        className={`object-cover transition-opacity duration-700 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                        onLoad={() => {
                            setImageLoaded(true);
                            setPrevImageUrl(imageUrl);
                        }}
                        sizes="100vw"
                        priority
                    />
                )}

                {/* 플래시백 오버레이 — 과거 이미지 반투명 비침 */}
                {flashbackImageUrl && (
                    <Image
                        src={flashbackImageUrl}
                        alt="기억"
                        fill
                        className={`object-cover transition-opacity duration-700 [filter:sepia(0.3)_brightness(0.8)] ${flashbackVisible ? "opacity-50" : "opacity-0"}`}
                        sizes="100vw"
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
                                instant={narrationInstant}
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
