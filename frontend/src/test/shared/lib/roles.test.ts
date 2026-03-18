import { describe, expect, it } from "vitest";

import { isAdminLike } from "@shared/lib/roles";

describe("isAdminLike", () => {
  it("returns false when the entity is missing", () => {
    expect(isAdminLike(null)).toBe(false);
    expect(isAdminLike(undefined)).toBe(false);
  });

  it("returns true when the explicit isAdmin flag is true", () => {
    expect(isAdminLike({ isAdmin: true })).toBe(true);
  });

  it("normalizes role and group values before checking admin aliases", () => {
    expect(isAdminLike({ role: " ADMIN " })).toBe(true);
    expect(isAdminLike({ role: "administrator" })).toBe(true);
    expect(isAdminLike({ group: " AdMiN " })).toBe(true);
    expect(isAdminLike({ group: "administrator" })).toBe(true);
  });

  it("returns false for non-admin values", () => {
    expect(isAdminLike({ isAdmin: false, role: "member", group: "team" })).toBe(
      false
    );
  });
});
