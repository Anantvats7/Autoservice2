import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (className utility)", () => {
  it("returns a single class unchanged", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("merges multiple classes into a single string", () => {
    const result = cn("px-4", "py-2", "rounded");
    expect(result).toBe("px-4 py-2 rounded");
  });

  it("deduplicates conflicting Tailwind utilities (last wins)", () => {
    // tailwind-merge resolves conflicts: second bg wins
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
    expect(cn("p-4", "p-8")).toBe("p-8");
  });

  it("handles conditional class objects (clsx)", () => {
    expect(cn({ "font-bold": true, italic: false })).toBe("font-bold");
    expect(cn({ hidden: false, block: true })).toBe("block");
  });

  it("handles arrays of classes", () => {
    const result = cn(["flex", "items-center"], "gap-4");
    expect(result).toBe("flex items-center gap-4");
  });

  it("handles undefined and null gracefully (returns empty string)", () => {
    expect(cn(undefined)).toBe("");
    expect(cn(null as any)).toBe("");
    expect(cn(undefined, null as any, "text-base")).toBe("text-base");
  });

  it("handles empty call (no arguments)", () => {
    expect(cn()).toBe("");
  });

  it("merges padding shorthand and longhands (last write wins)", () => {
    // px-4 and py-4 are independent; p-2 overrides both → p-2 wins
    expect(cn("px-4", "py-4", "p-2")).toBe("p-2");
  });

  it("preserves non-conflicting utilities", () => {
    const result = cn("flex", "flex-col", "gap-2", "bg-white");
    expect(result).toContain("flex");
    expect(result).toContain("flex-col");
    expect(result).toContain("gap-2");
    expect(result).toContain("bg-white");
  });

  it("handles boolean conditions for conditional classes", () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn(
      "base-class",
      isActive && "active",
      isDisabled && "disabled"
    );
    expect(result).toContain("base-class");
    expect(result).toContain("active");
    expect(result).not.toContain("disabled");
  });
});
