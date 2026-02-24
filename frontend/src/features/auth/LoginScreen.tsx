import { useState } from "react";
import { isValidEmail, isValidPassword } from "../../utils/validation";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { AuthCard } from "../../components/auth/AuthCard";
import { AuthHeader, AuthPageTitle } from "../../components/auth/AuthHeader";
import { TextField } from "../../components/auth/TextField";
import { PrimaryButton } from "../../components/auth/PrimaryButton";
import { AuthFooterLink } from "../../components/auth/AuthFooterLink";
import { loginApi } from "../../services/api";
import { useNavigate } from "react-router-dom";

export function LoginScreen() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const isEmailValid = isValidEmail(email);
    const isPasswordValid = isValidPassword(password);
    const isFormValid = isEmailValid && isPasswordValid;

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid || isLoading) return;

        setIsLoading(true);
        setError("");

        try {
            await loginApi(email.trim(), password);
            navigate("/projects");
        } catch {
            setError("Credenziali non valide");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout>
            <AuthPageTitle text="BugBoard26" />
            <AuthCard>
                <AuthHeader />
                <form className="flex flex-col gap-3" onSubmit={onSubmit}>
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
                    {error ? <p className="text-sm text-red-400">{error}</p> : null}
                    <PrimaryButton type="submit" disabled={!isFormValid || isLoading}>
                        {isLoading ? "Logging in..." : "Login"}
                    </PrimaryButton>
                </form>
                <AuthFooterLink to="/forgot-password">Forgot password?</AuthFooterLink>
            </AuthCard>
        </AuthLayout>
    );
}
