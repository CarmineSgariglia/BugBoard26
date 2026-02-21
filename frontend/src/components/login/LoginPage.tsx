import { LoginCard } from "./LoginCard";

export function LoginPage() {
  return (
    <main
      className="relative grid min-h-screen place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_44%,rgba(83,84,89,0.75)_0%,rgba(34,36,41,0.8)_32%,rgba(9,11,13,0.94)_68%,#000_95%),repeating-linear-gradient(90deg,rgba(255,255,255,0.02)_0,rgba(255,255,255,0.02)_2px,rgba(0,0,0,0)_2px,rgba(0,0,0,0)_16px)] text-[#f5f5f5] before:pointer-events-none before:absolute before:inset-0 before:content-[''] before:bg-[radial-gradient(rgba(255,255,255,0.12)_0.8px,transparent_1px)] before:bg-[length:4px_4px] before:opacity-[0.09]"
    >
      <div className="relative z-10 w-full max-w-[420px] px-6 py-6 text-center">
        <h1 className="mb-[18px] font-['Sora','Avenir_Next',sans-serif] text-[52px] font-extrabold leading-none tracking-[0.01em] text-[#f5f5f5] [text-shadow:0_1px_0_rgba(255,255,255,0.18)] max-[520px]:text-[44px]">
          BugBoard26
        </h1>
        <LoginCard />
      </div>
    </main>
  );
}
