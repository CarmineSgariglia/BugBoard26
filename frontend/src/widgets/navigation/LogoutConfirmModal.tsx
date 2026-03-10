import { ConfirmModal } from "../../shared/ui/ConfirmModal";
import { IoIosLogOut } from "react-icons/io";
import { useQueryClient } from "@tanstack/react-query";

interface LogoutConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isLoading?: boolean;
}

export function LogoutConfirmModal({ isOpen, onClose, onConfirm, isLoading }: LogoutConfirmModalProps) {
    const queryClient = useQueryClient();

    const handleConfirm = () => {
        queryClient.clear();
        onConfirm();
    }
    return (
        <ConfirmModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleConfirm}
            isLoading={isLoading}
            title="Sign Out"
            description="Are you sure you want to log out of your account?"
            icon={<IoIosLogOut size={24} />}
            confirmText="Log Out"
            danger={true}
        />
    );
}
