import { useMemo, useState } from "react";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { isValidPassword, isValidCode } from "../../utils/validation";
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

    const isCodeValid = isValidCode(code);
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
                setError("OTP invalid or expired");
                return;
            }

            await resetPasswordApi(email, code, newPassword);
            setSuccess("Password updated successfully. Redirecting to login...");
            setTimeout(() => navigate("/login"), 900);
        } catch {
            setError("Unable to update password");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">

            {!email ? (
                <p className="text-sm text-red-400">Missing email context. Restart password recovery.</p>
            ) : null}
            <form className="flex flex-col gap-3" onSubmit={onSubmit}>
                <FormField>
                    <Input
                        type="text"
                        placeholder="Code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        maxLength={6}
                    />
                </FormField>
                <FormField>
                    <Input
                        type="password"
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                    />
                </FormField>
                {error ? <p className="text-sm text-rose-400">{error}</p> : null}
                {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
                <Button type="submit" disabled={!isFormValid || isLoading} isLoading={isLoading}>
                    Change password
                </Button>
            </form>
        </div>
    );
}
