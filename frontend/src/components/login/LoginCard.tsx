import { BugIcon } from "./BugIcon";
import { LoginForm } from "./LoginForm";

export function LoginCard() {
  return (
    <section className="rounded-[20px] border border-white/[0.05] bg-[linear-gradient(185deg,rgba(78,80,85,0.9),rgba(70,72,76,0.85))] px-[12px] pb-[18px] pt-[18px] shadow-[0_20px_36px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <BugIcon />
      <LoginForm />
    </section>
  );
}
