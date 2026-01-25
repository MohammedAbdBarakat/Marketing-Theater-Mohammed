import React, { useEffect, useState } from 'react';
import { fetchStyleClasses } from '../../lib/api';

interface StyleControlsProps {
    styleClass: string | null;
    useCustomStyles: boolean;
    onChangeStyle: (val: string | null) => void;
    onChangeCustom: (val: boolean) => void;
}

export const StyleControls: React.FC<StyleControlsProps> = ({
    styleClass,
    useCustomStyles,
    onChangeStyle,
    onChangeCustom
}) => {
    const [availableStyles, setAvailableStyles] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        fetchStyleClasses()
            .then(setAvailableStyles)
            .finally(() => setLoading(false));
    }, []);

    return (
        <>
            {/* 1. Style Dropdown */}
            <div className="flex items-center gap-1.5 bg-gray-50 rounded-md px-2 py-1 border border-gray-100 hover:border-gray-200 transition-colors">
                <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Style</span>
                <select
                    className="text-[10px] bg-transparent border-none focus:ring-0 p-0 pr-4 cursor-pointer font-medium text-gray-700 hover:text-black transition-colors min-w-[60px]"
                    style={{ backgroundImage: 'none' }}
                    value={styleClass || "auto"}
                    onChange={(e) => onChangeStyle(e.target.value === "auto" ? null : e.target.value)}
                    disabled={loading}
                >
                    <option value="auto">Auto</option>
                    {availableStyles.map(style => (
                        <option key={style} value={style}>{style}</option>
                    ))}
                </select>
            </div>

            {/* 2. DNA Toggle */}
            <button
                onClick={() => onChangeCustom(!useCustomStyles)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all border text-[10px] uppercase font-bold tracking-wider ${useCustomStyles
                    ? "bg-black border-black text-white"
                    : "bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                    }`}
                title="Include Brand DNA"
            >
                <div className={`w-1 h-1 rounded-full ${useCustomStyles ? "bg-white" : "bg-gray-300"}`} />
                <span>DNA</span>
            </button>
        </>
    );
};
