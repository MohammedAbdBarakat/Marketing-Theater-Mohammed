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

export function StudioModal({ assetId, initialContext, onClose }: StudioModalProps) {
    const [versions, setVersions] = useState<AssetVersion[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);

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
        });
        return () => { mounted = false; };
    }, [assetId]);

    // 2. Poll Active Version if Processing
    useEffect(() => {
        if (!activeVersion || activeVersion.status === "completed" || activeVersion.status === "failed") return;

        let mounted = true;
        setIsPolling(true);
        const interval = setInterval(async () => {
            const updated = await pollAssetVersion(activeVersion.id);
            if (!mounted) return;
            if (updated && (updated.status === "completed" || updated.status === "failed")) {
                setVersions(prev => prev.map(v => v.id === updated.id ? updated : v));
                setIsPolling(false);
            }
        }, 3000);

        return () => { clearInterval(interval); mounted = false; };
    }, [activeVersion?.id, activeVersion?.status]);


    // Actions
    const handleGenerate = async () => {
        // Create a optimistic placeholder? Or just let api return pending version
        const { versionId } = await startGeneration(assetId);
        // Refresh list to see the new pending version
        const list = await getAssetHistory(assetId);
        setVersions(list);
        setSelectedVersionId(versionId);
    };

    const handleUpdate = async (prompt: string) => {
        if (!activeVersion) return;
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

                    <div className="space-y-6 flex-1 overflow-y-auto">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Context</label>
                            <div className="mt-1 text-sm font-medium">{initialContext.channel} • {initialContext.type}</div>
                            <div className="text-lg font-semibold mt-1">{initialContext.title}</div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Strategy</label>
                            <div className="mt-1 text-sm text-gray-700 bg-white p-3 rounded border">
                                Using <strong>Confident</strong> tone. Visuals should align with branding guidelines.
                                {/* Mock context - could pull real strategy */}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Hook & Caption</label>
                            <div className="mt-1 p-3 bg-white rounded border text-sm text-gray-800 whitespace-pre-wrap">
                                {initialContext.baseText}
                            </div>
                        </div>
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

                    <div className="flex-1 min-h-0 mb-4 bg-gray-100 rounded-lg border border-gray-200 p-4">
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
