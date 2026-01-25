import React, { useEffect, useRef } from "react";

interface PromptBarProps {
    prompt: string;
    onChange: (val: string) => void;
    structuredPrompts?: string[];
    onStructuredChange?: (vals: string[]) => void;
    onPlan: () => void;
    onGenerate: () => void;
    isPlanning: boolean;
    isGenerating: boolean;
    disabled?: boolean;
    controls?: React.ReactNode;
    extraOptions?: React.ReactNode;
}

function CarouselPromptList({
    prompts,
    onChange,
    disabled
}: {
    prompts: string[];
    onChange: (vals: string[]) => void;
    disabled?: boolean;
}) {
    // Scroll to bottom on mount/update to show latest slides if many
    const bottomRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (prompts.length > 0) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [prompts.length]);

    const handleChange = (idx: number, val: string) => {
        const next = [...prompts];
        next[idx] = val;
        onChange(next);
    };

    return (
        <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
            {prompts.map((p, i) => (
                <div key={i} className="relative flex flex-col fade-in duration-300">
                    <label className="absolute top-2 left-2 z-10 text-[9px] uppercase font-bold text-white bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded select-none pointer-events-none">
                        Slide {i + 1}
                    </label>
                    <textarea
                        value={p}
                        onChange={e => handleChange(i, e.target.value)}
                        placeholder={`Describe content for slide ${i + 1}...`}
                        className="w-full bg-gray-50 border border-gray-200 rounded-md p-2 pt-8 text-sm focus:ring-1 focus:ring-black focus:border-black transition-all resize-y min-h-[80px]"
                        disabled={disabled}
                    />
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
}

export type PromptMode = "autopilot" | "manual";

export function PromptBar({
    prompt,
    onChange,
    structuredPrompts,
    onStructuredChange,
    onPlan,
    onGenerate,
    isPlanning,
    isGenerating,
    disabled,
    controls,
    extraOptions,
    inputMode,
    onInputModeChange
}: PromptBarProps & { inputMode: PromptMode; onInputModeChange: (m: PromptMode) => void }) {
    const isStructuredMode = structuredPrompts && structuredPrompts.length > 0 && onStructuredChange;

    const hasContent = isStructuredMode
        ? structuredPrompts.some(s => s.trim().length > 0)
        : (prompt || "").trim().length > 0;

    const canGenerate = inputMode === "autopilot" ? true : hasContent;

    return (
        <div className="border-t border-gray-100 bg-white p-4 space-y-3 z-30 relative shadow-[-1px_-5px_20px_rgba(0,0,0,0.03)]">

            {/* Mode Tabs */}
            <div className="flex items-center gap-1 mb-2 bg-gray-100 p-0.5 rounded-lg w-max">
                <button
                    onClick={() => onInputModeChange("autopilot")}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${inputMode === "autopilot" ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-gray-600"
                        }`}
                >
                    Autopilot
                </button>
                <button
                    onClick={() => onInputModeChange("manual")}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${inputMode === "manual" ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-gray-600"
                        }`}
                >
                    Manual Instructions
                </button>
            </div>

            {/* Controls Row (if present) */}
            {controls && (
                <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
                    {controls}
                </div>
            )}

            {/* Input Area */}
            <div className={`relative group ${isStructuredMode ? 'bg-white' : ''}`}>
                {inputMode === "manual" ? (
                    <>
                        <div className={`relative flex flex-col gap-2 ${isStructuredMode ? '' : 'bg-white border border-gray-200 rounded-lg p-3 shadow-sm focus-within:ring-2 focus-within:ring-black/5 focus-within:border-gray-400 transition-all'}`}>

                            {isStructuredMode ? (
                                <CarouselPromptList
                                    prompts={structuredPrompts}
                                    onChange={onStructuredChange}
                                    disabled={disabled || isPlanning || isGenerating}
                                />
                            ) : (
                                <textarea
                                    value={prompt || ""}
                                    onChange={(e) => onChange(e.target.value)}
                                    placeholder="Describe your asset... (e.g. 'A professional LinkedIn carousel about leadership')"
                                    className="w-full bg-transparent border-none resize-y focus:ring-0 text-sm min-h-[60px] max-h-[400px] placeholder:text-gray-400"
                                    disabled={disabled || isPlanning || isGenerating}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            if (hasContent) onGenerate();
                                        }
                                    }}
                                />
                            )}

                            {/* Manual Actions */}
                            <div className={`flex justify-between items-center pt-2 ${isStructuredMode ? 'border-t border-gray-100 mt-2' : 'border-t border-gray-50'}`}>
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
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="py-3 text-center flex items-center justify-center gap-2 opacity-50 bg-gray-50/50 rounded-lg border border-dashed border-gray-200 mx-1">
                        <span className="text-xl grayscale">✨</span>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Autopilot Engaged</span>
                    </div>
                )}


                {/* Extra Options (Style Controls, etc) */}
                {
                    extraOptions && (
                        <div className="mt-3">
                            {extraOptions}
                        </div>
                    )
                }

                {/* Global Generate Button (Outside input box for Autopilot, inside logic for Manual flow but visual consistency) */}
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={onGenerate}
                        disabled={disabled || isPlanning || isGenerating || !canGenerate}
                        className={`flex items-center gap-2 px-6 py-2 text-xs font-bold text-white rounded-full transition-all shadow-md
                            ${!canGenerate || disabled
                                ? "bg-gray-300 cursor-not-allowed"
                                : "bg-black hover:bg-gray-800 transform active:scale-95"
                            }`
                        }
                    >
                        {isGenerating ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <span>{inputMode === "autopilot" ? "Start Autopilot" : "Generate"}</span>
                        )}
                        {!isGenerating && <span className="text-[10px] opacity-70">⏎</span>}
                    </button>
                </div>
            </div >
        </div >
    );
}

