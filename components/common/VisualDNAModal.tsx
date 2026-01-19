"use client";
import { useState } from "react";

type ScrapedSample = {
    name: string;
    url: string;
    type: "image" | "video";
};

type ImageAnalysis = {
    design_class: string;
    idea_conveyed: string;
    reproduction_prompt: string;
    layer_analysis: {
        background: string;
        middle: string;
        foreground: string;
    };
    integration_mechanics: string;
    text_design_analysis: string;
    main_design_elements: string[];
    recurring_elements: string[];
    lighting_and_color: string;
    filename: string;
};

type VideoAnalysis = {
    design_class: string;
    trigger_keywords: string[];
    camera_movement: string;
    action_logic: string;
    visual_modifiers: string;
    veo_technical_prompt: string;
    source_filename: string;
};

type VisualDNAModalProps = {
    isOpen: boolean;
    onClose: () => void;
    data: {
        summary?: string;
        image_analysis: ImageAnalysis[];
        video_analysis: VideoAnalysis[];
        scraped_samples?: ScrapedSample[];
    } | null;
};

function CollapsibleItem({
    title,
    subtitle,
    mediaUrl,
    mediaType,
    children,
}: {
    title: string;
    subtitle: string;
    mediaUrl?: string;
    mediaType?: "image" | "video";
    children: React.ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border rounded-lg overflow-hidden">
            {/* Header - always visible */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
            >
                <div>
                    <div className="font-medium">{title}</div>
                    <div className="text-xs text-gray-500">{subtitle}</div>
                </div>
                <span className="text-gray-400 text-lg">{isOpen ? "−" : "+"}</span>
            </button>

            {/* Expanded content */}
            {isOpen && (
                <div className="border-t">
                    {/* Media preview */}
                    {mediaUrl && (
                        <div className="bg-black flex items-center justify-center p-4">
                            {mediaType === "video" ? (
                                <video
                                    src={mediaUrl}
                                    controls
                                    className="max-h-64 max-w-full rounded"
                                />
                            ) : (
                                <img
                                    src={mediaUrl}
                                    alt={title}
                                    className="max-h-64 max-w-full object-contain rounded"
                                />
                            )}
                        </div>
                    )}

                    {/* Analysis details */}
                    <div className="p-4 space-y-3">{children}</div>
                </div>
            )}
        </div>
    );
}

export function VisualDNAModal({ isOpen, onClose, data }: VisualDNAModalProps) {
    if (!isOpen || !data) return null;

    // Create a map for quick lookup of scraped samples by name
    const samplesMap = new Map<string, ScrapedSample>();
    data.scraped_samples?.forEach((sample) => {
        samplesMap.set(sample.name, sample);
    });

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-lg overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold">Visual DNA Analysis</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-black text-xl"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Summary */}
                    {data.summary && (
                        <div className="text-sm text-gray-600 bg-gray-50 border rounded p-3">
                            {data.summary}
                        </div>
                    )}

                    {/* Image Analysis Section */}
                    {data.image_analysis.length > 0 && (
                        <section>
                            <h3 className="text-base font-semibold mb-4 border-b pb-2">
                                Image Analysis ({data.image_analysis.length})
                            </h3>
                            <div className="space-y-3">
                                {data.image_analysis.map((img, i) => {
                                    const sample = samplesMap.get(img.filename);
                                    return (
                                        <CollapsibleItem
                                            key={i}
                                            title={img.design_class}
                                            subtitle={img.filename}
                                            mediaUrl={sample?.url}
                                            mediaType={sample?.type || "image"}
                                        >
                                            {/* Idea Conveyed */}
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase mb-1">Idea Conveyed</div>
                                                <p className="text-sm">{img.idea_conveyed}</p>
                                            </div>

                                            {/* Reproduction Prompt */}
                                            <div className="bg-gray-50 p-3 rounded">
                                                <div className="text-xs text-gray-500 uppercase mb-1">Reproduction Prompt</div>
                                                <p className="text-sm">{img.reproduction_prompt}</p>
                                            </div>

                                            {/* Layer Analysis */}
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase mb-2">Layer Analysis</div>
                                                <div className="grid grid-cols-3 gap-3 text-sm">
                                                    <div className="bg-gray-50 p-2 rounded">
                                                        <div className="font-medium text-xs mb-1">Background</div>
                                                        <p className="text-xs text-gray-600">{img.layer_analysis.background}</p>
                                                    </div>
                                                    <div className="bg-gray-50 p-2 rounded">
                                                        <div className="font-medium text-xs mb-1">Middle</div>
                                                        <p className="text-xs text-gray-600">{img.layer_analysis.middle}</p>
                                                    </div>
                                                    <div className="bg-gray-50 p-2 rounded">
                                                        <div className="font-medium text-xs mb-1">Foreground</div>
                                                        <p className="text-xs text-gray-600">{img.layer_analysis.foreground}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Integration & Text Design */}
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <div className="text-xs text-gray-500 uppercase mb-1">Integration Mechanics</div>
                                                    <p className="text-xs text-gray-700">{img.integration_mechanics}</p>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500 uppercase mb-1">Text Design</div>
                                                    <p className="text-xs text-gray-700">{img.text_design_analysis}</p>
                                                </div>
                                            </div>

                                            {/* Elements */}
                                            <div className="flex gap-6">
                                                <div>
                                                    <div className="text-xs text-gray-500 uppercase mb-1">Main Elements</div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {img.main_design_elements.map((el, j) => (
                                                            <span key={j} className="text-xs px-2 py-0.5 bg-gray-200 rounded">{el}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500 uppercase mb-1">Recurring</div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {img.recurring_elements.map((el, j) => (
                                                            <span key={j} className="text-xs px-2 py-0.5 bg-gray-100 border rounded">{el}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Lighting & Color */}
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase mb-1">Lighting & Color</div>
                                                <p className="text-xs text-gray-700">{img.lighting_and_color}</p>
                                            </div>
                                        </CollapsibleItem>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Video Analysis Section */}
                    {data.video_analysis.length > 0 && (
                        <section>
                            <h3 className="text-base font-semibold mb-4 border-b pb-2">
                                Video Analysis ({data.video_analysis.length})
                            </h3>
                            <div className="space-y-3">
                                {data.video_analysis.map((vid, i) => {
                                    const sample = samplesMap.get(vid.source_filename);
                                    return (
                                        <CollapsibleItem
                                            key={i}
                                            title={vid.design_class}
                                            subtitle={vid.source_filename}
                                            mediaUrl={sample?.url}
                                            mediaType="video"
                                        >
                                            {/* Keywords */}
                                            <div className="flex flex-wrap gap-1">
                                                {vid.trigger_keywords.map((kw, j) => (
                                                    <span key={j} className="text-xs px-2 py-0.5 bg-gray-800 text-white rounded">{kw}</span>
                                                ))}
                                            </div>

                                            {/* Camera & Action */}
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <div className="text-xs text-gray-500 uppercase mb-1">Camera Movement</div>
                                                    <p className="text-xs text-gray-700">{vid.camera_movement}</p>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500 uppercase mb-1">Action Logic</div>
                                                    <p className="text-xs text-gray-700">{vid.action_logic}</p>
                                                </div>
                                            </div>

                                            {/* Visual Modifiers */}
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase mb-1">Visual Modifiers</div>
                                                <p className="text-xs text-gray-700">{vid.visual_modifiers}</p>
                                            </div>

                                            {/* VEO Prompt */}
                                            <div className="bg-gray-50 p-3 rounded">
                                                <div className="text-xs text-gray-500 uppercase mb-1">VEO Technical Prompt</div>
                                                <p className="text-sm">{vid.veo_technical_prompt}</p>
                                            </div>
                                        </CollapsibleItem>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-black text-white rounded text-sm hover:bg-gray-800"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
