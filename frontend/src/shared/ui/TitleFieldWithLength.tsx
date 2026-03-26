import { FormField } from "./FormField";
import { Input } from "./Input";

interface TitleFieldWithLengthProps {
    title: string;
    onChangeTitle: (val: string) => void;
    maxLength?: number;
    placeholder?: string;
    label: string;
    hasError?: boolean;
    error?: string;
}

export function TitleFieldWithLength({
    title,
    onChangeTitle,
    maxLength,
    placeholder,
    label,
    hasError = false,
    error,
}: TitleFieldWithLengthProps) {
    const max = maxLength || 20;
    const place = placeholder || "Insert your text...";

    const helperNode = (
        <div className="flex justify-end w-full">
            <span className="text-[10px] text-neutral-500 font-medium">
                {title.length} / {max}
            </span>
        </div>
    );

    return (
        <FormField label={label} error={error}>
            <Input
                type="text"
                value={title}
                onChange={(e) => onChangeTitle(e.target.value)}
                maxLength={max}
                placeholder={place}
                hasError={hasError}
            />
            {helperNode}
        </FormField>
    );
}
