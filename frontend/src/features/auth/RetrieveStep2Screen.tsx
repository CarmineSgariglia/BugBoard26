import { useMemo, useState } from "react";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { GlassCard } from "../../components/ui/GlassCard";
import { AuthHeader, AuthPageTitle } from "../../components/auth/AuthHeader";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { isValidPassword } from "../../utils/validation";
import { resetPasswordApi, verifyOtpApi } from "../../services/api";
import { useLocation, useNavigate } from "react-router-dom";

export function RetrieveStep2Screen() {
    const navigate = useNavigate();
    const location = useLocation();
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const email = useMemo(() => {
        const search = new URLSearchParams(location.search);
        return search.get("email")?.trim() ?? "";
    }, [location.search]);

    const isCodeValid = /^\d{6}$/.test(code);
    const isPasswordValid = isValidPassword(newPassword);
    const isFormValid = !!email && isCodeValid && isPasswordValid;

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid || isLoading) return;

        setError("");
        setSuccess("");
        setIsLoading(true);
        try {
            const verifyResult = await verifyOtpApi(email, code);
            if (!verifyResult.valid) {
                setError("OTP non valido o scaduto");
                return;
            }

            await resetPasswordApi(email, code, newPassword);
            setSuccess("Password aggiornata con successo. Reindirizzamento al login...");
            setTimeout(() => navigate("/login"), 900);
        } catch {
            setError("Impossibile aggiornare la password");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout>
            <AuthPageTitle text="Retrieve Password" />
            <GlassCard className="p-8">
                <AuthHeader
                    subtitle="Insert OTP code and your new password"
                />
                {!email ? (
                    <p className="text-sm text-red-400">Missing email context. Restart password recovery.</p>
                ) : null}
                <form className="flex flex-col gap-3" onSubmit={onSubmit}>
                    <TextField
                        type="text"
                        placeholder="Code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        maxLength={6}
                    />
                    <TextField
                        type="password"
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                    />
                    {error ? <p className="text-sm text-red-400">{error}</p> : null}
                    {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
                    <Button type="submit" disabled={!isFormValid || isLoading} isLoading={isLoading}>
                        Change password
                    </Button>
                </form>
            </GlassCard>
        </AuthLayout>
    );
}
