import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { CreateProjectFlow } from "@features/project/flows/CreateProjectFlow";
import { listProjectsApi } from "@shared/api/modules/projects";
import type { Project } from "@shared/api/types/projects";
import { resolveMediaUrl } from "@shared/api/core/media";
import { getProjectIcon } from "@features/project/ui/projectIcons";
import { useFluidWheelWindow } from "@shared/hooks";
import { useAuth } from "@features/auth";
import { SearchBar } from "@shared/ui/SearchBar";
import { CreateProjectCard } from "@features/project/ui/CreateProjectCard";
import { ProjectFolderCard } from "@features/project/ui/ProjectFolderCard";

function projectIcon(iconId?: string) {
  return getProjectIcon(iconId || "folder", 30);
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useFluidWheelWindow(true);

  const {
    data: projects = [],
    isLoading,
    error,
    refetch: fetchProjects,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const projectsData = await listProjectsApi();
      const sorted = [...projectsData].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return sorted.map((p) => ({
        ...p,
        authorProfileImg: resolveMediaUrl(p.authorProfileImg || undefined),
      })) as Project[];
    },
    staleTime: 30_000,
  });

  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const lowerQuery = searchQuery.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(lowerQuery));
  }, [projects, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0D0D12] text-white flex flex-col relative overflow-hidden">
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 pt-24 pb-8 relative z-10 flex mt-8 flex-col">
        <div className="mb-10 w-full max-w-xl mx-auto text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Hello,{" "}
            {currentUser?.firstName || currentUser?.lastName
              ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
              : currentUser?.username || "User"}
          </h1>
          <p className="text-[#9CA3AF]">Select a project folder to view its issues and boards.</p>
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

        {error ? <p className="text-sm text-red-400">Unable to load data. Please login again.</p> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {currentUser?.isAdmin && !searchQuery.trim() ? (
            <CreateProjectCard onClick={() => setIsCreateModalOpen(true)} />
          ) : null}

          {filteredCards.map((project) => (
            <ProjectFolderCard
              key={project.projectId}
              color={project.color || "#14B8A6"}
              title={project.name}
              description={project.description}
              date={new Date(project.createdAt).toLocaleDateString()}
              icon={projectIcon(project.icon)}
              authorImageUrl={project.authorProfileImg}
              onClick={() => {
                navigate(`/projects/${project.projectId}/issues`);
              }}
            />
          ))}
        </div>

        {!isLoading && !error && filteredCards.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] mt-8 text-center">
            {projects.length === 0
              ? "No projects found."
              : `No projects found matching "${searchQuery}".`}
          </p>
        ) : null}
      </div>

      {isCreateModalOpen ? (
        <CreateProjectFlow
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={fetchProjects}
        />
      ) : null}
    </div>
  );
}
