"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ART_STYLE_OPTIONS, getDefaultArtStyle } from "@/lib/ai/art-styles";
import type { ArtStyleOption } from "@/lib/ai/art-styles";

const GENRES = [
    { id: "fantasy", emoji: "🏰", label: "판타지" },
    { id: "sci-fi", emoji: "🚀", label: "SF" },
    { id: "romance", emoji: "💕", label: "로맨스" },
    { id: "horror", emoji: "👻", label: "호러" },
    { id: "slice-of-life", emoji: "🏫", label: "학원" },
    { id: "mystery", emoji: "🔍", label: "미스터리" },
    { id: "post-apocalyptic", emoji: "✨", label: "이세계" },
    { id: "custom", emoji: "✏️", label: "직접입력" },
] as const;

const GENRE_PROMPTS: Record<string, string[]> = {
    fantasy: [
        "천년 봉인이 풀린 고대 숲의 마을, 마법이 다시 깨어나며 숲 속 유적에서 이상한 빛이 새어 나온다. 마을 사람들은 점점 불안해하고, 숲 깊은 곳에서 정체불명의 울음소리가 밤마다 들려온다.",
        "용의 등뼈로 이루어진 산맥 아래 광산 도시, 드워프와 인간이 공존하지만 최근 광맥에서 발굴된 검은 수정이 광부들을 하나둘 미치게 만들고 있다.",
        "떠다니는 섬들 사이를 비행선으로 오가는 세계, 하늘 해적단이 무역로를 위협하고 있고, 전설 속 '하늘의 심장'을 찾는 모험가 길드에 가입하게 된다.",
    ],
    "sci-fi": [
        "태양계 외곽 목성 궤도의 연구 정거장, 심우주에서 수신된 규칙적 신호를 분석하던 중 정거장의 AI가 이상 행동을 보이기 시작한다. 승무원들 사이에 불신이 퍼진다.",
        "지구가 멸망한 뒤 세대 우주선 '아크호' 안에서 태어난 3세대 주민, 선장이 감추고 있는 비밀 구역과 우주선의 진짜 목적지에 대한 소문이 돈다.",
        "사이버네틱 도시 네오서울 2187, 기억을 사고파는 블랙마켓에서 누군가의 기억 조각을 우연히 손에 넣게 되면서 거대 기업의 음모에 휘말린다.",
    ],
    romance: [
        "해안가 작은 마을의 오래된 서점, 매일 같은 시간에 찾아오는 정체불명의 단골손님과 점점 가까워진다. 하지만 그 사람에게는 이 마을에 온 숨겨진 이유가 있다.",
        "파리 유학 중 우연히 들어간 골목의 빈티지 카페, 그곳의 바리스타와 서툰 프랑스어로 대화를 나누며 시작되는 이야기. 카페에는 모든 연인에게 한 가지 시련을 내린다는 전설이 있다.",
        "같은 아파트 옥상 정원에서 밤마다 마주치는 이웃, 서로의 이름도 모른 채 별을 보며 나누는 대화가 깊어지지만, 곧 둘 중 한 명이 이사를 가야 한다는 사실을 알게 된다.",
    ],
    horror: [
        "폐교된 시골 학교에 다큐멘터리 촬영차 찾아온 일행, 밤이 되자 교실마다 칠판에 알 수 없는 글씨가 나타나고, 촬영 영상에 있을 수 없는 인물이 찍혀 있다.",
        "깊은 산속 할머니 집에 내려온 주말, 마을 사람들은 해 지면 절대 밖에 나가지 말라 경고한다. 첫날 밤, 창밖에서 내 이름을 부르는 목소리가 들린다.",
        "빌라 지하 창고에서 발견한 오래된 일기장, 30년 전 이 건물에서 일어난 실종 사건의 기록이 적혀 있고, 일기의 마지막 장에는 오늘 날짜가 써 있다.",
    ],
    "slice-of-life": [
        "전학 첫날, 교실 뒷자리에 앉게 되었는데 옆자리 학생이 몰래 쪽지를 건네며 비밀 동아리 초대장이라고 속삭인다. 방과 후 지도에 표시된 옥상 창고를 찾아가면 그곳에는...",
        "시골 바닷가 마을로 전학 온 고등학생, 학교 뒤 절벽 위 등대에 혼자 사는 신비로운 선배가 있다는 소문. 매일 방과 후 등대에서 새어 나오는 피아노 소리를 따라가게 된다.",
        "졸업 직전, 학교 타임캡슐을 열었는데 1년 전의 내가 쓴 편지에는 기억나지 않는 약속이 적혀 있다. 편지 속 단서를 따라가며 잊고 있던 친구와의 추억을 되짚어간다.",
    ],
    mystery: [
        "강남 한복판 고급 호텔의 밀실에서 발견된 변사체, 방에는 잠긴 문과 창문뿐이고 CCTV에는 아무도 들어간 기록이 없다. 호텔 투숙객 중 한 명으로서 수사에 휘말린다.",
        "매주 금요일 자정에만 나타나는 심야 라디오 방송, DJ가 청취자의 비밀을 읽어주는데, 어느 날 방송에서 내 비밀이 흘러나온다. 이 방송국의 위치를 추적하기 시작한다.",
        "유명 추리 작가가 사라지기 전 마지막으로 보낸 원고, 소설 속 살인 사건과 실제 사건이 기묘하게 일치한다. 원고의 다음 챕터가 다음 사건의 예고인 것 같다.",
    ],
    "post-apocalyptic": [
        "차원의 틈이 열려 현대 도시 한복판에 중세 판타지 세계가 겹쳐진 세상, 강남역 앞에 드래곤이 둥지를 틀고 한강 다리 위에서 기사단과 경찰이 합동 순찰을 한다.",
        "게임 같은 시스템이 현실에 덮어씌워진 세계, 사람들 머리 위에 레벨이 뜨고 퀘스트 알림이 올린다. 하지만 '레벨 0'인 나만 이 시스템의 버그를 볼 수 있다.",
        "어느 날 눈을 떠보니 판타지 소설 속 조연이 되어 있다. 원작에서 3화 만에 죽는 캐릭터인데, 죽음을 피하면서 원작 스토리를 바꾸지 않아야 하는 줄타기가 시작된다.",
    ],
    custom: [
        "원하는 세계를 자유롭게 묘사해주세요. 배경, 분위기, 시작 상황, 핵심 갈등을 구체적으로 적을수록 더 풍부한 세계가 만들어집니다.",
    ],
};

