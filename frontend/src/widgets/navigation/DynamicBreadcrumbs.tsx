import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import brandLogo from "../../assets/LogoBugBoard26.webp";
import { listProjectsApi } from "../../shared/api/modules/projects";
import { getIssueApi } from "../../shared/api/modules/issues";
import { useBreadcrumbs } from "../../contexts/BreadcrumbContext";

export function DynamicBreadcrumbs() {
  const location = useLocation();
  const { projectId, issueId } = useParams();
  const { labels } = useBreadcrumbs();

  const projectLabel = projectId ? labels[`project:${projectId}`] : "";
  const issueLabel = issueId ? labels[`issue:${issueId}`] : "";

  const { data: fetchedProjectName } = useQuery({
    queryKey: ["breadcrumb", "project", projectId],
    queryFn: async () => {
      const projects = await listProjectsApi();
      const currentProject = projects.find((p) => String(p.projectId) === projectId);
      return currentProject ? currentProject.name : `Project #${projectId}`;
    },
    enabled: !!projectId && !projectLabel && location.pathname.includes("/projects/"),
    staleTime: 0,
  });

  const { data: fetchedIssueTitle } = useQuery({
    queryKey: ["breadcrumb", "issue", issueId],
    queryFn: async () => {
      const issue = await getIssueApi(issueId!);
      return issue ? issue.title : `Issue #${issueId}`;
    },
    enabled: !!issueId && !issueLabel,
    staleTime: 0,
  });

  const projectName = projectLabel || fetchedProjectName || "";
  const issueTitle = issueLabel || fetchedIssueTitle || "";

  const isSettings = location.pathname.startsWith("/settings");
  const isProjects = location.pathname === "/projects";

  return (
    <div className="flex items-center gap-3">
      <Link to="/projects" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <img src={brandLogo} alt="Logo_BugBoard26" className="w-8 h-6" />
      </Link>

      <div className="flex items-center text-xl font-medium tracking-wide">
        <Link
          to="/projects"
          className={`transition-colors ${
            isProjects ? "text-white cursor-default" : "text-neutral-500 hover:text-white"
          }`}
        >
          Projects
        </Link>

        {projectId ? (
          <>
            <span className="mx-2 text-neutral-600">/</span>
            {issueId ? (
              <Link
                to={`/projects/${projectId}/issues`}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                {projectName || "..."}
              </Link>
            ) : (
              <span className="text-white">{projectName || "..."}</span>
            )}
          </>
        ) : null}

        {issueId ? (
          <>
            <span className="mx-2 text-neutral-600">/</span>
            <span className="text-white">{issueTitle || "..."}</span>
          </>
        ) : null}

        {isSettings ? (
          <>
            <span className="mx-2 text-neutral-600">/</span>
            <span className="text-white">Settings</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
