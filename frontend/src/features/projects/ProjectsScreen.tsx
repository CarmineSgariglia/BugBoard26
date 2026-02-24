import { TopNav } from "../../components/navigation/TopNav";

export function ProjectsScreen() {
  return (
    <div className="min-h-screen bg-[#0D0D12] text-white flex flex-col relative overflow-hidden">
      {/* Radial Gradient Background (Fixed so it stays centered on scroll) */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: "radial-gradient(circle at center, #1b1e2a 0%, #0d0d12 60%)"
        }}
      />

      {/* TopNav handles its own z-index (z-40) */}
      <TopNav />

      {/* Page Content: z-10 ensures it floats above the background */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 relative z-10">
        <h1 className="text-2xl font-semibold mb-6">Projects</h1>
        <div className="text-sm text-[#9CA3AF]">
          Login riuscito. Questa schermata è il punto di ingresso per la dashboard progetti.
        </div>
      </div>
    </div>
  );
}
