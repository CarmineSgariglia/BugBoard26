import { FormField } from "./FormField";
import { Textarea } from "./Textarea";

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

    const helperNode = (
        <div className="flex justify-end w-full">
            <span className="text-[10px] text-neutral-500 font-medium">
                {description.length} / {max}
            </span>
        </div>
    );

    return (
        <FormField label={label}>
            <Textarea
                value={description}
                onChange={(e) => onChangeDescription(e.target.value)}
                maxLength={max}
                placeholder={place}
                className="min-h-[120px]"
            />
            {helperNode}
        </FormField>
    );
}
