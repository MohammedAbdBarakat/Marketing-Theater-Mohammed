// Campaign Events Types - Used for events selection modal after strategy selection

export interface RegionalEvent {
    name: string;           // "National Day"
    type: string;           // "national" | "religious" | "observance"
    country: string;        // ISO code: "ae", "us", etc.
    description: string;
    selected: boolean;      // Pre-selected by AI (significant events)
}

export interface CampaignDay {
    day_index: number;      // 1-based index
    date: string;           // "2026-01-22"
    events: RegionalEvent[];
}

export interface CampaignEventsPayload {
    type: "campaign_events";
    days: CampaignDay[];
}

export interface EventSelection {
    day_index: number;
    event_name: string;
    country?: string;
    description?: string;
    type?: string;
    date?: string;
}
