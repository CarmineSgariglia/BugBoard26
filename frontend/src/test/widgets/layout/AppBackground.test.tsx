import { describe, expect, it } from "vitest";

import { AppBackground } from "@widgets/layout/AppBackground";
import { renderWithProviders } from "../../render";

describe("AppBackground", () => {
  it("renders the fixed background layer with the radial gradient", () => {
    const { container } = renderWithProviders(<AppBackground />);
    const background = container.firstElementChild as HTMLElement;

    expect(background).toBeInTheDocument();
    expect(background.className).toContain("fixed");
    expect(background.getAttribute("style")).toContain("radial-gradient");
  });
});
