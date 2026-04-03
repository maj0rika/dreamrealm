"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";

interface FreeInputProps {
    onSubmit: (text: string) => void;
    disabled: boolean;
}

export function FreeInput({ onSubmit, disabled }: FreeInputProps) {
    const [text, setText] = useState("");

    function handleSubmit() {
        const trimmed = text.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
        setText("");
    }

    return (
        <div className="flex items-center gap-2 px-4">
            <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        handleSubmit();
                    }
                }}
                disabled={disabled}
                placeholder="직접 행동을 입력하세요..."
                className="h-10 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-[#7c6aff]/50 disabled:opacity-50"
            />
            <button
                onClick={handleSubmit}
                disabled={disabled || !text.trim()}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#7c6aff] text-white transition-colors hover:bg-[#6b5ce7] disabled:opacity-50"
            >
                <ArrowUp className="size-4" />
            </button>
        </div>
    );
}
