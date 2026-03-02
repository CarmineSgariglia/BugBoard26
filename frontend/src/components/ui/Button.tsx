/*
    Button component
    
    Varianti:
    - primary: Bottone primario
    - glass: Bottone con effetto vetro smerigliato
    - destructive: Bottone distruttivo
    - ghost: Bottone fantasma
    
    Dimensioni:
    - sm: Piccolo
    - md: Medio
    - lg: Grande
     
    Opzioni:
    - isLoading: Indica se il bottone è in stato di caricamento
    - active: Indica se il bottone è attivo
    - destructive: Indica se il bottone è distruttivo (elimina i dati)
    - fullWidth: Indica se il bottone deve occupare tutta la larghezza
*/

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";


type ButtonVariant = "primary" | "glass" | "destructive" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    active?: boolean;
    destructive?: boolean;
    fullWidth?: boolean;
    icon?: ReactNode;
}

export function Button({
    children,
    variant = "primary",
    size = "md",
    isLoading = false,
    active = false,
    destructive = false,
    fullWidth = true,
    icon,
    className = "",
    disabled,
    ...props
}: ButtonProps) {

    const baseStyles = "flex items-center justify-center gap-2 font-medium transition-all duration-200 outline-none disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-white text-black hover:bg-neutral-200 active:scale-[0.98]",
        glass: `${active
            ? "bg-white/10 text-white border border-white/10 shadow-sm"
            : "text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5"} ${destructive ? "!text-red-500 hover:bg-red-500/10" : ""}`,
        destructive: "text-red-500 hover:bg-red-500/10 active:bg-red-500/20",
        ghost: "text-neutral-400 hover:text-white hover:bg-white/5"
    };

    const sizes = {
        sm: "h-8 px-3 text-xs rounded-lg",
        md: "h-11 px-4 text-[14px] rounded-xl",
        lg: "h-12 px-6 text-[16px] rounded-2xl"
    };

    const widthStyle = fullWidth ? "w-full" : "w-auto";

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <div className="flex items-center gap-2">
                    <AiOutlineLoading3Quarters className="animate-spin h-4 w-4" />
                    <span>Caricamento...</span>
                </div>
            ) : (
                <>
                    {icon && <span className="flex-shrink-0">{icon}</span>}
                    {children}
                </>
            )}
        </button>
    );
}
