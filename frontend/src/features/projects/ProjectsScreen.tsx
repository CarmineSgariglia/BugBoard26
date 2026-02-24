import { TopNav } from "../../components/navigation/TopNav";
import { ProjectFolderCard } from "../../components/projects/ProjectFolderCard";
import { mockProjects } from "./projectsTest";

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
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 relative z-10 flex flex-col">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Projects</h1>
          <p className="text-[#9CA3AF]">
            Select a project folder to view its issues and boards.
          </p>
        </div>

        {/* CSS Grid for the folders */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {mockProjects.map((project) => (
            <ProjectFolderCard
              key={project.id}
              color={project.color}
              title={project.title}
              description={project.description}
              date={project.date}
              authorImageUrl={project.authorImageUrl}
              icon={project.icon}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
