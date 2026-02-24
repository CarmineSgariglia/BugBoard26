import { useRef, useEffect, useState } from "react";
import { isValidEmail } from "../../utils/validation";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { AuthCard } from "../../components/auth/AuthCard";
import { AuthHeader, AuthPageTitle } from "../../components/auth/AuthHeader";
import { TextField } from "../../components/auth/TextField";
import { PrimaryButton } from "../../components/auth/PrimaryButton";
import { useNavigate } from "react-router-dom";

export function RetrieveStep1Screen() {
    const navigate = useNavigate();
    const emailInputRef = useRef<HTMLInputElement>(null);
    const [email, setEmail] = useState("");

    const isEmailValid = isValidEmail(email);

    useEffect(() => {
        emailInputRef.current?.focus();
    }, []);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Here we could validate the email before navigating
        navigate("/forgot-password/verify");
    };

    return (
        <AuthLayout>
            <AuthPageTitle text="Retrive Password" />
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
                    <PrimaryButton type="submit" disabled={!isEmailValid}>
                        Send Code
                    </PrimaryButton>
                </form>
            </AuthCard>
        </AuthLayout>
    );
}
