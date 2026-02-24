import { useState } from "react";
import { isValidEmail, isValidPassword } from "../../utils/validation";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { AuthCard } from "../../components/auth/AuthCard";
import { AuthHeader, AuthPageTitle } from "../../components/auth/AuthHeader";
import { TextField } from "../../components/auth/TextField";
import { PrimaryButton } from "../../components/auth/PrimaryButton";
import { AuthFooterLink } from "../../components/auth/AuthFooterLink";

export function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const isEmailValid = isValidEmail(email);
    const isPasswordValid = isValidPassword(password);
    const isFormValid = isEmailValid && isPasswordValid;

    return (
        <AuthLayout>
            <AuthPageTitle text="BugBoard26" />
            <AuthCard>
                <AuthHeader />
                <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
                    <TextField
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextField
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <PrimaryButton type="submit" disabled={!isFormValid}>
                        Login
                    </PrimaryButton>
                </form>
                <AuthFooterLink to="/forgot-password">Forgot password?</AuthFooterLink>
            </AuthCard>
        </AuthLayout>
    );
}
