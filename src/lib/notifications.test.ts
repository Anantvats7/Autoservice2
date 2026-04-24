/**
 * Notifications domain logic tests.
 * Tests notification type guards, unread count computation,
 * mark-as-read helpers, and notification grouping logic
 * used across all three portals (customer, employee, manager).
 */
import { describe, it, expect } from "vitest";

// ---- Notification types ----------------------------------------------------

type NotificationType = "success" | "warning" | "error" | "info";

interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string | null;
  read: boolean;
  created_at: string;
}

// ---- Domain helpers --------------------------------------------------------

/** Returns the count of unread notifications. */
function unreadCount(notifications: AppNotification[]): number {
  return notifications.filter((n) => !n.read).length;
}

/** Marks all notifications as read (returns new array, pure function). */
function markAllRead(notifications: AppNotification[]): AppNotification[] {
  return notifications.map((n) => ({ ...n, read: true }));
}

/** Marks a single notification as read by id. */
function markRead(
  notifications: AppNotification[],
  id: string
): AppNotification[] {
  return notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
}

/** Returns only unread notifications, sorted by created_at descending (newest first). */
function unreadNotificationsSorted(
  notifications: AppNotification[]
): AppNotification[] {
  return notifications
    .filter((n) => !n.read)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

/** Returns true if the notification type is a recognised warning or error. */
function isUrgent(notification: AppNotification): boolean {
  return notification.type === "warning" || notification.type === "error";
}

/** Groups notifications into today vs earlier (for grouped display in the UI). */
function groupNotifications(
  notifications: AppNotification[],
  today: string
): { today: AppNotification[]; earlier: AppNotification[] } {
  const todayPrefix = today.slice(0, 10);
  return {
    today: notifications.filter((n) => n.created_at.startsWith(todayPrefix)),
    earlier: notifications.filter((n) => !n.created_at.startsWith(todayPrefix)),
  };
}

// ---- Test fixtures ---------------------------------------------------------

const makeNotification = (
  overrides: Partial<AppNotification> = {}
): AppNotification => ({
  id: "notif-001",
  user_id: "user-uuid",
  title: "Booking Confirmed",
  message: "Your service is scheduled for tomorrow.",
  type: "success",
  read: false,
  created_at: "2026-04-20T10:00:00Z",
  ...overrides,
});

// ---- Tests -----------------------------------------------------------------

describe("unreadCount", () => {
  it("returns the correct count of unread notifications", () => {
    const notifications = [
      makeNotification({ id: "1", read: false }),
      makeNotification({ id: "2", read: true }),
      makeNotification({ id: "3", read: false }),
    ];
    expect(unreadCount(notifications)).toBe(2);
  });

  it("returns 0 when all notifications are read", () => {
    const notifications = [
      makeNotification({ id: "1", read: true }),
      makeNotification({ id: "2", read: true }),
    ];
    expect(unreadCount(notifications)).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(unreadCount([])).toBe(0);
  });

  it("counts all as unread when none are read", () => {
    const notifications = Array.from({ length: 5 }, (_, i) =>
      makeNotification({ id: String(i), read: false })
    );
    expect(unreadCount(notifications)).toBe(5);
  });
});

describe("markAllRead", () => {
  it("marks all notifications as read", () => {
    const notifications = [
      makeNotification({ id: "1", read: false }),
      makeNotification({ id: "2", read: false }),
    ];
    const result = markAllRead(notifications);
    expect(result.every((n) => n.read)).toBe(true);
  });

  it("does not mutate the original array (pure function)", () => {
    const notifications = [makeNotification({ read: false })];
    markAllRead(notifications);
    expect(notifications[0].read).toBe(false);
  });

  it("is a no-op when all notifications are already read", () => {
    const notifications = [makeNotification({ read: true })];
    const result = markAllRead(notifications);
    expect(result[0].read).toBe(true);
  });

  it("returns empty array for empty input", () => {
    expect(markAllRead([])).toHaveLength(0);
  });
});

describe("markRead (single notification)", () => {
  it("marks the correct notification as read by id", () => {
    const notifications = [
      makeNotification({ id: "n1", read: false }),
      makeNotification({ id: "n2", read: false }),
    ];
    const result = markRead(notifications, "n1");
    expect(result.find((n) => n.id === "n1")!.read).toBe(true);
    expect(result.find((n) => n.id === "n2")!.read).toBe(false);
  });

  it("does not mutate the original array", () => {
    const notifications = [makeNotification({ id: "n1", read: false })];
    markRead(notifications, "n1");
    expect(notifications[0].read).toBe(false);
  });

  it("is a no-op for a non-existent id", () => {
    const notifications = [makeNotification({ id: "n1", read: false })];
    const result = markRead(notifications, "does-not-exist");
    expect(result[0].read).toBe(false);
  });
});

describe("unreadNotificationsSorted", () => {
  it("filters out read notifications", () => {
    const notifications = [
      makeNotification({ id: "1", read: true }),
      makeNotification({ id: "2", read: false }),
    ];
    const result = unreadNotificationsSorted(notifications);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("sorts unread notifications by created_at descending (newest first)", () => {
    const notifications = [
      makeNotification({ id: "old", read: false, created_at: "2026-04-18T08:00:00Z" }),
      makeNotification({ id: "new", read: false, created_at: "2026-04-20T10:00:00Z" }),
      makeNotification({ id: "mid", read: false, created_at: "2026-04-19T12:00:00Z" }),
    ];
    const result = unreadNotificationsSorted(notifications);
    expect(result.map((n) => n.id)).toEqual(["new", "mid", "old"]);
  });

  it("returns empty array when all are read", () => {
    expect(
      unreadNotificationsSorted([makeNotification({ read: true })])
    ).toHaveLength(0);
  });
});

describe("isUrgent", () => {
  it("returns true for 'warning' type", () => {
    expect(isUrgent(makeNotification({ type: "warning" }))).toBe(true);
  });

  it("returns true for 'error' type", () => {
    expect(isUrgent(makeNotification({ type: "error" }))).toBe(true);
  });

  it("returns false for 'success' type", () => {
    expect(isUrgent(makeNotification({ type: "success" }))).toBe(false);
  });

  it("returns false for 'info' type", () => {
    expect(isUrgent(makeNotification({ type: "info" }))).toBe(false);
  });

  it("returns false for null type", () => {
    expect(isUrgent(makeNotification({ type: null }))).toBe(false);
  });
});

describe("groupNotifications", () => {
  const TODAY = "2026-04-20T00:00:00Z";

  it("correctly groups today's notifications", () => {
    const notifications = [
      makeNotification({ id: "1", created_at: "2026-04-20T10:00:00Z" }),
      makeNotification({ id: "2", created_at: "2026-04-19T10:00:00Z" }),
      makeNotification({ id: "3", created_at: "2026-04-20T15:00:00Z" }),
    ];
    const { today, earlier } = groupNotifications(notifications, TODAY);
    expect(today).toHaveLength(2);
    expect(earlier).toHaveLength(1);
    expect(today.map((n) => n.id)).toContain("1");
    expect(today.map((n) => n.id)).toContain("3");
    expect(earlier[0].id).toBe("2");
  });

  it("returns all in earlier when none are from today", () => {
    const notifications = [
      makeNotification({ id: "1", created_at: "2026-04-19T10:00:00Z" }),
      makeNotification({ id: "2", created_at: "2026-04-18T10:00:00Z" }),
    ];
    const { today, earlier } = groupNotifications(notifications, TODAY);
    expect(today).toHaveLength(0);
    expect(earlier).toHaveLength(2);
  });

  it("returns all in today when all are from today", () => {
    const notifications = [
      makeNotification({ id: "1", created_at: "2026-04-20T08:00:00Z" }),
      makeNotification({ id: "2", created_at: "2026-04-20T16:00:00Z" }),
    ];
    const { today, earlier } = groupNotifications(notifications, TODAY);
    expect(today).toHaveLength(2);
    expect(earlier).toHaveLength(0);
  });

  it("handles empty input gracefully", () => {
    const { today, earlier } = groupNotifications([], TODAY);
    expect(today).toHaveLength(0);
    expect(earlier).toHaveLength(0);
  });
});
