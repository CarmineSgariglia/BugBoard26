import { describe, expect, it } from "vitest";

import { resolveMediaUrl } from "@shared/api/core/media";

describe("resolveMediaUrl", () => {
  it("returns an empty string for missing paths", () => {
    expect(resolveMediaUrl()).toBe("");
  });

  it("keeps /media paths unchanged", () => {
    expect(resolveMediaUrl("/media/avatar.png")).toBe("/media/avatar.png");
  });

  it("normalizes media paths without a leading slash", () => {
    expect(resolveMediaUrl("media/avatar.png")).toBe("/media/avatar.png");
  });

  it("rewrites backend container urls to the browser-accessible origin", () => {
    const expectedOrigin = `${window.location.protocol}//${window.location.hostname}:8000`;

    expect(resolveMediaUrl("http://backend:8000/media/avatar.png")).toBe(
      `${expectedOrigin}/media/avatar.png`
    );
    expect(resolveMediaUrl("https://backend:8000/media/avatar.png")).toBe(
      `${expectedOrigin}/media/avatar.png`
    );
  });

  it("leaves unrelated absolute urls unchanged", () => {
    expect(resolveMediaUrl("https://cdn.example.com/avatar.png")).toBe(
      "https://cdn.example.com/avatar.png"
    );
  });
});
