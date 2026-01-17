// components/studio/VideoMixer.tsx
"use client";

import { useEffect, useState } from "react";
import { VideoOptions, VideoOverrides, getVideoOptions } from "../../lib/api";

interface VideoMixerProps {
    selection: VideoOverrides;
    onChange: (val: VideoOverrides) => void;
    disabled?: boolean;
}

export function VideoMixer({ selection, onChange, disabled }: VideoMixerProps) {
    const [options, setOptions] = useState<VideoOptions | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getVideoOptions()
            .then(setOptions)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const toggle = (category: keyof VideoOverrides, value: string) => {
        if (disabled) return;
        const current = selection[category];
        onChange({
            ...selection,
            [category]: current === value ? undefined : value // Toggle off if clicked again
        });
    };

    if (loading) return <div className="text-xs text-gray-400 p-4">Loading Mixologist Library...</div>;
    if (!options) return null;

    return (
        <div className="space-y-4 p-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Video Mixologist</h3>
                <button
                    onClick={() => onChange({})}
                    className="text-[10px] text-gray-400 hover:text-red-500"
                >
                    Reset
                </button>
            </div>

            {/* Render 3 Columns: Camera, Light, Action */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <CategoryColumn
                    title="🎥 Camera"
                    items={options.cameras}
                    selected={selection.camera}
                    onSelect={(v: string) => toggle("camera", v)}
                />
                <CategoryColumn
                    title="💡 Lighting"
                    items={options.lighting}
                    selected={selection.lighting}
                    onSelect={(v: string) => toggle("lighting", v)}
                />
                <CategoryColumn
                    title="🎬 Action"
                    items={options.actions}
                    selected={selection.action}
                    onSelect={(v: string) => toggle("action", v)}
                />
            </div>
        </div>
    );
}

interface CategoryColumnProps {
    title: string;
    items: string[];
    selected?: string;
    onSelect: (value: string) => void;
}

function CategoryColumn({ title, items, selected, onSelect }: CategoryColumnProps) {
    return (
        <div>
            <div className="text-[10px] font-medium text-gray-400 mb-2">{title}</div>
            <div className="flex flex-wrap gap-1.5">
                {items.map((item: string) => (
                    <button
                        key={item}
                        onClick={() => onSelect(item)}
                        className={`text-[10px] px-2 py-1 rounded-md border transition-all text-left truncate max-w-full
              ${selected === item
                                ? "bg-black text-white border-black"
                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                            }`}
                        title={item}
                    >
                        {item}
                    </button>
                ))}
            </div>
        </div>
    );
}
