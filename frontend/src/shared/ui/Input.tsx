import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { HiEye, HiEyeOff } from "react-icons/hi";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ hasError, className = "", type, ...props }, ref) => {

        const [showPassword, setShowPassword] = useState(false);

        const isPassword = type === "password";
        const actualType = isPassword && showPassword ? "text" : type;

        return (
            <div className="relative w-full">
                <input
                    ref={ref}
                    type={actualType}
                    className={`flex h-11 w-full rounded-lg border px-4 text-[14px] text-white placeholder:text-neutral-500 bg-[#1A1D24]/50 outline-none transition-all duration-200
                        ${hasError
                            ? "border-rose-500/50 bg-rose-500/5 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
                            : "border-white/10 hover:border-white/20 focus:border-[#5671F6] focus:bg-[#1A1D24] focus:ring-1 focus:ring-[#5671F6]/30"
                        } 
                        ${isPassword ? "pr-12" : ""} 
                        disabled:cursor-not-allowed disabled:opacity-50
                        ${className}`}
                    {...props}
                />

                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors focus:outline-none"
                    >
                        {showPassword ? <HiEyeOff size={20} /> : <HiEye size={20} />}
                    </button>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";
