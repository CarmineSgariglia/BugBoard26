import { useEffect } from "react";

/**
 * Hook per bloccare lo scroll del body quando un modal o un overlay è aperto.
 * @param isLocked Se true, blocca lo scroll. Se false, lo ripristina.
 */
export function useLockBodyScroll(isLocked: boolean) {
    useEffect(() => {
        if (isLocked) {
            // Salva l'overflow originale per ripristinarlo correttamente
            const originalStyle = window.getComputedStyle(document.body).overflow;
            document.body.style.overflow = "hidden";

            return () => {
                document.body.style.overflow = originalStyle;
            };
        }
    }, [isLocked]);
}
