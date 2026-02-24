import { useState } from "react";
import type { FormEvent } from "react";

import { AuthShell } from "../../components/layout/AuthShell";
import { loginApi } from "../../services/api";

export function LoginPageV2() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await loginApi(email, password);
      window.location.assign("/projects");
    } catch {
      setError("Credenziali non valide");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Accedi" subtitle="Entra in BugBoard26 con le credenziali del tuo account">
      <form className="grid gap-3" onSubmit={onSubmit}>
        <input
          className="h-11 rounded-lg border border-white/20 bg-black/20 px-3"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="h-11 rounded-lg border border-white/20 bg-black/20 px-3"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button className="h-11 rounded-lg bg-cyan-300 font-semibold text-slate-900 disabled:opacity-50" type="submit" disabled={loading}>
          {loading ? "Accesso..." : "Login"}
        </button>
      </form>
      <div className="mt-4 text-sm text-slate-300">
        <a className="underline underline-offset-4" href="/forgot-password">
          Recupera password
        </a>
      </div>
    </AuthShell>
  );
}
