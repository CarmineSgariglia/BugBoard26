import { useEffect, useState, useCallback } from "react";
import { GlassCard } from "../ui/GlassCard";
import { SearchBar } from "../ui/SearchBar";
import { Select } from "../ui/Select";
import { Pagination } from "../ui/Pagination";
import { listUsersApi, disableUserApi, type AuthUser } from "../../services/api";
import { getErrorMessage } from "../../utils/error";
import { UserTable } from "../ui/UserTable";
import { AdminUserEditSection } from "./AdminUserEditSection";
import { ToggleUserStatusModal } from "./ToggleUserStatusModal";
import { FiEdit2 } from "react-icons/fi";
import { MdGroupOff } from "react-icons/md";

export interface ManageUsersSectionProps {
    onEditingChange?: (isEditing: boolean) => void;
}

export function ManageUsersSection({ onEditingChange }: ManageUsersSectionProps) {
    const [users, setUsers] = useState<AuthUser[]>([]);
    const [totalItems, setTotalItems] = useState(0); // Aggiunto per salvare il conteggio dal DB

    // I parametri che l'utente può cambiare dall'interfaccia
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
    const [roleFilter, setRoleFilter] = useState<"All" | "Admin" | "User">("All");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
    const [toggleStatusUser, setToggleStatusUser] = useState<AuthUser | null>(null);
    const [isToggling, setIsToggling] = useState(false);

    // L'effetto scatta ogni volta che uno dei filtri, la ricerca o la pagina cambia!
    useEffect(() => {
        const fetchDaServer = async () => {
            setIsLoading(true);
            setError("");
            try {
                // Costruiamo i parametri da inviare al server backend
                const params: any = { page: currentPage };

                if (search.trim()) params.search = search.trim();
                if (roleFilter !== "All") params.role = roleFilter;
                if (statusFilter !== "All") params.status = statusFilter;

                // Facciamo la chiamata passando i parametri
                const response = await listUsersApi(params);

                // Salviamo SOLO gli utenti di questa pagina specifica
                setUsers(response.results);
                // Aggiorniamo il numero totale per far calcolare le pagine alla <Pagination>
                setTotalItems(response.count);
            } catch (err) {
                setError(getErrorMessage(err, "Unable to load users"));
            } finally {
                setIsLoading(false);
            }
        };

        // Usa un piccolo "debounce" (ritardo) per evitare chiamate inutili mentre l'utente sta digitando velocemente
        const timeoutId = setTimeout(() => {
            fetchDaServer();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [currentPage, search, roleFilter, statusFilter]);

    // Quando cerchi o filtri qualcosa di nuovo, rimendiamo automaticamente l'utente a pagina 1
    useEffect(() => {
        setCurrentPage(1);
    }, [search, roleFilter, statusFilter]);


    const handleActionClick = (actionName: string, user: AuthUser) => {
        if (actionName === 'Edit') {
            setEditingUser(user);
            onEditingChange?.(true);
        } else if (actionName === 'Delete') {
            setToggleStatusUser(user);
        }
    }

    const handleToggleStatus = useCallback(async () => {
        if (!toggleStatusUser) return;
        setIsToggling(true);
        try {
            await disableUserApi(toggleStatusUser.userId, toggleStatusUser.username);
            // Toggle the active status locally
            setUsers(prev => prev.map(u =>
                u.userId === toggleStatusUser.userId
                    ? { ...u, active: !u.active }
                    : u
            ));
            setToggleStatusUser(null);
        } catch (err) {
            console.error("Failed to toggle user status", err);
        } finally {
            setIsToggling(false);
        }
    }, [toggleStatusUser]);

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
                        setUsers(prev => prev.map(u => u.userId === updatedUser.userId ? updatedUser : u));
                        setEditingUser(null);
                        onEditingChange?.(false);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col gap-6 mb-16">

            {/* Header Text */}
            <div className="text-center mb-2">
                <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Manage Users</h1>
                <p className="text-sm font-medium text-neutral-400">View and manage all registered users in the BugBoard system.</p>
            </div>

            {/* Toolbar (Search & Filter) */}
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
                        onChange={(value) => setRoleFilter(value as any)}
                        options={[
                            { label: "All Roles", value: "All" },
                            { label: "Administrators", value: "Admin" },
                            { label: "Developers", value: "User" }
                        ]}
                    />
                </div>
                <div className="w-full sm:w-48">
                    <Select
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value as any)}
                        options={[
                            { label: "All Users", value: "All" },
                            { label: "Active Users", value: "Active" },
                            { label: "Inactive Users", value: "Inactive" }
                        ]}
                    />
                </div>
            </div>

            {/* Main Table Card */}
            <GlassCard className="w-full overflow-hidden p-0 border-none bg-[#1A1D24] shadow-[0_8px_30px_rgb(0,0,0,0.12)]">

                <UserTable
                    users={users}
                    isLoading={isLoading}
                    error={error}
                    showStatus={true}
                    // Iniettiamo i nostri bottoni di azione per queste righe specifiche
                    renderActions={(user) => (
                        <>
                            <button
                                onClick={() => handleActionClick('Edit', user)}
                                className="text-neutral-500 hover:text-white transition-colors"
                                title="Edit User"
                            >
                                <FiEdit2 size={16} />
                            </button>
                            <button
                                onClick={() => handleActionClick('Delete', user)}
                                className="text-neutral-500 hover:text-red-400 transition-colors"
                                title={user.active ? "Deactivate User" : "Activate User"}
                            >
                                <MdGroupOff size={16} />
                            </button>
                        </>
                    )}
                />

                {/* Pagination Footer */}
                {totalItems > 0 && !isLoading && !error && (
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                    />
                )}
            </GlassCard>

            <ToggleUserStatusModal
                isOpen={toggleStatusUser !== null}
                user={toggleStatusUser}
                onClose={() => setToggleStatusUser(null)}
                onConfirm={handleToggleStatus}
                isLoading={isToggling}
            />
        </div>
    );
}
