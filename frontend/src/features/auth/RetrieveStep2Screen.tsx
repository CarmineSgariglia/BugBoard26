import { useState } from "react";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { AuthCard } from "../../components/auth/AuthCard";
import { AuthHeader, AuthPageTitle } from "../../components/auth/AuthHeader";
import { TextField } from "../../components/auth/TextField";
import { PrimaryButton } from "../../components/auth/PrimaryButton";
import { isValidPassword } from "../../utils/validation";

export function RetrieveStep2Screen() {
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");

    const isCodeValid = code.length > 0;
    const isPasswordValid = isValidPassword(newPassword);
    const isFormValid = isCodeValid && isPasswordValid;

    return (
        <AuthLayout>
            <AuthPageTitle text="Retrive Password" />
            <AuthCard>
                <AuthHeader
                    subtitle="We send you a temporary password on your email"
                />
                <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
                    <TextField
                        type="text"
                        placeholder="Code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    />
                    <TextField
                        type="password"
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <PrimaryButton type="submit" disabled={!isFormValid}>
                        Change password
                    </PrimaryButton>
                </form>
            </AuthCard>
        </AuthLayout>
    );
}
