import { useState, useRef, useCallback } from "react";
import { AssetMediaItem } from "../../lib/api";

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentAsset: AssetMediaItem | null;
    slideNum: number;
    onSubmit: (prompt: string, referenceImages?: string[]) => void;
    isLoading?: boolean;
}

export function EditModal({
    isOpen,
    onClose,
    currentAsset,
    slideNum,
    onSubmit,
    isLoading = false
}: EditModalProps) {
    const [prompt, setPrompt] = useState("");
    const [referenceImages, setReferenceImages] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = useCallback((files: FileList | null) => {
        if (!files) return;

        // Limit to 3 reference images
        const remainingSlots = 3 - referenceImages.length;
        const filesToProcess = Array.from(files).slice(0, remainingSlots);

        filesToProcess.forEach(file => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target?.result as string;
                setReferenceImages(prev => [...prev, base64].slice(0, 3));
            };
            reader.readAsDataURL(file);
        });
    }, [referenceImages.length]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileChange(e.dataTransfer.files);
    }, [handleFileChange]);

    const removeImage = (index: number) => {
        setReferenceImages(prev => prev.filter((_, i) => i !== index));
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!prompt.trim()) return;
        setIsSubmitting(true);
        try {
            await onSubmit(prompt.trim(), referenceImages.length > 0 ? referenceImages : undefined);
            // Reset state only after success
            setPrompt("");
            setReferenceImages([]);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setPrompt("");
        setReferenceImages([]);
        onClose();
    };

    if (!isOpen || !currentAsset) return null;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={handleClose}
        >
            <div
                className="bg-neutral-900 border border-white/10 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white">
                        Edit Slide {slideNum}
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-col md:flex-row h-[calc(90vh-140px)]">
                    {/* Left Panel - Preview */}
                    <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-white/10 flex items-center justify-center bg-black/40">
                        <div className="relative w-full h-full flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={currentAsset.url}
                                alt={`Slide ${slideNum}`}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                            />
                            <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur rounded text-xs text-white/70">
                                Current Version
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Edit Controls */}
                    <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">
                        {/* Prompt Input */}
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                                Edit Instructions
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe what changes you want to make..."
                                className="w-full h-32 px-4 py-3 bg-black/40 border border-white/20 rounded-lg text-white placeholder-white/40 resize-none focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40 transition-colors"
                                disabled={isLoading}
                            />
                        </div>

                        {/* Reference Images */}
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                                Reference Images <span className="text-white/40">(optional, max 3)</span>
                            </label>

                            {/* Dropzone */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                                    border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
                                    ${isDragging
                                        ? 'border-white/60 bg-white/10'
                                        : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                                    }
                                    ${referenceImages.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => handleFileChange(e.target.files)}
                                    className="hidden"
                                    disabled={referenceImages.length >= 3 || isLoading}
                                />
                                <svg className="w-8 h-8 mx-auto mb-2 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                </svg>
                                <p className="text-sm text-white/50">
                                    {referenceImages.length >= 3
                                        ? "Maximum images reached"
                                        : "Drop images here or click to browse"
                                    }
                                </p>
                            </div>

                            {/* Image Previews */}
                            {referenceImages.length > 0 && (
                                <div className="flex gap-2 mt-3 flex-wrap">
                                    {referenceImages.map((img, idx) => (
                                        <div key={idx} className="relative group">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={img}
                                                alt={`Reference ${idx + 1}`}
                                                className="w-16 h-16 object-cover rounded-md border border-white/20"
                                            />
                                            <button
                                                onClick={() => removeImage(idx)}
                                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-black/20">
                    <button
                        onClick={handleClose}
                        disabled={isLoading || isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!prompt.trim() || isLoading || isSubmitting}
                        className="px-5 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading || isSubmitting ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Processing...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Apply Edit
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
