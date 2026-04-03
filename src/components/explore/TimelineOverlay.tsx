"use client";

import type { TimePassageEvent } from "@/types/world";

interface TimelineOverlayProps {
    events: TimePassageEvent[];
    onDismiss: () => void;
}

const IMPORTANCE_COLORS: Record<string, string> = {
    low: "border-zinc-600 bg-zinc-900/50",
    mid: "border-amber-600/60 bg-amber-950/30",
    high: "border-red-600/60 bg-red-950/30",
};

function getImportanceLevel(importance: number): string {
    if (importance >= 7) return "high";
    if (importance >= 4) return "mid";
    return "low";
}

export function TimelineOverlay({ events, onDismiss }: TimelineOverlayProps) {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md">
                {/* 헤더 */}
                <div className="mb-4 text-center">
                    <p className="text-xs uppercase tracking-widest text-zinc-500">
                        당신이 없는 동안
                    </p>
                    <h2 className="mt-1 text-lg font-medium text-zinc-200">
                        세계는 계속 흘러갔습니다
                    </h2>
                </div>

                {/* 타임라인 */}
                <div className="relative space-y-3">
                    {/* 수직 라인 */}
                    <div className="absolute bottom-0 left-3 top-0 w-px bg-zinc-700/50" />

                    {events.map((event, i) => {
                        const level = getImportanceLevel(event.importance);
                        const colorClass = IMPORTANCE_COLORS[level];

                        return (
                            <div key={i} className="relative flex gap-3 pl-7">
                                {/* 타임라인 도트 */}
                                <div
                                    className={`absolute left-1.5 top-3 size-3 rounded-full border ${
                                        level === "high"
                                            ? "border-red-500 bg-red-500/30"
                                            : level === "mid"
                                              ? "border-amber-500 bg-amber-500/30"
                                              : "border-zinc-500 bg-zinc-500/30"
                                    }`}
                                />

                                {/* 사건 카드 */}
                                <div
                                    className={`flex-1 rounded-lg border p-3 ${colorClass}`}
                                >
                                    <p className="mb-1 text-xs text-zinc-500">
                                        {event.time}
                                    </p>
                                    <p className="text-sm text-zinc-200">
                                        {event.description}
                                    </p>
                                    {event.entitiesInvolved.length > 0 && (
                                        <p className="mt-1 text-xs text-zinc-500">
                                            {event.entitiesInvolved.join(", ")}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 계속 버튼 */}
                <button
                    onClick={onDismiss}
                    className="mt-6 w-full rounded-lg bg-[#7c6aff] py-3 text-sm font-medium text-white transition-colors hover:bg-[#6b5ce7]"
                >
                    계속 탐험하기
                </button>
            </div>
        </div>
    );
}
