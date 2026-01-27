import { useState, useRef, useEffect } from "react";
import { AssetMediaItem } from "../../lib/api";
import { EditModal } from "./EditModal";

function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: { zoom: number, onZoomIn: () => void, onZoomOut: () => void, onReset: () => void }) {
    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/40 backdrop-blur-xl border border-white/10 p-1 rounded-full shadow-2xl z-20 transition-all hover:bg-black/50" onClick={e => e.stopPropagation()}>
            <button onClick={onZoomOut} className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white active:bg-white/20 transition-colors disabled:opacity-30 disabled:hover:bg-transparent" disabled={zoom <= 0.5}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <span className="text-[10px] font-bold w-10 text-center text-white/90 select-none font-mono">{Math.round(zoom * 100)}%</span>
            <button onClick={onZoomIn} className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white active:bg-white/20 transition-colors disabled:opacity-30 disabled:hover:bg-transparent" disabled={zoom >= 3}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            {zoom !== 1 && (
                <button onClick={onReset} className="ml-1 p-1.5 hover:bg-white/10 rounded-full text-white/60 hover:text-white border-l border-white/10 active:bg-white/20 transition-colors" title="Reset">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" /><path d="M3 5v7h7" /></svg>
                </button>
            )}
        </div>
    );
}

interface AssetPreviewProps {
    assets: AssetMediaItem[];
    selectedSlideInfo?: { num: number; total: number };
    onSelectSlide?: (num: number) => void;
    hideThumbnails?: boolean;
    onEdit?: (slideNum: number, prompt: string, referenceImages?: string[]) => void;
    canEdit?: boolean; // Optional explicit disable
}

export function AssetPreview({ assets, selectedSlideInfo, onSelectSlide, hideThumbnails, onEdit, canEdit = true }: AssetPreviewProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Zoom & Pan State
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef<{ x: number, y: number } | null>(null);

    // Reset when asset changes
    useEffect(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, [selectedSlideInfo?.num, assets]);

    // Pan Event Handlers
    useEffect(() => {
        const move = (e: MouseEvent) => {
            if (isDragging && dragStart.current) {
                const dx = e.clientX - dragStart.current.x;
                const dy = e.clientY - dragStart.current.y;
                setPan(p => ({ x: p.x + dx, y: p.y + dy }));
                dragStart.current = { x: e.clientX, y: e.clientY };
            }
        };
        const up = () => {
            setIsDragging(false);
            dragStart.current = null;
        };

        if (isDragging) {
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        }
        return () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
    }, [isDragging]);

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setZoom(z => Math.min(Math.max(0.5, z + delta), 3));
        }
    };

    const isCarousel = assets.length > 1;
    // If carousel, we show the selected slide or the first one
    const currentAsset = isCarousel && selectedSlideInfo
        ? assets.find(a => a.slide_num === selectedSlideInfo.num) || assets[0]
        : assets[0];

    const currentSlideNum = isCarousel && selectedSlideInfo ? selectedSlideInfo.num : 1;

    if (!currentAsset) {
        return <div className="h-full flex items-center justify-center bg-gray-100 text-gray-400">No Asset</div>;
    }

    return (
        <div className="flex flex-col h-full relative select-none">
            <div
                className={`flex-1 relative bg-black rounded-lg overflow-hidden flex items-center justify-center group ${isDragging ? 'cursor-grabbing' : zoom > 1 ? 'cursor-grab' : 'cursor-default'}`}
                onMouseDown={e => {
                    // Only start drag if not clicking a button/interactive element
                    if ((e.target as HTMLElement).closest('button, input')) return;
                    if (zoom > 1) {
                        setIsDragging(true);
                        dragStart.current = { x: e.clientX, y: e.clientY };
                        setIsEditModalOpen(false); // Close edit modal if open? Actually it's a modal now, so it covers everything.
                    }
                }}
                onWheel={handleWheel}
            >
                <div
                    className="relative w-full h-full flex items-center justify-center transition-transform duration-75 ease-out"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
                    }}
                >
                    {currentAsset.type === "image" && (
                        <div className="relative w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={currentAsset.url} alt="Asset" className="max-w-full max-h-full object-contain shadow-sm" />
                        </div>
                    )}
                    {currentAsset.type === "video" && (
                        <video src={currentAsset.url} poster={currentAsset.thumbnail} controls className="max-h-full max-w-full" />
                    )}
                </div>

                {/* Edit Modal (Portal-like behavior but rendered here for now) */}
                {/* Edit Modal (Portal-like behavior but rendered here for now) */}
                {isEditModalOpen && onEdit && (
                    <EditModal
                        isOpen={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        currentAsset={currentAsset}
                        slideNum={currentSlideNum}
                        onSubmit={async (prompt, refs) => {
                            // Wait for the edit submission to complete (returns when optimistic update is done)
                            await onEdit(currentSlideNum, prompt, refs);
                            setIsEditModalOpen(false);
                        }}
                        isLoading={false} // We can't easily access global isGenerating here without passing it down. 
                    // BUT: EditModal can have its own local loading state if onSubmit returns a promise? 
                    // Wait, EditModal component implementation:
                    // <button onClick={handleSubmit} disabled={isLoading}>
                    // handleSubmit calls onSubmit(prompt...) then resets state. It does NOT wait.
                    // I should update EditModal to await onSubmit if it returns a promise.
                    />
                )}

                {/* 🛠️ FIX: Magic Wand Button - ONLY VISIBLE IF IMAGE */}
                {onEdit && currentAsset.type === "image" && canEdit && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsEditModalOpen(true);
                        }}
                        className={`absolute top-2 left-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-md transition-all backdrop-blur-xl z-20 border border-white/10
                            ${isEditModalOpen ? 'opacity-100 ring-1 ring-white/20' : 'opacity-0 group-hover:opacity-100'}
                        `}
                        title="Magic Edit"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </button>
                )}

                {/* Controls Overlay */}
                <ZoomControls
                    zoom={zoom}
                    onZoomIn={() => setZoom(z => Math.min(3, z + 0.25))}
                    onZoomOut={() => setZoom(z => Math.max(0.5, z - 0.25))}
                    onReset={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                />

                {/* Expand Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(true);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xl border border-white/10"
                    title="Expand"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                </button>
            </div>

            {isCarousel && onSelectSlide && !hideThumbnails && (
                <div className="mt-4 flex gap-2 overflow-x-auto py-2">
                    {assets.map((a, i) => (
                        <button
                            key={i}
                            onClick={() => onSelectSlide(a.slide_num || i + 1)}
                            className={`relative w-16 h-16 flex-shrink-0 border-2 rounded overflow-hidden ${selectedSlideInfo?.num === (a.slide_num || i + 1) ? 'border-purple-600 ring-1 ring-purple-100' : 'border-transparent'}`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}

            {/* Full Screen Overlay */}
            {isExpanded && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsExpanded(false)}>
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>

                    {currentAsset.type === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={currentAsset.url}
                            alt="Full view"
                            className="max-w-full max-h-full object-contain shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <video
                            src={currentAsset.url}
                            poster={currentAsset.thumbnail}
                            controls
                            className="max-w-full max-h-full shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        />
                    )}
                </div>
            )}
        </div>
    );
}