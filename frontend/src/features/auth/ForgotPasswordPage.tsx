import { useState } from "react";
import type { FormEvent } from "react";

import { AuthShell } from "../../components/layout/AuthShell";
import { requestOtpApi } from "../../services/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await requestOtpApi(email);
      window.location.assign(`/forgot-password/verify?email=${encodeURIComponent(email)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Recupera password" subtitle="Richiedi un codice OTP valido 5 minuti">
      <form className="grid gap-3" onSubmit={onSubmit}>
        <input
          className="h-11 rounded-lg border border-white/20 bg-black/20 px-3"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className="h-11 rounded-lg bg-cyan-300 font-semibold text-slate-900" type="submit" disabled={loading}>
          {loading ? "Invio..." : "Invia OTP"}
        </button>
      </form>
    </AuthShell>
  );
}
