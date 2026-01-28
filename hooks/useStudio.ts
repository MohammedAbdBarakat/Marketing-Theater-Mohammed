import { useState, useEffect, useRef } from "react";
import { IS_REMOTE } from "../lib/config";
import { useRunStream } from "./useRunStream";
import { AssetVersion, AssetUpdateEvent, getAssetHistory, pollAssetVersion, previewPlan, generateAsset, resumeGeneration, editAsset, VideoOverrides } from "../lib/api";

export function useStudio(runId: string, assetId: string, initialType: string) {
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
    const [targetSlideCount, setTargetSlideCountState] = useState(3);
    const [stepByStep, setStepByStep] = useState(true);

    // Aspect Ratio Config
    const [aspectRatio, setAspectRatio] = useState<string>("4:5");

    // ✨ Style Config
    const [styleClass, setStyleClass] = useState<string | null>(null);
    const [useCustomStyles, setUseCustomStyles] = useState(true);

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

    // Polling (Legacy/Mock Support)
    useEffect(() => {
        // Only poll if NOT remote (mock mode) or if stream fails?
        // Let's strictly use polling for Mock mode as Stream URL won't exist.
        if (IS_REMOTE) return;

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

    // Streaming (Remote Only)
    useRunStream(IS_REMOTE ? runId : undefined, (event: AssetUpdateEvent) => {
        setVersions(prev => {
            return prev.map(v => {
                if (v.id !== event.version_id) return v;

                // Found the version, update it
                let newStatus = event.status as any;

                // Step-by-step mode status handling:
                // 1. If we receive a slide URL with processing status, set to waiting_for_approval
                // 2. If we receive processing WITHOUT a URL, it means resume was triggered - allow it
                // 3. Never downgrade from waiting_for_approval to processing if there's no URL
                if (stepByStep) {
                    if (event.url && newStatus === 'processing') {
                        // Received a new slide URL - waiting for user to approve next
                        newStatus = 'waiting_for_approval';
                    } else if (!event.url && v.status === 'waiting_for_approval' && newStatus === 'processing') {
                        // Resume triggered - allow transition to processing
                        // This is correct, user clicked resume
                    } else if (!event.url && newStatus === 'processing' && v.assets?.length > 0) {
                        // Backend sent processing status without URL after we already have assets
                        // This might happen if backend sends status before slide completion
                        // Keep status as-is to avoid flicker, or if we were waiting_for_approval, keep it
                        if (v.status === 'waiting_for_approval') {
                            newStatus = 'waiting_for_approval'; // Don't downgrade
                        }
                    }
                }

                const updated = { ...v, status: newStatus };


                // ✨ CAPTURE MESSAGE
                if (event.message || event.progress_message) {
                    updated.current_progress_message = event.message || event.progress_message;
                }

                // Handle Slide/URL Update
                if (event.url) {
                    let newAssets: any[] = [];

                    // Check if it's a JSON string (Array of slides)
                    if (event.url.trim().startsWith('[') || event.url.trim().startsWith('{')) {
                        try {
                            const parsed = JSON.parse(event.url);
                            if (Array.isArray(parsed)) {
                                newAssets = parsed;
                            } else {
                                newAssets = [parsed];
                            }
                        } catch (e) {
                            console.warn("Failed to parse event.url as JSON", e);
                            // Fallback to single asset if parse fails but it looked like JSON? 
                            // Or maybe it was just a weird URL. Treat as single.
                            newAssets = [{
                                type: "image",
                                url: event.url,
                                slide_num: event.slide_num
                            }];
                        }
                    } else {
                        // Regular URL string
                        const determinedType = initialType.toLowerCase() === 'video' ? 'video' : 'image';
                        newAssets = [{
                            type: determinedType,
                            url: event.url,
                            slide_num: event.slide_num
                        }];
                    }

                    // Upsert Logic
                    const existingAssets = [...(v.assets || [])];

                    newAssets.forEach(newItem => {
                        if (newItem.slide_num) {
                            const idx = existingAssets.findIndex(a => a.slide_num === newItem.slide_num);
                            if (idx >= 0) {
                                existingAssets[idx] = { ...existingAssets[idx], ...newItem }; // Merge/Update
                            } else {
                                existingAssets.push(newItem);
                            }
                        } else {
                            // If no slide num, maybe replace all? or push?
                            // For single image scenario, we usually just replace.
                            if (!event.slide_num && newAssets.length === 1) {
                                // If it's a single update without slide num, assume it's THE asset.
                                // But if we have existing assets and this is a generic update?
                                // Let's simplify: if no slide_num in event OR item, replace list? 
                                // Or generic add?
                                // User said: "media url json should have this structure for EACH slide"
                                // So we expect slide_num.
                                existingAssets.push(newItem);
                            }
                        }
                    });

                    // If not carousel (no slide nums involved at all), replace
                    if (!event.slide_num && newAssets.length === 1 && !newAssets[0].slide_num) {
                        updated.assets = newAssets;
                    } else {
                        updated.assets = existingAssets.sort((a, b) => (a.slide_num || 0) - (b.slide_num || 0));
                    }
                }

                // Handle Completion Count (optional sync)
                if (event.status === 'completed' && event.count) {
                    // Could re-fetch history here to be perfectly synced, 
                    // but we might have all data from streams.
                }

                return updated;
            });
        });
    });

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
            const data = await previewPlan(assetId, isCarousel ? targetSlideCount : undefined, videoOverrides); // Pass partial overrides if we supported them

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
            // ✅ AUTOPILOT MODE: If all prompts are empty, send undefined to trigger backend auto-planner
            let finalPromptToSend: string | undefined = prompt.trim() || undefined;

            if (isCarousel && structuredPrompts.length > 0) {
                // Check if ANY slide has actual content
                const hasContent = structuredPrompts.some(p => p.trim().length > 0);

                if (hasContent) {
                    // Manual mode: user provided slide content
                    finalPromptToSend = structuredPrompts.map((p, i) => `[Slide ${i + 1}] ${p}`).join("\n\n");
                } else {
                    // Autopilot mode: no content provided, let backend generate
                    finalPromptToSend = undefined;
                }
            }

            // Optimistic Update: API returns initiation object { version_id, ... }
            const res: any = await generateAsset(
                assetId,
                finalPromptToSend,
                isCarousel ? stepByStep : false,
                isCarousel ? targetSlideCount : 1,
                {
                    aspect_ratio: aspectRatio,
                    style_class: styleClass || undefined,
                    use_custom_styles: useCustomStyles
                }
            );

            // Construct proper AssetVersion from response
            const newVersion: AssetVersion = {
                id: res.version_id || res.id, // Handle both shapes
                status: 'processing',
                createdAt: new Date().toISOString(),
                assets: [],
                blueprint: {
                    image_prompt: finalPromptToSend,
                    slides: isCarousel && structuredPrompts.length > 0
                        ? structuredPrompts.map((p, i) => ({ slide_num: i + 1, image_prompt: p }))
                        : undefined
                },
                final_used_prompt: finalPromptToSend
            };

            // Robust State Update Helper
            setVersions(prev => {
                // Ensure we don't duplicate if it already exists (unlikely for new gen)
                const combined = [newVersion, ...prev];
                // Unique by ID
                const map = new Map();
                combined.forEach(v => {
                    if (!map.has(v.id)) map.set(v.id, v);
                });
                return Array.from(map.values());
            });
            setSelectedVersionId(newVersion.id);

            // Fetch history in background just in case, but no block
            getAssetHistory(assetId).then(list => {
                setVersions(prev => {
                    const prevMap = new Map(prev.map(v => [v.id, v]));
                    const remoteIds = new Set(list.map(v => v.id));

                    // Debugging Duplicates
                    if (process.env.NODE_ENV === 'development') {
                        console.log("Merge Debug:", {
                            newVersionId: newVersion.id,
                            remoteIds: Array.from(remoteIds),
                            localIds: Array.from(prevMap.keys())
                        });
                    }

                    // 1. Start with remote list (source of truth for existing)
                    const merged = list.map(remoteV => {
                        const localV = prevMap.get(remoteV.id);
                        if (localV) {
                            // ✨ Preserve ephemeral stream data (message)
                            if (localV.current_progress_message) {
                                remoteV.current_progress_message = localV.current_progress_message;
                            }

                            if (localV.status === 'processing' || localV.status === 'waiting_for_approval') {
                                // If local has more assets (from stream), keep them.
                                const localCount = localV.assets?.length || 0;
                                const remoteCount = remoteV.assets?.length || 0;
                                if (localCount > remoteCount) {
                                    remoteV.assets = localV.assets;
                                }
                            }
                        }
                        return remoteV;
                    });

                    // 2. Add back any local-only versions that are likely optimistic (processing/new)
                    // We only keep them if they are the currently selected one or very recent. 
                    // For simplicity, we keep any active/processing ones not in remote.
                    prev.forEach(localV => {
                        if (!remoteIds.has(localV.id)) {
                            // It's local only. Is it a ghost or optimistic?
                            // If it's the one we just created (newVersion), definitely keep it.
                            if (localV.id === newVersion.id || localV.status === 'processing' || localV.status === 'created') {
                                // Prepend or Append? Usually new ones are at top.
                                // If existing list is sorted desc, and this is new, it should be at top.
                                // Logic: merged is presumably sorted by date desc from backend.
                                // We'll just unshift it if it's newer than the first key? 
                                // Actually, let's just push it to a separate list and concat.
                                // However, simpler to just put it at the very top since it's "latest".
                            }
                        }
                    });

                    // Re-construct clean list
                    // Re-construct clean list
                    // Filter optimistic: Keep ONLY if it is NOT in remote AND (it is the new one OR is actively processing)
                    const optimistic = prev.filter(p => {
                        const existsRemote = remoteIds.has(p.id);
                        const isRelevant = p.id === newVersion.id || p.status === 'processing';
                        return !existsRemote && isRelevant;
                    });
                    return [...optimistic, ...merged];
                });
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
        } finally {
            setIsGenerating(false);
        }
    };

    const handleNewVersion = () => {
        setSelectedVersionId(null);
        setPrompt("");
        // Reset to default 3 for carousel, or empty for others
        const defaultSlides = isCarousel ? Array.from({ length: 3 }).map(() => "") : [];
        setStructuredPrompts(defaultSlides);
        setTargetSlideCountState(3);
        setError(null);
    };

    // Validation helper for edit capability
    const canEditSlide = (slideNum: number): boolean => {
        if (!activeVersion) return false;

        // Check version status
        // Allow 'processing' if we want to allow editing while others generate? No, usually lock it.
        // But if the user says it's not visible, maybe status is weird.
        if (!['completed', 'waiting_for_approval', 'processing'].includes(activeVersion.status)) {
            // 'processing' is technically active, but if we have the asset, maybe valid?
            // Actually, if it's processing, sending another edit might race. 
            // The user complaint might be about single images.
            if (activeVersion.status !== 'processing') return false;
            // If processing, only allow if we actually have the asset (it might be a previous slide that is done)
        }

        // Check if slide exists in assets
        const slideExists = activeVersion.assets?.some(
            item => (item.slide_num === slideNum || (!item.slide_num && slideNum === 1)) && item.url
        );

        return !!slideExists && activeVersion.status !== 'created'; // Ensure not just created empty
    };

    const editSlide = async (slideIndex: number, editPrompt: string, referenceImages?: string[]) => {
        if (!activeVersion) return;
        setIsGenerating(true);
        setError(null);

        try {
            const res = await editAsset(assetId, {
                sourceVersionId: activeVersion.id,
                slide_num: slideIndex,
                prompt: editPrompt,
                reference_images: referenceImages
            });

            // Optimistic Update: Create placeholder for the new version
            const newVersion: AssetVersion = {
                id: res.new_version_id,
                status: 'processing',
                createdAt: new Date().toISOString(),
                assets: [], // Start empty, will fill from stream
                edit_reason: `Edit Slide ${slideIndex}: ${editPrompt}`,
                blueprint: activeVersion.blueprint, // Inherit blueprint
                current_progress_message: "Initiating edit..."
            };

            setVersions(prev => [{ ...newVersion }, ...prev]);
            setSelectedVersionId(newVersion.id);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Edit failed");
        } finally {
            setIsGenerating(false);
        }
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
        aspectRatio,
        setAspectRatio,
        styleClass,
        setStyleClass,
        useCustomStyles,
        setUseCustomStyles,

        // Actions
        handlePlan,
        handleGenerate,
        handleResume,
        handleNewVersion,
        editSlide,
        canEditSlide
    };
}
