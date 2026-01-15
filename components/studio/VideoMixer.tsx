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
      .then(data => {
        setOptions(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (category: keyof VideoOverrides, value: string) => {
    if (disabled) return;
    const current = selection[category];
    onChange({
      ...selection,
      [category]: current === value ? undefined : value
    });
  };

  if (loading) return <div className="text-xs text-gray-400 p-4">Loading Mixologist Library...</div>;
  if (!options) return <div className="text-xs text-red-400 p-4">Failed to load options.</div>;

  return (
    <div className="flex flex-col space-y-3 p-4 bg-gray-50 border-t border-gray-200">
      <div className="flex-shrink-0 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Video Mixologist</h3>
        <button 
            onClick={() => onChange({})}
            className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
        >
            Reset All
        </button>
      </div>

      {/* 
         🛠️ UI FIX: 
         1. Added max-h-[200px] to limit height 
         2. Added overflow-y-auto to make it scrollable
         3. Added custom-scrollbar for cleaner look
      */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[180px] overflow-y-auto custom-scrollbar pr-2">
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

function CategoryColumn({ title, items, selected, onSelect }: any) {
  if (!items || items.length === 0) return <div className="text-xs text-gray-300">No items</div>;

  return (
    <div>
      <div className="sticky top-0 bg-gray-50 z-10 text-[10px] font-medium text-gray-400 mb-2 pb-1">{title}</div>
      <div className="flex flex-col gap-1.5">
        {items.map((item: string) => (
          <button
            key={item}
            onClick={() => onSelect(item)}
            className={`text-[10px] px-2 py-1.5 rounded-md border transition-all text-left truncate w-full
              ${selected === item 
                ? "bg-black text-white border-black shadow-sm" 
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
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