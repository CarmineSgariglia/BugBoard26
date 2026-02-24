import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#10334d_0%,#05111e_45%,#03070d_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-10">
        <section className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-cyan-300">BugBoard26</p>
          <h1 className="font-['Sora','Avenir_Next',sans-serif] text-4xl font-bold leading-tight">{title}</h1>
          <p className="mt-2 text-sm text-slate-200">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <div className="mt-6 text-sm text-slate-300">
            <a className="underline decoration-cyan-300 underline-offset-4" href="/login">
              Torna al login
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
