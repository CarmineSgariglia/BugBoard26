import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProjectDetailsStep } from "@features/project/flows/ProjectDetailsStep";
import { renderWithProviders } from "../../../render";

// Mock ScrollComponent to avoid ResizeObserver issues
vi.mock("@shared/ui/ScrollComponent", () => ({
  ScrollComponent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@widgets/layout/ProjectFormLayout", () => ({
  ProjectFormLayout: ({
    children,
    title,
    footer,
    stepInfo,
  }: {
    children: React.ReactNode;
    title: string;
    footer: React.ReactNode;
    stepInfo?: string;
  }) => (
    <div>
      <h2>{title}</h2>
      {stepInfo && <span>{stepInfo}</span>}
      {children}
      {footer}
    </div>
  ),
}));

const defaultProps = {
  mode: "create" as const,
  onNext: vi.fn(),
  onExit: vi.fn(),
};

describe("ProjectDetailsStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Project Details' title in create mode", () => {
    renderWithProviders(<ProjectDetailsStep {...defaultProps} />);
    expect(screen.getByText("Project Details")).toBeInTheDocument();
  });

  it("renders 'Edit Project' title in edit mode", () => {
    renderWithProviders(
      <ProjectDetailsStep {...defaultProps} mode="edit" />
    );
    expect(screen.getByText("Edit Project")).toBeInTheDocument();
  });

  it("shows STEP 1 OF 2 info in create mode", () => {
    renderWithProviders(<ProjectDetailsStep {...defaultProps} />);
    expect(screen.getByText("STEP 1 OF 2")).toBeInTheDocument();
  });

  it("does not show step info in edit mode", () => {
    renderWithProviders(
      <ProjectDetailsStep {...defaultProps} mode="edit" />
    );
    expect(screen.queryByText("STEP 1 OF 2")).not.toBeInTheDocument();
  });

  it("Next button is disabled when form is empty", () => {
    renderWithProviders(<ProjectDetailsStep {...defaultProps} />);
    const btn = screen.getByRole("button", { name: /next/i });
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("Next button is disabled when title < 3 chars", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectDetailsStep {...defaultProps} />);
    await user.type(
      screen.getByPlaceholderText(/Insert your Project Title/i),
      "AB"
    );
    await user.type(
      screen.getByPlaceholderText(/Describe the project goals/i),
      "Valid description"
    );
    expect(screen.getByRole("button", { name: /next/i }).hasAttribute("disabled")).toBe(true);
  });

  it("Next button is disabled when description < 5 chars", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectDetailsStep {...defaultProps} />);
    await user.type(
      screen.getByPlaceholderText(/Insert your Project Title/i),
      "Valid Title"
    );
    await user.type(
      screen.getByPlaceholderText(/Describe the project goals/i),
      "Hi"
    );
    expect(screen.getByRole("button", { name: /next/i }).hasAttribute("disabled")).toBe(true);
  });

  it("enables Next button when title ≥ 3 and description ≥ 5 chars", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectDetailsStep {...defaultProps} />);
    await user.type(
      screen.getByPlaceholderText(/Insert your Project Title/i),
      "New Project"
    );
    await user.type(
      screen.getByPlaceholderText(/Describe the project goals/i),
      "A meaningful description"
    );
    expect(screen.getByRole("button", { name: /next/i }).hasAttribute("disabled")).toBe(false);
  });

  it("calls onNext with trimmed title and description", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ProjectDetailsStep {...defaultProps} onNext={onNext} />
    );
    await user.type(
      screen.getByPlaceholderText(/Insert your Project Title/i),
      "  My Project  "
    );
    await user.type(
      screen.getByPlaceholderText(/Describe the project goals/i),
      "  My description  "
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "My Project",
        description: "My description",
      })
    );
  });

  it("pre-fills title and description from initialData", () => {
    renderWithProviders(
      <ProjectDetailsStep
        {...defaultProps}
        mode="edit"
        initialData={{
          title: "Existing Title",
          description: "Existing description",
          icon: "folder",
          color: "#ffffff",
        }}
      />
    );
    expect(
      screen.getByPlaceholderText(/Insert your Project Title/i)
    ).toHaveValue("Existing Title");
    expect(
      screen.getByPlaceholderText(/Describe the project goals/i)
    ).toHaveValue("Existing description");
  });

  it("calls onExit when Exit link is clicked", async () => {
    const onExit = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ProjectDetailsStep {...defaultProps} onExit={onExit} />
    );
    await user.click(screen.getByText("Exit"));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("shows 'Confirm' button label in edit mode", () => {
    renderWithProviders(
      <ProjectDetailsStep
        {...defaultProps}
        mode="edit"
        initialData={{
          title: "Valid Title",
          description: "Valid description here",
          icon: "folder",
          color: "#fff",
        }}
      />
    );
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
  });
});
