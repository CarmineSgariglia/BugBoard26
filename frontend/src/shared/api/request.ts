export type RequestOptions = {
  signal?: AbortSignal;
};

export function isRequestAbortError(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ERR_CANCELED"
  ) {
    return true;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof (error as { name?: unknown }).name === "string"
  ) {
    const name = (error as { name: string }).name;
    return name === "AbortError" || name === "CanceledError";
  }

  return false;
}
