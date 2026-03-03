
interface DescriptionFieldWithLenghtProps {
    description: string;
    onChangeDescription: (val: string) => void;
    maxLength?: number;
    placeholder?: string;
    label: string;
}

export function DescriptionFieldWithLenght({ description, onChangeDescription, maxLength, placeholder, label }: DescriptionFieldWithLenghtProps) {
    const max = maxLength || 256;
    const place = placeholder || "Insert your text...";

    return (
        <div className="flex flex-col gap-2" >
            <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-neutral-400 capitalize tracking-wide">{label}</label>
                <span className="text-[10px] text-neutral-500 font-medium">
                    {description.length} / {max}
                </span>
            </div>
            <textarea
                value={description}
                onChange={(e) => onChangeDescription(e.target.value)}
                maxLength={max}
                placeholder={place}
                className="w-full bg-[#0D0D12]/50 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#5671F6] focus:ring-1 focus:ring-[#5671F6] transition-all"
            />
        </div>
    );
}