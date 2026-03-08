import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import brandLogo from "../../assets/LogoBugBoard26.webp";
import { getIssueApi } from "../../services/api";
import { useBreadcrumbs } from "../../contexts/useBreadcrumbs";

export function DynamicBreadcrumbs() {
    const location = useLocation();
    const { projectId, issueId } = useParams();
    const { labels } = useBreadcrumbs();
    const [fetchedIssueTitle, setFetchedIssueTitle] = useState<string>("");

    const projectName = useMemo(
        () => (projectId ? labels[`project:${projectId}`] || `Project #${projectId}` : ""),
        [labels, projectId]
    );
    const issueTitle = useMemo(
        () => (issueId ? labels[`issue:${issueId}`] || fetchedIssueTitle : ""),
        [fetchedIssueTitle, issueId, labels]
    );

    useEffect(() => {
        let isCancelled = false;

        const fetchIssueName = async () => {
            if (issueId && !labels[`issue:${issueId}`]) {
                try {
                    const issue = await getIssueApi(issueId);
                    if (!isCancelled) {
                        setFetchedIssueTitle(issue?.title || `Issue #${issueId}`);
                    }
                } catch (error) {
                    console.error("Failed to fetch issue for breadcrumbs", error);
                    if (!isCancelled) {
                        setFetchedIssueTitle(`Issue #${issueId}`);
                    }
                }
            }
        };

        if (issueId) {
            void fetchIssueName();
        }

        return () => {
            isCancelled = true;
        };
    }, [location.pathname, projectId, issueId, labels]);

    const isSettings = location.pathname.startsWith("/settings");
    const isProjects = location.pathname === "/projects";

    return (
        <div className="flex items-center gap-3">
            {/* Logo + Root link */}
            <Link to="/projects" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <img src={brandLogo} alt="Logo_BugBoard26" className="w-8 h-7" />
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
