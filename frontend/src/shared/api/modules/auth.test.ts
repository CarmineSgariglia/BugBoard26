import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loginApi,
  logoutApi,
  meApi,
  refreshApi,
  requestOtpApi,
  resetPasswordApi,
  verifyOtpApi,
} from "./auth";

const { getMock, postMock, patchMock, deleteMock, setAccessTokenMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  setAccessTokenMock: vi.fn(),
}));

vi.mock("../core/client", () => ({
  __esModule: true,
  default: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    delete: deleteMock,
  },
  apiBaseUrl: "/api",
  setAccessToken: setAccessTokenMock,
}));

describe("auth api module", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
    setAccessTokenMock.mockReset();
  });

  it("logs in and stores the access token", async () => {
    const user = {
      userId: 7,
      username: "dev",
      email: "dev@example.com",
      firstName: "Dev",
      lastName: "User",
    };
    postMock.mockResolvedValue({ data: { accessToken: "token-123", user } });

    await expect(loginApi("dev@example.com", "StrongPass123!")).resolves.toEqual(user);
    expect(postMock).toHaveBeenCalledWith("/auth/login", {
      email: "dev@example.com",
      password: "StrongPass123!",
    });
    expect(setAccessTokenMock).toHaveBeenCalledWith("token-123");
  });

  it("requests, verifies, and resets OTP via the expected endpoints", async () => {
    postMock
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { valid: true } })
      .mockResolvedValueOnce({ data: {} });

    await expect(requestOtpApi("dev@example.com")).resolves.toBeUndefined();
    await expect(verifyOtpApi("dev@example.com", "123456")).resolves.toEqual({ valid: true });
    await expect(resetPasswordApi("dev@example.com", "123456", "NewPass123!")).resolves.toBeUndefined();

    expect(postMock).toHaveBeenNthCalledWith(1, "/auth/password/otp/request", {
      email: "dev@example.com",
    });
    expect(postMock).toHaveBeenNthCalledWith(2, "/auth/password/otp/verify", {
      email: "dev@example.com",
      code: "123456",
    });
    expect(postMock).toHaveBeenNthCalledWith(3, "/auth/password/reset", {
      email: "dev@example.com",
      code: "123456",
      newPassword: "NewPass123!",
    });
  });

  it("refreshes the session and stores the rotated access token", async () => {
    postMock.mockResolvedValue({ data: { accessToken: "fresh-token" } });

    await expect(refreshApi()).resolves.toBe("fresh-token");
    expect(postMock).toHaveBeenCalledWith("/auth/refresh", {});
    expect(setAccessTokenMock).toHaveBeenCalledWith("fresh-token");
  });

  it("always clears the access token on logout, even when the request fails", async () => {
    postMock.mockRejectedValueOnce(new Error("network down"));

    await expect(logoutApi()).rejects.toThrow("network down");
    expect(postMock).toHaveBeenCalledWith("/auth/logout");
    expect(setAccessTokenMock).toHaveBeenCalledWith(null);
  });

  it("fetches the current user from /auth/me", async () => {
    const user = {
      userId: 1,
      username: "dev",
      email: "dev@example.com",
    };
    getMock.mockResolvedValue({ data: user });

    await expect(meApi()).resolves.toEqual(user);
    expect(getMock).toHaveBeenCalledWith("/auth/me");
  });
});
