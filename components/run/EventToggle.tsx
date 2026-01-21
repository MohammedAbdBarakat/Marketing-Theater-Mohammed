"use client";

interface RegionalEvent {
    name: string;
    type: string;
    country: string;
    description: string;
    selected: boolean;
}

interface EventToggleProps {
    event: RegionalEvent;
    isSelected: boolean;
    onToggle: () => void;
}

import React from "react";

const TYPE_ICONS: Record<string, React.ReactNode> = {
    national: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18" /><path d="M5 21V7l8-4 8 4v14" /><path d="M10 9a3 3 0 0 1 3 3v9" />
        </svg>
    ),
    religious: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 2a10 10 0 1 1-10 10" />
        </svg>
    ),
    observance: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
        </svg>
    ),
};

// Helper function included again if needed, or rely on import if refactored. 
// For this file, I will just revert the badge span to use the getFlagEmoji function with the emoji directly.

function getFlagEmoji(countryCode: string): string {
    const flags: Record<string, string> = {
        ae: "🇦🇪", sa: "🇸🇦", us: "🇺🇸", gb: "🇬🇧",
        de: "🇩🇪", fr: "🇫🇷", eg: "🇪🇬", qa: "🇶🇦",
        kw: "🇰🇼", bh: "🇧🇭", om: "🇴🇲", jo: "🇯🇴",
    };
    return flags[countryCode?.toLowerCase()] || "🌍";
}

export function EventToggle({ event, isSelected, onToggle }: EventToggleProps) {
    const icon = TYPE_ICONS[event.type] || TYPE_ICONS.observance;

    return (
        <button
            onClick={onToggle}
            title={`${event.name}\n${event.description}`}
            className={`
        flex items-start gap-2 w-full px-2 py-2 rounded-md text-xs transition-all text-left group
        ${isSelected
                    ? "bg-gray-100 border border-gray-300"
                    : "bg-transparent border border-dashed border-gray-200 opacity-60 hover:opacity-100"
                }
      `}
        >
            <span className={`flex-shrink-0 mt-0.5 ${isSelected ? "text-black" : "text-gray-400 group-hover:text-gray-600"}`}>
                {icon}
            </span>
            <span className="flex-1 text-gray-800 leading-tight">{event.name}</span>
            <span className="text-sm flex-shrink-0">{getFlagEmoji(event.country)}</span>
            {isSelected && (
                <span className="text-black font-bold flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </span>
            )}
        </button>
    );
}
