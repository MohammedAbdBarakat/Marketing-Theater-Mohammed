// components/studio/AssetPreview.tsx
import { AssetMediaItem } from "../../lib/api";

interface AssetPreviewProps {
    assets: any[]; // Use any to be safe with 'kind' vs 'type' mismatch
    selectedSlideInfo?: { num: number; total: number };
    onSelectSlide?: (num: number) => void;
}

export function AssetPreview({ assets, selectedSlideInfo, onSelectSlide }: AssetPreviewProps) {
    const isCarousel = assets.length > 1;
    
    // Helper to normalize the asset object (handle type vs kind)
    const normalize = (a: any) => ({
        ...a,
        type: a.type || a.kind || "image", // Fallback to handle Zaid's 'kind' field
        url: a.url || a.src // Safety for URL field
    });

    const rawCurrent = isCarousel && selectedSlideInfo
        ? assets.find(a => (a.slide_num || 0) === selectedSlideInfo.num) || assets[0]
        : assets[0];

    if (!rawCurrent) {
        return <div className="h-full flex items-center justify-center bg-gray-100 text-gray-400">No Asset</div>;
    }

    const currentAsset = normalize(rawCurrent);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 relative bg-black rounded-lg overflow-hidden flex items-center justify-center">
                {currentAsset.type === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentAsset.url} alt="Asset" className="max-h-full max-w-full object-contain" />
                )}
                {currentAsset.type === "video" && (
                    <video 
                        src={currentAsset.url} 
                        poster={currentAsset.thumbnail} 
                        controls 
                        autoPlay 
                        loop
                        className="max-h-full max-w-full" 
                    />
                )}
            </div>

            {isCarousel && onSelectSlide && (
                <div className="mt-4 flex gap-2 overflow-x-auto py-2">
                    {assets.map((raw, i) => {
                        const a = normalize(raw);
                        return (
                            <button
                                key={i}
                                onClick={() => onSelectSlide(a.slide_num || i + 1)}
                                className={`relative w-16 h-16 flex-shrink-0 border-2 rounded overflow-hidden ${selectedSlideInfo?.num === (a.slide_num || i + 1) ? 'border-blue-500' : 'border-transparent'}`}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={a.url || a.thumbnail} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}