export type AssetMediaItem = {
    type: "image" | "video";
    url: string;
    slide_num?: number;
    thumbnail?: string;
};

export type AssetVersion = {
    id: string; // "ver_xyz"
    status: "created" | "planning" | "ready_to_render" | "processing" | "completed" | "failed" | "waiting_for_approval";
    createdAt: string;

    // The Plan
    blueprint?: {
        slides?: { slide_num: number; image_prompt: string }[];
        [key: string]: any;
    };
    prompt_snapshot?: string;
    final_used_prompt?: string; // Stored prompt that generated this version

    // The Output
    assets: AssetMediaItem[]; // Can be 1 item (Image) or 5 items (Carousel)

    // Metadata
    edit_reason?: string; // "Initial Plan" or "User Edit: Make it blue"
};

export type PhaseResult = {
    phase: 1 | 2 | 3 | 4;
    summary: string;
    artifacts: any[];
    candidates?: {
        id: string;
        name: string;
        rationale: string;
        highlights: string[];
    }[];
};
