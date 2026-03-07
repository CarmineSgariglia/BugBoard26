import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import brandLogo from "../../assets/LogoBugBoard26.webp";
import { listProjectsApi, getIssueApi } from "../../services/api";
import { useBreadcrumbs } from "../../contexts/BreadcrumbContext";

export function DynamicBreadcrumbs() {
    const location = useLocation();
    const { projectId, issueId } = useParams();
    const { labels } = useBreadcrumbs();
    const [projectName, setProjectName] = useState<string>("");
    const [issueTitle, setIssueTitle] = useState<string>("");

    useEffect(() => {
        // Use context label if available
        if (projectId && labels[`project:${projectId}`]) {
            setProjectName(labels[`project:${projectId}`]);
        }
        if (issueId && labels[`issue:${issueId}`]) {
            setIssueTitle(labels[`issue:${issueId}`]);
        }

        const fetchProjectName = async () => {
            if (projectId && !labels[`project:${projectId}`]) {
                try {
                    const projects = await listProjectsApi();
                    const currentProject = projects.find(p => String(p.projectId) === projectId);
                    if (currentProject) {
                        setProjectName(currentProject.name);
                    } else {
                        setProjectName(`Project #${projectId}`);
                    }
                } catch (error) {
                    console.error("Failed to fetch project for breadcrumbs", error);
                    setProjectName(`Project #${projectId}`);
                }
            }
        };

        const fetchIssueName = async () => {
            if (issueId && !labels[`issue:${issueId}`]) {
                try {
                    // fall back to getIssueApi
                    const issue = await getIssueApi(issueId);
                    if (issue) {
                        setIssueTitle(issue.title);
                    } else {
                        setIssueTitle(`Issue #${issueId}`);
                    }
                } catch (error) {
                    console.error("Failed to fetch issue for breadcrumbs", error);
                    setIssueTitle(`Issue #${issueId}`);
                }
            }
        }

        if (location.pathname.includes("/projects/") && projectId) {
            fetchProjectName();
        }

        if (issueId) {
            fetchIssueName();
        }
    }, [location.pathname, projectId, issueId, labels]);

    const isSettings = location.pathname.startsWith("/settings");
    const isProjects = location.pathname === "/projects";

    return (
        <div className="flex items-center gap-3">
            {/* Logo + Root link */}
            <Link to="/projects" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <img src={brandLogo} alt="Logo_BugBoard26" className="w-8 h-6" />
            </Link>

            {/* Separator / Breadcrumb chain */}
            <div className="flex items-center text-xl font-medium tracking-wide">
                <Link
                    to="/projects"
                    className={`transition-colors ${isProjects ? "text-white cursor-default" : "text-neutral-500 hover:text-white"}`}
                >
                    Projects
                </Link>

                {projectId && (
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
                            <span className="text-white">
                                {projectName || "..."}
                            </span>
                        )}
                    </>
                )}

                {issueId && (
                    <>
                        <span className="mx-2 text-neutral-600">/</span>
                        <span className="text-white">
                            {issueTitle || "..."}
                        </span>
                    </>
                )}

                {isSettings && (
                    <>
                        <span className="mx-2 text-neutral-600">/</span>
                        <span className="text-white">Settings</span>
                    </>
                )}
            </div>
        </div>
    );
}
