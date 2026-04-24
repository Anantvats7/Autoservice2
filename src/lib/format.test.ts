import { describe, it, expect } from "vitest";
import { formatINR, formatDate, formatDateTime, formatTime, timeAgo, initials } from "@/lib/format";

describe("formatINR", () => {
  it("formats whole numbers with the rupee sign and Indian grouping", () => {
    expect(formatINR(2499)).toBe("₹2,499");
    expect(formatINR(125000)).toBe("₹1,25,000");
  });

  it("returns ₹0 for null or undefined", () => {
    expect(formatINR(null)).toBe("₹0");
    expect(formatINR(undefined)).toBe("₹0");
  });

  it("strips fractional rupees", () => {
    expect(formatINR(2499.75)).toBe("₹2,500");
  });

  it("formats ₹0 exactly", () => {
    expect(formatINR(0)).toBe("₹0");
  });

  it("formats large crore-range values with Indian grouping", () => {
    // 1,00,00,000 = 1 crore
    expect(formatINR(10000000)).toBe("₹1,00,00,000");
  });

  it("formats single-digit values", () => {
    expect(formatINR(5)).toBe("₹5");
  });

  it("rounds .5 up (standard rounding)", () => {
    expect(formatINR(999.5)).toBe("₹1,000");
  });
});

describe("formatDate", () => {
  it("formats an ISO string as DD-MMM-YYYY", () => {
    const out = formatDate("2026-04-19T10:00:00Z");
    expect(out).toMatch(/19 Apr 2026|20 Apr 2026/);
  });

  it("accepts a Date object directly", () => {
    const d = new Date("2026-01-01T00:00:00Z");
    const out = formatDate(d);
    expect(out).toMatch(/Jan 2026/);
  });

  it("formats December correctly", () => {
    const out = formatDate("2025-12-25T00:00:00Z");
    expect(out).toMatch(/Dec 2025/);
  });
});

describe("formatDateTime", () => {
  it("includes both date and time components", () => {
    const out = formatDateTime("2026-04-19T14:30:00Z");
    expect(out).toMatch(/Apr 2026/);
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });

  it("accepts a Date object", () => {
    const d = new Date("2026-06-15T09:00:00Z");
    const out = formatDateTime(d);
    expect(out).toMatch(/Jun 2026/);
  });
});

describe("formatTime", () => {
  it("returns a string with hour and minute", () => {
    const out = formatTime("2026-04-19T10:30:00Z");
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });

  it("accepts a Date object", () => {
    const d = new Date("2026-04-19T08:45:00Z");
    const out = formatTime(d);
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for the current moment", () => {
    expect(timeAgo(new Date())).toBe("just now");
  });

  it("returns 'just now' for 30 seconds ago", () => {
    expect(timeAgo(new Date(Date.now() - 30 * 1000))).toBe("just now");
  });

  it("returns minutes ago for recent past", () => {
    const fiveMin = new Date(Date.now() - 5 * 60 * 1000);
    expect(timeAgo(fiveMin)).toBe("5m ago");
  });

  it("returns '59m ago' for 59 minutes ago", () => {
    expect(timeAgo(new Date(Date.now() - 59 * 60 * 1000))).toBe("59m ago");
  });

  it("returns hours ago", () => {
    const twoHrs = new Date(Date.now() - 2 * 3600 * 1000);
    expect(timeAgo(twoHrs)).toBe("2h ago");
  });

  it("returns '23h ago' for 23 hours ago", () => {
    expect(timeAgo(new Date(Date.now() - 23 * 3600 * 1000))).toBe("23h ago");
  });

  it("returns days ago for dates within the past week", () => {
    const threeDays = new Date(Date.now() - 3 * 86400 * 1000);
    expect(timeAgo(threeDays)).toBe("3d ago");
  });

  it("returns a formatted date for dates older than 7 days", () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400 * 1000);
    const result = timeAgo(twoWeeksAgo);
    // Should fall back to formatDate output, e.g. "06 Apr 2026"
    expect(result).toMatch(/\d{2} \w{3} \d{4}/);
  });

  it("accepts an ISO string as input", () => {
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    expect(timeAgo(recent)).toBe("1m ago");
  });
});

describe("initials", () => {
  it("returns the first letter of up to two words", () => {
    expect(initials("Aarav Kapoor")).toBe("AK");
    expect(initials("Rohan")).toBe("R");
    expect(initials("Priya Mehta Verma")).toBe("PM");
  });

  it("returns ? for empty input", () => {
    expect(initials(null)).toBe("?");
    expect(initials("")).toBe("?");
    expect(initials("  ")).toBe("?");
  });

  it("uppercases the initials", () => {
    expect(initials("aarav kapoor")).toBe("AK");
  });

  it("handles names with multiple spaces between words", () => {
    expect(initials("Rohan  Singh")).toBe("RS");
  });

  it("handles single-character names", () => {
    expect(initials("X")).toBe("X");
  });

  it("limits result to 2 initials even for many-word names", () => {
    expect(initials("Vijay Kumar Sharma Gupta")).toBe("VK");
  });
});
