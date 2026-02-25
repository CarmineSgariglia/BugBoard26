import { useMemo, useState } from "react";
import { SettingsCard } from "./SettingsCard";
import { TextField } from "../auth/TextField";
import { PrimaryButton } from "../auth/PrimaryButton";
import { createUserApi } from "../../services/api";
import { isValidEmail, isValidName, isValidPassword } from "../../utils/validation";

export function AddUsersSection() {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const isFormValid = useMemo(() => {
        return (
            isValidName(firstName.trim()) &&
            isValidName(lastName.trim()) &&
            username.trim().length >= 3 &&
            isValidEmail(email.trim()) &&
            isValidPassword(password)
        );
    }, [email, firstName, lastName, password, username]);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid || isLoading) return;
        setIsLoading(true);
        setError("");
        setMessage("");
        try {
            await createUserApi({
                username: username.trim(),
                email: email.trim(),
                password,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                isAdmin,
                active: true,
            });
            setMessage("User created successfully.");
            setFirstName("");
            setLastName("");
            setUsername("");
            setEmail("");
            setPassword("");
            setIsAdmin(false);
        } catch {
            setError("Unable to create user.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SettingsCard className="w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">Add New User</h2>
            <form className="flex flex-col gap-3" onSubmit={onSubmit}>
                <TextField placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <TextField placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                <TextField placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                <TextField type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <TextField
                    type="password"
                    placeholder="Temporary password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm text-neutral-300">
                    <input
                        type="checkbox"
                        checked={isAdmin}
                        onChange={(e) => setIsAdmin(e.target.checked)}
                        className="h-4 w-4 rounded border-[#2D3342] bg-[#13151A]"
                    />
                    Create as admin
                </label>
                {error ? <p className="text-sm text-red-400">{error}</p> : null}
                {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
                <PrimaryButton type="submit" disabled={!isFormValid || isLoading}>
                    {isLoading ? "Creating..." : "Create user"}
                </PrimaryButton>
            </form>
        </SettingsCard>
    );
}
