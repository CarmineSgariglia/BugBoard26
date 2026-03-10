import { useRef, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { isValidEmail } from "../../shared/lib/validation";
import { FormField } from "../../shared/ui/FormField";
import { Input } from "../../shared/ui/Input";
import { Button } from "../../shared/ui/Button";
import { requestOtpApi } from "../../shared/api/modules/auth";

export function RetrieveStep1Screen() {
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
      setError("Impossibile inviare il codice OTP");
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
