import { useEffect, useState } from "react";

import { fetchHealth } from "./services/api";

type HealthState = "loading" | "ok" | "error";

function App() {
  const [healthState, setHealthState] = useState<HealthState>("loading");
  const [message, setMessage] = useState("Checking backend connectivity...");

  useEffect(() => {
    let cancelled = false;

    fetchHealth()
      .then((response) => {
        if (!cancelled) {
          setHealthState("ok");
          setMessage(`Backend status: ${response.status}`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHealthState("error");
          setMessage("Unable to reach backend API.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRetry = async () => {
    setHealthState("loading");
    setMessage("Checking backend connectivity...");

    try {
      const response = await fetchHealth();
      setHealthState("ok");
      setMessage(`Backend status: ${response.status}`);
    } catch {
      setHealthState("error");
      setMessage("Unable to reach backend API.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-lg shadow-slate-300/60">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          BugBoard26
        </p>
        <h1 className="text-3xl font-bold">Three-Tier Architecture</h1>
        <p className="mt-2 text-slate-600">
          React (Presentation Tier), Django REST (Application Tier), PostgreSQL (Data Tier)
        </p>

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-700">API Health Check</p>
          <p
            className={`mt-2 text-lg font-medium ${
              healthState === "ok"
                ? "text-emerald-600"
                : healthState === "error"
                  ? "text-rose-600"
                  : "text-amber-600"
            }`}
          >
            {message}
          </p>

          <button
            type="button"
            onClick={handleRetry}
            className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Retry
          </button>
        </div>
      </div>
    </main>
  );
}

export default App;
