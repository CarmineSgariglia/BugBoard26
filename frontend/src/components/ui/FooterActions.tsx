import type { ReactNode } from "react";
import { Button } from "./Button";

interface FooterLink {
    label: string;
    icon: ReactNode;
    onClick: () => void;
}

interface FooterActionsProps {
    isSaveEnabled?: boolean;
    onSave?: () => void;
    isSaving?: boolean;
    saveLabel?: string;
    showSave?: boolean;
    links?: FooterLink[];
}

export function FooterActions({ isSaveEnabled = true, onSave, isSaving = false, saveLabel = "Save Changes", showSave = true, links = [] }: FooterActionsProps) {
    return (
        <div className="px-8 pb-8 pt-6 flex items-center justify-between">
            {/* Left: text links */}
            <div className="flex items-center gap-4 text-[13px] font-medium text-[#8A8F98]">
                {links.map((link, i) => (
                    <div key={i} className="flex items-center gap-4">
                        {i > 0 && <div className="w-[1px] h-3.5 bg-white/15" />}
                        <Button
                            variant="ghost"
                            fullWidth={false}
                            onClick={link.onClick}
                            className="flex items-center gap-2 hover:text-white transition-colors focus:outline-none"
                        >
                            {link.icon}
                            {link.label}
                        </Button>
                    </div>
                ))}
            </div>

            {/* Right: save button */}
            {showSave && (
                <Button
                    onClick={onSave}
                    disabled={!isSaveEnabled || isSaving}
                    isLoading={isSaving}
                    fullWidth={false}
                    className="tracking-wide font-semibold text-[14px] px-8"
                >
                    {saveLabel}
                </Button>
            )}
        </div>
    );
}
