import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { FiEdit2 } from "react-icons/fi";
import { MdGroupOff } from "react-icons/md";

import { GlassCard } from "@shared/ui/GlassCard";
import { SearchBar } from "@shared/ui/SearchBar";
import { Select } from "@shared/ui/Select";
import { Pagination } from "@shared/ui/Pagination";
import { UserTable } from "@shared/ui/UserTable";
import type { AuthUser } from "@shared/api/types/auth";
import { useAuth } from "@features/auth";
import { usePaginatedUsers } from "@features/user/hooks/usePaginatedUsers";
import { setSettingsUserActiveApi } from "@features/settings/api";
import { AdminUserEditSection } from "./AdminUserEditSection";
import { ToggleUserStatusModal } from "./ToggleUserStatusModal";

export interface ManageUsersSectionProps {
  onEditingChange?: (isEditing: boolean) => void;
  onSelfEditRedirect?: () => void;
}

export function ManageUsersSection({ onEditingChange, onSelfEditRedirect }: ManageUsersSectionProps) {
  const { user: currentUser } = useAuth();
  const {
    users,
    totalItems,
    isLoading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter,
    currentPage,
    setCurrentPage,
    updateLocalUser,
  } = usePaginatedUsers();

  const itemsPerPage = 10;
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [toggleStatusUser, setToggleStatusUser] = useState<AuthUser | null>(null);

  const isDjangoSuperuser = useCallback((user: AuthUser) => Boolean(user.isSuperuser), []);

  const isSuperuserDeactivationLocked = useCallback(
    (user: AuthUser) => Boolean(isDjangoSuperuser(user) && user.active),
    [isDjangoSuperuser]
  );

  const toggleUserStatusMutation = useMutation({
    mutationFn: async (targetUser: AuthUser) => {
      const nextActive = !targetUser.active;
      return setSettingsUserActiveApi(targetUser.userId, nextActive);
    },
    onSuccess: (updatedUser) => {
      updateLocalUser(updatedUser);
      setToggleStatusUser(null);
    },
    onError: (err) => {
      console.error("Failed to toggle user status", err);
    },
  });

  const handleActionClick = (actionName: string, user: AuthUser) => {
    if (actionName === "Edit") {
      if (currentUser?.userId === user.userId) {
        onSelfEditRedirect?.();
        return;
      }
      if (isDjangoSuperuser(user)) return;
      setEditingUser(user);
      onEditingChange?.(true);
    } else if (actionName === "Delete") {
      if (isSuperuserDeactivationLocked(user)) return;
      setToggleStatusUser(user);
    }
  };

  const handleToggleStatus = useCallback(async () => {
    if (!toggleStatusUser || toggleUserStatusMutation.isPending) return;
    if (isSuperuserDeactivationLocked(toggleStatusUser)) return;
    await toggleUserStatusMutation.mutateAsync(toggleStatusUser);
  }, [isSuperuserDeactivationLocked, toggleStatusUser, toggleUserStatusMutation]);

  if (editingUser) {
    return (
      <div className="w-full">
        <AdminUserEditSection
          user={editingUser}
          onClose={() => {
            setEditingUser(null);
            onEditingChange?.(false);
          }}
          onUserUpdated={(updatedUser) => {
            updateLocalUser(updatedUser);
            setEditingUser(updatedUser);
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 mb-16">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Manage Users</h1>
        <p className="text-sm font-medium text-neutral-400">
          View and manage all registered users in the BugBoard system.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by name or email..."
            bgColor="bg-[#1A1D24]"
            textColor="text-white"
            iconColor="text-neutral-400"
            className="border border-white/5 !py-2.5 !shadow-none"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={roleFilter}
            onChange={(value) => setRoleFilter(value as "All" | "Admin" | "User")}
            options={[
              { label: "All Roles", value: "All" },
              { label: "Administrators", value: "Admin" },
              { label: "Developers", value: "User" },
            ]}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as "All" | "Active" | "Inactive")}
            options={[
              { label: "All Users", value: "All" },
              { label: "Active Users", value: "Active" },
              { label: "Inactive Users", value: "Inactive" },
            ]}
          />
        </div>
      </div>

      <GlassCard className="p-0 border-none shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
          <UserTable
            users={users}
            isLoading={isLoading}
            error={error}
            showStatus={true}
            renderActions={(user) => (
              <>
                <button
                  onClick={() => handleActionClick("Edit", user)}
                  className="text-neutral-500 hover:text-white transition-colors disabled:cursor-not-allowed disabled:text-neutral-700 disabled:hover:text-neutral-700"
                  title={
                    currentUser?.userId === user.userId
                      ? "Edit in Profile Settings"
                      : isDjangoSuperuser(user)
                        ? "Django superusers cannot be edited"
                        : "Edit User"
                  }
                  disabled={isDjangoSuperuser(user)}
                >
                  <FiEdit2 size={16} />
                </button>
                <button
                  onClick={() => handleActionClick("Delete", user)}
                  className="text-neutral-500 hover:text-red-400 transition-colors disabled:cursor-not-allowed disabled:text-neutral-700 disabled:hover:text-neutral-700"
                  title={
                    currentUser?.userId === user.userId
                      ? "You cannot deactivate your own account"
                      : isSuperuserDeactivationLocked(user)
                        ? "Django superusers cannot be deactivated"
                      : user.active
                        ? "Deactivate User"
                        : "Activate User"
                  }
                  disabled={currentUser?.userId === user.userId || isSuperuserDeactivationLocked(user)}
                >
                  <MdGroupOff size={16} />
                </button>
              </>
            )}
          />
        </div>

        {totalItems > 0 && !isLoading && !error ? (
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        ) : null}
      </GlassCard>

      <ToggleUserStatusModal
        isOpen={toggleStatusUser !== null}
        user={toggleStatusUser}
        onClose={() => setToggleStatusUser(null)}
        onConfirm={handleToggleStatus}
        isLoading={toggleUserStatusMutation.isPending}
      />
    </div>
  );
}
