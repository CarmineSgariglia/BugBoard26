import { GlassCard } from "./GlassCard";
import { GlassButton } from "./GlassButton";

interface ProfileDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    onLogout?: () => void;
}

export function ProfileDropdown({ isOpen, onClose, onLogout }: ProfileDropdownProps) {
    if (!isOpen) return null;

    return (
        <>
            {/* Invisible overlay for closing when clicking outside */}
            <div className="fixed inset-0 z-40" onClick={onClose}></div>

            <div className="absolute top-14 right-0 z-50 w-64 origin-top-right">
                <GlassCard>
                    <GlassButton>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white flex-shrink-0">
                            <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M19.4 15C19.7828 14.1165 20.0003 13.0807 20 12C20 10.8954 19.7828 9.8596 19.4 8.9761M15 19.4C14.1165 19.7828 13.0807 20.0003 12 20C10.8954 20 9.8596 19.7828 8.9761 19.4M4.6 9C4.21715 9.88349 3.99974 10.9193 4 12C4 13.1046 4.21715 14.1404 4.6 15.0239M9 4.6C9.88349 4.21715 10.9193 3.99974 12 4C13.1046 4 14.1404 4.21715 15.0239 4.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M19.4 15L21 16.6C21 16.6 20.5 17.5 19 19C17.5 20.5 16.6 21 16.6 21L15 19.4M15 19.4V19.4C14.1165 19.7828 13.0807 20.0003 12 20M15 19.4C15 19.4 15 19.4 15 19.4ZM19.4 15C19.4 15 19.4 15 19.4 15ZM19.4 15H19.4M15 4.6L16.6 3C16.6 3 17.5 3.5 19 5C20.5 6.5 21 7.4 21 7.4L19.4 9M15 4.6L15 4.6C14.1165 4.21715 13.0807 3.99974 12 4M15 4.6C15 4.6 15 4.6 15 4.6ZM19.4 9H19.4C19.7828 9.88349 20.0003 10.9193 20 12C20 13.1046 19.7828 14.1404 19.4 15.0239M19.4 9V9M4.6 9L3 7.4C3 7.4 3.5 6.5 5 5C6.5 3.5 7.4 3 7.4 3L9 4.6M4.6 9H4.6C4.21715 9.88349 3.99974 10.9193 4 12C4 13.1046 4.21715 14.1404 4.6 15.0239M4.6 9V9M9 19.4L7.4 21C7.4 21 6.5 20.5 5 19C3.5 17.5 3 16.6 3 16.6L4.6 15M9 19.4L9 19.4C9.88349 19.7828 10.9193 20.0003 12 20M9 19.4C9 19.4 9 19.4 9 19.4ZM4.6 15H4.6V15M9 4.6L9 4.6M9 4.6C9 4.6 9 4.6 9 4.6C8.11651 4.21715 7.08069 3.99974 6 4C4.89543 4 3.85961 4.21715 2.9761 4.6L4.6 6.2C4.98285 5.31651 6 5 6 5H9.4V4.6H9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Settings
                    </GlassButton>
                    <GlassButton destructive onClick={onLogout}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                            <path d="M15 3H21M21 3V9M21 3L13 11M9 21H3M3 21V15M3 21L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14 21H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M21 14V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M10 3H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M3 10V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M10 13L14 9V13H10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Correct Logout Icon overlay */}
                            <path d="M9 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Log Out
                    </GlassButton>
                </GlassCard>
            </div>
        </>
    );
}
