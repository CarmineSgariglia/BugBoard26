import axios from "axios";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { loginApi } from "@features/auth/api";
import { isValidEmail, isValidPassword } from "@shared/lib/validation";
import { useAuth } from "@features/auth";
import { ensureCsrfCookieReady } from "@shared/api/core/client";
import { Button } from "@shared/ui/Button";
import { FormField } from "@shared/ui/FormField";
import { Input } from "@shared/ui/Input";

const postLoginVerificationCode = "post_login_verification_failed";

function isTimeoutError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.code === "ECONNABORTED";
}

function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response && !isTimeoutError(error);
}

function isPostLoginVerificationError(error: unknown): boolean {
  return error instanceof Error && error.message === postLoginVerificationCode;
}

function logLoginFailure(error: unknown): void {
  if (axios.isAxiosError(error)) {
    console.warn("login_failed", {
      status: error.response?.status ?? null,
      code: error.code ?? null,
      requestUrl: error.config?.url ?? null,
      isTimeout: isTimeoutError(error),
    });
    return;
  }

  console.warn("login_failed", {
    status: null,
    code: isPostLoginVerificationError(error) ? postLoginVerificationCode : null,
    requestUrl: null,
    isTimeout: false,
  });
}

function getLoginErrorMessage(error: unknown): string {
  if (isPostLoginVerificationError(error)) {
    return "Login succeeded, but we couldn't verify your session. Please try again.";
  }

  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status;
    if (statusCode === 401) return "Invalid credentials";
    if (statusCode === 403) {
      return "We couldn't validate the secure session. Please try again.";
    }
    if (statusCode === 429) {
      return "Too many login attempts. Please wait a moment and try again.";
    }
    if (isTimeoutError(error)) {
      return "The login request took too long. Please try again.";
    }
    if (isNetworkError(error)) {
      return "We couldn't reach the server. Please try again.";
    }
  }

  return "We couldn't complete the login. Please try again.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPreparingCsrf, setIsPreparingCsrf] = useState(true);
  const [isCsrfReady, setIsCsrfReady] = useState(false);

  const isEmailValid = isValidEmail(email);
  const isPasswordValid = isValidPassword(password);
  const isFormValid = isEmailValid && isPasswordValid;

  const prepareCsrfCookie = async (showFailureMessage: boolean): Promise<boolean> => {
    setIsPreparingCsrf(true);

    try {
      const ready = await ensureCsrfCookieReady();
      setIsCsrfReady(ready);

      if (!ready && showFailureMessage) {
        setError("We couldn't prepare a secure login session. Please try again.");
      }

      return ready;
    } catch (csrfError) {
      setIsCsrfReady(false);
      if (showFailureMessage) {
        setError("We couldn't prepare a secure login session. Please try again.");
      }
      logLoginFailure(csrfError);
      return false;
    } finally {
      setIsPreparingCsrf(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      setIsPreparingCsrf(true);

      try {
        const ready = await ensureCsrfCookieReady();
        if (!isMounted) return;
        setIsCsrfReady(ready);
      } catch (csrfError) {
        if (!isMounted) return;
        setIsCsrfReady(false);
        logLoginFailure(csrfError);
      } finally {
        if (isMounted) {
          setIsPreparingCsrf(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await loginApi(email, password);
      const user = await refreshUser();
      if (!user) {
        throw new Error(postLoginVerificationCode);
      }
    },
    onSuccess: () => {
      console.info("login_success", { requestUrl: "/sessions" });
      navigate("/projects");
    },
    onError: (loginError) => {
      logLoginFailure(loginError);
      setError(getLoginErrorMessage(loginError));
    },
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || loginMutation.isPending || isPreparingCsrf) return;

    setError("");

    if (!isCsrfReady) {
      const ready = await prepareCsrfCookie(true);
      if (!ready) return;
    }

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
          disabled={!isFormValid || loginMutation.isPending || isPreparingCsrf}
          isLoading={loginMutation.isPending}
        >
          Login
        </Button>
      </form>
    </div>
  );
}
