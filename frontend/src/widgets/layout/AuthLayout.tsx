{/* 
    Main layout for unauthenticated users.
*/}

import { Outlet, useLocation } from "react-router-dom";
import { GlassCard } from "@shared/ui/GlassCard";
import logoUrl from "@shared/assets/images/LogoBugBoard26.webp";
import { Link } from "react-router-dom";



export function AuthLayout() {
    const location = useLocation();

    // Determine the title based on the route
    let pageTitle = "BugBoard26";
    let subtitle = "";

    if (location.pathname.includes("/forgot-password/verify")) {
        pageTitle = "Retrieve Password";
        subtitle = "Insert OTP code and your new password";
    } else if (location.pathname.includes("/forgot-password")) {
        pageTitle = "Retrieve Password";
        subtitle = "Insert your email to recover your password";
    }

    const isLoginPage = location.pathname === "/login";
    const footerTo = isLoginPage ? "/forgot-password" : "/login";
    const footerLabel = isLoginPage ? "Forgot password?" : "Back to login";


    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0D0D12]">
            {/* Radial Gradient Background */}
            <div
                className="pointer-events-none absolute inset-0 z-0"
                style={{
                    background: "radial-gradient(circle at center, #1b1e2a 0%, #0d0d12 60%)"
                }}
            />

            {/* Dotted Pattern Background */}
            <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:18px_18px]" />

            {/* Grain Overlay */}
            <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.04] mix-blend-overlay">
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
                    <filter id="n">
                        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#n)" />
                </svg>
            </div>

            {/* Content Wrapper */}
            <main className="relative z-10 w-full max-w-[420px] px-4 flex flex-col items-center">

                <h1 className="mb-6 text-center text-3xl font-bold tracking-tight text-white shadow-black drop-shadow-md">
                    {pageTitle}
                </h1>

                <GlassCard className="p-8">

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

                    <Outlet /> {/* Here we render the LoginPage, RecoverPasswordRequestPage, or RecoverPasswordVerifyPage */}

                    <div className="mt-5 text-center">
                        <Link
                            to={footerTo}
                            className="text-[13px] text-[#8B949E] underline underline-offset-4 transition-colors hover:text-[#C9D1D9]"
                        >
                            {footerLabel}
                        </Link>
                    </div>

                </GlassCard>
            </main>
        </div>
    );
}

