"use client";

import { useEffect, useState, useRef } from "react";
import { AssetVersion, getAssetHistory, pollAssetVersion, startGeneration, submitEdit } from "../../lib/api";
import { AssetPreview } from "./AssetPreview";
import { VersionTimeline } from "./VersionTimeline";
import { EditControls } from "./EditControls";

interface StudioModalProps {
    assetId: string; // Mapping to CalendarEntry ID for now
    initialContext: { title: string; channel: string; type: string; baseText: string };
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
    const [error, setError] = useState<string | null>(null);

    // Carousel State
    const [slideNum, setSlideNum] = useState(1);

    const activeVersion = versions.find(v => v.id === selectedVersionId) || versions[0];
    const isProcessing = activeVersion?.status === "processing" || activeVersion?.status === "planning" || isPolling;

    // 1. Init: Load History
    useEffect(() => {
        let mounted = true;
        getAssetHistory(assetId).then(list => {
            if (!mounted) return;
            setVersions(list);
            if (list.length > 0) setSelectedVersionId(list[0].id);
        }).catch(err => {
            console.error("Failed to load history:", err);
        });
        return () => { mounted = false; };
    }, [assetId]);

   // 2. Poll Active Version if Processing
    useEffect(() => {
        // SAFETY CHECK: Do not poll if ID is missing or undefined
        if (!activeVersion?.id || activeVersion.id === "undefined") return;
        
        if (activeVersion.status === "completed" || activeVersion.status === "failed") return;

        let mounted = true;
        setIsPolling(true);
        const interval = setInterval(async () => {
            if (!activeVersion.id) return; // Double check inside loop
            
            try {
                const updated = await pollAssetVersion(activeVersion.id);
                if (!mounted) return;
                
                if (updated && (updated.status === "completed" || updated.status === "failed")) {
                    setVersions(prev => prev.map(v => v.id === updated.id ? updated : v));
                    setIsPolling(false);
                }
            } catch (e) {
                console.log("Polling error (might be too early):", e);
            }
        }, 3000);

        return () => { clearInterval(interval); mounted = false; };
    }, [activeVersion?.id, activeVersion?.status]);


    // Actions
    const handleGenerate = async () => {
        // 1. Start on Backend
        const { versionId } = await startGeneration(assetId);
        
        // 2. Create Optimistic Version (The "Placeholder")
        // We manually build what we expect the new version to look like
        const optimisticVersion: AssetVersion = {
            id: versionId,
            status: "planning",
            createdAt: new Date().toISOString(),
            assets: [],
            edit_reason: "Generation Triggered",
            // Inherit blueprint from current active if available
            blueprint: activeVersion?.blueprint
        };

        // 3. Force Update State IMMEDIATELY
        // We add the new version to the top of the list so .find() works instantly
        setVersions(prev => [optimisticVersion, ...prev]);
        setSelectedVersionId(versionId);
        
        // 4. Background Refresh
        // We still fetch the real list to be safe, but we don't block the UI switch
        getAssetHistory(assetId).then(list => {
            // Only update if we found the new ID, otherwise keep our optimistic one
            if (list.find(v => v.id === versionId)) {
                setVersions(list);
            }
        });
        setError(null);
        try {
            const { versionId } = await startGeneration(assetId);
            const list = await getAssetHistory(assetId);
            setVersions(list);
            setSelectedVersionId(versionId);
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white w-full max-w-6xl h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row">

                {/* Left Column: The Plan */}
                <div className="w-full md:w-1/3 bg-gray-50 border-r border-gray-200 p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold">The Plan</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
                    </div>

                    <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Context</label>
                            <div className="mt-1 text-sm font-medium">{initialContext.channel} • {initialContext.type}</div>
                            <div className="text-lg font-semibold mt-1">{initialContext.title}</div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Strategy</label>
                            <div className="mt-1 text-sm text-gray-700 bg-white p-3 rounded border">
                                Using <strong>Confident</strong> tone. Visuals should align with branding guidelines.
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Hook & Caption</label>
                            <div className="mt-1 p-3 bg-white rounded border text-sm text-gray-800 whitespace-pre-wrap">
                                {initialContext.baseText}
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
                        {versions.length === 0 ? (
                            <div className="text-sm text-gray-500 italic">No versions yet. Start generating.</div>
                        ) : (
                            <VersionTimeline versions={versions} selectedVersionId={selectedVersionId} onSelectVersion={v => setSelectedVersionId(v.id)} />
                        )}
                    </div>
                </div>

                {/* Right Column: The Studio */}
                <div className="w-full md:w-2/3 bg-white p-6 flex flex-col">
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

                    <div className="flex-1 min-h-0 mb-4 bg-gray-100 rounded-lg border border-gray-200 p-4 relative">
                        {versions.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                <div className="text-gray-400 mb-4">Ready to create assets?</div>
                                <button
                                    onClick={handleGenerate}
                                    className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:scale-105 transition-transform"
                                >
                                    Generate Initial Draft
                                </button>
                            </div>
                        ) : (
                            <AssetPreview
                                assets={activeVersion.assets}
                                selectedSlideInfo={activeVersion.assets.length > 1 ? { num: slideNum, total: activeVersion.assets.length } : undefined}
                                onSelectSlide={setSlideNum}
                            />
                        )}
                    </div>

                    {/* Edit Controls */}
                    {versions.length > 0 && (
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
        </div>
    );
}
