import { TopNav } from "../../components/navigation/TopNav";

export function ProjectsScreen() {
  return (
    <div className="min-h-screen bg-[#0D0D12] text-white flex flex-col">
      <TopNav />
      {/* Page Content */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-6">Projects</h1>
        <div className="text-sm text-[#9CA3AF]">
          Login riuscito. Questa schermata è il punto di ingresso per la dashboard progetti.
        </div>
      </div>
    </div>
  );
}
