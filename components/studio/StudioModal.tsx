"use client";

import { useRef, useState } from "react";
import { AssetMediaItem } from "../../lib/api";
import { useStudio } from "../../hooks/useStudio";
import { AssetPreview } from "./AssetPreview";
import { PromptBar } from "./PromptBar";
import { VideoMixer } from "./VideoMixer";

interface StudioModalProps {
    assetId: string;
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
    status
}: {
    assets: AssetMediaItem[],
    totalSlides: number,
    currentSlide: number,
    onSelect: (n: number) => void,
    status: string
}) {
    const slides = Array.from({ length: totalSlides });

    return (
        <div className="bg-white border-t border-gray-100 px-4 py-2 flex gap-2 overflow-x-auto items-center justify-center min-h-[80px]">
            {slides.map((_, i) => {
                const slideNum = i + 1;
                const asset = assets.find(a => a.slide_num === slideNum);
                const effectiveAsset = asset || (assets[i] ? assets[i] : undefined);
                const isGenerated = !!effectiveAsset;
                const isCurrent = slideNum === currentSlide;

                const isNext = !isGenerated && slideNum === (assets.length + 1) && (status === 'processing' || status === 'waiting_for_approval');

                return (
                    <button
                        key={slideNum}
                        onClick={() => isGenerated ? onSelect(slideNum) : null}
                        disabled={!isGenerated}
                        className={`
                            relative w-14 h-14 rounded border flex-shrink-0 transition-all overflow-hidden
                            ${isCurrent ? "border-black ring-1 ring-black shadow-md z-10" : "border-gray-200 hover:border-gray-300"}
                            ${!isGenerated ? "cursor-default bg-gray-50" : "cursor-pointer bg-white"}
                        `}
                    >
                        {isGenerated ? (
                            <img src={effectiveAsset.url} alt={`Slide ${slideNum}`} className="w-full h-full object-cover" />
                        ) : isNext ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-300 font-bold font-mono">
                                {slideNum}
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

export function StudioModal({ assetId, initialContext, onClose }: StudioModalProps) {
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
        handlePlan,
        handleGenerate,
        handleResume,
        handleNewVersion,
        videoOverrides,
        setVideoOverrides,
    } = useStudio(assetId, initialContext.type);

    const isVideo = initialContext.type.toLowerCase() === "video";
    const [viewMode, setViewMode] = useState<"edited" | "raw">("edited");

    // Find the correct asset URL based on toggle
    // The backend returns a list. Convention: Slide 1 = Edited, Slide 2 = Raw (or labeled)
    let displayAssets = activeVersion?.assets || [];

    if (isVideo && activeVersion?.status === "completed") {
        const editedAsset = activeVersion.assets.find(a => a.slide_num === 1);
        const rawAsset = activeVersion.assets.find(a => a.slide_num === 2);
        
        // If user wants raw and it exists, show it. Otherwise default to edited/first.
        if (viewMode === "raw" && rawAsset) {
            displayAssets = [rawAsset];
        } else if (editedAsset) {
            displayAssets = [editedAsset];
        }
    }


    // Layout (Resizable)
    const [leftWidth, setLeftWidth] = useState(30);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const expectedTotal = activeVersion?.blueprint?.slides?.length || (isCarousel ? targetSlideCount : 1);

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
                className="bg-white w-full max-w-[95vw] h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-row border border-gray-200"
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

                            {versions.length === 0 ? (
                                <div className="text-sm text-gray-400 italic text-center py-4">No iterations yet.</div>
                            ) : (
                                <div className="space-y-2">
                                    {versions.map((v, i) => (
                                        <button
                                            key={v.id}
                                            onClick={() => setSelectedVersionId(v.id)}
                                            className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-center group
                                                ${v.id === selectedVersionId
                                                    ? "bg-white border-black shadow-sm ring-1 ring-black/5"
                                                    : "bg-white border-transparent hover:border-gray-200"
                                                }`}
                                        >
                                            <div className="flex flex-col flex-1">
                                                <span className={`font-medium ${v.id === selectedVersionId ? "text-gray-900" : "text-gray-500 group-hover:text-gray-700"}`}>
                                                    Version {versions.length - i}
                                                </span>
                                                <span className="text-[10px] text-gray-400">{new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className={`w-2 h-2 rounded-full ${v.status === 'completed' ? 'bg-green-500' :
                                                v.status === 'failed' ? 'bg-red-500' :
                                                    'bg-yellow-500'
                                                }`} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Resizer */}
                <div
                    className="w-[1px] bg-gray-200 cursor-col-resize hover:bg-black hover:w-0.5 transition-all z-10"
                    onMouseDown={(e) => {
                        isDragging.current = true;
                        const up = () => { isDragging.current = false; document.removeEventListener('mouseup', up); document.removeEventListener('mousemove', move) };
                        const move = (ev: MouseEvent) => {
                            if (!containerRef.current) return;
                            const rect = containerRef.current.getBoundingClientRect();
                            const p = ((ev.clientX - rect.left) / rect.width) * 100;
                            if (p > 20 && p < 60) setLeftWidth(p);
                        };
                        document.addEventListener('mouseup', up);
                        document.addEventListener('mousemove', move);
                    }}
                />

                {/* --- Right Column: Studio --- */}
                <div style={{ width: `${100 - leftWidth}%` }} className="flex flex-col bg-white h-full relative">

                    {/* Main Preview Area */}
                    <div className="flex-1 overflow-hidden relative bg-gray-50 flex flex-col">

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

                        {!activeVersion ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl grayscale opacity-50">✨</div>
                                <h3 className="text-gray-900 font-medium mb-1">Canvas Empty</h3>
                                <p className="text-sm max-w-xs mx-auto">Use the controls below to plan or generate your asset.</p>
                            </div>
                        ) : activeVersion.status === "processing" || activeVersion.status === "created" ? (
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
                                    />
                                </div>

                                {/* Status Banner */}
                                {activeVersion.status === "waiting_for_approval" && (
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-2 rounded-full shadow-lg flex items-center gap-4 z-20">
                                        <span className="text-xs font-medium">Reviewing Slide {activeVersion.assets.length}</span>
                                        <button
                                            onClick={handleResume}
                                            disabled={isGenerating}
                                            className="bg-white text-black text-xs font-bold px-3 py-1 rounded hover:bg-gray-100 transition-colors"
                                        >
                                            {isGenerating ? "..." : "Approve & Next →"}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Thumbnails (Overlay or Bottom) */}
                        {isCarousel && activeVersion && (
                            <CarouselThumbnails
                                assets={activeVersion.assets}
                                totalSlides={Math.max(activeVersion.assets.length, expectedTotal)}
                                currentSlide={slideNum}
                                onSelect={setSlideNum}
                                status={activeVersion.status}
                            />
                        )}
                    </div>

                    {/* Bottom Input Area */}
                    <div className="flex-shrink-0 z-20">
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
                            onGenerate={handleGenerate}
                            isPlanning={isPlanning}
                            isGenerating={isGenerating || (activeVersion?.status === "processing")}
                            disabled={isPolling}
                            controls={isCarousel ? (
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
                            ) : undefined}
                        />
                    </div>

                </div>
            </div>
        </div>
    );
}

