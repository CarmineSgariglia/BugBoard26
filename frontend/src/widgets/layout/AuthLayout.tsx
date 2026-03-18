/*
  Main layout for unauthenticated routes.
*/

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
            <div className="absolute inset-0 z-0 opacity-[0.04] bg-[radial-gradient(circle,_rgba(255,255,255,0.18)_1px,_transparent_1px)] [background-size:24px_24px]" />

            {/* Grain Overlay */}
            <div className="absolute inset-0 z-0 opacity-[0.02] mix-blend-overlay">
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
                    <filter id="noiseFilter">
                        <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" stitchTiles="stitch" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#noiseFilter)" />
                </svg>
            </div>

            {/* Content Wrapper */}
            <div className="relative z-10 flex w-full max-w-5xl items-center justify-center px-6 py-16">
                <GlassCard className="flex w-full max-w-4xl overflow-hidden rounded-[32px] border border-white/10 bg-[#121620]/80 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                    <div className="hidden w-1/2 flex-col justify-between border-r border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-10 lg:flex">
                        <div>
                            <img src={logoUrl} alt="BugBoard26" className="mb-10 h-10 w-auto object-contain" />
                            <p className="mb-3 text-sm uppercase tracking-[0.22em] text-sky-300/80">Workspace control</p>
                            <h1 className="max-w-sm text-4xl font-semibold leading-tight text-white">{pageTitle}</h1>
                            <p className="mt-4 max-w-sm text-sm leading-7 text-neutral-400">{subtitle || "Sign in to continue managing projects, issues, and your team workspace."}</p>
                        </div>

                        <div className="text-xs leading-6 text-neutral-500">
                            Built for focused project tracking, smooth collaboration, and issue management.
                        </div>
                    </div>

                    <div className="flex w-full flex-1 flex-col justify-between p-8 sm:p-10 lg:w-1/2">
                        <div className="mb-8 lg:hidden">
                            <img src={logoUrl} alt="BugBoard26" className="mb-6 h-10 w-auto object-contain" />
                            <h1 className="text-3xl font-semibold text-white">{pageTitle}</h1>
                            <p className="mt-3 text-sm leading-7 text-neutral-400">{subtitle || "Sign in to continue managing projects, issues, and your team workspace."}</p>
                        </div>

                        <div className="flex-1">
                            <Outlet />
                        </div>

                        <div className="mt-8 border-t border-white/10 pt-5 text-sm text-neutral-400">
                            <Link to={footerTo} className="transition hover:text-white">
                                {footerLabel}
                            </Link>
                        </div>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
