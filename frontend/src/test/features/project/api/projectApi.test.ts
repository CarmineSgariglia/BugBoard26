import { beforeEach, describe, expect, it, vi } from "vitest";

import { listProjectMembersApi } from "@features/project/api";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock("@shared/api/core/client", () => ({
  __esModule: true,
  default: {
    get: getMock,
  },
}));

describe("feature project api module", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("fetches project members", async () => {
    getMock.mockResolvedValue({ data: [{ userId: 4, role: "Developer" }] });

    await expect(listProjectMembersApi(12)).resolves.toEqual([{ userId: 4, role: "Developer" }]);
    expect(getMock).toHaveBeenCalledWith("/projects/12/members");
  });
});
