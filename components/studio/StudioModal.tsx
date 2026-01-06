"use client";

import { useEffect, useState, useRef } from "react";
import { AssetVersion, getAssetHistory, pollAssetVersion, previewPlan, generateAsset, createFreshVersion, resumeGeneration } from "../../lib/api";
import { AssetPreview } from "./AssetPreview";
import { VersionTimeline } from "./VersionTimeline";
import { PromptBar } from "./PromptBar";

interface StudioModalProps {
    assetId: string; // Mapping to CalendarEntry ID for now
    initialContext: { title: string; channel: string; type: string; baseText: string; date?: string };
    onClose: () => void;
}

// Helper to extract user-friendly message from API error
// Helper to extract user-friendly message from API error
function parseErrorMessage(err: any): string {
    if (typeof err === "string") return err;
    if (err?.detail) return err.detail;
    if (err?.message) return err.message;

    // Fallback: try to stringify if it's an object (like the Pydantic error array)
    try {
        const str = JSON.stringify(err);
        if (str !== "{}") return str;
    } catch {
        // ignore
    }

    return "An unknown error occurred";
}

function BlueprintDisplay({ data }: { data: any }) {
    if (!data) return null;

    // Extract known fields
    const notes = data.composition_notes || data.rationale || data.notes;
    const prompts = data.prompts || data.image_prompts || (data.image_prompt ? [data.image_prompt] : []) || [];

    // Normalize prompts list (handle string[] or object[])
    const cleanPrompts = Array.isArray(prompts) ? prompts.map((p: any) => {
        if (typeof p === "string") return p;
        if (typeof p === "object" && p.prompt) return p.prompt; // Extract prompt, ignore slide_num
        return JSON.stringify(p);
    }) : [];

    return (
        <div className="space-y-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Blueprint</label>

            {notes && (
                <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1">Composition Notes</div>
                    <div className="p-3 bg-blue-50 text-blue-900 rounded border border-blue-100 text-sm whitespace-pre-wrap">
                        {typeof notes === 'object' ? JSON.stringify(notes, null, 2) : notes}
                    </div>
                </div>
            )}

            {cleanPrompts.length > 0 && (
                <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1">Image Prompts</div>
                    <div className="space-y-2">
                        {cleanPrompts.map((p: string, i: number) => (
                            <div key={i} className="p-3 bg-gray-50 text-gray-800 rounded border border-gray-200 text-sm">
                                {p}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Fallback: if empty specific fields but has content, show raw minimally? 
                User asked NOT to prompt raw JSON. So we hide it if we found nothing, 
                or maybe show a generic "No details available" if completely empty. 
            */}
        </div>
    );
}

export function StudioModal({ assetId, initialContext, onClose }: StudioModalProps) {
    const [versions, setVersions] = useState<AssetVersion[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Chatbot Workflow State
    const [prompt, setPrompt] = useState("");
    const [isPlanning, setIsPlanning] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Carousel State
    const [slideNum, setSlideNum] = useState(1);
    const [targetSlideCount, setTargetSlideCount] = useState(5); // Default 5
    const [stepByStep, setStepByStep] = useState(true); // Default enabled for carousels

    const isCarousel = initialContext.type.toLowerCase().includes("carousel");

    // 5. Layout State (Resizable)
    const [leftWidth, setLeftWidth] = useState(33.33); // Percentage
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = 'none'; // Prevent selection
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        // Clamp between 20% and 80%
        if (newLeftWidth > 20 && newLeftWidth < 80) {
            setLeftWidth(newLeftWidth);
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
    };

    const activeVersion = versions.find(v => v.id === selectedVersionId); // Null if draft mode
    // const isProcessing = activeVersion?.status === "processing" || activeVersion?.status === "planning" || isPolling; 

    // Sync Prompt with Selection
    useEffect(() => {
        if (activeVersion) {
            setPrompt(activeVersion.final_used_prompt || (activeVersion.blueprint?.image_prompt as string) || "");
        } else {
            // Draft mode: Keep existing prompt if user was typing? Or clear? 
            // "State A: The 'New Version' View (Zero State)... Input: Empty text box."
            // But if I clicked "New Version", I want empty.
            // If I just opened the modal and there are no versions, empty.
            // If I manually deselected...
            // Let's rely on the explicit "New Version" action to clear it.
        }
    }, [activeVersion?.id]);

    // 1. Init: Load History
    useEffect(() => {
        let mounted = true;
        setIsLoadingHistory(true);
        getAssetHistory(assetId).then(list => {
            if (!mounted) return;
            setVersions(list);
            if (list.length > 0) {
                setSelectedVersionId(list[0].id);
            } else {
                setSelectedVersionId(null); // Explicit draft mode
            }
        }).catch(err => {
            console.error("Failed to load history:", err);
        }).finally(() => {
            if (mounted) setIsLoadingHistory(false);
        });
        return () => { mounted = false; };
    }, [assetId]);

    // 2. Poll Active Version if Processing
    useEffect(() => {
        if (!activeVersion || (activeVersion.status === "completed" || activeVersion.status === "failed" || activeVersion.status === "waiting_for_approval")) return;

        let mounted = true;
        // setIsLoadingHistory(false); // Don't toggle full loading for polling
        setIsPolling(true);
        const interval = setInterval(async () => {
            // If local status is processing but we lost track, we poll.
            try {
                const updated = await pollAssetVersion(activeVersion.id);
                if (!mounted) return;
                if (updated && (updated.status === "completed" || updated.status === "failed" || updated.status === "waiting_for_approval")) {
                    setVersions(prev => prev.map(v => v.id === updated.id ? updated : v));
                    setIsPolling(false);
                }
            } catch (pollErr) {
                console.warn("Polling failed temporarily:", pollErr);
            }
        }, 3000);

        return () => { clearInterval(interval); mounted = false; };
    }, [activeVersion?.id, activeVersion?.status]);


    // Actions
    const handlePlan = async () => {
        setIsPlanning(true);
        setError(null);
        try {
            const data = await previewPlan(assetId, isCarousel ? targetSlideCount : undefined);
            let text = data.resolved_prompt;

            // Fallback: If no single prompt, try to construct from blueprint slides
            if (!text && data.blueprint?.slides && Array.isArray(data.blueprint.slides)) {
                text = data.blueprint.slides
                    .map((s: any) => `[Slide ${s.slide_num}] ${s.image_prompt}`)
                    .join("\n\n");
            }

            setPrompt(text || "");
        } catch (err: any) {
            setError(parseErrorMessage(err));
        } finally {
            setIsPlanning(false);
        }
    };

    const handleGenerate = async () => {
        setError(null);
        setIsGenerating(true);
        try {
            const { versionId } = await generateAsset(assetId, prompt, isCarousel ? stepByStep : false);
            const list = await getAssetHistory(assetId);
            setVersions(list);
            setSelectedVersionId(versionId); // Switches to view the new version
        } catch (err: any) {
            setError(parseErrorMessage(err));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleResume = async () => {
        if (!activeVersion) return;
        setError(null);
        setIsGenerating(true); // Reuse generating state for resume spinner
        try {
            await resumeGeneration(activeVersion.id);
            // Trigger polling manually
            setVersions(prev => prev.map(v => v.id === activeVersion.id ? { ...v, status: 'processing' } : v));
        } catch (err: any) {
            setError(parseErrorMessage(err));
            setIsGenerating(false);
        }
    };

    const handleNewVersion = () => {
        setSelectedVersionId(null);
        setPrompt("");
        setError(null);
    };



    // 4. Loading State
    if (isLoadingHistory) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                <div className="bg-white p-4 rounded-full shadow-2xl animate-in fade-in zoom-in duration-200">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-black" />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                ref={containerRef}
                className="bg-white w-full max-w-[90vw] h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative"
            >

                {/* Left Column: The Plan */}
                <div
                    style={{ width: `${leftWidth}%` }}
                    className="h-full bg-gray-50 border-r border-gray-200 p-6 flex flex-col flex-shrink-0"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold">The Plan</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
                    </div>

                    <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Asset Info</label>
                                {initialContext.date && <span className="text-xs font-mono text-gray-500">{initialContext.date}</span>}
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Channel</div>
                                        <div className="text-sm font-medium text-gray-900">{initialContext.channel}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Type</div>
                                        <div className="text-sm font-medium text-gray-900">{initialContext.type}</div>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Title</div>
                                    <div className="text-sm font-semibold text-gray-900 leading-tight">{initialContext.title}</div>
                                </div>
                                <div className="pt-4 border-t border-gray-100">
                                    <div className="text-[10px] uppercase text-gray-400 font-bold mb-2">Instructions</div>
                                    <div className="text-xs text-gray-600 space-y-2">
                                        <p className="flex items-start gap-2">
                                            <span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5" />
                                            <span>Write in brand voice using <strong>Confident</strong> tone.</span>
                                        </p>
                                        <p className="flex items-start gap-2">
                                            <span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5" />
                                            <span>Include a clear Call to Action.</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Blueprint Section (Refined) */}
                        {activeVersion?.blueprint && (
                            <BlueprintDisplay data={activeVersion.blueprint} />
                        )}
                    </div>

                    {/* Version Timeline at bottom of Left Col */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">Version History</label>
                            <button
                                onClick={handleNewVersion}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded font-medium transition-colors"
                            >
                                + New Version
                            </button>
                        </div>
                        {isLoadingHistory ? (
                            <div className="text-sm text-gray-500 animate-pulse">Loading history...</div>
                        ) : versions.length === 0 ? (
                            <div className="text-sm text-gray-500 italic">No versions yet. Start generating.</div>
                        ) : (
                            <VersionTimeline versions={versions} selectedVersionId={selectedVersionId} onSelectVersion={v => setSelectedVersionId(v.id)} />
                        )}
                    </div>
                </div>



                {/* Drag Handle */}
                <div
                    className="w-1 hover:w-2 bg-transparent hover:bg-blue-400 cursor-col-resize z-10 -ml-0.5 transition-all flex items-center justify-center group"
                    onMouseDown={handleMouseDown}
                >
                    <div className="h-8 w-1 bg-gray-300 rounded-full group-hover:bg-white" />
                </div>

                {/* Right Column: The Studio */}
                <div
                    style={{ width: `${100 - leftWidth}%` }}
                    className="h-full bg-white p-6 flex flex-col flex-shrink-0"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">Asset Studio</h2>
                        {activeVersion?.status === "processing" && (
                            <span className="text-sm text-blue-600 animate-pulse font-medium">✨ AI is thinking...</span>
                        )}
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm flex items-start justify-between">
                            <span className="flex-1 mr-2">{error}</span>
                            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-900 font-bold">✕</button>
                        </div>
                    )}

                    <div className="flex-1 min-h-0 mb-4 bg-gray-100 rounded-lg border border-gray-200 p-4 relative overflow-y-auto">
                        {!activeVersion ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                <div className="bg-white p-4 rounded-full mb-4 shadow-sm text-4xl">✨</div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a New Creation</h3>

                                {isCarousel && (
                                    <div className="flex gap-4 mb-6 mt-2">
                                        <div className="flex flex-col items-start bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Slides</label>
                                            <div className="flex gap-2">
                                                {[3, 4, 5].map(n => (
                                                    <button
                                                        key={n}
                                                        onClick={() => setTargetSlideCount(n)}
                                                        className={`px-3 py-1 text-sm font-medium rounded ${targetSlideCount === n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                                    >
                                                        {n}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-start bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Mode</label>
                                            <label className="flex items-center gap-2 cursor-pointer mt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={stepByStep}
                                                    onChange={e => setStepByStep(e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Step-by-Step Approval</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                <p className="text-gray-500 text-sm max-w-sm">
                                    Describe what you want to see, or click the <strong>Plan</strong> button to let AI suggest a direction based on your strategy.
                                </p>
                            </div>
                        ) : activeVersion.status === "processing" || activeVersion.status === "created" ? (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4" />
                                <h3 className="text-lg font-medium text-gray-900">Creating your asset...</h3>
                                <p className="text-sm text-gray-500 mt-2">This usually takes about 20-30 seconds.</p>
                            </div>
                        ) : activeVersion.status === "waiting_for_approval" ? (
                            <div className="h-full flex flex-col">
                                <div className="flex-1 overflow-hidden relative">
                                    <AssetPreview
                                        assets={activeVersion.assets}
                                        selectedSlideInfo={activeVersion.assets.length > 1 ? { num: slideNum, total: activeVersion.assets.length } : undefined}
                                        onSelectSlide={setSlideNum}
                                    />
                                </div>
                                <div className="p-4 bg-yellow-50 border-t border-yellow-100 flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-yellow-800">Review Slide {activeVersion.assets.length}</div>
                                        <div className="text-xs text-yellow-700">Approve this slide to generate the next one.</div>
                                    </div>
                                    <button
                                        onClick={handleResume}
                                        disabled={isGenerating}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-6 rounded shadow-sm flex items-center gap-2"
                                    >
                                        {isGenerating ? "Generating..." : "Next Slide →"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <AssetPreview
                                assets={activeVersion.assets}
                                selectedSlideInfo={activeVersion.assets.length > 1 ? { num: slideNum, total: activeVersion.assets.length } : undefined}
                                onSelectSlide={setSlideNum}
                            />
                        )}
                    </div>

                    <PromptBar
                        prompt={prompt}
                        onChange={setPrompt}
                        onPlan={handlePlan}
                        onGenerate={handleGenerate}
                        isPlanning={isPlanning}
                        isGenerating={isGenerating || (activeVersion?.status === "processing")}
                        disabled={isPolling}
                    />
                </div>

            </div>
        </div >
    );
}
