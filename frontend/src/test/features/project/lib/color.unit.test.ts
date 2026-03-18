import { describe, expect, it } from "vitest";

import { getContrastColor } from "../../../../features/project/lib/color";

describe("getContrastColor", () => {
  it("returns black text for light backgrounds", () => {
    // White background
    expect(getContrastColor("#ffffff")).toBe("rgba(0, 0, 0, 1)");
    // Light grey
    expect(getContrastColor("#f0f0f0")).toBe("rgba(0, 0, 0, 1)");
    // Bright yellow
    expect(getContrastColor("#ffff00")).toBe("rgba(0, 0, 0, 1)");
  });

  it("returns white text for dark backgrounds", () => {
    // Black background
    expect(getContrastColor("#000000")).toBe("rgba(255, 255, 255, 1)");
    // Dark blue
    expect(getContrastColor("#000080")).toBe("rgba(255, 255, 255, 1)");
    // Dark red
    expect(getContrastColor("#800000")).toBe("rgba(255, 255, 255, 1)");
  });

  it("applies opacity correctly", () => {
    expect(getContrastColor("#ffffff", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
    expect(getContrastColor("#000000", 0.8)).toBe("rgba(255, 255, 255, 0.8)");
  });

  it("handles hex codes without # prefix if structure permits (optional spec)", () => {
    // The implementation does: hexColor.replace("#", "")
    // So it should support both "ffffff" and "#ffffff"
    expect(getContrastColor("ffffff")).toBe("rgba(0, 0, 0, 1)");
  });
});
