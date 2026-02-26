import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { TopNav } from "../../components/navigation/TopNav";
import { listProjectIssuesApi, type Issue } from "../../services/api";

export function ProjectIssuesScreen() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!projectId) {
        setError("Missing project id");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError("");
      try {
        const data = await listProjectIssuesApi(projectId);
        setIssues(data);
      } catch {
        setError("Unable to load project issues");
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [projectId]);

  const sortedIssues = useMemo(
    () => [...issues].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [issues],
  );

  return (
    <div className="min-h-screen bg-[#0D0D12] text-white flex flex-col relative overflow-hidden">
      <TopNav />
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 pt-24 pb-8 relative z-10 flex flex-col">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Project Issues</h1>
            <p className="text-[#9CA3AF]">Project #{projectId}</p>
          </div>
          <button
            className="rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
            type="button"
            onClick={() => navigate("/projects")}
          >
            Back to Projects
          </button>
        </div>

        {isLoading ? <p className="text-sm text-[#9CA3AF]">Loading issues...</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="grid grid-cols-1 gap-4">
          {sortedIssues.map((issue) => (
            <article key={issue.issueId} className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{issue.title}</h2>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{issue.status}</span>
              </div>
              <p className="mt-2 text-sm text-[#CBD5E1]">{issue.description}</p>
              <div className="mt-3 flex gap-2 text-xs text-[#94A3B8]">
                <span className="rounded bg-white/10 px-2 py-1">{issue.type}</span>
                <span className="rounded bg-white/10 px-2 py-1">{issue.priority}</span>
              </div>
            </article>
          ))}
          {!isLoading && !error && sortedIssues.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">No issues found for this project.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
