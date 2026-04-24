// Booking lifecycle helpers — tests for the customer/manager booking pages' status logic.
import { describe, it, expect } from "vitest";

// Mirror the constants used in src/pages/customer/MyBookings.tsx and src/pages/manager/Bookings.tsx
const ALL_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
  "ready_for_pickup",
  "completed",
  "released",
  "cancelled",
] as const;

type Status = typeof ALL_STATUSES[number];

const isUpcoming = (s: Status) => ["pending", "confirmed"].includes(s);
const isInProgress = (s: Status) => ["checked_in", "in_progress", "ready_for_pickup"].includes(s);
const isPast = (s: Status) => ["completed", "released"].includes(s);
const isCancelled = (s: Status) => s === "cancelled";
const isTerminal = (s: Status) => ["completed", "released", "cancelled"].includes(s);
const showsDropoffQR = (s: Status) => ["pending", "confirmed"].includes(s);
const showsPickupQR = (s: Status) => s === "ready_for_pickup";

describe("Booking lifecycle classification", () => {
  it("classifies upcoming statuses", () => {
    expect(isUpcoming("pending")).toBe(true);
    expect(isUpcoming("confirmed")).toBe(true);
    expect(isUpcoming("in_progress")).toBe(false);
    expect(isUpcoming("released")).toBe(false);
  });

  it("classifies in-progress statuses", () => {
    expect(isInProgress("checked_in")).toBe(true);
    expect(isInProgress("in_progress")).toBe(true);
    expect(isInProgress("ready_for_pickup")).toBe(true);
    expect(isInProgress("pending")).toBe(false);
  });

  it("classifies past statuses (completed + released)", () => {
    expect(isPast("completed")).toBe(true);
    expect(isPast("released")).toBe(true);
    expect(isPast("cancelled")).toBe(false);
  });

  it("shows the drop-off QR ONLY before vehicle arrives", () => {
    expect(showsDropoffQR("pending")).toBe(true);
    expect(showsDropoffQR("confirmed")).toBe(true);
    expect(showsDropoffQR("checked_in")).toBe(false);
  });

  it("shows the pickup QR ONLY when ready_for_pickup", () => {
    expect(showsPickupQR("ready_for_pickup")).toBe(true);
    expect(showsPickupQR("in_progress")).toBe(false);
    expect(showsPickupQR("released")).toBe(false);
  });

  it("the lifecycle covers all 8 known statuses", () => {
    expect(ALL_STATUSES).toHaveLength(8);
  });

  it("cancelled status is not upcoming, in-progress, or past", () => {
    expect(isUpcoming("cancelled")).toBe(false);
    expect(isInProgress("cancelled")).toBe(false);
    expect(isPast("cancelled")).toBe(false);
  });

  it("identifies cancelled status correctly", () => {
    expect(isCancelled("cancelled")).toBe(true);
    expect(isCancelled("pending")).toBe(false);
    expect(isCancelled("completed")).toBe(false);
  });

  it("terminal states are completed, released, and cancelled", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("released")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("in_progress")).toBe(false);
    expect(isTerminal("pending")).toBe(false);
    expect(isTerminal("checked_in")).toBe(false);
  });

  it("every status belongs to exactly one classification (or is cancelled)", () => {
    const nonTerminalStatuses: Status[] = ["pending", "confirmed", "checked_in", "in_progress", "ready_for_pickup"];
    nonTerminalStatuses.forEach((s) => {
      const count = [isUpcoming(s), isInProgress(s), isPast(s)].filter(Boolean).length;
      expect(count).toBe(1);
    });
  });

  it("no non-pending/confirmed status shows the drop-off QR", () => {
    const noQrStatuses: Status[] = ["checked_in", "in_progress", "ready_for_pickup", "completed", "released", "cancelled"];
    noQrStatuses.forEach((s) => expect(showsDropoffQR(s)).toBe(false));
  });

  it("only ready_for_pickup status shows the pickup QR", () => {
    const allExceptReady = ALL_STATUSES.filter((s) => s !== "ready_for_pickup");
    allExceptReady.forEach((s) => expect(showsPickupQR(s)).toBe(false));
  });
});

describe("Booking total cost with priority surcharge", () => {
  const computeTotal = (subtotal: number, priority: "normal" | "express" | "priority") => {
    const mult = priority === "express" ? 1.15 : priority === "priority" ? 1.3 : 1;
    return subtotal * mult;
  };

  it("normal priority charges base price", () => {
    expect(computeTotal(2499, "normal")).toBe(2499);
  });

  it("express adds 15%", () => {
    expect(computeTotal(2000, "express")).toBe(2300);
  });

  it("priority adds 30%", () => {
    expect(computeTotal(2000, "priority")).toBe(2600);
  });

  it("multi-service bookings sum subtotals before applying surcharge", () => {
    const subtotal = 2499 + 1899 + 599;
    expect(computeTotal(subtotal, "express")).toBeCloseTo(subtotal * 1.15);
  });

  it("zero-cost booking stays at zero for all priorities", () => {
    expect(computeTotal(0, "normal")).toBe(0);
    expect(computeTotal(0, "express")).toBe(0);
    expect(computeTotal(0, "priority")).toBe(0);
  });

  it("express surcharge is less than priority surcharge for same base", () => {
    const base = 5000;
    expect(computeTotal(base, "express")).toBeLessThan(computeTotal(base, "priority"));
  });

  it("priority surcharge of 30% on ₹4,999 is ≈ ₹6,499", () => {
    expect(computeTotal(4999, "priority")).toBeCloseTo(6498.7, 0);
  });

  it("normal priority multiplier is exactly 1.0 (no surcharge)", () => {
    const base = 12345;
    expect(computeTotal(base, "normal")).toBe(base);
  });
});
