import { useState, type FormEvent } from "react";

import { FormField } from "./FormField";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <form className="grid gap-[12px]" onSubmit={handleSubmit}>
      <FormField
        label="Email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <FormField
        label="Password"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <button
        className="mt-[8px] h-[49px] w-full cursor-pointer rounded-[8px] border border-[#7db7ea] bg-[linear-gradient(180deg,#f5f7f9_0%,#f0f2f5_100%)] font-['Manrope','Trebuchet_MS',sans-serif] text-[17px] font-semibold text-[#212121] transition duration-200 hover:-translate-y-px hover:brightness-[1.01] hover:shadow-[0_6px_16px_rgba(95,156,205,0.25)] active:translate-y-0"
        type="submit"
      >
        Login
      </button>

      <a
        className="mt-[4px] inline-block text-[17px] text-[rgba(197,198,200,0.82)] underline underline-offset-[3px] transition-colors hover:text-[rgba(226,227,228,0.95)]"
        href="#"
      >
        Forgot password?
      </a>
    </form>
  );
}
