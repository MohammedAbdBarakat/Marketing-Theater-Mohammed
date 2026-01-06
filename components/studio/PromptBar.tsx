import React from "react";

interface PromptBarProps {
    prompt: string;
    onChange: (val: string) => void;
    onPlan: () => void;
    onGenerate: () => void;
    isPlanning: boolean;
    isGenerating: boolean;
    disabled?: boolean;
    controls?: React.ReactNode;
}

export function PromptBar({
    prompt,
    onChange,
    onPlan,
    onGenerate,
    isPlanning,
    isGenerating,
    disabled,
    controls
}: PromptBarProps) {
    return (
        <div className="border-t border-gray-100 bg-white p-4 space-y-3">
            {/* Controls Row (if present) */}
            {controls && (
                <div className="flex items-center gap-4 px-1">
                    {controls}
                </div>
            )}

            {/* Input Area */}
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-gray-200 to-gray-100 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative flex flex-col gap-2 bg-white border border-gray-200 rounded-lg p-3 shadow-sm focus-within:ring-2 focus-within:ring-black/5 focus-within:border-gray-400 transition-all">
                    <textarea
                        value={prompt || ""}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="Describe your asset... (e.g. 'A professional LinkedIn carousel about leadership')"
                        className="w-full bg-transparent border-none resize-none focus:ring-0 text-sm min-h-[60px] max-h-60 placeholder:text-gray-400"
                        disabled={disabled || isPlanning || isGenerating}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                if ((prompt || "").trim()) onGenerate();
                            }
                        }}
                    />

                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                        {/* Left Side Actions (Enhance/Plan) */}
                        <button
                            onClick={onPlan}
                            disabled={disabled || isPlanning || isGenerating}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors border border-gray-200"
                            title="Let AI suggest a prompt"
                        >
                            {isPlanning ? (
                                <>
                                    <span className="animate-spin">✨</span>
                                    <span>Planning...</span>
                                </>
                            ) : (
                                <>
                                    <span>✨</span>
                                    <span>Auto-Plan</span>
                                </>
                            )}
                        </button>

                        {/* Right Side Actions (Generate) */}
                        <button
                            onClick={onGenerate}
                            disabled={disabled || isPlanning || isGenerating || !(prompt || "").trim()}
                            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white rounded-full transition-all shadow-sm
                                ${!(prompt || "").trim() || disabled
                                    ? "bg-gray-300 cursor-not-allowed"
                                    : "bg-black hover:bg-gray-800 transform active:scale-95"
                                }`
                            }
                        >
                            {isGenerating ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <span>Generate</span>
                            )}
                            {!isGenerating && <span className="text-[10px] opacity-70">⏎</span>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
