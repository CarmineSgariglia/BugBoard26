/*
    This is the footer actions component for the settings page.
    It is used in the ProfileSettingsSection component.
*/

import { Button } from "../ui/Button";
import { RiArrowGoBackLine } from "react-icons/ri";
import { MdOutlineMail } from "react-icons/md";



interface FooterActionsProps {
    isSaveEnabled: boolean;
    onSave: () => void;
    onExit: () => void;
    onGetHelp: () => void;
    isSaving?: boolean;
    isAdmin?: boolean;
}

export function FooterActions({ isSaveEnabled, onSave, onExit, onGetHelp, isSaving = false, isAdmin = false }: FooterActionsProps) {
    return (
        <div className="px-8 pb-8 pt-6 flex flex-col gap-6">
            <Button
                onClick={onSave}
                disabled={!isSaveEnabled || isSaving}
                isLoading={isSaving}
                className="mt-0 tracking-wide font-semibold text-[14px]"
            >
                Save Changes
            </Button>

            {!isAdmin && (
                <div className="flex items-center justify-center gap-6 mt-1 text-[13px] font-medium text-[#8A8F98]">
                    <Button
                        variant="ghost"
                        fullWidth={false}
                        onClick={onExit}
                        className="flex items-center gap-2 hover:text-white transition-colors focus:outline-none"
                    >
                        <RiArrowGoBackLine size={16} />
                        Exit
                    </Button>

                    <div className="w-[1px] h-3.5 bg-white/15" />

                    <Button
                        variant="ghost"
                        fullWidth={false}
                        onClick={onGetHelp}
                        className="flex items-center gap-2 hover:text-white transition-colors focus:outline-none"
                    >
                        <MdOutlineMail size={16} />
                        Get Help
                    </Button>
                </div>
            )}
        </div>
    );
}
