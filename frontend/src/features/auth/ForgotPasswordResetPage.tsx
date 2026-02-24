import { useState } from "react";
import type { FormEvent } from "react";

import { AuthShell } from "../../components/layout/AuthShell";
import { resetPasswordApi } from "../../services/api";

export function ForgotPasswordResetPage() {
  const query = new URLSearchParams(window.location.search);
  const email = query.get("email") ?? "";
  const code = query.get("code") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await resetPasswordApi(email, code, newPassword);
      window.location.assign("/login");
    } catch {
      setError("Impossibile completare il reset password");
    }
  };

  return (
    <AuthShell title="Imposta nuova password" subtitle="Conferma la nuova password del tuo account">
      <form className="grid gap-3" onSubmit={onSubmit}>
        <input
          className="h-11 rounded-lg border border-white/20 bg-black/20 px-3"
          placeholder="Nuova password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button className="h-11 rounded-lg bg-cyan-300 font-semibold text-slate-900" type="submit">
          Salva password
        </button>
      </form>
    </AuthShell>
  );
}
