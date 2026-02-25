import { Button } from "../ui/Button";

interface FooterActionsProps {
    isSaveEnabled: boolean;
    onSave: () => void;
    onExit: () => void;
    onGetHelp: () => void;
    isSaving?: boolean;
}

export function FooterActions({ isSaveEnabled, onSave, onExit, onGetHelp, isSaving = false }: FooterActionsProps) {
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

            <div className="flex items-center justify-center gap-6 mt-1 text-[13px] font-medium text-[#8A8F98]">
                <Button
                    variant="ghost"
                    fullWidth={false}
                    onClick={onExit}
                    className="flex items-center gap-2 hover:text-white transition-colors focus:outline-none"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Exit
                </Button>

                <div className="w-[1px] h-3.5 bg-white/15" />

                <Button
                    variant="ghost"
                    fullWidth={false}
                    onClick={onGetHelp}
                    className="flex items-center gap-2 hover:text-white transition-colors focus:outline-none"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 7.00005L10.2 11.6501C11.2667 12.4501 12.7333 12.4501 13.8 11.6501L20 7.00005M5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Get Help
                </Button>
            </div>
        </div>
    );
}
