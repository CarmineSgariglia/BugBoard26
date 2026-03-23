import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loginApi,
  logoutApi,
  meApi,
  refreshApi,
  requestOtpApi,
  resetPasswordApi,
  verifyOtpApi,
} from "@features/auth/api";

const { getMock, postMock, deleteMock, setAccessTokenMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
  setAccessTokenMock: vi.fn(),
}));

vi.mock("@shared/api/core/client", () => ({
  __esModule: true,
  default: {
    get: getMock,
    post: postMock,
    delete: deleteMock,
  },
  setAccessToken: setAccessTokenMock,
}));

describe("feature auth api module", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
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
    expect(postMock).toHaveBeenCalledWith("/sessions", {
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

    expect(postMock).toHaveBeenNthCalledWith(1, "/password-reset-requests", {
      email: "dev@example.com",
    });
    expect(postMock).toHaveBeenNthCalledWith(2, "/password-reset-verifications", {
      email: "dev@example.com",
      code: "123456",
    });
    expect(postMock).toHaveBeenNthCalledWith(3, "/password-resets", {
      email: "dev@example.com",
      code: "123456",
      newPassword: "NewPass123!",
    });
  });

  it("always clears the access token on logout, even when the request fails", async () => {
    deleteMock.mockRejectedValueOnce(new Error("network down"));

    await expect(logoutApi()).rejects.toThrow("network down");
    expect(deleteMock).toHaveBeenCalledWith("/sessions/current");
    expect(setAccessTokenMock).toHaveBeenCalledWith(null);
  });

  it("fetches the current user from /users/me", async () => {
    const user = {
      userId: 1,
      username: "dev",
      email: "dev@example.com",
    };
    getMock.mockResolvedValue({ data: user });

    await expect(meApi()).resolves.toEqual(user);
    expect(getMock).toHaveBeenCalledWith("/users/me");
  });

  it("refreshes the session and stores the rotated access token", async () => {
    postMock.mockResolvedValue({ data: { accessToken: "fresh-token" } });

    await expect(refreshApi()).resolves.toBe("fresh-token");
    expect(postMock).toHaveBeenCalledWith("/sessions/current/access-token", {});
    expect(setAccessTokenMock).toHaveBeenCalledWith("fresh-token");
  });
});
