import axios from "axios";

function readMessage(value: unknown): string | null {
    if (typeof value === "string" && value.trim().length > 0) return value;

    if (Array.isArray(value)) {
        for (const item of value) {
            const nested = readMessage(item);
            if (nested) return nested;
        }
        return null;
    }

    if (value && typeof value === "object") {
        for (const nestedValue of Object.values(value as Record<string, unknown>)) {
            const nested = readMessage(nestedValue);
            if (nested) return nested;
        }
    }

    return null;
}

export function getFieldError(error: unknown, field: string): string | null {
    if (!axios.isAxiosError(error)) return null;

    const data = error.response?.data;
    if (!data || typeof data !== "object") return null;

    return readMessage((data as Record<string, unknown>)[field]);
}

/**
 * Extracts a user-friendly error message from an Axios error response.
 * Falls back to the provided default message if no detail is available.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
    if (!axios.isAxiosError(error)) return fallback;

    const data = error.response?.data;
    const keyPriority = [
        "detail",
        "non_field_errors",
        "newPassword",
        "currentPassword",
        "password",
        "email",
        "username",
    ] as const;

    if (data && typeof data === "object") {
        const record = data as Record<string, unknown>;

        for (const key of keyPriority) {
            const message = readMessage(record[key]);
            if (message) return message;
        }

        const firstFieldMessage = readMessage(record);
        if (firstFieldMessage) return firstFieldMessage;
    }

    return fallback;
}
