"use client";
import { useState } from "react";
import { EventToggle } from "./EventToggle";
import type { CampaignDay } from "../../types/events";

interface DayEventCardProps {
    day: CampaignDay;
    selections: Map<string, boolean>;
    onToggle: (dayIndex: number, eventName: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
    national: "🏛️ National",
    "National holiday": "🏛️ National",
    religious: "🕌 Religious",
    observance: "📌 Observance",
};

function getFlagEmoji(countryCode: string): string {
    const flags: Record<string, string> = {
        ae: "🇦🇪", sa: "🇸🇦", us: "🇺🇸", gb: "🇬🇧",
        de: "🇩🇪", fr: "🇫🇷", eg: "🇪🇬", qa: "🇶🇦",
        kw: "🇰🇼", bh: "🇧🇭", om: "🇴🇲", jo: "🇯🇴",
    };
    return flags[countryCode?.toLowerCase()] || "🌍";
}

// Helper is likely already there or can be kept/re-added if needed.
// IMPORTANT: I am replacing the entire component to ensure clean state from previous partial edits

export function DayEventCard({ day, selections, onToggle }: DayEventCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const hasEvents = day.events.length > 0;
    const dateObj = new Date(day.date);

    return (
        <div
            className="relative h-56"
            style={{ perspective: "1000px" }}
        >
            <div
                className="w-full h-full transition-transform duration-500"
                style={{
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
            >
                {/* FRONT SIDE */}
                <div
                    className={`
                        absolute inset-0 rounded-lg border p-3 overflow-hidden
                        ${hasEvents ? "border-black bg-white shadow-sm" : "border-gray-200 bg-gray-50"}
                    `}
                    style={{ backfaceVisibility: "hidden" }}
                >
                    {/* Flip button */}
                    {hasEvents && (
                        <button
                            onClick={() => setIsFlipped(true)}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
                            title="View details"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                            </svg>
                        </button>
                    )}

                    {/* Date Header */}
                    <div className="text-center mb-2">
                        <div className="text-[10px] uppercase text-gray-400 font-medium">
                            {dateObj.toLocaleDateString("en-US", { weekday: "short" })}
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{dateObj.getDate()}</div>
                        <div className="text-xs text-gray-500">
                            {dateObj.toLocaleDateString("en-US", { month: "short" })}
                        </div>
                    </div>

                    {/* Day Index */}
                    <div className="text-center text-[10px] text-gray-400 mb-2">Day {day.day_index}</div>

                    {/* Events List */}
                    {hasEvents ? (
                        <div className="space-y-1.5 overflow-y-auto max-h-20">
                            {day.events.map((event) => (
                                <EventToggle
                                    key={`${event.name}-${event.country}`}
                                    event={event}
                                    isSelected={selections.get(`${day.day_index}-${event.name}`) ?? false}
                                    onToggle={() => onToggle(day.day_index, event.name)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-300 text-lg">—</div>
                    )}
                </div>

                {/* BACK SIDE */}
                <div
                    className="absolute inset-0 rounded-lg border border-black bg-white shadow-sm p-3 overflow-hidden"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                    {/* Back button */}
                    <button
                        onClick={() => setIsFlipped(false)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
                        title="Go back"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
                        </svg>
                    </button>

                    {/* Date mini header */}
                    <div className="text-xs text-gray-400 mb-2">
                        {dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · Day {day.day_index}
                    </div>

                    {/* Full event details */}
                    <div className="space-y-3 overflow-y-auto max-h-44">
                        {day.events.map((event, idx) => {
                            const isSelected = selections.get(`${day.day_index}-${event.name}`) ?? false;
                            return (
                                <div key={idx} className="border-b border-gray-100 pb-2 last:border-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="font-medium text-sm text-gray-900 leading-tight">
                                            {event.name}
                                        </div>
                                        <button
                                            onClick={() => onToggle(day.day_index, event.name)}
                                            className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected
                                                    ? "bg-black text-white border-black"
                                                    : "bg-white text-gray-300 border-gray-300 hover:border-gray-500"
                                                }`}
                                        >
                                            {isSelected ? (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            ) : ""}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-1">
                                        <span className="capitalize">{TYPE_LABELS[event.type] || event.type}</span>
                                        <span>{getFlagEmoji(event.country)}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed">
                                        {event.description}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
