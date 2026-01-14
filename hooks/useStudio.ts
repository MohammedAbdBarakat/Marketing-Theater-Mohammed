import { useState, useEffect, useRef } from "react";
import { AssetVersion, getAssetHistory, pollAssetVersion, previewPlan, generateAsset, resumeGeneration, VideoOverrides } from "../lib/api";

export function useStudio(assetId: string, initialType: string) {
    // Data State
    const [versions, setVersions] = useState<AssetVersion[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [videoOverrides, setVideoOverrides] = useState<VideoOverrides>({});

    // Workflow State
    const [prompt, setPrompt] = useState("");
    const [structuredPrompts, setStructuredPrompts] = useState<string[]>(
        initialType.toLowerCase().includes("carousel") ? Array.from({ length: 3 }).map(() => "") : []
    ); // New state for structured slides
    const [isPlanning, setIsPlanning] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPolling, setIsPolling] = useState(false);

    // Carousel Config
    const isCarousel = initialType.toLowerCase().includes("carousel");
    const [slideNum, setSlideNum] = useState(1);
    const [targetSlideCount, setTargetSlideCountState] = useState(5);
    const [stepByStep, setStepByStep] = useState(true);

    const setTargetSlideCount = (count: number) => {
        setTargetSlideCountState(count);
        // Auto-switch to structured mode or resize if already in it
        setStructuredPrompts(prev => {
            const newArr = Array.from({ length: count }).map(() => "");
            // Preserve existing inputs
            prev.forEach((val, idx) => {
                if (idx < count) newArr[idx] = val;
            });

            // If coming from single-prompt mode, try to be helpful
            if (prev.length === 0 && prompt.trim()) {
                newArr[0] = prompt;
            }
            return newArr;
        });
    };

    // Active Version
    const activeVersion = selectedVersionId
        ? versions.find(v => v.id === selectedVersionId) || null
        : null;

    // Reset slide on version change
    useEffect(() => setSlideNum(1), [selectedVersionId]);

    const fetchedAssetId = useRef<string | null>(null);

    // Load History
    useEffect(() => {
        // Prevent double-fetch in StrictMode
        if (fetchedAssetId.current === assetId) return;
        fetchedAssetId.current = assetId;

        setIsLoadingHistory(true);
        getAssetHistory(assetId).then(list => {
            // Ensure we only update if this is still the relevant asset
            if (fetchedAssetId.current !== assetId) return;

            setVersions(list);
            if (list.length > 0) setSelectedVersionId(list[0].id);
        }).catch(err => {
            if (fetchedAssetId.current !== assetId) return;
            console.warn(err);
            setError("Could not load history.");
        }).finally(() => {
            if (fetchedAssetId.current !== assetId) return;
            setIsLoadingHistory(false);
        });
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            const data = await previewPlan(assetId, isCarousel ? targetSlideCount : undefined, videoOverrides);

            if (isCarousel && data.blueprint?.slides) {
                // Structured Handling
                const slides = data.blueprint.slides.sort((a: any, b: any) => a.slide_num - b.slide_num);
                const texts = slides.map((s: any) => s.image_prompt);
                setStructuredPrompts(texts);
                setPrompt(texts.join("\n\n")); // Fallback/Sync for single text box if needed
            } else {
                // Single Image / Simple
                setPrompt(data.resolved_prompt || "");
                setStructuredPrompts([]);
            }
        } catch (err) { setError(parseErrorMessage(err)); }
        finally { setIsPlanning(false); }
    };

    const handleGenerate = async () => {
        setError(null);
        setIsGenerating(true);
        try {
            // Construct final prompt based on mode
            let finalPromptToSend = prompt;
            if (isCarousel && structuredPrompts.length > 0) {
                finalPromptToSend = structuredPrompts.map((p, i) => `[Slide ${i + 1}] ${p}`).join("\n\n");
            }

            // Optimistic Update: API now returns full object
            const newVersion = await generateAsset(assetId, finalPromptToSend, isCarousel ? stepByStep : false, isCarousel ? targetSlideCount : 1);

            setVersions(prev => {
                // Deduplicate: If ID already exists (race condition), don't add again
                if (prev.some(v => v.id === newVersion.id)) return prev;
                return [newVersion, ...prev];
            });
            setSelectedVersionId(newVersion.id);

            // Fetch history in background just in case, but no block
            getAssetHistory(assetId).then(list => {
                setVersions(list); // We might want smarter merge here too, but dedupe on add helps most
            }).catch(console.warn);

        } catch (err) { setError(parseErrorMessage(err)); }
        finally { setIsGenerating(false); }
    };

    const handleResume = async () => {
        if (!activeVersion) return;
        setError(null);
        setIsGenerating(true);
        try {
            await resumeGeneration(activeVersion.id);
            setVersions(prev => prev.map(v => v.id === activeVersion.id ? { ...v, status: 'processing' } : v));
        } catch (err) {
            setError(parseErrorMessage(err));
            setIsGenerating(false);
        }
    };

    const handleNewVersion = () => {
        setSelectedVersionId(null);
        setPrompt("");
        setStructuredPrompts([]);
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
        videoOverrides,
        setVideoOverrides,

        // Workflow
        prompt,
        setPrompt,
        structuredPrompts,
        setStructuredPrompts,
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
