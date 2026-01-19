"use client";

import { useRef, useState, useEffect } from "react";
import { AssetMediaItem } from "../../lib/api";
import { useStudio } from "../../hooks/useStudio";
import { AssetPreview } from "./AssetPreview";
import { PromptBar, PromptMode } from "./PromptBar";
import { VideoMixer } from "./VideoMixer";

interface StudioModalProps {
    assetId: string;
    runId: string; // ✨ Streaming
    initialContext: { title: string; channel: string; type: string; baseText: string; date?: string };
    onClose: () => void;
}

// Minimal Helper for Errors


// Clean Thumbnail Component
function CarouselThumbnails({
    assets,
    totalSlides,
    currentSlide,
    onSelect,
    onResume,
    status
}: {
    assets: AssetMediaItem[],
    totalSlides: number,
    currentSlide: number,
    onSelect: (n: number) => void,
    onResume: () => void,
    status: string
}) {
    // Generate slide array correctly
    // If totalSlides is not provided, use existing assets count (which might be partial)
    // But we usually want to show the TARGET length if known.
    const slides = Array.from({ length: Math.max(totalSlides, assets.length) });

    // Calculate highest actually generated slide (with URL)
    const generatedAssets = assets.filter(a => a.url);
    const highestGeneratedSlide = generatedAssets.length > 0
        ? Math.max(...generatedAssets.map(a => a.slide_num || 0))
        : 0;

    return (
        <div className="bg-white border-t border-gray-100 px-4 py-2 flex gap-2 overflow-x-auto items-center justify-center min-h-[90px]">
            {slides.map((_, i) => {
                const slideNum = i + 1;
                // Find asset by slide_num first
                const asset = assets.find(a => a.slide_num === slideNum);
                // Check if this slide is truly generated (has URL)
                const isGenerated = !!(asset?.url);
                const isCurrent = slideNum === currentSlide;

                // Next slot is the slide immediately after highest generated
                const isNextSlot = !isGenerated && slideNum === (highestGeneratedSlide + 1);
                const showSpinner = (isNextSlot && status === 'processing');
                const showReady = isNextSlot && status === 'waiting_for_approval';

                return (
                    <button
                        key={slideNum}
                        onClick={() => {
                            if (isGenerated && asset?.url) onSelect(slideNum);
                            else if (showReady) onResume();
                        }}
                        // Allow clicking generated slides even during processing
                        disabled={!isGenerated && !showReady}
                        className={`
                            relative w-14 h-14 rounded border flex-shrink-0 transition-all overflow-hidden flex items-center justify-center
                            ${isCurrent ? "border-black ring-1 ring-black shadow-md z-10" : "border-gray-200 hover:border-gray-300"}
                            ${!isGenerated && !showReady ? "cursor-default bg-gray-50" : "cursor-pointer bg-white"}
                            ${showReady ? "border-dashed border-gray-400 bg-gray-50 hover:bg-gray-100 hover:border-gray-500" : ""}
                        `}
                    >
                        {isGenerated && asset?.url ? (
                            <img src={asset.url} alt={`Slide ${slideNum}`} className="w-full h-full object-cover" />
                        ) : showSpinner ? (
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
                        ) : showReady ? (
                            <div className="text-gray-400">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </div>
                        ) : (
                            <div className="text-[10px] text-gray-300 font-bold font-mono">
                                {slideNum}
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

export function StudioModal({ assetId, runId, initialContext, onClose }: StudioModalProps) {
    // Use Hook
    const {
        versions,
        activeVersion,
        selectedVersionId,
        setSelectedVersionId,
        isLoadingHistory,
        error,
        prompt,
        setPrompt,
        isPlanning,
        isGenerating,
        isPolling,
        isCarousel,
        slideNum,
        setSlideNum,
        targetSlideCount,
        setTargetSlideCount,
        stepByStep,
        setStepByStep,
        structuredPrompts,
        setStructuredPrompts,
        aspectRatio,
        setAspectRatio,
        handlePlan,
        handleGenerate: generate,
        handleResume: resume,
        handleNewVersion,
        editSlide, // ✨
        videoOverrides, // ✨
        setVideoOverrides // ✨
    } = useStudio(runId, assetId, initialContext.type);

    const isVideo = initialContext.type === 'video';
    const [viewMode, setViewMode] = useState<"edited" | "raw">("edited"); // ✨ Video View Mode


    // Layout (Resizable)
    const [leftWidth, setLeftWidth] = useState(30);
    const [topHeight, setTopHeight] = useState(70); // ✨ Vertical Split (Percentage)
    const containerRef = useRef<HTMLDivElement>(null);
    const dragType = useRef<"horizontal" | "vertical" | null>(null); // ✨ Track drag type

    // Mode State
    const [inputMode, setInputMode] = useState<PromptMode>("autopilot");

    const expectedTotal = activeVersion?.blueprint?.slides?.length || (isCarousel ? targetSlideCount : 1);

    // Resize Logic
    useEffect(() => {
        const move = (ev: MouseEvent) => {
            if (!dragType.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();

            if (dragType.current === "horizontal") {
                const p = ((ev.clientX - rect.left) / rect.width) * 100;
                if (p > 15 && p < 50) setLeftWidth(p);
            } else if (dragType.current === "vertical") {
                const p = ((ev.clientY - rect.top) / rect.height) * 100;
                if (p > 20 && p < 90) setTopHeight(p);
            }
        };
        const up = () => { dragType.current = null; };

        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
        return () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
        };
    }, []);

    // ✨ Compute Display Assets (Raw vs Edited)
    const displayAssets = viewMode === "raw"
        ? (activeVersion?.assets.map(a => ({ ...a, url: a.rawUrl || a.url })) || [])
        : (activeVersion?.assets || []);

    // --- Render ---

    if (error) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl border border-red-200 max-w-md w-full">
                    <h3 className="text-red-600 font-bold mb-2">Error</h3>
                    <p className="text-gray-700 mb-4">{error}</p>
                    <button onClick={onClose} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded font-medium">Close</button>
                </div>
            </div>
        );
    }

    if (isLoadingHistory) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white p-4 rounded-full shadow-xl">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-black" />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                ref={containerRef}
                className="bg-white w-full max-w-[95vw] h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-row border border-gray-200 select-none"
            >
                {/* --- Left Column: Info & History --- */}
                <div
                    style={{ width: `${leftWidth}%` }}
                    className="flex flex-col border-r border-gray-100 bg-gray-50/50 min-w-[250px]"
                >
                    {/* Header */}
                    <div className="h-14 flex items-center justify-between px-6 border-b border-gray-100 bg-white">
                        <span className="font-semibold text-sm text-gray-900">Asset Details</span>
                        <button onClick={onClose} className="text-gray-400 hover:text-black transition-colors rounded-full p-1 hover:bg-gray-100">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4L4 12M4 4l8 8" /></svg>
                        </button>
                    </div>

                    {/* Info Card */}
                    <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Project</label>
                                <div className="font-medium text-sm text-gray-900 mt-0.5 max-w-full truncate">{initialContext.title}</div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Channel</label>
                                    <div className="font-medium text-xs text-gray-700 mt-0.5 px-2 py-1 bg-gray-50 rounded-md inline-block border border-gray-100">{initialContext.channel}</div>
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Format</label>
                                    <div className="font-medium text-xs text-gray-700 mt-0.5 px-2 py-1 bg-gray-50 rounded-md inline-block border border-gray-100">{initialContext.type}</div>
                                </div>
                            </div>
                            {initialContext.date && (
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Date</label>
                                    <div className="font-mono text-xs text-gray-500 mt-0.5">{initialContext.date}</div>
                                </div>
                            )}
                        </div>

                        {/* History */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Version History</label>
                                <button
                                    onClick={handleNewVersion}
                                    className="text-[10px] font-bold text-black hover:underline decoration-gray-300 underline-offset-2"
                                >
                                    + ADD NEW
                                </button>
                            </div>

                            {(() => {
                                // Defensive deduplication for render
                                const uniqueVersions = Array.from(new Map(versions.map(v => [v.id, v])).values());

                                return uniqueVersions.length === 0 ? (
                                    <div className="text-sm text-gray-400 italic text-center py-4">No iterations yet.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {uniqueVersions.map((v, i) => (
                                            <button
                                                key={v.id || i}
                                                onClick={() => setSelectedVersionId(v.id)}
                                                className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-center group
                                                    ${v.id === selectedVersionId
                                                        ? "bg-white border-black shadow-sm ring-1 ring-black/5"
                                                        : "bg-white border-transparent hover:border-gray-200"
                                                    }`}
                                            >
                                                <div className="flex flex-col flex-1">
                                                    <span className={`font-medium ${v.id === selectedVersionId ? "text-gray-900" : "text-gray-500 group-hover:text-gray-700"}`}>
                                                        Version {uniqueVersions.length - i}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">
                                                        {(() => {
                                                            try {
                                                                if (!v.createdAt) return "";
                                                                // Raw: "2026-01-13 21:33:23.327721+00"
                                                                // 1. Replace space with T
                                                                let safe = v.createdAt.replace(' ', 'T');
                                                                // 2. Truncate fractional seconds to 3 digits (millis) if > 3
                                                                //    Matches .123456 -> .123
                                                                safe = safe.replace(/(\.\d{3})\d+/, '$1');
                                                                // 3. Fix short timezone "+00" -> "+00:00" if missing minutes
                                                                //    Matches end of string +00 -> +00:00
                                                                safe = safe.replace(/([+-]\d{2})$/, '$1:00');

                                                                const d = new Date(safe);
                                                                if (isNaN(d.getTime())) return "";

                                                                const now = new Date();
                                                                const diffMs = now.getTime() - d.getTime();
                                                                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                                                const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                                                if (diffDays === 0 && now.getDate() === d.getDate()) {
                                                                    return `Today ${timeStr}`;
                                                                } else if (diffDays === 1 || (diffDays === 0 && now.getDate() !== d.getDate())) {
                                                                    // Covers yesterday even if < 24h but crossed midnight?
                                                                    // Simple approach: if getDate differs by 1
                                                                    const yest = new Date(now);
                                                                    yest.setDate(yest.getDate() - 1);
                                                                    if (d.getDate() === yest.getDate()) return `Yesterday ${timeStr}`;
                                                                }

                                                                if (diffDays < 7) {
                                                                    // Show Weekday
                                                                    return `${d.toLocaleDateString([], { weekday: 'short' })} ${timeStr}`;
                                                                }

                                                                // Older -> Date
                                                                return `${d.toLocaleDateString([], { month: 'numeric', day: 'numeric' })} ${timeStr}`;
                                                            } catch (e) {
                                                                return "";
                                                            }
                                                        })()}
                                                    </span>
                                                </div>
                                                <div className={`w-2 h-2 rounded-full ${v.status === 'completed' ? 'bg-green-500' :
                                                    v.status === 'failed' ? 'bg-red-500' :
                                                        'bg-yellow-500'
                                                    }`} />
                                            </button>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* Resizer */}
                <div
                    className="w-[1px] bg-gray-200 cursor-col-resize hover:bg-black hover:w-0.5 transition-all z-10"
                    onMouseDown={(e) => {
                        dragType.current = "horizontal";
                        e.preventDefault(); // Prevent text selection
                    }}
                />

                {/* --- Right Column: Studio --- */}
                <div style={{ width: `${100 - leftWidth}%` }} className="flex flex-col bg-white h-full relative">

                    {/* Main Preview Area */}
                    <div
                        style={{ height: `${topHeight}%` }}
                        className="flex-shrink-0 overflow-hidden relative bg-gray-50 flex flex-col"
                    >
                        {!activeVersion ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl grayscale opacity-50">✨</div>
                                <h3 className="text-gray-900 font-medium mb-1">Canvas Empty</h3>
                                <p className="text-sm max-w-xs mx-auto">Use the controls below to plan or generate your asset.</p>
                            </div>
                        ) : (activeVersion.status === "processing" || activeVersion.status === "created") && activeVersion.assets.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-gray-200 border-t-black mb-6" />
                                <h3 className="text-gray-900 font-medium animate-pulse">Designing...</h3>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 relative overflow-hidden">
                                    <AssetPreview
                                        assets={displayAssets}
                                        selectedSlideInfo={activeVersion.assets.length > 1 ? { num: slideNum, total: activeVersion.assets.length } : undefined}
                                        onSelectSlide={setSlideNum}
                                        hideThumbnails={true} // Replaced redundancy
                                        onEdit={editSlide} // ✨ Passed here now!
                                    />
                                </div>

                                {/* Status Banner */}
                                {/* Status Banner Removed per user request - Resume moved to Thumbnail Play Icon */}
                            </>
                        )}

                        {/* Thumbnails (Bottom of Preview) */}
                        {isCarousel && activeVersion && (
                            <CarouselThumbnails
                                assets={(activeVersion as any).media_url || activeVersion.assets || []}
                                // Use targetSlideCount if available, else fallback to current length (or default 3)
                                // The hook has 'targetSlideCount', we should populate it.
                                totalSlides={Math.max(activeVersion.assets.length, targetSlideCount || 3)}
                                currentSlide={slideNum}
                                onSelect={setSlideNum}
                                onResume={resume}
                                status={activeVersion.status}
                            />
                        )}

                        {/* ✅ NEW: Video Toggle Controls (Floating on top) */}
                        {isVideo && activeVersion?.status === "completed" && activeVersion.assets.length > 1 && (
                            <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur border border-gray-200 p-1 rounded-lg flex gap-1 shadow-sm">
                                <button
                                    onClick={() => setViewMode("edited")}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === "edited" ? "bg-black text-white" : "hover:bg-gray-100 text-gray-600"}`}
                                >
                                    Edited
                                </button>
                                <button
                                    onClick={() => setViewMode("raw")}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === "raw" ? "bg-black text-white" : "hover:bg-gray-100 text-gray-600"}`}
                                >
                                    Raw Source
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ✨ Vertical Resizer */}
                    <div
                        className="h-[1px] bg-gray-200 cursor-row-resize hover:bg-black hover:h-1 transition-all z-20 flex-shrink-0"
                        onMouseDown={(e) => {
                            dragType.current = "vertical";
                            e.preventDefault();
                        }}
                    />

                    {/* Bottom Input Area */}
                    <div className="flex-1 min-h-0 z-20 bg-white">
                        {/* ✅ NEW: Video Mixologist Panel (Only show for Video) */}
                        {isVideo && (
                            <VideoMixer
                                selection={videoOverrides}
                                onChange={setVideoOverrides}
                                disabled={isGenerating || isPlanning}
                            />
                        )}
                        <PromptBar
                            prompt={prompt}
                            onChange={setPrompt}
                            structuredPrompts={structuredPrompts}
                            onStructuredChange={setStructuredPrompts}
                            onPlan={handlePlan}
                            onGenerate={generate}
                            isPlanning={isPlanning}
                            isGenerating={isGenerating || (activeVersion?.status === "processing")}
                            disabled={isPolling}
                            inputMode={inputMode}
                            onInputModeChange={setInputMode}
                            controls={(
                                <>
                                    {/* Aspect Ratio */}
                                    <div className="flex items-center gap-2 border-r border-gray-200 pr-4 mr-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Ratio</span>
                                        <select
                                            value={aspectRatio}
                                            onChange={e => setAspectRatio(e.target.value)}
                                            disabled={isGenerating || activeVersion?.status === "processing"}
                                            className="text-xs border-none bg-gray-100 rounded-md py-1 pl-2 pr-6 focus:ring-0 cursor-pointer font-medium"
                                        >
                                            {["1:1", "16:9", "9:16", "4:5", "3:4"].map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>

                                    {isCarousel && (
                                        <>
                                            <div className="flex items-center gap-2 border-r border-gray-200 pr-4 mr-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Slides</span>
                                                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-md">
                                                    {[3, 4, 5].map(n => (
                                                        <button
                                                            key={n}
                                                            onClick={() => setTargetSlideCount(n)}
                                                            className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded transition-all
                                                                ${targetSlideCount === n ? 'bg-white shadow-sm text-black' : 'text-gray-400 hover:text-gray-600'}`}
                                                        >
                                                            {n}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={stepByStep}
                                                    onChange={e => setStepByStep(e.target.checked)}
                                                    className="w-3.5 h-3.5 rounded border-gray-300 text-black focus:ring-0 checked:bg-black transition-colors"
                                                />
                                                <span className="text-xs font-medium text-gray-500 group-hover:text-gray-900 transition-colors">Step-by-Step</span>
                                            </label>
                                        </>
                                    )}
                                </>
                            )}
                        />
                    </div>

                </div>
            </div>
        </div>
    );
}

