import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectFormLayout } from "@widgets/layout/ProjectFormLayout";
import { renderWithProviders } from "../../render";

describe("ProjectFormLayout", () => {
  it("renders header, action, content, footer and step info", () => {
    renderWithProviders(
      <ProjectFormLayout
        title="Project Details"
        subtitle="Choose the project basics"
        stepInfo="STEP 2 OF 2"
        headerAction={<button>Header action</button>}
        footer={<button>Confirm</button>}
      >
        <div>Form body</div>
      </ProjectFormLayout>
    );

    expect(screen.getByText("Project Details")).toBeInTheDocument();
    expect(screen.getByText("Choose the project basics")).toBeInTheDocument();
    expect(screen.getByText("STEP 2 OF 2")).toBeInTheDocument();
    expect(screen.getByText("Header action")).toBeInTheDocument();
    expect(screen.getByText("Form body")).toBeInTheDocument();
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it("does not render the step indicator when stepInfo is missing", () => {
    renderWithProviders(
      <ProjectFormLayout title="Project Details" subtitle="Choose the project basics">
        <div>Form body</div>
      </ProjectFormLayout>
    );

    expect(screen.queryByText(/STEP/i)).not.toBeInTheDocument();
    expect(screen.getByText("Form body")).toBeInTheDocument();
  });
});
