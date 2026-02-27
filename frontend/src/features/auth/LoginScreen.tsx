import { useState } from "react";
import { isValidEmail, isValidPassword } from "../../utils/validation";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { AuthFooterLink } from "../../components/auth/AuthFooterLink";
import { loginApi } from "../../services/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function LoginScreen() {
    const navigate = useNavigate();
    const { refreshUser } = useAuth();
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
            await refreshUser();
            navigate("/projects");
        } catch {
            setError("Invalid credentials");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
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
                <Button type="submit" disabled={!isFormValid || isLoading} isLoading={isLoading}>
                    Login
                </Button>
            </form>
            <AuthFooterLink to="/forgot-password">Forgot password?</AuthFooterLink>
        </div>
    );
}
