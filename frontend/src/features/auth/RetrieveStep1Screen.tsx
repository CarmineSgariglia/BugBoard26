import { useRef, useEffect, useState } from "react";
import { isValidEmail } from "../../utils/validation";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { AuthCard } from "../../components/auth/AuthCard";
import { AuthHeader, AuthPageTitle } from "../../components/auth/AuthHeader";
import { TextField } from "../../components/auth/TextField";
import { PrimaryButton } from "../../components/auth/PrimaryButton";
import { useNavigate } from "react-router-dom";
import { requestOtpApi } from "../../services/api";

export function RetrieveStep1Screen() {
    const navigate = useNavigate();
    const emailInputRef = useRef<HTMLInputElement>(null);
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const isEmailValid = isValidEmail(email);

    useEffect(() => {
        emailInputRef.current?.focus();
    }, []);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEmailValid || isLoading) return;

        setError("");
        setIsLoading(true);
        try {
            await requestOtpApi(email.trim());
            navigate(`/forgot-password/verify?email=${encodeURIComponent(email.trim())}`);
        } catch {
            setError("Impossibile inviare il codice OTP");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout>
            <AuthPageTitle text="Retrieve Password" />
            <AuthCard>
                <AuthHeader
                    subtitle="Insert your email to recover your password"
                />
                <form className="flex flex-col gap-3" onSubmit={onSubmit}>
                    <TextField
                        ref={emailInputRef}
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    {error ? <p className="text-sm text-red-400">{error}</p> : null}
                    <PrimaryButton type="submit" disabled={!isEmailValid || isLoading}>
                        {isLoading ? "Sending..." : "Send Code"}
                    </PrimaryButton>
                </form>
            </AuthCard>
        </AuthLayout>
    );
}
