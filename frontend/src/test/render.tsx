import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { ToastProvider } from "@shared/providers";

type Options = {
  route?: string;
  queryClient?: QueryClient;
} & Omit<RenderOptions, "wrapper">;

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { route = "/", queryClient: providedQueryClient, ...renderOptions } = options;

  const queryClient =
    providedQueryClient ??
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
          gcTime: Infinity,
        },
        mutations: {
          retry: false,
        },
      },
    });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}
