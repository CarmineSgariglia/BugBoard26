import { useState } from "react";
import type { FormEvent } from "react";

import { AuthShell } from "../../components/layout/AuthShell";
import { verifyOtpApi } from "../../services/api";

export function ForgotPasswordVerifyPage() {
  const query = new URLSearchParams(window.location.search);
  const email = query.get("email") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await verifyOtpApi(email, code);
    if (!result.valid) {
      setError("OTP non valido o scaduto");
      return;
    }
    window.location.assign(`/forgot-password/reset?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`);
  };

  return (
    <AuthShell title="Verifica OTP" subtitle="Inserisci il codice a 6 cifre ricevuto via email">
      <form className="grid gap-3" onSubmit={onSubmit}>
        <input
          className="h-11 rounded-lg border border-white/20 bg-black/20 px-3"
          placeholder="Codice OTP"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          required
        />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button className="h-11 rounded-lg bg-cyan-300 font-semibold text-slate-900" type="submit">
          Verifica codice
        </button>
      </form>
    </AuthShell>
  );
}
