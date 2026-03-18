import { beforeEach, describe, expect, it, vi } from "vitest";

import { listUsersApi } from "@features/user/api";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock("@shared/api/core/client", () => ({
  __esModule: true,
  default: {
    get: getMock,
  },
}));

describe("feature user api module", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("lists users with pagination params", async () => {
    const payload = { count: 1, next: null, previous: null, results: [{ userId: 9 }] };
    getMock.mockResolvedValue({ data: payload });

    await expect(listUsersApi({ page: 2, role: "User" })).resolves.toEqual(payload);
    expect(getMock).toHaveBeenCalledWith("/users", {
      params: { page: 2, role: "User" },
    });
  });

  it("propagates API errors", async () => {
    const error = new Error("Network Error");
    getMock.mockRejectedValue(error);

    await expect(listUsersApi()).rejects.toThrow(error);
  });
});
