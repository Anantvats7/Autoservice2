/**
 * Inventory domain logic tests.
 * Tests low-stock detection, SKU format validation, reorder math,
 * and stock-adjustment calculations used in the workshop management flow.
 */
import { describe, it, expect } from "vitest";

// ---- Domain helpers (pure functions, mirroring the Inventory page logic) ----

/** Returns true when an inventory item's quantity is at or below its reorder level. */
function isLowStock(quantity: number, reorderLevel: number): boolean {
  return quantity <= reorderLevel;
}

/** Returns true when stock has run out entirely. */
function isOutOfStock(quantity: number): boolean {
  return quantity <= 0;
}

/**
 * Validates an AutoServe SKU format.
 * Acceptable format: UPPERCASE-letters separated by hyphens, e.g. OIL-5W30-1L
 */
function isValidSku(sku: string): boolean {
  return /^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(sku);
}

/** Returns the total value of an inventory item (quantity × unit_price). */
function stockValue(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

/** Returns the number of units needed to reach the safe stock level (reorder_level × 2). */
function reorderQuantity(quantity: number, reorderLevel: number): number {
  const target = reorderLevel * 2;
  return Math.max(0, target - quantity);
}

/** Clamps a quantity adjustment – quantity must stay ≥ 0. */
function adjustStock(current: number, delta: number): number {
  return Math.max(0, current + delta);
}

// ---- Tests ----------------------------------------------------------------

describe("isLowStock", () => {
  it("returns true when quantity equals reorder level", () => {
    expect(isLowStock(20, 20)).toBe(true);
  });

  it("returns true when quantity is below reorder level", () => {
    expect(isLowStock(5, 20)).toBe(true);
  });

  it("returns false when quantity exceeds reorder level", () => {
    expect(isLowStock(84, 20)).toBe(false);
  });

  it("returns true when quantity is 0 (regardless of reorder level)", () => {
    expect(isLowStock(0, 0)).toBe(true);
    expect(isLowStock(0, 5)).toBe(true);
  });

  it("handles reorder level of 0 (any positive quantity is fine)", () => {
    expect(isLowStock(1, 0)).toBe(false);
    expect(isLowStock(0, 0)).toBe(true);
  });
});

describe("isOutOfStock", () => {
  it("returns true for quantity 0", () => {
    expect(isOutOfStock(0)).toBe(true);
  });

  it("returns false for any positive quantity", () => {
    expect(isOutOfStock(1)).toBe(false);
    expect(isOutOfStock(100)).toBe(false);
  });

  it("returns true for negative quantity (should not occur in practice)", () => {
    expect(isOutOfStock(-1)).toBe(true);
  });
});

describe("isValidSku", () => {
  it("accepts well-formed SKU strings", () => {
    expect(isValidSku("OIL-5W30-1L")).toBe(true);
    expect(isValidSku("TYRE-195-65-R15")).toBe(true);
    expect(isValidSku("FILTER-AIR")).toBe(true);
    expect(isValidSku("BRAKE-PAD-FRONT")).toBe(true);
    expect(isValidSku("COOLANT")).toBe(true);
  });

  it("rejects lowercase SKUs", () => {
    expect(isValidSku("oil-5w30")).toBe(false);
  });

  it("rejects SKUs with special characters", () => {
    expect(isValidSku("OIL 5W30")).toBe(false);
    expect(isValidSku("OIL/5W30")).toBe(false);
    expect(isValidSku("OIL_5W30")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidSku("")).toBe(false);
  });

  it("accepts purely alphanumeric SKU (no hyphens)", () => {
    expect(isValidSku("COOLANT1L")).toBe(true);
  });
});

describe("stockValue", () => {
  it("calculates quantity × unit_price correctly", () => {
    expect(stockValue(84, 650)).toBe(54600);
    expect(stockValue(8, 4500)).toBe(36000);
  });

  it("returns 0 for zero quantity", () => {
    expect(stockValue(0, 1000)).toBe(0);
  });

  it("returns 0 for zero unit price", () => {
    expect(stockValue(50, 0)).toBe(0);
  });

  it("handles fractional prices correctly", () => {
    expect(stockValue(3, 299.5)).toBeCloseTo(898.5);
  });
});

describe("reorderQuantity", () => {
  it("returns units needed to reach double the reorder level", () => {
    // reorder_level=20, quantity=5 → target=40 → need 35
    expect(reorderQuantity(5, 20)).toBe(35);
  });

  it("returns 0 when already at or above target", () => {
    expect(reorderQuantity(40, 20)).toBe(0);
    expect(reorderQuantity(100, 20)).toBe(0);
  });

  it("returns full target when quantity is 0", () => {
    expect(reorderQuantity(0, 10)).toBe(20);
  });

  it("returns 0 for reorder_level of 0", () => {
    expect(reorderQuantity(0, 0)).toBe(0);
  });
});

describe("adjustStock", () => {
  it("increases stock correctly", () => {
    expect(adjustStock(84, 10)).toBe(94);
  });

  it("decreases stock correctly", () => {
    expect(adjustStock(84, -10)).toBe(74);
  });

  it("clamps to 0 when delta would make stock negative", () => {
    expect(adjustStock(5, -10)).toBe(0);
  });

  it("allows stock to reach exactly 0", () => {
    expect(adjustStock(5, -5)).toBe(0);
  });

  it("handles zero delta (no-op)", () => {
    expect(adjustStock(50, 0)).toBe(50);
  });
});
