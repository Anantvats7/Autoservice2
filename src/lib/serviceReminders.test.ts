/**
 * Service Reminders domain logic tests.
 * Tests overdue detection, acknowledgement state, due-date sorting,
 * and reminder urgency classification used in the customer dashboard.
 */
import { describe, it, expect } from "vitest";

// ---- Domain helpers --------------------------------------------------------

interface ServiceReminder {
  id: string;
  customer_id: string;
  vehicle_id: string;
  title: string;
  message: string;
  due_date: string; // ISO date string "YYYY-MM-DD"
  acknowledged: boolean;
}

/** Returns true if the reminder is past its due date and not yet acknowledged. */
function isOverdue(reminder: ServiceReminder, today: Date = new Date()): boolean {
  if (reminder.acknowledged) return false;
  return new Date(reminder.due_date) < new Date(today.toISOString().slice(0, 10));
}

/** Returns true if the reminder is due within the next `withinDays` days. */
function isDueSoon(
  reminder: ServiceReminder,
  withinDays = 7,
  today: Date = new Date()
): boolean {
  if (reminder.acknowledged) return false;
  const dueDate = new Date(reminder.due_date);
  const todayDate = new Date(today.toISOString().slice(0, 10));
  const diff = (dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= withinDays;
}

/** Returns unacknowledged reminders sorted by due_date ascending. */
function pendingRemindersSorted(reminders: ServiceReminder[]): ServiceReminder[] {
  return reminders
    .filter((r) => !r.acknowledged)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

/** Returns acknowledged reminders. */
function acknowledgedReminders(reminders: ServiceReminder[]): ServiceReminder[] {
  return reminders.filter((r) => r.acknowledged);
}

/** Counts unacknowledged reminders. */
function pendingCount(reminders: ServiceReminder[]): number {
  return reminders.filter((r) => !r.acknowledged).length;
}

// ---- Test fixtures ---------------------------------------------------------

const makeReminder = (overrides: Partial<ServiceReminder> = {}): ServiceReminder => ({
  id: "rem-001",
  customer_id: "cust-uuid",
  vehicle_id: "veh-uuid",
  title: "Oil Change Due",
  message: "Your vehicle is due for an oil change.",
  due_date: "2026-06-01",
  acknowledged: false,
  ...overrides,
});

const TODAY = new Date("2026-04-20");

// ---- Tests -----------------------------------------------------------------

describe("isOverdue", () => {
  it("returns true for a past-due unacknowledged reminder", () => {
    const reminder = makeReminder({ due_date: "2026-04-01" });
    expect(isOverdue(reminder, TODAY)).toBe(true);
  });

  it("returns false for a future-due reminder", () => {
    const reminder = makeReminder({ due_date: "2026-05-01" });
    expect(isOverdue(reminder, TODAY)).toBe(false);
  });

  it("returns false for today's due date (not overdue yet)", () => {
    const reminder = makeReminder({ due_date: "2026-04-20" });
    expect(isOverdue(reminder, TODAY)).toBe(false);
  });

  it("returns false for an acknowledged reminder even if past due", () => {
    const reminder = makeReminder({ due_date: "2026-01-01", acknowledged: true });
    expect(isOverdue(reminder, TODAY)).toBe(false);
  });
});

describe("isDueSoon", () => {
  it("returns true for a reminder due in 3 days (within default 7-day window)", () => {
    const reminder = makeReminder({ due_date: "2026-04-23" });
    expect(isDueSoon(reminder, 7, TODAY)).toBe(true);
  });

  it("returns true for today's due date", () => {
    const reminder = makeReminder({ due_date: "2026-04-20" });
    expect(isDueSoon(reminder, 7, TODAY)).toBe(true);
  });

  it("returns false for a reminder due in 10 days when window is 7", () => {
    const reminder = makeReminder({ due_date: "2026-04-30" });
    expect(isDueSoon(reminder, 7, TODAY)).toBe(false);
  });

  it("returns false for overdue reminders (negative diff)", () => {
    const reminder = makeReminder({ due_date: "2026-04-10" });
    expect(isDueSoon(reminder, 7, TODAY)).toBe(false);
  });

  it("returns false for acknowledged reminders even if due soon", () => {
    const reminder = makeReminder({ due_date: "2026-04-22", acknowledged: true });
    expect(isDueSoon(reminder, 7, TODAY)).toBe(false);
  });

  it("respects a custom withinDays parameter", () => {
    const reminder = makeReminder({ due_date: "2026-04-25" });
    expect(isDueSoon(reminder, 30, TODAY)).toBe(true);
    expect(isDueSoon(reminder, 3, TODAY)).toBe(false);
  });
});

describe("pendingRemindersSorted", () => {
  it("filters out acknowledged reminders", () => {
    const reminders = [
      makeReminder({ id: "r1", acknowledged: false, due_date: "2026-05-01" }),
      makeReminder({ id: "r2", acknowledged: true, due_date: "2026-04-15" }),
    ];
    const result = pendingRemindersSorted(reminders);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("r1");
  });

  it("sorts unacknowledged reminders by due_date ascending", () => {
    const reminders = [
      makeReminder({ id: "r3", due_date: "2026-06-01" }),
      makeReminder({ id: "r1", due_date: "2026-04-25" }),
      makeReminder({ id: "r2", due_date: "2026-05-10" }),
    ];
    const result = pendingRemindersSorted(reminders);
    expect(result.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("returns empty array when all reminders are acknowledged", () => {
    const reminders = [
      makeReminder({ acknowledged: true }),
      makeReminder({ acknowledged: true }),
    ];
    expect(pendingRemindersSorted(reminders)).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(pendingRemindersSorted([])).toHaveLength(0);
  });
});

describe("acknowledgedReminders", () => {
  it("returns only acknowledged reminders", () => {
    const reminders = [
      makeReminder({ id: "r1", acknowledged: true }),
      makeReminder({ id: "r2", acknowledged: false }),
      makeReminder({ id: "r3", acknowledged: true }),
    ];
    const result = acknowledgedReminders(reminders);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.acknowledged)).toBe(true);
  });

  it("returns empty when no reminders are acknowledged", () => {
    expect(acknowledgedReminders([makeReminder()])).toHaveLength(0);
  });
});

describe("pendingCount", () => {
  it("correctly counts unacknowledged reminders", () => {
    const reminders = [
      makeReminder({ acknowledged: false }),
      makeReminder({ acknowledged: true }),
      makeReminder({ acknowledged: false }),
      makeReminder({ acknowledged: false }),
    ];
    expect(pendingCount(reminders)).toBe(3);
  });

  it("returns 0 when all reminders are acknowledged", () => {
    const reminders = [
      makeReminder({ acknowledged: true }),
      makeReminder({ acknowledged: true }),
    ];
    expect(pendingCount(reminders)).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(pendingCount([])).toBe(0);
  });
});
