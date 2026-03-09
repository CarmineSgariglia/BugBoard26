/**
 * Calculates whether a hex color is "light" or "dark" and returns the contrast color (white or black)
 * with an optional opacity.
 */
export function getContrastColor(hexColor: string, opacity: number = 1): string {
    // Remove # if present
    const hex = hexColor.replace("#", "");

    // Convert hex to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculate relative luminance (WCAG formula)
    // https://www.w3.org/TR/WCAG20/#relativeluminancedef
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5
        ? `rgba(0, 0, 0, ${opacity})`   // Light background -> Black text
        : `rgba(255, 255, 255, ${opacity})`; // Dark background -> White text
}


