/**
 * Calcola se un colore hex è "chiaro" o "scuro" e restituisce il colore di contrasto (bianco o nero)
 * con un'opacità opzionale.
 */
export function getContrastColor(hexColor: string, opacity: number = 1): string {
    // Rimuovi # se presente
    const hex = hexColor.replace("#", "");

    // Converti hex in RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calcola la luminanza relativa (formula WCAG)
    // https://www.w3.org/TR/WCAG20/#relativeluminancedef
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5
        ? `rgba(0, 0, 0, ${opacity})`   // Sfondo chiaro -> Testo nero
        : `rgba(255, 255, 255, ${opacity})`; // Sfondo scuro -> Testo bianco
}
