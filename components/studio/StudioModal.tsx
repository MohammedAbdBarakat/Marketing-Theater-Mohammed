"use client";

import { useEffect, useState, useRef } from "react";
import { AssetVersion, getAssetHistory, pollAssetVersion, planAsset, updateBlueprint, executeGeneration, submitEdit } from "../../lib/api";
import { AssetPreview } from "./AssetPreview";
import { VersionTimeline } from "./VersionTimeline";
import { EditControls } from "./EditControls";

interface StudioModalProps {
    assetId: string; // Mapping to CalendarEntry ID for now
    initialContext: { title: string; channel: string; type: string; baseText: string; date?: string };
    onClose: () => void;
}

// Helper to extract user-friendly message from API error
function parseErrorMessage(err: any): string {
    const raw = err.message || toString();
    // Look for JSON payload in the error string: HTTP 400 ...: {"detail": "..."}
    const match = raw.match(/HTTP \d{3} .*?: (\{.*\})/);
    if (match && match[1]) {
        try {
            const json = JSON.parse(match[1]);
            if (json.detail) return json.detail;
            if (json.message) return json.message;
        } catch {
            // ignore parse error
        }
    }
    return raw; // Fallback to raw string
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
                        {notes}
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
    const [isLoadingHistory, setIsLoadingHistory] = useState(true); // New state for initial load
    const [error, setError] = useState<string | null>(null);

    // Carousel State
    const [slideNum, setSlideNum] = useState(1);

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

    const activeVersion = versions.find(v => v.id === selectedVersionId) || versions[0];
    const isProcessing = activeVersion?.status === "processing" || activeVersion?.status === "planning" || isPolling;

    // 1. Init: Load History
    useEffect(() => {
        let mounted = true;
        setIsLoadingHistory(true);
        getAssetHistory(assetId).then(list => {
            if (!mounted) return;
            setVersions(list);
            if (list.length > 0) setSelectedVersionId(list[0].id);
        }).catch(err => {
            console.error("Failed to load history:", err);
        }).finally(() => {
            if (mounted) setIsLoadingHistory(false);
        });
        return () => { mounted = false; };
    }, [assetId]);

    // 2. Poll Active Version if Processing
    useEffect(() => {
        if (!activeVersion || activeVersion.status === "completed" || activeVersion.status === "failed") return;

        let mounted = true;
        setIsLoadingHistory(false); // Ensure loading is off if we are polling
        setIsPolling(true);
        const interval = setInterval(async () => {
            const updated = await pollAssetVersion(activeVersion.id);
            if (!mounted) return;
            if (updated && (updated.status === "completed" || updated.status === "failed" || updated.status === "ready_to_render")) {
                setVersions(prev => prev.map(v => v.id === updated.id ? updated : v));
                setIsPolling(false);
            }
        }, 7000); // Increased from 3000 to 7000

        return () => { clearInterval(interval); mounted = false; };
    }, [activeVersion?.id, activeVersion?.status]);


    // Actions
    // Actions
    const handleGenerate = async () => {
        setError(null);
        try {
            // New Plan-First Workflow
            const { versionId } = await planAsset(assetId);
            const list = await getAssetHistory(assetId);
            setVersions(list);
            setSelectedVersionId(versionId);
        } catch (err: any) {
            setError(parseErrorMessage(err));
        }
    };

    const handleExecute = async () => {
        if (!activeVersion) return;
        setError(null);
        try {
            await executeGeneration(assetId, activeVersion.id);
            // Manually set status to processing locally to trigger polling
            setVersions(prev => prev.map(v => v.id === activeVersion.id ? { ...v, status: 'processing' } : v));
        } catch (err: any) {
            setError(parseErrorMessage(err));
        }
    };

    const handleUpdate = async (prompt: string) => {
        if (!activeVersion) return;
        setError(null);
        try {
            // If carousel, send slide num
            const isCarousel = activeVersion.assets.length > 1;
            const { newVersionId } = await submitEdit(assetId, {
                sourceVersionId: activeVersion.id,
                prompt,
                slideNum: isCarousel ? slideNum : undefined
            });
            const list = await getAssetHistory(assetId);
            setVersions(list);
            setSelectedVersionId(newVersionId);
        } catch (err: any) {
            setError(parseErrorMessage(err));
        }
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
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Version History</label>
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
                        {versions.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                <div className="text-gray-400 mb-4">Ready to create assets?</div>
                                <button
                                    onClick={handleGenerate}
                                    className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:scale-105 transition-transform"
                                >
                                    Plan Asset
                                </button>
                            </div>
                        ) : activeVersion.status === "ready_to_render" ? (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
                                <h3 className="text-xl font-bold mb-4">Blueprint Ready</h3>
                                <div className="bg-white p-4 rounded border border-gray-200 w-full text-left mb-6 shadow-sm">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">AI Plan</label>
                                    <textarea
                                        className="w-full text-sm text-gray-800 border-none resize-none focus:ring-0 bg-transparent p-0"
                                        rows={4}
                                        defaultValue={String(activeVersion.blueprint?.image_prompt || "")}
                                        placeholder="Enter image prompt..."
                                        onBlur={(e) => updateBlueprint(activeVersion.id, { image_prompt: e.target.value })}
                                    />
                                </div>
                                <button
                                    onClick={handleExecute}
                                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 hover:scale-105 transition-all shadow-lg"
                                >
                                    Generate Final Asset
                                </button>
                                <p className="text-xs text-gray-400 mt-4">
                                    Review the plan above. Click generate to maximize credits.
                                </p>
                            </div>
                        ) : (
                            <AssetPreview
                                assets={activeVersion.assets}
                                selectedSlideInfo={activeVersion.assets.length > 1 ? { num: slideNum, total: activeVersion.assets.length } : undefined}
                                onSelectSlide={setSlideNum}
                            />
                        )}
                    </div>

                    {/* Edit Controls - Only show for completed or processing, not planning status? 
                        Actually, manual said "Edit Plan" is optional. For now, hiding EditControls in ready_to_render to keep it simple as per design.
                    */}
                    {versions.length > 0 && activeVersion.status !== "ready_to_render" && (
                        <div className="pt-4 border-t border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">
                                Refine {activeVersion.assets.length > 1 ? `Slide ${slideNum}` : "Asset"}
                            </label>
                            <EditControls
                                onUpdate={handleUpdate}
                                isProcessing={isProcessing}
                                placeholder={activeVersion.assets.length > 1 ? `Changes apply to Slide ${slideNum} (e.g. 'Add text overlay')` : undefined}
                            />
                        </div>
                    )}
                </div>

            </div>
        </div >
    );
}
