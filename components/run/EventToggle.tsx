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

const TYPE_STYLES: Record<string, { emoji: string; label: string }> = {
    national: { emoji: "🏛️", label: "National" },
    religious: { emoji: "🕌", label: "Religious" },
    observance: { emoji: "📌", label: "Observance" },
};

function getFlagEmoji(countryCode: string): string {
    const flags: Record<string, string> = {
        ae: "🇦🇪", sa: "🇸🇦", us: "🇺🇸", gb: "🇬🇧",
        de: "🇩🇪", fr: "🇫🇷", eg: "🇪🇬", qa: "🇶🇦",
        kw: "🇰🇼", bh: "🇧🇭", om: "🇴🇲", jo: "🇯🇴",
    };
    return flags[countryCode?.toLowerCase()] || "🌍";
}

export function EventToggle({ event, isSelected, onToggle }: EventToggleProps) {
    const style = TYPE_STYLES[event.type] || TYPE_STYLES.observance;

    return (
        <button
            onClick={onToggle}
            title={`${event.name}\n${event.description}`}
            className={`
        flex items-start gap-2 w-full px-2 py-2 rounded-md text-xs transition-all text-left
        ${isSelected
                    ? "bg-gray-100 border border-gray-300"
                    : "bg-transparent border border-dashed border-gray-200 opacity-60 hover:opacity-100"
                }
      `}
        >
            <span className="text-sm flex-shrink-0 mt-0.5">{style.emoji}</span>
            <span className="flex-1 text-gray-800 leading-tight">{event.name}</span>
            <span className="text-sm flex-shrink-0">{getFlagEmoji(event.country)}</span>
            {isSelected && <span className="text-green-600 font-bold flex-shrink-0">✓</span>}
        </button>
    );
}
