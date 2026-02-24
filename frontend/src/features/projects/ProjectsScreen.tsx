import { logoutApi } from "../../services/api";

export function ProjectsScreen() {
  return (
    <div className="min-h-screen bg-[#0D0D12] text-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-8">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <button
          className="rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
          onClick={async () => {
            await logoutApi();
            window.location.assign("/login");
          }}
          type="button"
        >
          Logout
        </button>
      </div>
      <div className="mx-auto w-full max-w-5xl px-6 pb-10 text-sm text-[#9CA3AF]">
        Login riuscito. Questa schermata è il punto di ingresso per la dashboard progetti.
      </div>
    </div>
  );
}
