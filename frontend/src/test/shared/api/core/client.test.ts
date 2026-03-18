import { beforeEach, describe, expect, it, vi } from "vitest";

const axiosHarness = vi.hoisted(() => {
  const instances: any[] = [];

  function createInstance() {
    const requestHandlers: Array<(config: any) => any> = [];
    const responseHandlers: Array<{
      onFulfilled?: (value: any) => any;
      onRejected?: (error: any) => any;
    }> = [];

    const instance: any = vi.fn();
    instance.get = vi.fn();
    instance.post = vi.fn();
    instance.patch = vi.fn();
    instance.delete = vi.fn();
    instance.interceptors = {
      request: {
        use: vi.fn((handler: (config: any) => any) => {
          requestHandlers.push(handler);
          return requestHandlers.length - 1;
        }),
      },
      response: {
        use: vi.fn(
          (
            onFulfilled?: (value: any) => any,
            onRejected?: (error: any) => any
          ) => {
            responseHandlers.push({ onFulfilled, onRejected });
            return responseHandlers.length - 1;
          }
        ),
      },
    };
    instance.__requestHandlers = requestHandlers;
    instance.__responseHandlers = responseHandlers;

    instances.push(instance);
    return instance;
  }

  return { instances, createInstance };
});

vi.mock("axios", () => {
  const create = vi.fn(() => axiosHarness.createInstance());
  return {
    default: { create },
    create,
  };
});

async function importClientModule() {
  vi.resetModules();
  axiosHarness.instances.length = 0;
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  return import("@shared/api/core/client");
}

describe("apiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores and returns the access token", async () => {
    const clientModule = await importClientModule();

    clientModule.setAccessToken("token-123");

    expect(clientModule.getAccessToken()).toBe("token-123");
  });

  it("adds authorization, csrf and json content-type headers to mutating requests", async () => {
    const clientModule = await importClientModule();
    const apiClient = axiosHarness.instances[0];
    document.cookie = "csrftoken=csrf-ready; path=/";

    clientModule.setAccessToken("token-123");

    const config = await apiClient.__requestHandlers[0]({
      method: "post",
      headers: {},
      data: { title: "New title" },
      url: "/issues/7",
    });

    expect(config.headers.Authorization).toBe("Bearer token-123");
    expect(config.headers["X-CSRFToken"]).toBe("csrf-ready");
    expect(config.headers["Content-Type"]).toBe("application/json");
  });

  it("bootstraps the csrf cookie before mutating requests when the cookie is missing", async () => {
    await importClientModule();
    const apiClient = axiosHarness.instances[0];
    const refreshClient = axiosHarness.instances[1];

    refreshClient.get.mockImplementation(async () => {
      document.cookie = "csrftoken=csrf-from-bootstrap; path=/";
      return { data: {} };
    });

    const config = await apiClient.__requestHandlers[0]({
      method: "patch",
      headers: {},
      data: { title: "Updated" },
      url: "/issues/8",
    });

    expect(refreshClient.get).toHaveBeenCalledWith("/auth/csrf");
    expect(config.headers["X-CSRFToken"]).toBe("csrf-from-bootstrap");
  });

  it("does not add a json content-type for FormData payloads", async () => {
    await importClientModule();
    const apiClient = axiosHarness.instances[0];
    document.cookie = "csrftoken=csrf-ready; path=/";

    const formData = new FormData();
    formData.append("file", new File(["content"], "proof.txt"));

    const config = await apiClient.__requestHandlers[0]({
      method: "post",
      headers: {},
      data: formData,
      url: "/attachments",
    });

    expect(config.headers["Content-Type"]).toBeUndefined();
    expect(config.headers["X-CSRFToken"]).toBe("csrf-ready");
  });

  it("refreshes the access token and retries the original request after a 401", async () => {
    const clientModule = await importClientModule();
    const apiClient = axiosHarness.instances[0];
    const refreshClient = axiosHarness.instances[1];

    refreshClient.post.mockResolvedValue({ data: { accessToken: "refreshed-token" } });
    apiClient.mockResolvedValue({ data: { ok: true } });

    const responseInterceptor = apiClient.__responseHandlers[0].onRejected;
    const result = await responseInterceptor({
      config: { url: "/issues/9", headers: {} },
      response: { status: 401 },
    });

    expect(refreshClient.post).toHaveBeenCalledWith("/auth/refresh", {});
    expect(apiClient).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/issues/9", _retry: true })
    );
    expect(clientModule.getAccessToken()).toBe("refreshed-token");
    expect(result).toEqual({ data: { ok: true } });
  });

  it("does not try to refresh requests that already retried or belong to auth endpoints", async () => {
    await importClientModule();
    const apiClient = axiosHarness.instances[0];
    const refreshClient = axiosHarness.instances[1];
    const responseInterceptor = apiClient.__responseHandlers[0].onRejected;

    const retriedError = {
      config: { url: "/issues/9", _retry: true },
      response: { status: 401 },
    };
    const authError = {
      config: { url: "/auth/login" },
      response: { status: 401 },
    };

    await expect(responseInterceptor(retriedError)).rejects.toBe(retriedError);
    await expect(responseInterceptor(authError)).rejects.toBe(authError);

    expect(refreshClient.post).not.toHaveBeenCalled();
  });

  it("clears the access token when the refresh request fails", async () => {
    const clientModule = await importClientModule();
    const apiClient = axiosHarness.instances[0];
    const refreshClient = axiosHarness.instances[1];
    const refreshError = new Error("refresh failed");

    clientModule.setAccessToken("stale-token");
    refreshClient.post.mockRejectedValue(refreshError);

    const responseInterceptor = apiClient.__responseHandlers[0].onRejected;

    await expect(
      responseInterceptor({
        config: { url: "/issues/12", headers: {} },
        response: { status: 401 },
      })
    ).rejects.toThrow("refresh failed");

    expect(clientModule.getAccessToken()).toBe(null);
  });
});
