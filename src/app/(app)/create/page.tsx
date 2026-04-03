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

const EXAMPLE_PROMPTS = [
    "고대 마법이 깨어나는 숲속 마을에서...",
    "우주 정거장에서 미지의 신호를 감지하고...",
    "전학 첫날, 비밀 동아리의 초대장을 받고...",
];

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
                {step === "prompt" && (
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
                            placeholder="예: 고대 마법이 깨어나는 숲속 마을에서..."
                            rows={4}
                            className="mb-4 w-full resize-none rounded-xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            maxLength={1000}
                        />

                        {/* 예시 문구 */}
                        <div className="mb-6 flex flex-wrap gap-2">
                            {EXAMPLE_PROMPTS.map((example) => (
                                <button
                                    key={example}
                                    onClick={() => setPrompt(example)}
                                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                                >
                                    {example}
                                </button>
                            ))}
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
                )}

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
