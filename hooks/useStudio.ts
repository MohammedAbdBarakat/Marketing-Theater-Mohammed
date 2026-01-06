import { useState, useEffect } from "react";
import { AssetVersion, getAssetHistory, pollAssetVersion, previewPlan, generateAsset, resumeGeneration } from "../lib/api";

export function useStudio(assetId: string, initialType: string) {
    // Data State
    const [versions, setVersions] = useState<AssetVersion[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Workflow State
    const [prompt, setPrompt] = useState("");
    const [isPlanning, setIsPlanning] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPolling, setIsPolling] = useState(false);

    // Carousel Config
    const isCarousel = initialType.toLowerCase().includes("carousel");
    const [slideNum, setSlideNum] = useState(1);
    const [targetSlideCount, setTargetSlideCount] = useState(5);
    const [stepByStep, setStepByStep] = useState(true);

    // Active Version
    const activeVersion = selectedVersionId
        ? versions.find(v => v.id === selectedVersionId) || null
        : null;

    // Reset slide on version change
    useEffect(() => setSlideNum(1), [selectedVersionId]);

    // Load History
    useEffect(() => {
        let mounted = true;
        setIsLoadingHistory(true);
        getAssetHistory(assetId).then(list => {
            if (!mounted) return;
            setVersions(list);
            if (list.length > 0) setSelectedVersionId(list[0].id);
        }).catch(err => {
            console.warn(err);
            setError("Could not load history.");
        }).finally(() => {
            if (mounted) setIsLoadingHistory(false);
        });
        return () => { mounted = false; };
    }, [assetId]);

    // Polling
    useEffect(() => {
        if (!activeVersion || ["completed", "failed", "waiting_for_approval"].includes(activeVersion.status)) {
            setIsPolling(false);
            return;
        }
        setIsPolling(true);
        const interval = setInterval(async () => {
            try {
                const refreshed = await pollAssetVersion(activeVersion.id);
                if (refreshed) setVersions(prev => prev.map(v => v.id === refreshed.id ? refreshed : v));
            } catch (err) { console.warn(err); }
        }, 2000);
        return () => clearInterval(interval);
    }, [activeVersion?.id, activeVersion?.status]);

    // Actions
    const parseErrorMessage = (err: any): string => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (typeof err === "string") return err;
        if (err?.detail) return err.detail;
        if (err?.message) return err.message;
        return "An unknown error occurred";
    };

    const handlePlan = async () => {
        setIsPlanning(true);
        setError(null);
        try {
            const data = await previewPlan(assetId, isCarousel ? targetSlideCount : undefined);
            let text = data.resolved_prompt;
            if (!text && data.blueprint?.slides) {
                text = data.blueprint.slides.map((s: any) => `[Slide ${s.slide_num}] ${s.image_prompt}`).join("\n\n");
            }
            setPrompt(text || "");
        } catch (err: any) { setError(parseErrorMessage(err)); }
        finally { setIsPlanning(false); }
    };

    const handleGenerate = async () => {
        setError(null);
        setIsGenerating(true);
        try {
            const { versionId } = await generateAsset(assetId, prompt, isCarousel ? stepByStep : false);
            const list = await getAssetHistory(assetId);
            setVersions(list);
            setSelectedVersionId(versionId);
        } catch (err: any) { setError(parseErrorMessage(err)); }
        finally { setIsGenerating(false); }
    };

    const handleResume = async () => {
        if (!activeVersion) return;
        setError(null);
        setIsGenerating(true);
        try {
            await resumeGeneration(activeVersion.id);
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

    return {
        // State
        versions,
        activeVersion,
        selectedVersionId,
        setSelectedVersionId,
        isLoadingHistory,
        error,

        // Workflow
        prompt,
        setPrompt,
        isPlanning,
        isGenerating,
        isPolling,

        // Config
        isCarousel,
        slideNum,
        setSlideNum,
        targetSlideCount,
        setTargetSlideCount,
        stepByStep,
        setStepByStep,

        // Actions
        handlePlan,
        handleGenerate,
        handleResume,
        handleNewVersion
    };
}
