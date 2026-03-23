import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import brandLogo from "@shared/assets/images/LogoBugBoard26.webp";
import { getProjectApi } from "@features/project/api";
import { getIssueApi } from "@features/issue/api";
import { useBreadcrumbs } from "@shared/providers/useBreadcrumbs";

export function DynamicBreadcrumbs() {
  const location = useLocation();
  const { projectId, issueId } = useParams();
  const { labels } = useBreadcrumbs();

  const projectLabel = projectId ? labels[`project:${projectId}`] : "";
  const issueLabel = issueId ? labels[`issue:${issueId}`] : "";

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: ({ signal }) => getProjectApi(projectId!, { signal }),
    enabled: !!projectId && !projectLabel && location.pathname.includes("/projects/"),
    staleTime: 30_000,
  });

  const { data: issue } = useQuery({
    queryKey: ["issue", issueId],
    queryFn: ({ signal }) => getIssueApi(issueId!, { signal }),
    enabled: !!issueId && !issueLabel,
    staleTime: 30_000,
  });

  const projectName = projectLabel || project?.name || (projectId ? `Project #${projectId}` : "");
  const issueTitle = issueLabel || issue?.title || (issueId ? `Issue #${issueId}` : "");

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
