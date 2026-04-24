import { describe, it, expect } from "vitest";
import { recommendRelated, PRIORITY_MULTIPLIER, priorityLabel, RELATED_BY_CATEGORY } from "@/lib/recommendations";

const catalog = [
  { id: "1", name: "Basic Service", category: "Maintenance", price: 2499 },
  { id: "2", name: "Diagnostic Scan", category: "Diagnostics", price: 599 },
  { id: "3", name: "Wheel Alignment", category: "Tyres", price: 799 },
  { id: "4", name: "AC Service", category: "AC", price: 1899 },
  { id: "5", name: "Engine Tuning", category: "Engine", price: 4999 },
  { id: "6", name: "Brake Pads", category: "Brakes", price: 3499 },
  { id: "7", name: "Interior Cleaning", category: "Cleaning", price: 999 },
  { id: "8", name: "Full Body Repair", category: "Body", price: 15000 },
  { id: "9", name: "Annual Inspection", category: "Inspection", price: 1499 },
  { id: "10", name: "Electrical Repair", category: "Electrical", price: 2999 },
  { id: "11", name: "Dent Repair", category: "Repair", price: 3000 },
];

describe("recommendRelated", () => {
  it("returns related categories for a Maintenance pick", () => {
    const picked = catalog[0];
    const recs = recommendRelated(picked, catalog, new Set([picked.id]), 3);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(3);
    // Should not include the picked service
    expect(recs.find((r) => r.id === picked.id)).toBeUndefined();
    // Recommended categories must come from the related-map
    const allowed = new Set([...(RELATED_BY_CATEGORY["Maintenance"] ?? []), "Maintenance"]);
    recs.forEach((r) => expect(allowed.has(r.category)).toBe(true));
  });

  it("excludes already-selected services", () => {
    const picked = catalog[0];
    const selected = new Set([picked.id, catalog[1].id, catalog[2].id]);
    const recs = recommendRelated(picked, catalog, selected, 3);
    recs.forEach((r) => expect(selected.has(r.id)).toBe(false));
  });

  it("returns an empty list when no service is picked", () => {
    expect(recommendRelated(undefined, catalog, new Set())).toEqual([]);
  });

  it("recommends Brakes and Maintenance for a Tyres pick", () => {
    const picked = catalog[2]; // Wheel Alignment / Tyres
    const recs = recommendRelated(picked, catalog, new Set([picked.id]), 3);
    const cats = recs.map((r) => r.category);
    expect(cats.some((c) => ["Brakes", "Maintenance"].includes(c))).toBe(true);
  });

  it("respects the custom limit parameter", () => {
    const picked = catalog[0];
    const recs = recommendRelated(picked, catalog, new Set([picked.id]), 2);
    expect(recs.length).toBeLessThanOrEqual(2);
  });

  it("sorts recommendations by ascending price", () => {
    const picked = catalog[0]; // Maintenance
    const recs = recommendRelated(picked, catalog, new Set([picked.id]), 10);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i].price).toBeGreaterThanOrEqual(recs[i - 1].price);
    }
  });

  it("returns empty when the entire catalog is already selected", () => {
    const picked = catalog[0];
    const allSelected = new Set(catalog.map((s) => s.id));
    const recs = recommendRelated(picked, catalog, allSelected);
    expect(recs).toHaveLength(0);
  });

  it("returns at most `limit` items even when many related services exist", () => {
    const picked = catalog[0]; // Maintenance has many related
    const recs = recommendRelated(picked, catalog, new Set([picked.id]), 1);
    expect(recs.length).toBeLessThanOrEqual(1);
  });

  it("recommends Diagnostics and Maintenance for an Engine pick", () => {
    const enginePick = catalog[4]; // Engine Tuning
    const recs = recommendRelated(enginePick, catalog, new Set([enginePick.id]), 5);
    const cats = recs.map((r) => r.category);
    expect(cats.some((c) => ["Diagnostics", "Maintenance"].includes(c))).toBe(true);
  });

  it("recommends Electrical and Maintenance for an AC pick", () => {
    const acPick = catalog[3]; // AC Service
    const recs = recommendRelated(acPick, catalog, new Set([acPick.id]), 5);
    const cats = recs.map((r) => r.category);
    expect(cats.some((c) => ["Electrical", "Maintenance"].includes(c))).toBe(true);
  });
});

describe("RELATED_BY_CATEGORY", () => {
  it("covers all 11 expected service categories", () => {
    const expected = [
      "Maintenance", "Engine", "Brakes", "Tyres",
      "Electrical", "AC", "Repair", "Diagnostics",
      "Cleaning", "Body", "Inspection",
    ];
    expected.forEach((cat) => expect(RELATED_BY_CATEGORY[cat]).toBeDefined());
  });

  it("each category maps to a non-empty array of related categories", () => {
    Object.entries(RELATED_BY_CATEGORY).forEach(([, related]) => {
      expect(Array.isArray(related)).toBe(true);
      expect(related.length).toBeGreaterThan(0);
    });
  });
});

describe("PRIORITY_MULTIPLIER", () => {
  it("normal has no surcharge", () => expect(PRIORITY_MULTIPLIER.normal).toBe(1));
  it("express adds 15%", () => expect(PRIORITY_MULTIPLIER.express).toBeCloseTo(1.15));
  it("priority adds 30%", () => expect(PRIORITY_MULTIPLIER.priority).toBeCloseTo(1.3));

  it("computes correct surcharge for ₹10,000", () => {
    const base = 10000;
    expect(base * (PRIORITY_MULTIPLIER.express - 1)).toBeCloseTo(1500);
    expect(base * (PRIORITY_MULTIPLIER.priority - 1)).toBeCloseTo(3000);
  });

  it("express surcharge is always less than priority surcharge", () => {
    expect(PRIORITY_MULTIPLIER.express).toBeLessThan(PRIORITY_MULTIPLIER.priority);
  });

  it("contains exactly the three priority keys", () => {
    const keys = Object.keys(PRIORITY_MULTIPLIER);
    expect(keys).toContain("normal");
    expect(keys).toContain("express");
    expect(keys).toContain("priority");
    expect(keys).toHaveLength(3);
  });
});

describe("priorityLabel", () => {
  it("returns labelled strings", () => {
    expect(priorityLabel("normal")).toBe("Normal");
    expect(priorityLabel("express")).toBe("Express (+15%)");
    expect(priorityLabel("priority")).toBe("Priority (+30%)");
  });

  it("defaults to 'Normal' for unknown values", () => {
    expect(priorityLabel("unknown")).toBe("Normal");
    expect(priorityLabel("")).toBe("Normal");
  });
});
