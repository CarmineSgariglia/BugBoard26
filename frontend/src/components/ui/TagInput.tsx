import React, { useState } from "react";
import { FiX } from "react-icons/fi";

interface TagInputProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    maxTags?: number;
}

export function TagInput({ tags, onChange, maxTags = 5 }: TagInputProps) {
    const [inputValue, setInputValue] = useState("");

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && inputValue.trim()) {
            e.preventDefault();
            if (tags.length < maxTags && !tags.includes(inputValue.trim())) {
                const newTags = [...tags, inputValue.trim()];
                onChange(newTags);
                setInputValue("");
            }
        }
    };

    const removeTag = (tagToRemove: string) => {
        onChange(tags.filter(t => t !== tagToRemove));
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-neutral-400 capitalize tracking-wide">Tags</label>
                <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-tighter">MAX {maxTags}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-[#0D0D12]/50 border border-white/10 rounded-lg p-2 min-h-[46px] focus-within:border-[#5671F6]/50 transition-all">
                {tags.map(tag => (
                    <div key={tag} className="flex items-center gap-1.5 bg-[#5671F6]/20 text-[#5671F6] border border-[#5671F6]/20 rounded-md px-2 py-1 text-xs font-medium">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-white transition-colors">
                            <FiX size={12} />
                        </button>
                    </div>
                ))}

                {tags.length < maxTags && (
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={tags.length === 0 ? "Add tag..." : ""}
                        className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-neutral-600 min-w-[80px]"
                    />
                )}
            </div>
        </div>
    );
}
