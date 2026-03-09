import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { isValidPassword, isValidCode } from "../../utils/validation";
import { resetPasswordApi, verifyOtpApi } from "../../shared/api/modules/auth";

export function RetrieveStep2Screen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const email = useMemo(() => {
    const search = new URLSearchParams(location.search);
    return search.get("email")?.trim() ?? "";
  }, [location.search]);

  const isCodeValid = isValidCode(code);
  const isPasswordValid = isValidPassword(newPassword);
  const isFormValid = !!email && isCodeValid && isPasswordValid;

  const resetMutation = useMutation({
    mutationFn: async ({ emailValue, codeValue, passwordValue }: { emailValue: string; codeValue: string; passwordValue: string }) => {
      const verifyResult = await verifyOtpApi(emailValue, codeValue);
      if (!verifyResult.valid) {
        throw new Error("OTP_INVALID");
      }
      await resetPasswordApi(emailValue, codeValue, passwordValue);
    },
    onSuccess: () => {
      setSuccess("Password updated successfully. Redirecting to login...");
      setTimeout(() => navigate("/login"), 900);
    },
    onError: (err) => {
      if (err instanceof Error && err.message === "OTP_INVALID") {
        setError("OTP invalid or expired");
        return;
      }
      setError("Unable to update password");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || resetMutation.isPending) return;

    setError("");
    setSuccess("");

    resetMutation.mutate({
      emailValue: email,
      codeValue: code,
      passwordValue: newPassword,
    });
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
        <Button
          type="submit"
          disabled={!isFormValid || resetMutation.isPending}
          isLoading={resetMutation.isPending}
        >
          Change password
        </Button>
      </form>
    </div>
  );
}
