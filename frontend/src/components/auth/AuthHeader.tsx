import logoUrl from "../../assets/LogoBugBoard26.webp";
import { Link } from "react-router-dom";

interface AuthHeaderProps {
    subtitle?: string;
}

export function AuthHeader({ subtitle }: AuthHeaderProps) {
    return (
        <div className="flex flex-col items-center mb-6">
            <Link to="/login" className="mb-2">
                <img src={logoUrl} alt="BugBoard26 Logo" className="h-16 w-auto opacity-90 grayscale brightness-200 contrast-200" style={{ filter: "brightness(0) invert(1)" }} />
            </Link>
            {subtitle && (
                <p className="text-[13px] text-[#8B949E] text-center mb-2">
                    {subtitle}
                </p>
            )}
        </div>
    );
}

// We also export the very top Title that sits above the card
export function AuthPageTitle({ text }: { text: string }) {
    return (
        <h1 className="mb-6 text-center text-3xl font-bold tracking-tight text-white shadow-black drop-shadow-md">
            {text}
        </h1>
    );
}
