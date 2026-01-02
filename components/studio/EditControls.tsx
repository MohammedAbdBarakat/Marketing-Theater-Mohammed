"use client";

import { useState } from "react";

interface EditControlsProps {
    onUpdate: (prompt: string) => void;
    isProcessing: boolean;
    placeholder?: string;
}

export function EditControls({ onUpdate, isProcessing, placeholder }: EditControlsProps) {
    const [prompt, setPrompt] = useState("");

    const handleSubmit = () => {
        if (!prompt.trim()) return;
        onUpdate(prompt);
        setPrompt("");
    };

    return (
        <div className="flex gap-2">
            <input
                type="text"
                className="flex-1 border rounded px-3 py-2 text-sm"
                placeholder={placeholder || "Describe changes (e.g. 'Make it sunset')"}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !isProcessing && handleSubmit()}
                disabled={isProcessing}
            />
            <button
                onClick={handleSubmit}
                disabled={!prompt.trim() || isProcessing}
                className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50 font-medium"
            >
                {isProcessing ? "Updating..." : "Update"}
            </button>
        </div>
    );
}
