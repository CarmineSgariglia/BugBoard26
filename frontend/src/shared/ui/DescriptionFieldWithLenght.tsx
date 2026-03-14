import { FormField } from "./FormField";
import { Textarea } from "./Textarea";
import { useRef, useEffect } from "react";

interface DescriptionFieldWithLenghtProps {
    description: string;
    onChangeDescription: (val: string) => void;
    maxLength?: number;
    placeholder?: string;
    label: string;
    containerClassName?: string;
    textareaClassName?: string;
    counterClassName?: string;
    hideLabel?: boolean;
}

export function DescriptionFieldWithLenght({
    description,
    onChangeDescription,
    maxLength,
    placeholder,
    label,
    containerClassName,
    textareaClassName,
    counterClassName,
    hideLabel = false,
}: DescriptionFieldWithLenghtProps) {
    const max = maxLength || 256;
    const place = placeholder || "Insert your text...";
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight + 2}px`;
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [description]);

    const helperNode = (
        <div className="flex justify-end w-full">
            <span className={`text-[10px] text-neutral-500 font-medium ${counterClassName ?? ""}`.trim()}>
                {description.length} / {max}
            </span>
        </div>
    );

    return (
        <FormField label={hideLabel ? undefined : label} className={containerClassName}>
            <Textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => onChangeDescription(e.target.value)}
                maxLength={max}
                placeholder={place}
                aria-label={label}
                rows={1}
                className={`max-h-[120px] overflow-y-auto ${textareaClassName ?? ""}`.trim()}
            />
            {helperNode}
        </FormField>
    );
}
