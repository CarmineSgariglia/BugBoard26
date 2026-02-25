import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopNav } from "../../components/navigation/TopNav";
import { ProjectFolderCard } from "../../components/projects/ProjectFolderCard";
import { listProjectsApi, resolveMediaUrl, type Project } from "../../services/api";

function folderIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function projectIcon(iconUrl?: string) {
  if (!iconUrl) {
    return folderIcon();
  }
  return <img src={resolveMediaUrl(iconUrl)} alt="Project icon" className="h-7 w-7 object-contain" />;
}

export function ProjectsScreen() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      setError("");
      try {
        setProjects(await listProjectsApi());
      } catch {
        setError("Unable to load projects. Please login again.");
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, []);

  const cards = useMemo(() => {
    return projects.map((project) => ({
      id: String(project.projectId),
      color: project.color || "#14B8A6",
      title: project.name,
      description: project.description,
      date: new Date(project.createdAt).toLocaleDateString(),
      iconUrl: project.icon,
    }));
  }, [projects]);

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

        {isLoading ? <p className="text-sm text-[#9CA3AF]">Loading projects...</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {/* CSS Grid for the folders */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {cards.map((project) => (
            <ProjectFolderCard
              key={project.id}
              color={project.color}
              title={project.title}
              description={project.description}
              date={project.date}
              icon={projectIcon(project.iconUrl)}
              onClick={() => {
                navigate(`/projects/${project.id}/issues`);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
