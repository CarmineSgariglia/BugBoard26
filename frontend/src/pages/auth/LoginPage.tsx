import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { loginApi } from "@shared/api/modules/auth";
import { isValidEmail, isValidPassword } from "@shared/lib/validation";
import { useAuth } from "@shared/providers/AuthContext";
import { Button } from "@shared/ui/Button";
import { FormField } from "@shared/ui/FormField";
import { Input } from "@shared/ui/Input";

export function LoginPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const isEmailValid = isValidEmail(email);
  const isPasswordValid = isValidPassword(password);
  const isFormValid = isEmailValid && isPasswordValid;

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await loginApi(email, password);
      await refreshUser();
    },
    onSuccess: () => {
      navigate("/projects");
    },
    onError: () => {
      setError("Invalid credentials");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || loginMutation.isPending) return;

    setError("");
    loginMutation.mutate({ email: email.trim(), password });
  };

  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <FormField>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        <Button
          type="submit"
          disabled={!isFormValid || loginMutation.isPending}
          isLoading={loginMutation.isPending}
        >
          Login
        </Button>
      </form>
    </div>
  );
}
