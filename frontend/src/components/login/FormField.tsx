import type { InputHTMLAttributes } from "react";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function FormField({ label, ...props }: FormFieldProps) {
  return (
    <input
      aria-label={label}
      className="h-[49px] w-full rounded-[8px] border border-white/[0.14] bg-[linear-gradient(180deg,#ced0d2_0%,#c6c8ca_100%)] px-[13px] font-['Manrope','Trebuchet_MS',sans-serif] text-[16px] font-medium text-[#2b2b2b] placeholder:text-[rgba(43,43,43,0.88)] transition-[box-shadow,border-color,transform] duration-200 focus-visible:border-[rgba(116,173,224,0.9)] focus-visible:shadow-[0_0_0_2px_rgba(116,173,224,0.3)] focus-visible:outline-none"
      {...props}
    />
  );
}
