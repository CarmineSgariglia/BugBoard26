import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { loginApi } from "@features/auth/api";
import { useAuth } from "@features/auth";
import { useSubmitValidation } from "@shared/hooks";
import { ensureCsrfCookieReady } from "@shared/api/core/client";
import { Button } from "@shared/ui/Button";
import { FormField } from "@shared/ui/FormField";
import { Input } from "@shared/ui/Input";
import { InlineFeedbackMessage } from "@shared/ui/InlineFeedbackMessage";

function isTimeoutError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.code === "ECONNABORTED";
}

function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response && !isTimeoutError(error);
}

function logLoginFailure(error: unknown): void {
  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status ?? null;
    const requestUrl = error.config?.url ?? null;
    if (statusCode === 401) {
      console.warn("login_401", {
        status: statusCode,
        requestUrl,
      });
      return;
    }

    console.warn("login_failed", {
      status: statusCode,
      code: error.code ?? null,
      requestUrl,
      isTimeout: isTimeoutError(error),
    });
    return;
  }

  console.warn("login_failed", {
    status: null,
    code: null,
    requestUrl: null,
    isTimeout: false,
  });
}

function getLoginErrorMessage(error: unknown): string {
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
  const { refreshUser, setAuthenticatedUser } = useAuth();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [isPreparingCsrf, setIsPreparingCsrf] = useState(true);
  const [isCsrfReady, setIsCsrfReady] = useState(false);
  const validation = useSubmitValidation<"email" | "password">();

  const syncCredentialInputs = useCallback(() => {
    return {
      email: emailInputRef.current?.value ?? "",
      password: passwordInputRef.current?.value ?? "",
    };
  }, []);

  const prepareCsrfCookie = async (showFailureMessage: boolean): Promise<boolean> => {
    setIsPreparingCsrf(true);

    try {
      const ready = await ensureCsrfCookieReady();
      setIsCsrfReady(ready);

      if (!ready && showFailureMessage) {
        setError("We couldn't prepare a secure login session. Please try again.");
        console.warn("csrf_bootstrap_failed", {
          requestUrl: "/security/csrf-token",
          reason: "csrf_cookie_unavailable",
        });
      }

      return ready;
    } catch (csrfError) {
      setIsCsrfReady(false);
      if (showFailureMessage) {
        setError("We couldn't prepare a secure login session. Please try again.");
      }
      console.warn("csrf_bootstrap_failed", {
        requestUrl: "/security/csrf-token",
        isTimeout: isTimeoutError(csrfError),
        status: axios.isAxiosError(csrfError) ? csrfError.response?.status ?? null : null,
      });
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
        if (!ready) {
          console.warn("csrf_bootstrap_failed", {
            requestUrl: "/security/csrf-token",
            reason: "csrf_cookie_unavailable",
          });
        }
      } catch (csrfError) {
        if (!isMounted) return;
        setIsCsrfReady(false);
        console.warn("csrf_bootstrap_failed", {
          requestUrl: "/security/csrf-token",
          isTimeout: isTimeoutError(csrfError),
          status: axios.isAxiosError(csrfError) ? csrfError.response?.status ?? null : null,
        });
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

  useEffect(() => {
    syncCredentialInputs();

    const syncIntervalId = window.setInterval(() => {
      syncCredentialInputs();
    }, 250);
    const handleWindowFocus = () => {
      syncCredentialInputs();
    };
    const handleVisibilityChange = () => {
      syncCredentialInputs();
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(syncIntervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncCredentialInputs]);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return loginApi(email, password);
    },
    onSuccess: (user) => {
      setAuthenticatedUser(user);
      console.info("login_success", { requestUrl: "/sessions" });
      navigate("/projects");
      void refreshUser({ clearOnUnauthorized: false })
        .then((nextUser) => {
          if (!nextUser) {
            console.warn("post_login_sync_failed", {
              requestUrl: "/users/me",
              reason: "missing_user",
            });
          }
        })
        .catch((syncError) => {
          console.warn("post_login_sync_failed", {
            requestUrl: "/users/me",
            isTimeout: isTimeoutError(syncError),
            status: axios.isAxiosError(syncError) ? syncError.response?.status ?? null : null,
            code: axios.isAxiosError(syncError) ? syncError.code ?? null : null,
          });
        });
    },
    onError: (loginError) => {
      logLoginFailure(loginError);
      setError(getLoginErrorMessage(loginError));
    },
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextValues = syncCredentialInputs();
    const trimmedEmail = nextValues.email.trim();
    const isFormComplete = validation.validate({
      email: trimmedEmail.length > 0,
      password: nextValues.password.length > 0,
    });

    if (!isFormComplete || loginMutation.isPending || isPreparingCsrf) {
      if (!isFormComplete) {
        setError("Please fill in all fields.");
      }
      return;
    }

    setError("");

    if (!isCsrfReady) {
      const ready = await prepareCsrfCookie(true);
      if (!ready) return;
    }

    loginMutation.mutate({ email: trimmedEmail, password: nextValues.password });
  };

  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <FormField>
          <Input
            ref={emailInputRef}
            id="login-email"
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="username"
            hasError={validation.hasFieldError("email")}
            onInput={() => {
              setError("");
              const nextValues = syncCredentialInputs();
              validation.updateFieldValidity("email", nextValues.email.trim().length > 0);
            }}
            onFocus={() => {
              syncCredentialInputs();
            }}
          />
        </FormField>
        <FormField>
          <Input
            ref={passwordInputRef}
            id="login-password"
            name="password"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            hasError={validation.hasFieldError("password")}
            onInput={() => {
              setError("");
              const nextValues = syncCredentialInputs();
              validation.updateFieldValidity("password", nextValues.password.length > 0);
            }}
            onFocus={() => {
              syncCredentialInputs();
            }}
          />
        </FormField>
        <InlineFeedbackMessage message={error} />
        <Button type="submit" disabled={loginMutation.isPending} isLoading={loginMutation.isPending}>
          Login
        </Button>
      </form>
    </div>
  );
}
