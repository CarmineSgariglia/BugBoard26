import { describe, expect, it } from "vitest";
import { handleGetHelp } from "../../../../src/shared/lib/help";

describe("help helpers", () => {
  it("sets window.location.href to mailto", () => {
    const locationMock = { href: "" };
    Object.defineProperty(window, "location", {
      value: locationMock,
      writable: true,
      configurable: true
    });

    handleGetHelp();

    expect(locationMock.href).toBe("mailto:support@bugboard.it");
  });
});
