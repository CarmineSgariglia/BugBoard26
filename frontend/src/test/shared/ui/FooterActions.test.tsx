import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FooterActions } from "@shared/ui/FooterActions";

describe("FooterActions", () => {
  it("renders Save button and reacts to loading states", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <FooterActions onSave={onSave} saveLabel="Verify" />
    );
    
    const saveButton = screen.getByRole("button", { name: "Verify" });
    expect(saveButton).toBeInTheDocument();

    await user.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);

    rerender(<FooterActions onSave={onSave} isSaving saveLabel="Verify" />);
    expect(saveButton).toHaveAttribute("disabled");
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders multiple descriptive links", async () => {
    const clickOne = vi.fn();
    const user = userEvent.setup();

    render(
      <FooterActions 
        links={[
          { label: "Link 1", icon: <span>Icon</span>, onClick: clickOne }
        ]}
      />
    );
    
    const linkButton = screen.getByRole("button", { name: "IconLink 1" });
    expect(linkButton).toBeInTheDocument();

    await user.click(linkButton);
    expect(clickOne).toHaveBeenCalledTimes(1);
  });
});
