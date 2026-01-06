import { AssetVersion } from "../../lib/api";
import dayjs from "dayjs";

interface VersionTimelineProps {
    versions: AssetVersion[];
    selectedVersionId: string | null;
    onSelectVersion: (v: AssetVersion) => void;
}

export function VersionTimeline({ versions, selectedVersionId, onSelectVersion }: VersionTimelineProps) {
    return (
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px]">
            {versions.map((v, i) => {
                const isSelected = v.id === selectedVersionId;
                return (
                    <button
                        key={v.id}
                        onClick={() => onSelectVersion(v)}
                        className={`text-left p-3 rounded border text-sm transition-colors ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-gray-200'}`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                                Version {versions.length - i}
                            </span>
                            <span className="text-xs text-gray-500">{dayjs(v.createdAt).format("MMM D, HH:mm")}</span>
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                            {v.status === "completed" ? (v.edit_reason || "Generated") : <span className="text-orange-600 capitalize">{v.status}...</span>}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
