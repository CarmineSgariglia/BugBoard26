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


/**
 Example of usage:


try {
  await resetPasswordApi(...);
} catch (err) {
  // "Impossibile resettare la password" è il tuo FALLBACK
  const messaggio = getErrorMessage(err, "Impossibile resettare la password");
  
  showToast(messaggio);
}

Fallback is used when the error response does not contain a user-friendly error message.
Axios is used to check if the error is inserted in the error object.

If something unexpected happens and the function does not find the specific message,
it returns the fallback you set with the `fallback` parameter.
If detail is not empty, it returns the detail from the error object (backend response).
 */