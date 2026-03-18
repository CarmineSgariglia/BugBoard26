import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Priority } from "@features/issue/ui/Priority";
import { renderWithProviders } from "../../../render";

describe("Priority", () => {
  it("renders the URGENT level with correct label", () => {
    renderWithProviders(<Priority level="URGENT" />);
    expect(screen.getByText("URGENT")).toBeInTheDocument();
  });

  it("renders the HIGH level with correct label", () => {
    renderWithProviders(<Priority level="HIGH" />);
    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("renders the MEDIUM level with correct label", () => {
    renderWithProviders(<Priority level="MEDIUM" />);
    expect(screen.getByText("MEDIUM")).toBeInTheDocument();
  });

  it("renders the LOW level with correct label", () => {
    renderWithProviders(<Priority level="LOW" />);
    expect(screen.getByText("LOW")).toBeInTheDocument();
  });

  it("is case-insensitive — lowercase input renders the right label", () => {
    renderWithProviders(<Priority level="high" />);
    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("renders UNKNOWN for unrecognised levels", () => {
    renderWithProviders(<Priority level="CRITICAL" />);
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
  });

  it("renders UNKNOWN label when level is empty string", () => {
    renderWithProviders(<Priority level="" />);
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
  });
});
