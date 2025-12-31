"use client";
import { useState } from "react";
import { editAsset, type AssetVersion, getVersionStatus } from "../../lib/api";

interface EditAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    assetId: string;
    sourceVersion: AssetVersion;
    onNewVersion: (v: AssetVersion) => void;
}

export function EditAssetModal({
    isOpen,
    onClose,
    assetId,
    sourceVersion,
    onNewVersion
}: EditAssetModalProps) {
    const [prompt, setPrompt] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        setIsSubmitting(true);
        try {
            const res = await editAsset(assetId, {
                source_version_id: sourceVersion.id,
                prompt: prompt
            });

            // Fetch the new skeletal version
            const newVer = await getVersionStatus(res.new_version_id);
            onNewVersion(newVer);
            onClose();
            setPrompt("");
        } catch (err) {
            console.error("Edit failed", err);
            alert("Failed to submit edit.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <form onSubmit={handleSubmit}>
                    <div className="p-4 border-b">
                        <h3 className="font-semibold text-lg">Edit Asset</h3>
                        <p className="text-sm text-gray-500">Refine the current version with a new prompt.</p>
                    </div>

                    <div className="p-4 space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Instruction
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g. Make it brighter, change the background to blue..."
                                className="w-full border rounded-lg p-3 text-sm h-32 resize-none focus:ring-2 focus:ring-black focus:outline-none"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!prompt.trim() || isSubmitting}
                            className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {isSubmitting ? "Submitting..." : "Generate Edit"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
