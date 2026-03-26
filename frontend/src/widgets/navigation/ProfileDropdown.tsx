import { useNavigate, useLocation } from "react-router-dom";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { IoIosLogOut } from "react-icons/io";
import { IoMdSettings } from "react-icons/io";


interface ProfileDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    onLogout?: () => void;
}

export function ProfileDropdown({ isOpen, onClose, onLogout }: ProfileDropdownProps) {
    const navigate = useNavigate();
    const location = useLocation();

    if (!isOpen) return null;

    return (
        <>
            {/* Invisible overlay for closing when clicking outside */}
            <div className="fixed inset-0 z-40" onClick={onClose}></div>

            <div className="absolute top-14 right-0 z-50 w-64 origin-top-right">
                <GlassCard>
                    <Button
                        variant="glass"
                        active={location.pathname === "/settings"}
                        onClick={() => { onClose(); navigate("/settings"); }}
                    >
                        <IoMdSettings size={24} />
                        Settings
                    </Button>
                    <Button variant="glass" destructive onClick={onLogout}>
                        <IoIosLogOut size={24} />
                        Logout
                    </Button>
                </GlassCard>
            </div>
        </>
    );
}
