import { useRef, useEffect, useState } from "react";
import { isValidEmail } from "../../utils/validation";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
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
        <div className="flex flex-col gap-3">

            <form className="flex flex-col gap-3" onSubmit={onSubmit}>
                <TextField
                    ref={emailInputRef}
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                {error ? <p className="text-sm text-red-400">{error}</p> : null}
                <Button type="submit" disabled={!isEmailValid || isLoading} isLoading={isLoading}>
                    Send Code
                </Button>
            </form>
        </div>
    );
}
