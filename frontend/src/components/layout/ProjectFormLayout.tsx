import type { ReactNode } from "react";
import { GlassCard } from "../ui/GlassCard";

interface ProjectFormLayoutProps {
    title: string;
    subtitle: string;
    stepInfo?: string; // Es: "STEP 1 OF 2"
    children: ReactNode; // Il contenuto centrale del form
    footer?: ReactNode; // I bottoni in basso (Next, Exit, ecc.)
}

export function ProjectFormLayout({
    title,
    subtitle,
    stepInfo,
    children,
    footer,
}: ProjectFormLayoutProps) {

    const currentStep = stepInfo ? stepInfo.split(" ")[1] : "";

    return (
        <GlassCard className="w-full max-w-2xl mx-auto flex flex-col px-8 pt-5 pb-0 gap-2 shadow-2xl">
            {/* Header: Titolo, Sottotitolo e Indicatore Step */}
            <div>
                <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
                <p className="text-sm text-neutral-400">{subtitle}</p>
            </div>
            {stepInfo && (
                <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold tracking-widest text-[#5671F6] uppercase">
                        {stepInfo}
                    </span>
                    {/* Piccola barretta decorativa sotto lo step */}
                    <div className="flex gap-1">
                        <div className={`h-1 rounded-full w-4 ${currentStep === "1" ? "bg-[#5671F6]" : "bg-white/10"}`} />
                        <div className={`h-1 rounded-full w-4 ${currentStep === "2" ? "bg-[#5671F6]" : "bg-white/10"}`} />
                    </div>
                </div>
            )}

            {/* Content: Il corpo vero e proprio del form (campi di testo, icone, colori) */}
            <div className="flex flex-col gap-4">
                {children}
            </div>

            {/* Footer: I bottoni di navigazione in basso (Next, Exit, Confirm) */}
            {footer && (
                <div className="mt-1">
                    {footer}
                </div>
            )}
        </GlassCard>
    );
}
