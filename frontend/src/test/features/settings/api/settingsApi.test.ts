import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  updateSettingsUserApi,
  changeSettingsPasswordApi,
  adminChangeSettingsPasswordApi,
  adminUploadSettingsProfileImageApi,
  createSettingsUserApi,
  setSettingsUserActiveApi,
  uploadSettingsProfileImageApi,
} from "@features/settings/api/settingsApi";

import { prepareProfileImageUpload } from "@shared/lib/media";

const { postMock, patchMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  patchMock: vi.fn(),
}));

vi.mock("@shared/api/core/client", () => ({
  __esModule: true,
  default: {
    post: postMock,
    patch: patchMock,
  },
}));

// Mock prepareProfileImageUpload to act as identity function
vi.mock("@shared/lib/media", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shared/lib/media")>();
  return {
    ...actual,
    prepareProfileImageUpload: vi.fn((file) => Promise.resolve(file)),
  };
});

describe("feature settings api module", () => {
  beforeEach(() => {
    postMock.mockReset();
    patchMock.mockReset();
    vi.mocked(prepareProfileImageUpload).mockClear();
  });

  const dummyUser = { id: 1, email: "test@example.com", name: "Test" };

  it("updates user settings", async () => {
    const payload = { name: "Updated" };
    patchMock.mockResolvedValue({ data: { ...dummyUser, ...payload } });

    await expect(updateSettingsUserApi(1, payload)).resolves.toEqual({ ...dummyUser, ...payload });
    expect(patchMock).toHaveBeenCalledWith("/users/1", payload);
  });

  it("changes password", async () => {
    postMock.mockResolvedValue({ data: undefined });

    await expect(changeSettingsPasswordApi(1, "current", "new")).resolves.toBeUndefined();
    expect(postMock).toHaveBeenCalledWith("/users/1/change-password", {
      currentPassword: "current",
      newPassword: "new",
    });
  });

  it("admin resets password", async () => {
    postMock.mockResolvedValue({ data: undefined });

    await expect(adminChangeSettingsPasswordApi(1, "newpass")).resolves.toBeUndefined();
    expect(postMock).toHaveBeenCalledWith("/users/1/admin-reset-password", {
      newPassword: "newpass",
    });
  });

  it("admin uploads profile image", async () => {
    const file = new File(["test"], "avatar.png", { type: "image/png" });
    postMock.mockResolvedValue({ data: { ...dummyUser, imageUrl: "new-url" } });

    await expect(adminUploadSettingsProfileImageApi(1, file)).resolves.toEqual({
      ...dummyUser,
      imageUrl: "new-url",
    });

    expect(prepareProfileImageUpload).toHaveBeenCalledWith(file);
    const [url, formData, config] = postMock.mock.calls[0];
    expect(url).toBe("/users/1/admin-upload-image");
    expect(formData).toBeInstanceOf(FormData);
    expect((formData as FormData).get("profile_img")).toBeDefined();
    expect(config).toBeDefined();
    expect(config.headers).toBeDefined();
    expect(config.headers["Content-Type"]).toBe("multipart/form-data");
  });

  it("creates a user", async () => {
    const payload = { email: "new@example.com", password: "123", name: "New" };
    postMock.mockResolvedValue({ data: { id: 2, ...payload } });

    await expect(createSettingsUserApi(payload as any)).resolves.toEqual({ id: 2, ...payload });
    expect(postMock).toHaveBeenCalledWith("/users", payload);
  });

  it("sets user active status", async () => {
    patchMock.mockResolvedValue({ data: { ...dummyUser, active: false } });

    await expect(setSettingsUserActiveApi(1, false)).resolves.toEqual({ ...dummyUser, active: false });
    expect(patchMock).toHaveBeenCalledWith("/users/1", { active: false });
  });

  it("uploads own profile image", async () => {
    const file = new File(["test"], "avatar2.png", { type: "image/png" });
    postMock.mockResolvedValue({ data: { ...dummyUser, imageUrl: "my-url" } });

    await expect(uploadSettingsProfileImageApi(file)).resolves.toEqual({
      ...dummyUser,
      imageUrl: "my-url",
    });

    expect(prepareProfileImageUpload).toHaveBeenCalledWith(file);
    const [url, formData, config] = postMock.mock.calls[0];
    expect(url).toBe("/users/me/upload-profile-image");
    expect(formData).toBeInstanceOf(FormData);
    expect(config).toBeDefined();
    expect(config.headers).toBeDefined();
    expect(config.headers["Content-Type"]).toBe("multipart/form-data");
  });

  it("propagates API errors", async () => {
    const error = new Error("Network Error");
    patchMock.mockRejectedValue(error);

    await expect(updateSettingsUserApi(1, {})).rejects.toThrow(error);
  });
});
