import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getProjectApi, listProjectIssuesApi, listProjectMembersApi, type Issue, type Project, type ProjectMembership } from "../../services/api";
import { useAuth } from "../../contexts/useAuth";
import { useBreadcrumbs } from "../../contexts/useBreadcrumbs";

import { CATEGORIES, PRIORITIES, STATUSES } from "../../utils/issueConstants";

// UI Components
import { SearchBar } from "../../components/ui/SearchBar";
import { Select } from "../../components/ui/Select";
import { Button } from "../../components/ui/Button";
import { IssueCard } from "../../components/issues/IssueCard";
import { ProjectSidebar } from "../../components/projects/ProjectSidebar";
import { EditProjectFlow } from "./EditProjectFlow";
import { EditTeamFlow } from "./EditTeamFlow";
import { DeleteProjectFlow } from "./DeleteProjectFlow";
import { SidebarLayout } from "../../components/layout/SidebarLayout";


// Icons
import { FiPlus } from "react-icons/fi";
import { BiCategoryAlt } from "react-icons/bi";
import { HiOutlineFlag, HiOutlineCollection, HiOutlineSortAscending, HiOutlineSortDescending } from "react-icons/hi";
import { IssueModal } from "../issue/IssueModal";

export function ProjectIssuesScreen() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { user: currentUser } = useAuth();
  const { setLabel } = useBreadcrumbs();

  // States
  const [project, setProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [members, setMembers] = useState<ProjectMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditTeamModalOpen, setIsEditTeamModalOpen] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewTeamModalOpen, setIsViewTeamModalOpen] = useState(false);

  // Issue Modal
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setError("Missing project id");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const [issuesData, projectData, membersData] = await Promise.all([
        listProjectIssuesApi(projectId),
        getProjectApi(projectId),
        listProjectMembersApi(projectId)
      ]);

      setIssues(issuesData);
      setMembers(membersData);
      setProject(projectData);
      setLabel(`project:${projectId}`, projectData.name);

    } catch {
      setError("Unable to load project data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, setLabel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredIssues = useMemo(() => {
    return issues
      .filter(issue => {
        const matchesSearch = issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          issue.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || issue.status.toLowerCase() === statusFilter.toLowerCase();
        const matchesPriority = priorityFilter === "all" || issue.priority.toLowerCase() === priorityFilter.toLowerCase();
        const matchesType = typeFilter === "all" || issue.type.toLowerCase() === typeFilter.toLowerCase();
        return matchesSearch && matchesStatus && matchesPriority && matchesType;
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [issues, searchQuery, statusFilter, priorityFilter, typeFilter, sortOrder]);

  if (!isLoading && !project && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-400">
        Project not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-6">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-8">

        {/* Header & Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
            <div className="w-full md:w-80">
              <SearchBar
                placeholder="Search issues..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar w-full md:w-auto">
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "All Status" },
                  ...STATUSES,
                ]}
                icon={<HiOutlineCollection size={16} />}
              />
              <Select
                value={priorityFilter}
                onChange={priorityFilter => setPriorityFilter(priorityFilter)}
                options={[
                  { value: "all", label: "All Priority" },
                  ...PRIORITIES,
                ]}
                icon={<HiOutlineFlag size={16} />}
              />
              <Select
                value={typeFilter}
                onChange={typeFilter => setTypeFilter(typeFilter)}
                options={[
                  { value: "all", label: "All Type" },
                  ...CATEGORIES,
                ]}
                icon={<BiCategoryAlt size={16} />}
              />
              <Select
                value={sortOrder}
                onChange={(val) => setSortOrder(val as 'desc' | 'asc')}
                options={[
                  { value: "desc", label: "Newest First" },
                  { value: "asc", label: "Oldest First" }
                ]}
                icon={sortOrder === 'desc' ? <HiOutlineSortDescending size={16} /> : <HiOutlineSortAscending size={16} />}
              />
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            icon={<FiPlus size={18} />}
            fullWidth={false}
            className="shadow-lg shadow-blue-600/20 whitespace-nowrap"
            onClick={() => setIsIssueModalOpen(true)}
          >
            Report New Issue
          </Button>
        </div>

        {/* Main Content Grid */}
        {/* Main Content Grid */}
        <SidebarLayout
          sidebar={
            project ? (
              <ProjectSidebar
                project={project}
                members={members.map(m => ({ username: m.username, profileImg: m.profileImg }))}
                isAdmin={currentUser?.isAdmin}
                onSettingsClick={() => setIsEditModalOpen(true)}
                onEditTeamClick={() => setIsEditTeamModalOpen(true)}
                onDeleteProjectClick={() => setIsDeleteModalOpen(true)}
                onViewTeamClick={() => setIsViewTeamModalOpen(true)}
              />
            ) : (
              <div className="h-80 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
            )
          }
        >

          {/* Left Column: Issues List */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white tracking-tight">Manage Issues</h2>
              <span className="text-xs font-medium text-neutral-500 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                {filteredIssues.length} {filteredIssues.length === 1 ? "Issue" : "Issues"}
              </span>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-4 max-h-[calc(100vh-270px)] overflow-y-auto pr-2 custom-scrollbar">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
                ))
              ) : filteredIssues.length > 0 ? (
                filteredIssues.map(issue => (
                  <IssueCard
                    key={issue.issueId}
                    issue={issue}
                    onClick={() => navigate(`/projects/${projectId}/issues/${issue.issueId}`)}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                    <HiOutlineCollection className="text-neutral-600" size={32} />
                  </div>
                  <h3 className="text-white font-medium mb-1">No issues found</h3>
                  <p className="text-sm text-neutral-500 max-w-xs">
                    Try adjusting your search or filters to find what you're looking for.
                  </p>
                </div>
              )}
            </div>
          </div>

        </SidebarLayout>

        {isEditModalOpen && project && (
          <EditProjectFlow
            onClose={() => setIsEditModalOpen(false)}
            project={project}
            onUpdated={() => {
              setIsEditModalOpen(false);
              fetchData();
            }}
          />
        )}

        {isEditTeamModalOpen && project && (
          <EditTeamFlow
            onClose={() => setIsEditTeamModalOpen(false)}
            project={project}
            onUpdated={() => {
              setIsEditTeamModalOpen(false);
              fetchData();
            }}
          />
        )}

        {project && (
          <DeleteProjectFlow
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            projectId={project.projectId}
            projectName={project.name}
          />
        )}

        {isViewTeamModalOpen && project && (
          <EditTeamFlow
            onClose={() => setIsViewTeamModalOpen(false)}
            project={project}
            readOnly
          />
        )}

      </div>

      {isIssueModalOpen && (
        <IssueModal
          isOpen={isIssueModalOpen}
          onClose={() => setIsIssueModalOpen(false)}
          projectId={projectId}
          mode="create"
          onSuccess={() => {
            setIsIssueModalOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
