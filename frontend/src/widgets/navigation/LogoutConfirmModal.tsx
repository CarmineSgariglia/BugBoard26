import { ConfirmModal } from "@shared/ui/ConfirmModal";
import { IoIosLogOut } from "react-icons/io";

interface LogoutConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isLoading?: boolean;
}

export function LogoutConfirmModal({ isOpen, onClose, onConfirm, isLoading }: LogoutConfirmModalProps) {
    return (
        <ConfirmModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            isLoading={isLoading}
            title="Sign Out"
            description="Are you sure you want to logout of your account?"
            icon={<IoIosLogOut size={24} />}
            confirmText="Logout"
            danger={true}
        />
    );
}
