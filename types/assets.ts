export type AssetMediaItem = {
    type: "image" | "video";
    url: string;
    slide_num?: number;
    thumbnail?: string;
    rawUrl?: string;
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

    // ✨ Add optional UI-only state
    current_progress_message?: string;
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

// --- API Request Types ---
export interface GenerateAssetRequest {
    final_prompt?: string;
    step_by_step?: boolean;
    slide_count?: number;

    // ✨ NEW FIELDS
    aspect_ratio?: "1:1" | "16:9" | "9:16" | "4:5" | "3:4"; // Default: "4:5"
    reference_image?: string; // Base64 string or URL
    description?: string; // Optional context override
    style_class?: string;
    use_custom_styles?: boolean;
}

export interface EditAssetRequest {
    sourceVersionId: string;
    prompt: string;
    slide_num?: number;

    // ✨ NEW FIELDS
    aspect_ratio?: string; // Can change aspect ratio during edit
    reference_image?: string; // Single reference (backward compat)
    reference_images?: string[]; // Multiple references (preferred)
}

// --- SSE Event Type ---
export interface AssetUpdateEvent {
    run_id: string;
    version_id: string;

    // Status: 'processing' | 'completed' | 'failed'
    status: string;

    // 📸 Payload Details (conditional)
    slide_num?: number; // Present if a specific slide is ready (Carousel)
    url?: string;       // Present if an image/video is ready
    error?: string;     // Present if failed
    count?: number;     // Total count (on completion)
    progress_message?: string;
    message?: string; // 🆕 New standard field
}

