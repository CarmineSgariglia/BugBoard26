import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ProjectFolderCard } from "../../components/projects/ProjectFolderCard";
import { SearchBar } from "../../components/ui/SearchBar";
import { CreateProjectCard } from "../../components/projects/CreateProjectCard";
import { CreateProjectFlow } from "./CreateProjectFlow";
import { listProjectsApi, resolveMediaUrl, type Project } from "../../services/api";
import { getProjectIcon } from "../../utils/projectIcons";
import { useAuth } from "../../contexts/AuthContext";

function projectIcon(iconId?: string) {
  return getProjectIcon(iconId || "folder", 30);
}

export function ProjectsScreen() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const projectsData = await listProjectsApi();
      // Sort projects by createdAt (newest first)
      const sorted = [...projectsData].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Pre-resolve media URLs for performance (Optimization item #13)
      const resolved = sorted.map(p => ({
        ...p,
        authorProfileImg: resolveMediaUrl(p.authorProfileImg || undefined)
      })) as Project[];

      setProjects(resolved);
    } catch {
      setError("Unable to load data. Please login again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const cards = useMemo(() => {
    return projects.map((project) => ({
      id: String(project.projectId),
      color: project.color || "#14B8A6",
      title: project.name,
      description: project.description,
      date: new Date(project.createdAt).toLocaleDateString(),
      iconUrl: project.icon,
      authorProfileImg: project.authorProfileImg, // Now already resolved

    }));

  }, [projects]);


  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards;
    const lowerQuery = searchQuery.toLowerCase();
    return cards.filter((card) => card.title.toLowerCase().includes(lowerQuery));
  }, [cards, searchQuery]);



  return (
    <div className="min-h-screen bg-[#0D0D12] text-white flex flex-col relative overflow-hidden">
      {/* Page Content: z-10 ensures it floats above the background */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 pt-24 pb-8 relative z-10 flex  mt-8 flex-col">
        <div className="mb-10 w-full max-w-xl mx-auto text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Hello, {currentUser?.firstName || currentUser?.lastName ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : currentUser?.username || 'User'}
          </h1>
          <p className="text-[#9CA3AF]">
            Select a project folder to view its issues and boards.
          </p>
        </div>

        <div className="mb-14 w-full max-w-xl mx-auto">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Enter project's name"
            bgColor="bg-white"
            textColor="text-neutral-900"
            placeholderColor="placeholder:text-neutral-400"
            iconColor="text-neutral-900"
          />
        </div>

        {isLoading ? <p className="text-sm text-[#9CA3AF]">Loading projects...</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {/* CSS Grid for the folders */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {currentUser?.isAdmin && !searchQuery.trim() && (
            <CreateProjectCard onClick={() => setIsCreateModalOpen(true)} />
          )}

          {filteredCards.map((project) => (
            <ProjectFolderCard
              key={project.id}
              color={project.color}
              title={project.title}
              description={project.description}
              date={project.date}
              icon={projectIcon(project.iconUrl)}
              authorImageUrl={project.authorProfileImg}
              onClick={() => {
                navigate(`/projects/${project.id}/issues`);
              }}
            />
          ))}
        </div>
        {!isLoading && !error && filteredCards.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] mt-8 text-center">
            {projects.length === 0 ? "No projects found." : `No projects found matching "${searchQuery}".`}
          </p>
        ) : null}
      </div>

      {isCreateModalOpen && (
        <CreateProjectFlow
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={fetchProjects}
        />
      )}
    </div>
  );
}
