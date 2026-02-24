export function ProjectsPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <h1 className="font-['Sora','Avenir_Next',sans-serif] text-3xl font-bold">Progetti</h1>
        <button className="rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-900">Nuovo progetto</button>
      </header>

      <section className="mx-auto mt-8 grid w-full max-w-6xl gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-semibold">Progetto Demo</h2>
          <p className="mt-2 text-sm text-slate-300">Placeholder della dashboard progetti (Milestone C/D/E).</p>
          <a className="mt-4 inline-block text-cyan-300 underline" href="/projects/1/issues">
            Apri issue board
          </a>
        </article>
      </section>
    </main>
  );
}
