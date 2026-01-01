"use client";
import { useState, useEffect, useRef } from "react";
import {
    type AssetVersion,
    generateAsset,
    getVersionStatus,
    type BlueprintOverrides
} from "../../lib/api";
import { PromptModal } from "../common/PromptModal";

interface BlueprintCardProps {
    assetId: string; // Typically the CalendarEntry.id
    title: string;
    channel: string;
    type: string;
    currentVersion: AssetVersion | null;
    onVersionUpdate: (v: AssetVersion) => void;
    isRemote?: boolean; // To force remote behavior logic if needed outside of config
}

export function BlueprintCard({
    assetId,
    title,
    channel,
    type,
    currentVersion,
    onVersionUpdate,
}: BlueprintCardProps) {
    const [baseText, setBaseText] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPolling, setIsPolling] = useState(false);

    // Prompt modal state
    const [showPromptModal, setShowPromptModal] = useState(false);

    // Initialize baseText from current version or default ??
    // Actually, we usually want to show the baseText of the current version.
    useEffect(() => {
        if (currentVersion) {
            // Use prompt_snapshot; if it's JSON, we might want to parse it, but for now allow editing raw or empty.
            // If the backend sends JSON, this might look ugly, but it's what we have.
            setBaseText(currentVersion.prompt_snapshot || "");
        } else {
            // Default brief logic could be here or passed in. 
            // For now we start empty or let the user edit.
            if (!baseText) {
                setBaseText(`Create assets for: ${title}\nChannel: ${channel}\nType: ${type}`);
            }
        }
    }, [currentVersion, title, channel, type]);

    // Polling logic
    // Use ref to access latest currentVersion without re-triggering polling effect
    const currentVersionRef = useRef(currentVersion);
    useEffect(() => { currentVersionRef.current = currentVersion; }, [currentVersion]);

    // Polling logic
    useEffect(() => {
        if (!isPolling) return;

        const tick = async () => {
            const cv = currentVersionRef.current;
            if (!cv) return;

            // If status is final, stop polling (double check)
            if (cv.status === 'completed' || cv.status === 'failed') {
                setIsPolling(false);
                setIsGenerating(false);
                return;
            }

            try {
                const status = await getVersionStatus(cv.id);

                // Safe comparison
                const currentAssetsLen = cv.assets?.length ?? 0;
                const newAssetsLen = status.assets?.length ?? 0;

                const hasChanged =
                    status.status !== cv.status ||
                    newAssetsLen !== currentAssetsLen ||
                    // Optional: Check if thought signature updated
                    status.render_metadata?.thought_signature !== cv.render_metadata?.thought_signature;

                if (hasChanged) {
                    onVersionUpdate(status);
                }

                if (status.status === 'completed' || status.status === 'failed') {
                    setIsPolling(false);
                    setIsGenerating(false);
                }
            } catch (err) {
                console.error("Polling failed", err);
            }
        };

        const interval = setInterval(tick, 2000);
        return () => clearInterval(interval);
    }, [isPolling, onVersionUpdate]);

    // If we receive a version that is processing (e.g. on mount), start polling
    useEffect(() => {
        if (currentVersion && (currentVersion.status === 'processing')) {
            setIsPolling(true);
            setIsGenerating(true);
        }
    }, [currentVersion]);

    const handleGenerate = async (overrides: BlueprintOverrides = {}) => {
        setIsGenerating(true);
        try {
            // 1. Trigger generation
            const res = await generateAsset(assetId, {
                blueprint_overrides: overrides,
                context: {
                    baseText: baseText,
                    channel,
                    type
                }
            });

            // 2. Fetch the initial status object/placeholder
            // The backend returns { version_id, ... }
            // We immediately create a skeletal version or fetch it
            const initialVersion = await getVersionStatus(res.version_id);
            onVersionUpdate(initialVersion);
            setIsPolling(true);
            setIsEditing(false);
        } catch (err) {
            console.error("Generation failed", err);
            setIsGenerating(false);
            alert("Failed to start generation. Check console.");
        }
    };

    return (
        <div className="border rounded-lg p-4 bg-white shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Asset Blueprint</h3>
                <div className="flex gap-2">
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="text-sm px-3 py-1 border rounded hover:bg-gray-50 transition-colors"
                            disabled={isGenerating}
                        >
                            Edit Brief
                        </button>
                    )}
                    {isEditing && (
                        <button
                            onClick={() => setIsEditing(false)}
                            className="text-sm px-3 py-1 text-gray-600 hover:text-gray-900"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={() => handleGenerate()}
                        disabled={isGenerating}
                        className="text-sm px-3 py-1 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        {isGenerating ? (
                            <>
                                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Generating...
                            </>
                        ) : (
                            "Generate"
                        )}
                    </button>
                </div>
            </div>

            <div className="relative">
                <textarea
                    value={baseText}
                    onChange={(e) => setBaseText(e.target.value)}
                    disabled={!isEditing || isGenerating}
                    className={`w-full border rounded-md p-3 text-sm h-32 resize-none transition-colors ${isEditing ? "bg-white border-gray-300 focus:ring-1 focus:ring-black" : "bg-gray-50 border-gray-200 text-gray-600"
                        }`}
                    placeholder="Enter asset brief..."
                />
                {currentVersion && currentVersion.status === 'processing' && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                        <div className="bg-white px-4 py-2 rounded-full shadow-md text-xs font-medium animate-pulse border">
                            Processing v{currentVersion.id.slice(0, 4)}...
                        </div>
                    </div>
                )}
            </div>

            {/* Status display if needed, though button shows state too */}
            {currentVersion?.render_metadata?.thought_signature && (
                <div className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">
                    Thinking: {currentVersion.render_metadata.thought_signature}
                </div>
            )}
        </div>
    );
}
