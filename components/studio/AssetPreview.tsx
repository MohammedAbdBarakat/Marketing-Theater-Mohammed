import { useState } from "react";
import { AssetMediaItem } from "../../lib/api";

interface AssetPreviewProps {
    assets: AssetMediaItem[];
    selectedSlideInfo?: { num: number; total: number };
    onSelectSlide?: (num: number) => void;
    hideThumbnails?: boolean;
}

export function AssetPreview({ assets, selectedSlideInfo, onSelectSlide, hideThumbnails }: AssetPreviewProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const isCarousel = assets.length > 1;
    // If carousel, we show the selected slide or the first one
    const currentAsset = isCarousel && selectedSlideInfo
        ? assets.find(a => a.slide_num === selectedSlideInfo.num) || assets[0]
        : assets[0];

    if (!currentAsset) {
        return <div className="h-full flex items-center justify-center bg-gray-100 text-gray-400">No Asset</div>;
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 relative bg-black rounded-lg overflow-hidden flex items-center justify-center group">
                {currentAsset.type === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentAsset.url} alt="Asset" className="max-h-full max-w-full object-contain" />
                )}
                {currentAsset.type === "video" && (
                    <video src={currentAsset.url} poster={currentAsset.thumbnail} controls className="max-h-full max-w-full" />
                )}

                {/* Expand Button */}
                <button
                    onClick={() => setIsExpanded(true)}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
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
                            className={`relative w-16 h-16 flex-shrink-0 border-2 rounded overflow-hidden ${selectedSlideInfo?.num === (a.slide_num || i + 1) ? 'border-blue-500' : 'border-transparent'}`}
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
