"use client";

import type { Choice } from "@/types/world";

const CHOICE_NUMBERS = ["①", "②", "③", "④", "⑤"];

interface ChoiceButtonsProps {
    choices: Choice[];
    onSelect: (choice: Choice) => void;
    disabled: boolean;
}

export function ChoiceButtons({
    choices,
    onSelect,
    disabled,
}: ChoiceButtonsProps) {
    return (
        <div className="flex flex-col gap-2 px-4">
            {choices.map((choice, i) => (
                <button
                    key={choice.id}
                    onClick={() => onSelect(choice)}
                    disabled={disabled}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-zinc-200 transition-all hover:border-[#7c6aff]/50 hover:bg-[#7c6aff]/10 hover:text-white disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:bg-white/5"
                >
                    <span className="text-base text-[#7c6aff]">
                        {CHOICE_NUMBERS[i] ?? `${i + 1}`}
                    </span>
                    <span>{choice.text}</span>
                </button>
            ))}
        </div>
    );
}
