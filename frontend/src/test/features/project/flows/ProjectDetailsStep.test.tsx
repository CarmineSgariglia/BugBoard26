import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectDetailsStep } from "@features/project/flows/ProjectDetailsStep";
import { renderWithProviders } from "../../../render";

vi.mock("@shared/ui/ScrollComponent", () => ({
  ScrollComponent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
      {stepInfo ? <span>{stepInfo}</span> : null}
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
    renderWithProviders(<ProjectDetailsStep {...defaultProps} mode="edit" />);
    expect(screen.getByText("Edit Project")).toBeInTheDocument();
  });

  it("shows STEP 1 OF 2 info in create mode", () => {
    renderWithProviders(<ProjectDetailsStep {...defaultProps} />);
    expect(screen.getByText("STEP 1 OF 2")).toBeInTheDocument();
  });

  it("does not show step info in edit mode", () => {
    renderWithProviders(<ProjectDetailsStep {...defaultProps} mode="edit" />);
    expect(screen.queryByText("STEP 1 OF 2")).not.toBeInTheDocument();
  });

  it("keeps Next active when form is empty", () => {
    renderWithProviders(<ProjectDetailsStep {...defaultProps} />);
    expect(screen.getByRole("button", { name: /next/i })).not.toHaveAttribute("disabled");
  });

  it("marks invalid fields on submit instead of disabling Next", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectDetailsStep {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(await screen.findByText("Please check the highlighted fields.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter a project title/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByPlaceholderText(/Describe the project goals/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("calls onNext with trimmed title and description", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ProjectDetailsStep {...defaultProps} onNext={onNext} />);

    await user.type(screen.getByPlaceholderText(/Enter a project title/i), "  My Project  ");
    await user.type(screen.getByPlaceholderText(/Describe the project goals/i), "  My description  ");
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "My Project",
        description: "My description",
      }),
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
      />,
    );

    expect(screen.getByPlaceholderText(/Enter a project title/i)).toHaveValue("Existing Title");
    expect(screen.getByPlaceholderText(/Describe the project goals/i)).toHaveValue("Existing description");
  });

  it("calls onExit when Exit link is clicked", async () => {
    const onExit = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ProjectDetailsStep {...defaultProps} onExit={onExit} />);

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
      />,
    );

    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
  });
});
