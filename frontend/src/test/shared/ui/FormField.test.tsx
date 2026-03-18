import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "@shared/ui/FormField";

describe("FormField", () => {
  it("renders label and required star", () => {
    render(
      <FormField label="Username" required>
        <input />
      </FormField>
    );
    
    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders error message preferentially over helperText", () => {
    render(
      <FormField label="Field" error="Invalid field" helperText="Be careful">
        <input />
      </FormField>
    );
    
    expect(screen.getByText("Invalid field")).toBeInTheDocument();
    expect(screen.queryByText("Be careful")).not.toBeInTheDocument();
  });

  it("renders helperText when error is missing", () => {
    render(
      <FormField label="Field" helperText="Be careful">
        <input />
      </FormField>
    );
    
    expect(screen.getByText("Be careful")).toBeInTheDocument();
  });

  it("renders children input zone", () => {
    render(
      <FormField>
        <input data-testid="field-input" />
      </FormField>
    );
    expect(screen.getByTestId("field-input")).toBeInTheDocument();
  });
});
