import { useMemo, useState } from "react";
import { GlassCard } from "../ui/GlassCard";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";
import { isValidEmail, isValidName } from "../../utils/validation";

export function AddUsersSection() {
    const [name, setName] = useState("");
    const [surname, setSurname] = useState("");
    const [email, setEmail] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

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
        // TODO: Call API
        await new Promise((r) => setTimeout(r, 1000));
        setIsLoading(false);
        // Reset form on success (mock)
        setName("");
        setSurname("");
        setEmail("");
        setIsAdmin(false);
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

                {/* Make an Admin Toggle */}
                <div className="flex items-center gap-4">
                    <Toggle checked={isAdmin} onChange={setIsAdmin} label="Make an admin" />
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
