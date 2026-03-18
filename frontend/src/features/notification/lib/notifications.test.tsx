import { render, screen } from "@testing-library/react";

import {
  getNotificationDescription,
  getNotificationIcon,
  getNotificationTitle,
  getNotificationTargetKind,
  flattenNotificationsPages,
  getNotificationsHasUnread,
  updateNotificationsInfiniteData,
  prependNotificationToInfiniteData,
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

  it("determines notification target kind", () => {
    expect(getNotificationTargetKind("ISSUE_ADDED")).toBe("issue");
    expect(getNotificationTargetKind("PROJECT_ADDED")).toBe("project");
    expect(getNotificationTargetKind("PROJECT_UNASSIGNED")).toBe("none");
    expect(getNotificationTargetKind("UNKNOWN")).toBe("none");
  });

  it("flattens notification pages into a single array", () => {
    const data = {
      pages: [
        { results: [{ notifyUserId: 1 }] },
        { results: [{ notifyUserId: 2 }] },
      ],
    };

    expect(flattenNotificationsPages(data as any)).toEqual([
      { notifyUserId: 1 },
      { notifyUserId: 2 },
    ]);
  });

  it("checks if notifications have unread from infinite data", () => {
    const dataWithUnread = { pages: [{ hasUnread: true }] };
    const dataWithoutUnread = { pages: [{ hasUnread: false }] };

    expect(getNotificationsHasUnread(dataWithUnread as any)).toBe(true);
    expect(getNotificationsHasUnread(dataWithoutUnread as any)).toBe(false);
    expect(getNotificationsHasUnread(null)).toBe(false);
  });

  it("updates notifications infinite data and recalculates unread state", () => {
    const data = {
      pages: [
        { results: [{ notifyUserId: 1, isRead: false }], hasMore: false, hasUnread: true },
      ],
    };

    const updated = updateNotificationsInfiniteData(data as any, (item) =>
      item.notifyUserId === 1 ? { ...item, isRead: true } : item
    );

    expect(updated?.pages[0].results[0].isRead).toBe(true);
    expect(updated?.pages[0].hasUnread).toBe(false);
  });

  it("prepends a notification to infinite data", () => {
    const data = {
      pages: [
        { results: [{ notifyUserId: 2, isRead: true }], hasMore: false, hasUnread: false },
      ],
      pageParams: [null],
    };

    const newNotification = { notifyUserId: 1, isRead: false } as any;

    const updated = prependNotificationToInfiniteData(data as any, newNotification);

    expect(updated.pages[0].results).toHaveLength(2);
    expect(updated.pages[0].results[0].notifyUserId).toBe(1);
    expect(updated.pages[0].hasUnread).toBe(true);
  });
});
