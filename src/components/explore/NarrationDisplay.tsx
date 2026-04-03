"use client";

import { useEffect, useState, useCallback } from "react";

interface NarrationDisplayProps {
    text: string;
    onComplete: () => void;
    /** true면 타이핑 효과 없이 즉시 전체 표시 (캐시된 대화 복원용) */
    instant?: boolean;
}

export function NarrationDisplay({ text, onComplete, instant }: NarrationDisplayProps) {
    const [displayed, setDisplayed] = useState("");
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        if (instant) {
            setDisplayed(text);
            setIsComplete(true);
            onComplete();
            return;
        }

        setDisplayed("");
        setIsComplete(false);

        let index = 0;
        const timer = setInterval(() => {
            index++;
            if (index >= text.length) {
                setDisplayed(text);
                setIsComplete(true);
                clearInterval(timer);
                onComplete();
            } else {
                setDisplayed(text.slice(0, index));
            }
        }, 30);

        return () => clearInterval(timer);
    }, [text, onComplete, instant]);

    const handleSkip = useCallback(() => {
        if (!isComplete) {
            setDisplayed(text);
            setIsComplete(true);
            onComplete();
        }
    }, [isComplete, text, onComplete]);

    return (
        <div
            className="cursor-pointer px-4 py-6 select-none"
            onClick={handleSkip}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleSkip();
            }}
        >
            <p className="whitespace-pre-wrap text-lg leading-relaxed text-zinc-200">
                {displayed}
                {!isComplete && (
                    <span className="animate-pulse text-[#7c6aff]">▌</span>
                )}
            </p>
        </div>
    );
}
