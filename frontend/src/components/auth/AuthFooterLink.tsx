import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

interface AuthFooterLinkProps extends Omit<LinkProps, 'to'> {
    children: ReactNode;
    to: string;
}

export function AuthFooterLink({ children, to, className = "", ...props }: AuthFooterLinkProps) {
    return (
        <div className="mt-5 text-center">
            <Link
                to={to}
                className={`text-[13px] text-[#8B949E] underline underline-offset-4 transition-colors hover:text-[#C9D1D9] ${className}`}
                {...props}
            >
                {children}
            </Link>
        </div>
    );
}
