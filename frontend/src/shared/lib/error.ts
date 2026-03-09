import axios from "axios";

/**
 * Extracts a user-friendly error message from an Axios error response.
 * Falls back to the provided default message if no detail is available.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
    if (!axios.isAxiosError(error)) return fallback;
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) return detail;
    return fallback;
}
