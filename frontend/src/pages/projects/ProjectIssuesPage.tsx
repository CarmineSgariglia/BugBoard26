import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BiCategoryAlt } from "react-icons/bi";
import { FiPlus, FiUser } from "react-icons/fi";
import {
  HiOutlineCollection,
  HiOutlineFlag,
  HiOutlineSortAscending,
  HiOutlineSortDescending,
} from "react-icons/hi";
import { useNavigate, useParams } from "react-router-dom";

import { EditProjectFlow } from "@features/project/flows/EditProjectFlow";
import { EditTeamFlow } from "@features/project/flows/EditTeamFlow";
import { IssueModal } from "@features/issue/ui/IssueModal";
import {
  getProjectApi,
  listProjectIssuesApi,
  listProjectMembersApi,
} from "@shared/api/modules/projects";
import type { Issue } from "@shared/api/types/issues";
import type { ProjectMembership } from "@shared/api/types/projects";
import { CATEGORIES, PRIORITIES, STATUSES } from "@features/issue/model/constants";
import { useAuth } from "@features/auth";
import { useBreadcrumbs } from "@shared/providers/BreadcrumbContext";
import { isAdminLike } from "@shared/lib";
import { useFluidWheelContainer } from "@shared/hooks";
import { Button } from "@shared/ui/Button";
import { SearchBar } from "@shared/ui/SearchBar";
import { Select } from "@shared/ui/Select";
import { IssueCard } from "@features/issue/ui/IssueCard";
import { SidebarLayout } from "@widgets/layout/SidebarLayout";
import { ProjectSidebar } from "@features/project/ui/ProjectSidebar";

