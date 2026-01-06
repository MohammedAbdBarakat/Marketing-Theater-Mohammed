import React from "react";

interface PromptBarProps {
    prompt: string;
    onChange: (val: string) => void;
    onPlan: () => void;
    onGenerate: () => void;
    isPlanning: boolean;
    isGenerating: boolean;
    disabled?: boolean;
}

export function PromptBar({ prompt, onChange, onPlan, onGenerate, isPlanning, isGenerating, disabled }: PromptBarProps) {
    return (
        <div className="border-t border-gray-200 bg-white p-4">
            <div className="flex gap-2 items-end bg-gray-50 border border-gray-200 rounded-lg p-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all">
                <textarea
                    value={prompt || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Describe what you want to create... (or ask AI to plan it)"
                    className="flex-1 bg-transparent border-none resize-none focus:ring-0 text-sm max-h-32 min-h-[40px] py-2"
                    disabled={disabled || isPlanning || isGenerating}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if ((prompt || "").trim()) onGenerate();
                        }
                    }}
                />

                <div className="flex gap-2 pb-1">
                    <button
                        onClick={onPlan}
                        disabled={disabled || isPlanning || isGenerating}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-md transition-colors tooltip-trigger relative group"
                        title="AI Plan"
                    >
                        {isPlanning ? (
                            <span className="animate-spin text-lg inline-block">✨</span>
                        ) : (
                            <span className="text-lg">✨</span>
                        )}
                        <span className="sr-only">Plan</span>
                    </button>

                    <button
                        onClick={onGenerate}
                        disabled={disabled || isPlanning || isGenerating || !(prompt || "").trim()}
                        className={`p-2 rounded-md transition-colors text-white ${!(prompt || "").trim() || disabled ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-sm"
                            }`}
                        title="Generate"
                    >
                        {isGenerating ? (
                            <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
                        ) : (
                            <span className="text-lg">⬆️</span>
                        )}
                        <span className="sr-only">Generate</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
