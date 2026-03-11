import { FormField } from "./FormField";
import { Textarea } from "./Textarea";

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
                value={description}
                onChange={(e) => onChangeDescription(e.target.value)}
                maxLength={max}
                placeholder={place}
                aria-label={label}
                className={`min-h-[120px] ${textareaClassName ?? ""}`.trim()}
            />
            {helperNode}
        </FormField>
    );
}
