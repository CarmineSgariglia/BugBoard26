/*
  Main layout for unauthenticated routes.
*/

import { Link, Outlet, useLocation } from "react-router-dom";

import logoUrl from "@shared/assets/images/LogoBugBoard26.webp";
import { GlassCard } from "@shared/ui/GlassCard";

export function AuthLayout() {
    const location = useLocation();

    let pageTitle = "BugBoard26";
    let subtitle = "";

    if (location.pathname.includes("/forgot-password/verify")) {
        pageTitle = "Reset Password";
        subtitle = "Enter the OTP code and your new password.";
    } else if (location.pathname.includes("/forgot-password")) {
        pageTitle = "Reset Password";
        subtitle = "Enter your email to reset your password.";
    }

    const isLoginPage = location.pathname === "/login";
    const footerTo = isLoginPage ? "/forgot-password" : "/login";
    const footerLabel = isLoginPage ? "Forgot password?" : "Back to login";

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#11131A] lg:min-h-dvh">
            <div
                className="pointer-events-none absolute inset-0 z-0"
                style={{
                    background: "radial-gradient(circle at center, #252A3B 0%, #11131A 62%)",
                }}
            />

            <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:18px_18px]" />

            <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.04] mix-blend-overlay">
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
                    <filter id="authNoiseFilter">
                        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#authNoiseFilter)" />
                </svg>
            </div>

            <main className="relative z-10 flex w-full flex-col items-center px-4">
                <h1 className="mb-6 text-center text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    {pageTitle}
                </h1>

                <GlassCard className="max-w-[440px] rounded-[28px] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:p-8">
                    <div className="flex flex-col items-center">
                        <Link to="/login" className="mb-5 inline-flex">
                            <img
                                src={logoUrl}
                                alt="BugBoard26"
                                className="h-16 w-auto object-contain"
                                style={{ filter: "brightness(0) invert(1)" }}
                            />
                        </Link>

                        {subtitle ? (
                            <p className="mb-5 text-center text-[13px] leading-6 text-[#8B949E]">
                                {subtitle}
                            </p>
                        ) : null}

                        <div className="w-full">
                            <Outlet />
                        </div>

                        <div className="mt-5 text-center">
                            <Link
                                to={footerTo}
                                className="text-[13px] text-[#8B949E] underline underline-offset-4 transition-colors hover:text-[#C9D1D9]"
                            >
                                {footerLabel}
                            </Link>
                        </div>
                    </div>
                </GlassCard>
            </main>
        </div>
    );
}
