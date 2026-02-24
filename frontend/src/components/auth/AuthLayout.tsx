import type { ReactNode } from "react";

interface AuthLayoutProps {
    children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
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
                {children}
            </main>
        </div>
    );
}
