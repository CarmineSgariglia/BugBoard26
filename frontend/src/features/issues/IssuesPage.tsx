function pathValue(index: number) {
  const segments = window.location.pathname.split("/").filter(Boolean);
  return segments[index] ?? "-";
}

export function IssuesPage() {
  const projectId = pathValue(1);
  const issueId = window.location.pathname.startsWith("/issues/") ? pathValue(1) : "-";

  return (
    <main className="min-h-screen bg-slate-900 p-8 text-slate-100">
      <h1 className="font-['Sora','Avenir_Next',sans-serif] text-3xl font-bold">Issue Management</h1>
      <p className="mt-3 text-slate-300">Project ID: {projectId}</p>
      <p className="text-slate-300">Issue ID: {issueId}</p>
      <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200">
        Pagina base pronta per integrare: lista issue, filtri, assegnazioni, aggiornamenti e notifiche.
      </div>
    </main>
  );
}