const LOADING_STEPS = [
    "세계 설계 중...",
    "주민 생성 중...",
    "역사 기록 중...",
    "문을 여는 중...",
    "🎨 커버 이미지 생성 중...",
];

type Step = "genre" | "art-style" | "prompt" | "loading";

export default function CreateWorldPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("genre");
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
    const [selectedArtStyle, setSelectedArtStyle] = useState<ArtStyleOption | null>(null);
    const [defaultArtStyleId, setDefaultArtStyleId] = useState<string | null>(null);
    const [prompt, setPrompt] = useState("");
    const [loadingStep, setLoadingStep] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // 로딩 체크리스트 애니메이션
    useEffect(() => {
        if (step !== "loading") return;
        if (loadingStep >= LOADING_STEPS.length) return;

        const timer = setTimeout(() => {
            setLoadingStep((prev) => prev + 1);
        }, 1500);

        return () => clearTimeout(timer);
    }, [step, loadingStep]);

    const handleGenreSelect = useCallback((genreId: string) => {
        setSelectedGenre(genreId);
        // 장르에 따른 기본 아트 스타일 자동 선택
        const effectiveGenre = genreId === "custom" ? "fantasy" : genreId;
        const defaultStyle = getDefaultArtStyle(effectiveGenre);
        setSelectedArtStyle(defaultStyle);
        setDefaultArtStyleId(defaultStyle.id);
        setStep("art-style");
    }, []);

    const handleArtStyleSelect = useCallback((style: ArtStyleOption) => {
        setSelectedArtStyle(style);
    }, []);

    const handleArtStyleConfirm = useCallback(() => {
        setStep("prompt");
    }, []);

    const handleCreate = useCallback(async () => {
        if (!selectedGenre || !selectedArtStyle || !prompt.trim()) return;

        setStep("loading");
        setLoadingStep(0);
        setError(null);

        try {
            const res = await fetch("/api/worlds", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    genre: selectedGenre === "custom" ? "fantasy" : selectedGenre,
                    prompt: prompt.trim(),
                    art_style: selectedArtStyle.id,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? "월드 생성에 실패했습니다");
            }

            const { worldId } = await res.json();

            // 커버 이미지는 비동기 생성 — 대시보드에서 자연스럽게 로드됨
            router.push(`/world/${worldId}`);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다"
            );
            setStep("prompt");
        }
    }, [selectedGenre, selectedArtStyle, prompt, router]);

    const handleBack = useCallback(() => {
        if (step === "art-style") {
            setStep("genre");
        } else if (step === "prompt") {
            setStep("art-style");
        } else {
            router.back();
        }
    }, [step, router]);

    return (
        <div className="flex min-h-dvh flex-col bg-background">
            {/* 헤더 */}
            <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
                <button
                    onClick={handleBack}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    disabled={step === "loading"}
                >
                    ← 뒤로
                </button>
                <h1 className="text-sm font-medium text-foreground">새 세계 만들기</h1>
                <div className="w-10" />
            </header>

            <main className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6">
                {/* Step 1: 장르 선택 */}
                {step === "genre" && (
                    <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <h2 className="mb-2 text-center text-2xl font-semibold text-foreground">
                            어떤 세계를 만들까요?
                        </h2>
                        <p className="mb-8 text-center text-sm text-muted-foreground">
                            장르를 선택하면 AI가 세계를 설계합니다
                        </p>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {GENRES.map((genre) => (
                                <button
                                    key={genre.id}
                                    onClick={() => handleGenreSelect(genre.id)}
                                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all hover:border-primary hover:bg-accent ${
                                        selectedGenre === genre.id
                                            ? "border-primary bg-accent"
                                            : "border-border"
                                    }`}
                                >
                                    <span className="text-3xl">{genre.emoji}</span>
                                    <span className="text-sm font-medium text-foreground">
                                        {genre.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: 아트 스타일 선택 */}
                {step === "art-style" && (
                    <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <h2 className="mb-2 text-center text-2xl font-semibold text-foreground">
                            아트 스타일을 골라주세요
                        </h2>
                        <p className="mb-8 text-center text-sm text-muted-foreground">
                            세계의 시각적 분위기를 결정합니다
                        </p>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {ART_STYLE_OPTIONS.map((style) => (
                                <button
                                    key={style.id}
                                    onClick={() => handleArtStyleSelect(style)}
                                    className={`relative flex flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition-all hover:border-[#7c6aff] hover:bg-accent ${
                                        selectedArtStyle?.id === style.id
                                            ? "border-[#7c6aff] bg-accent"
                                            : "border-border"
                                    }`}
                                >
                                    {/* 추천 배지 */}
                                    {style.id === defaultArtStyleId && (
                                        <span className="absolute -top-2 right-2 rounded-full bg-[#7c6aff] px-2 py-0.5 text-[10px] font-medium text-white">
                                            추천
                                        </span>
                                    )}
                                    <span className="text-sm font-medium text-foreground">
                                        {style.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {style.description}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleArtStyleConfirm}
                            disabled={!selectedArtStyle}
                            className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            다음
                        </button>
                    </div>
                )}

                {/* Step 3: 프롬프트 입력 */}
                {step === "prompt" && (() => {
                    const genreExamples = GENRE_PROMPTS[selectedGenre ?? "custom"] ?? GENRE_PROMPTS.custom;
                    return (
                    <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <h2 className="mb-2 text-center text-2xl font-semibold text-foreground">
                            세계를 묘사해주세요
                        </h2>
                        <p className="mb-8 text-center text-sm text-muted-foreground">
                            어떤 세계에서 모험하고 싶은지 자유롭게 적어주세요
                        </p>

                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={genreExamples[0] ?? "원하는 세계를 자유롭게 묘사해주세요..."}
                            rows={5}
                            className="mb-4 w-full resize-none rounded-xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            maxLength={1000}
                        />

                        {/* 장르별 예시 문구 */}
                        <div className="mb-6 space-y-2">
                            <p className="text-xs text-muted-foreground">예시를 눌러 바로 사용하거나, 참고해서 직접 써보세요</p>
                            <div className="flex flex-col gap-2">
                                {genreExamples.map((example) => (
                                    <button
                                        key={example}
                                        onClick={() => setPrompt(example)}
                                        className="rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                                    >
                                        {example}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <p className="mb-4 text-center text-sm text-destructive">
                                {error}
                            </p>
                        )}

                        <button
                            onClick={handleCreate}
                            disabled={!prompt.trim()}
                            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            세계 생성하기
                        </button>
                    </div>
                    );
                })()}

                {/* Step 4: 로딩 */}
                {step === "loading" && (
                    <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center animate-in fade-in duration-500">
                        {/* 회전 아이콘 */}
                        <div className="mb-8 h-16 w-16 animate-spin rounded-full border-4 border-muted border-t-primary" />

                        <h2 className="mb-6 text-xl font-semibold text-foreground">
                            세계를 만들고 있어요
                        </h2>

                        <div className="w-full space-y-3">
                            {LOADING_STEPS.map((label, i) => (
                                <div
                                    key={label}
                                    className={`flex items-center gap-3 transition-all duration-500 ${
                                        i <= loadingStep
                                            ? "translate-x-0 opacity-100"
                                            : "translate-x-4 opacity-0"
                                    }`}
                                >
                                    <span className="text-lg">
                                        {i < loadingStep ? "✅" : "⏳"}
                                    </span>
                                    <span
                                        className={`text-sm ${
                                            i < loadingStep
                                                ? "text-muted-foreground line-through"
                                                : "text-foreground"
                                        }`}
                                    >
                                        {label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
