import type { RequestOptions } from "@shared/api/request";

export function withRequestOptions<T extends Record<string, unknown>>(
  config: T,
  options?: RequestOptions,
): T & { signal?: AbortSignal } {
  if (!options?.signal) {
    return config;
  }

  return {
    ...config,
    signal: options.signal,
  };
}
