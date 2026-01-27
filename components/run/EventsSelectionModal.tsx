"use client";
import { useState, useEffect, useMemo } from "react";
import { DayEventCard } from "./DayEventCard";
import type { CampaignDay, EventSelection } from "../../types/events";

interface EventsSelectionModalProps {
    isOpen: boolean;
    days: CampaignDay[];
    onConfirm: (selectedEvents: EventSelection[]) => void;
    onClose: () => void;
}

export function EventsSelectionModal({
    isOpen,
    days,
    onConfirm,
    onClose,
}: EventsSelectionModalProps) {
    const [selections, setSelections] = useState<Map<string, boolean>>(new Map());
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize selections from pre-selected events
    useEffect(() => {
        if (!isOpen) return;
        const map = new Map<string, boolean>();
        days.forEach((day) => {
            day.events.forEach((event) => {
                const key = `${day.day_index}-${event.name}`;
                map.set(key, event.selected);
            });
        });
        setSelections(map);
    }, [isOpen, days]);

    // ESC key handler
    useEffect(() => {
        function onEsc(e: KeyboardEvent) {
            if (e.key === "Escape" && !isSubmitting) onClose();
        }
        if (isOpen) document.addEventListener("keydown", onEsc);
        return () => document.removeEventListener("keydown", onEsc);
    }, [isOpen, onClose, isSubmitting]);

    const handleToggle = (dayIndex: number, eventName: string) => {
        const key = `${dayIndex}-${eventName}`;
        setSelections((prev) => new Map(prev).set(key, !prev.get(key)));
    };

    const handleConfirm = async () => {
        setIsSubmitting(true);
        const selectedEvents: EventSelection[] = [];
        days.forEach((day) => {
            day.events.forEach((event) => {
                const key = `${day.day_index}-${event.name}`;
                if (selections.get(key)) {
                    selectedEvents.push({
                        day_index: day.day_index,
                        event_name: event.name,
                        country: event.country,
                        description: event.description,
                        type: event.type,
                        date: day.date,
                    });
                }
            });
        });
        try {
            await onConfirm(selectedEvents);
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalEvents = useMemo(
        () => days.reduce((sum, d) => sum + d.events.length, 0),
        [days]
    );
    const selectedCount = useMemo(
        () => Array.from(selections.values()).filter(Boolean).length,
        [selections]
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <span className="text-gray-400">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                            </span>
                            Campaign Events
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {totalEvents > 0
                                ? `${selectedCount} of ${totalEvents} events selected`
                                : "No regional events found for this campaign period"}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="text-sm text-gray-500 hover:text-gray-800 font-medium px-3 py-2"
                        >
                            Exit
                        </button>

                        <button
                            onClick={handleConfirm}
                            disabled={isSubmitting}
                            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
              ${isSubmitting
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-black text-white hover:bg-gray-800"
                                }
            `}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Confirming...
                                </>
                            ) : (
                                <>Confirm & Continue →</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 overflow-auto p-6">
                    {days.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No campaign days found.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                            {days.map((day) => (
                                <DayEventCard
                                    key={day.day_index}
                                    day={day}
                                    selections={selections}
                                    onToggle={handleToggle}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer hint */}
                <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-center">
                    <p className="text-xs text-gray-400">
                        Toggle events to include or exclude them from your content calendar
                    </p>
                </div>
            </div>
        </div>
    );
}
