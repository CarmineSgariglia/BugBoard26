import { useMemo, useState } from "react";
import axios from "axios";
import { GlassCard } from "../ui/GlassCard";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { isValidEmail, isValidName } from "../../utils/validation";
import { createUserApi } from "../../services/api";

function buildUsernameFromEmail(email: string): string {
    const localPart = email.split("@")[0] ?? "user";
    const base = localPart.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 20) || "user";
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `${base}${suffix}`;
}

function generateTemporaryPassword(): string {
    const suffix = Math.floor(100000 + Math.random() * 900000);
    return `Temp!${suffix}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (!axios.isAxiosError(error)) return fallback;
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) return detail;
    return fallback;
}

export function AddUsersSection() {
    const [name, setName] = useState("");
    const [surname, setSurname] = useState("");
    const [email, setEmail] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Validation
    const isNameValid = useMemo(() => name === "" || isValidName(name.trim()), [name]);
    const isSurnameValid = useMemo(() => surname === "" || isValidName(surname.trim()), [surname]);
    const isEmailValid = useMemo(() => email === "" || isValidEmail(email.trim()), [email]);

    const isFormValid = useMemo(() => {
        return (
            name.trim().length > 0 && isValidName(name.trim()) &&
            surname.trim().length > 0 && isValidName(surname.trim()) &&
            email.trim().length > 0 && isValidEmail(email.trim())
        );
    }, [name, surname, email]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid || isLoading) return;
        setIsLoading(true);
        setError("");
        setSuccess("");

        const normalizedEmail = email.trim().toLowerCase();
        const username = buildUsernameFromEmail(normalizedEmail);
        const temporaryPassword = generateTemporaryPassword();

        try {
            await createUserApi({
                username,
                email: normalizedEmail,
                password: temporaryPassword,
                firstName: name.trim(),
                lastName: surname.trim(),
                isAdmin,
                active: true,
            });
            setName("");
            setSurname("");
            setEmail("");
            setIsAdmin(false);
            setSuccess(`User created. Username: ${username} | Temporary password: ${temporaryPassword}`);
        } catch (err) {
            setError(getErrorMessage(err, "Unable to create user"));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <GlassCard className="w-full flex flex-col pt-8 px-8 border-none bg-[#1A1D24] shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">

                {/* Name & Surname Row */}
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 flex flex-col gap-2">
                        <label className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
                            Name
                        </label>
                        <TextField
                            placeholder="Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            error={!isNameValid ? "Name must contain only letters (min. 3)." : undefined}
                            className="bg-[#1A1D24] border-white/5 h-12"
                        />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                        <label className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
                            Surname
                        </label>
                        <TextField
                            placeholder="Surname"
                            value={surname}
                            onChange={(e) => setSurname(e.target.value)}
                            error={!isSurnameValid ? "Surname must contain only letters (min. 3)." : undefined}
                            className="bg-[#1A1D24] border-white/5 h-12"
                        />
                    </div>
                </div>

                {/* Email Address */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
                        Email Address
                    </label>
                    <TextField
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        error={!isEmailValid ? "Invalid email address." : undefined}
                        className="bg-[#1A1D24] border-white/5 h-12"
                    />
                </div>

                {/* Divider Line */}
                <div className="h-[1px] w-full bg-white/5 mt-2 mb-1"></div>

                {error ? <p className="text-sm text-red-400">{error}</p> : null}
                {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

                {/* Make an Admin Toggle */}
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        role="switch"
                        aria-checked={isAdmin}
                        onClick={() => setIsAdmin(!isAdmin)}
                        className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-[#1A1D24] ${isAdmin ? 'bg-[#3DD66A]' : 'bg-white/10'
                            }`}
                    >
                        <span className="sr-only">Make an admin</span>

                        {/* The "I" icon when active */}
                        <span className={`pointer-events-none absolute left-3 text-[11px] font-bold text-white transition-opacity ${isAdmin ? 'opacity-100' : 'opacity-0'}`}>
                            |
                        </span>

                        <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isAdmin ? 'translate-x-2.5' : '-translate-x-3'
                                }`}
                        />
                    </button>
                    <span className="text-sm font-bold tracking-wider text-neutral-400 uppercase">
                        Make an Admin
                    </span>
                </div>

                {/* Add User Button Container */}
                <div className="mt-4 bg-[#20252F] -mx-8 p-6 rounded-b-[24px]">
                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        isLoading={isLoading}
                        disabled={!isFormValid || isLoading}
                        fullWidth
                    >
                        Add User
                    </Button>
                </div>
            </form>
        </GlassCard>
    );
}
