import { useRef, useEffect, type KeyboardEventHandler } from "react";
import { FormField } from "./FormField";
import { Textarea } from "./Textarea";

interface DescriptionFieldWithLengthProps {
    description: string;
    onChangeDescription: (val: string) => void;
    maxLength?: number;
    placeholder?: string;
    label: string;
    containerClassName?: string;
    textareaClassName?: string;
    counterClassName?: string;
    hideLabel?: boolean;
    onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
    hasError?: boolean;
    error?: string;
}

export function DescriptionFieldWithLength({
    description,
    onChangeDescription,
    maxLength,
    placeholder,
    label,
    containerClassName,
    textareaClassName,
    counterClassName,
    hideLabel = false,
    onKeyDown,
    hasError = false,
    error,
}: DescriptionFieldWithLengthProps) {
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
        <FormField label={hideLabel ? undefined : label} className={containerClassName} error={error}>
            <Textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => onChangeDescription(e.target.value)}
                maxLength={max}
                placeholder={place}
                aria-label={label}
                rows={1}
                onKeyDown={onKeyDown}
                hasError={hasError}
                className={`max-h-[120px] overflow-y-auto ${textareaClassName ?? ""}`.trim()}
            />
            {helperNode}
        </FormField>
    );
}
