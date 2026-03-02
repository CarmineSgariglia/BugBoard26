import { useMemo, useState } from "react";
import { GlassCard } from "../ui/GlassCard";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";
import { isValidEmail, isValidName } from "../../utils/validation";
import { getErrorMessage } from "../../utils/error";
import { createUserApi } from "../../services/api";
import { IdentityFields } from "./IdentityFields";
import { TiUserAdd } from "react-icons/ti";


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
            setSuccess(`User created. \n Username: ${username} \n Temporary password: ${temporaryPassword}`);
        } catch (err) {
            setError(getErrorMessage(err, "Unable to create user"));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <GlassCard className="w-full flex flex-col pt-8 border-none bg-[#1A1D24] shadow-[0_8px_30px_rgb(0,0,0,0.12)]">

            <div className="flex flex-col items-center justify-center mb-8 mt-2">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 border border-blue-500/20">
                    <TiUserAdd className="text-white-400" size={32} />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Add New User</h2>
                <p className="text-sm text-neutral-400 text-center max-w-sm">
                    Enter the details below to create a new account in the system.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">

                <IdentityFields
                    name={name}
                    onChangeName={setName}
                    surname={surname}
                    onChangeSurname={setSurname}
                    email={email}
                    onChangeEmail={setEmail}
                    errorName={!isNameValid ? "Name must contain only letters (min. 3)." : undefined}
                    errorSurname={!isSurnameValid ? "Surname must contain only letters (min. 3)." : undefined}
                    errorEmail={!isEmailValid ? "Invalid email address." : undefined}
                    className="px-8 pb-4 flex flex-col gap-5"
                />

                {/* Divider Line */}
                <div className="h-[1px] w-full bg-white/5 mt-2 mb-1"></div>

                <div className="pl-8 pr-8">
                    {error ? <p className="text-sm text-red-400 whitespace-pre-line">{error}</p> : null}
                    {success ? <p className="text-sm text-emerald-400 whitespace-pre-line">{success}</p> : null}
                </div>

                {/* Make an Admin Toggle */}
                <div className="flex items-center gap-4 px-8">
                    <Toggle checked={isAdmin} onChange={setIsAdmin} label="Make an admin" />
                    <span className="text-sm font-bold tracking-wider text-neutral-400 uppercase">
                        Make an Admin
                    </span>
                </div>

                {/* Add User Button Container */}
                <div className="mt-4 bg-[#20252F] -mx-18 p-6 rounded-b-[24px]">
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