export function ProjectIssuesPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { user: currentUser } = useAuth();
  const { setLabel } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const issueListRef = useFluidWheelContainer<HTMLDivElement>(true, {
    tailDurationMs: 980,
    tailIntensity: 0.34,
    tailMaxPx: 140,
    idleMs: 120,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("asc");
  const [assigneeFilter, setAssigneeFilter] = useState<"all" | "assigned-to-you">("all");


  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditTeamModalOpen, setIsEditTeamModalOpen] = useState(false);
  const [isViewTeamModalOpen, setIsViewTeamModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);

  const {
    data: issues = [],
    isLoading: isIssuesLoading,
    isFetching: isIssuesFetching,
    error: issuesError,
  } = useQuery({
    queryKey: ["project", projectId, "issues"],
    queryFn: () => listProjectIssuesApi(projectId!),
    enabled: !!projectId,
    staleTime: 0,
  });

  const {
    data: members = [],
    isLoading: isMembersLoading,
    isFetching: isMembersFetching,
    error: membersError,
  } = useQuery({
    queryKey: ["project", projectId, "members"],
    queryFn: () => listProjectMembersApi(projectId!),
    enabled: !!projectId,
    staleTime: 0,
  });

  const {
    data: project = null,
    isLoading: isProjectLoading,
    isFetching: isProjectFetching,
    error: projectError,
  } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProjectApi(projectId!),
    enabled: !!projectId,
    staleTime: 0,
  });

  useEffect(() => {
    if (projectId && project) {
      setLabel(`project:${projectId}`, project.name);
    }
  }, [projectId, project, setLabel]);

  const refreshProjectData = useCallback(() => {
    if (!projectId) return;
    void queryClient.invalidateQueries({ queryKey: ["project", projectId, "issues"] });
    void queryClient.invalidateQueries({ queryKey: ["project", projectId, "members"] });
    void queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [projectId, queryClient]);

  const filteredIssues = useMemo(() => {
    return issues
      .filter((issue) => {
        const matchesSearch =
          issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          issue.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === "all" || issue.status.toLowerCase() === statusFilter.toLowerCase();
        const matchesPriority =
          priorityFilter === "all" || issue.priority.toLowerCase() === priorityFilter.toLowerCase();
        const matchesType =
          typeFilter === "all" || issue.type.toLowerCase() === typeFilter.toLowerCase();
        const matchesAssignee =
          assigneeFilter === "all" ||
          issue.assignees.some((assignee) => assignee.userId === currentUser?.userId);

        return matchesSearch && matchesStatus && matchesPriority && matchesType && matchesAssignee;
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
      });
  }, [issues, searchQuery, statusFilter, priorityFilter, typeFilter, sortOrder, assigneeFilter, currentUser?.userId]);

  const nonAdminMembers = useMemo(() => members.filter((m) => !isAdminLike({ role: m.role })), [members]);

  const isLoading = isIssuesLoading || isMembersLoading || isProjectLoading;
  const isRefreshing = (isIssuesFetching || isMembersFetching || isProjectFetching) && !isLoading;
  const error =
    !projectId
      ? "Missing project id"
      : issuesError || membersError || projectError
        ? "Unable to load project data. Please try again."
        : "";

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
            <div className="w-full md:w-80">
              <SearchBar placeholder="Search issues..." value={searchQuery} onChange={setSearchQuery} />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar w-full md:w-auto">
              {!currentUser?.isAdmin && <Select
                value={assigneeFilter}
                onChange={(v) => setAssigneeFilter(v as "all" | "assigned-to-you")}
                options={[
                  { value: "all", label: "All" },
                  { value: "assigned-to-you", label: "Assigned to you" },
                ]}
                icon={<FiUser size={16} />}
              />}
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[{ value: "all", label: "All Status" }, ...STATUSES]}
                icon={<HiOutlineCollection size={16} />}
              />
              <Select
                value={priorityFilter}
                onChange={(v) => setPriorityFilter(v)}
                options={[{ value: "all", label: "All Priority" }, ...PRIORITIES]}
                icon={<HiOutlineFlag size={16} />}
              />
              <Select
                value={typeFilter}
                onChange={(v) => setTypeFilter(v)}
                options={[{ value: "all", label: "All Type" }, ...CATEGORIES]}
                icon={<BiCategoryAlt size={16} />}
              />
              <Select
                value={sortOrder}
                onChange={(val) => setSortOrder(val as "desc" | "asc")}
                options={[
                  { value: "asc", label: "Oldest First" },
                  { value: "desc", label: "Newest First" },
                ]}
                icon={
                  sortOrder === "desc" ? (
                    <HiOutlineSortDescending size={16} />
                  ) : (
                    <HiOutlineSortAscending size={16} />
                  )
                }
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

        <SidebarLayout
          sidebar={
            project ? (
              <ProjectSidebar
                project={project}
                members={nonAdminMembers.map((m: ProjectMembership) => ({
                  username: m.username,
                  profileImg: m.profileImg,
                }))}
                isAdmin={currentUser?.isAdmin}
                onSettingsClick={() => setIsEditModalOpen(true)}
                onEditTeamClick={() => setIsEditTeamModalOpen(true)}
                onViewTeamClick={() => setIsViewTeamModalOpen(true)}
              />
            ) : (
              <div className="h-80 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
            )
          }
        >
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white tracking-tight">{project ? `${project.name} - Manage Issues` : "Manage Issues"}</h2>
              <span className="text-xs font-medium text-neutral-500 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                {filteredIssues.length} {filteredIssues.length === 1 ? "Issue" : "Issues"}
              </span>
            </div>

            {isRefreshing ? <div className="text-xs text-neutral-500">Refreshing...</div> : null}

            {error ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm">
                {error}
              </div>
            ) : null}

            <div ref={issueListRef} className="flex flex-col gap-4 max-h-[calc(100vh-270px)] overflow-y-auto pr-2 custom-scrollbar">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
                ))
              ) : filteredIssues.length > 0 ? (
                filteredIssues.map((issue: Issue) => (
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
              refreshProjectData();
            }}
          />
        )}

        {isEditTeamModalOpen && project && (
          <EditTeamFlow
            onClose={() => setIsEditTeamModalOpen(false)}
            project={project}
            onUpdated={() => {
              setIsEditTeamModalOpen(false);
              refreshProjectData();
            }}
          />
        )}

        {isViewTeamModalOpen && project ? (
          <EditTeamFlow onClose={() => setIsViewTeamModalOpen(false)} project={project} readOnly />
        ) : null}
      </div>

      {isIssueModalOpen ? (
        <IssueModal
          isOpen={isIssueModalOpen}
          onClose={() => setIsIssueModalOpen(false)}
          projectId={projectId}
          mode="create"
          onSuccess={() => {
            setIsIssueModalOpen(false);
            refreshProjectData();
          }}
        />
      ) : null}
    </div>
  );
}












