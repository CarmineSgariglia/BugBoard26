import { FormField } from "./FormField";
import { Input } from "./Input";

interface TitleFieldWithLenghtProps {
    title: string;
    onChangeTitle: (val: string) => void;
    maxLength?: number;
    placeholder?: string;
    label: string;
}

export function TitleFieldWithLenght({ title, onChangeTitle, maxLength, placeholder, label }: TitleFieldWithLenghtProps) {
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
        <FormField label={label}>
            <Input
                type="text"
                value={title}
                onChange={(e) => onChangeTitle(e.target.value)}
                maxLength={max}
                placeholder={place}
            />
            {helperNode}
        </FormField>
    );
}
