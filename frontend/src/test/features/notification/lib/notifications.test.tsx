import { render, screen } from "@testing-library/react";

import {
  getNotificationDescription,
  getNotificationIcon,
  getNotificationTitle,
} from "@features/notification/lib/notifications";

describe("notification helpers", () => {
  it("returns consistent titles for known and unknown notification types", () => {
    expect(getNotificationTitle("ISSUE_UPDATED")).toBe("Issue updated");
    expect(getNotificationTitle("PROJECT_ADDED")).toBe("Project added");
    expect(getNotificationTitle("CUSTOM_ALERT")).toBe("CUSTOM ALERT");
  });

  it("prefers issue id over project id when building descriptions", () => {
    expect(getNotificationDescription({ issueId: 42, projectId: 5 })).toBe("Issue #42");
    expect(getNotificationDescription({ issueId: null, projectId: 5 })).toBe("Project #5");
    expect(getNotificationDescription({ issueId: null, projectId: null })).toBe(
      "System notification",
    );
  });

  it("renders icons for both known and fallback notification types", () => {
    render(
      <div>
        <span data-testid="known">{getNotificationIcon("ISSUE_ASSIGNED")}</span>
        <span data-testid="fallback">{getNotificationIcon("SOMETHING_NEW")}</span>
      </div>,
    );

    expect(screen.getByTestId("known").querySelector("svg")).not.toBeNull();
    expect(screen.getByTestId("fallback").querySelector("svg")).not.toBeNull();
  });
});
