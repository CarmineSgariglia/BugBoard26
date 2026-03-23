import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { requestOtpApi } from "@features/auth/api";
import { isValidEmail } from "@shared/lib/validation";
import { Button } from "@shared/ui/Button";
import { FormField } from "@shared/ui/FormField";
import { Input } from "@shared/ui/Input";

export function RecoverPasswordRequestPage() {
  const navigate = useNavigate();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const isEmailValid = isValidEmail(email);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const requestOtpMutation = useMutation({
    mutationFn: (emailValue: string) => requestOtpApi(emailValue),
    onSuccess: (_data, emailValue) => {
      navigate(`/forgot-password/verify?email=${encodeURIComponent(emailValue)}`);
    },
    onError: () => {
      setError("Impossible to send the OTP code");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid || requestOtpMutation.isPending) return;

    setError("");
    requestOtpMutation.mutate(email.trim());
  };

  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <FormField>
          <Input
            ref={emailInputRef}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        <Button
          type="submit"
          disabled={!isEmailValid || requestOtpMutation.isPending}
          isLoading={requestOtpMutation.isPending}
        >
          Send Code
        </Button>
      </form>
    </div>
  );
}
