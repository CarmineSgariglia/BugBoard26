import { MdGroupOff, MdGroup } from "react-icons/md";

import { ConfirmModal } from "@shared/ui/ConfirmModal";
import type { AuthUser } from "@shared/api/types/auth";

interface ToggleUserStatusModalProps {
  isOpen: boolean;
  user: AuthUser | null;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ToggleUserStatusModal({
  isOpen,
  user,
  onClose,
  onConfirm,
  isLoading,
}: ToggleUserStatusModalProps) {
  if (!user) return null;

  const isActive = user.active ?? true;
  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username;

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      title={isActive ? "Deactivate User" : "Activate User"}
      confirmText={isActive ? "Deactivate" : "Activate"}
      danger={isActive}
      icon={isActive ? <MdGroupOff size={24} /> : <MdGroup size={24} />}
      description={
        <>
          Are you sure you want to {isActive ? "deactivate" : "activate"}? <br />
          <span className="text-white font-medium">{fullName}</span>
          <br />
          {isActive
            ? <>
              The user will no longer <br />
              be able to access the system.
            </>
            : <>The user will regain access <br /> to the system.</>}
        </>
      }
    />
  );
}
