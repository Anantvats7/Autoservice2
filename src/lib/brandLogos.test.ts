import { describe, it, expect } from "vitest";
import { brandLogoUrl, BRAND_LOGOS } from "@/lib/brandLogos";

describe("brandLogoUrl", () => {
  it("returns a CDN URL for known Indian makes", () => {
    expect(brandLogoUrl("Maruti Suzuki")).toMatch(/maruti-suzuki-logo/);
    expect(brandLogoUrl("Tata")).toMatch(/tata-logo/);
    expect(brandLogoUrl("Mahindra")).toMatch(/mahindra-logo/);
    expect(brandLogoUrl("Hyundai")).toMatch(/hyundai-logo/);
  });

  it("is case insensitive via fuzzy match", () => {
    expect(brandLogoUrl("maruti")).toBeTruthy();
    expect(brandLogoUrl("TATA MOTORS")).toBeTruthy();
    expect(brandLogoUrl("mercedes")).toMatch(/mercedes-benz-logo/);
  });

  it("returns null for unknown makes", () => {
    expect(brandLogoUrl("Unknown Make XYZ")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(brandLogoUrl(null)).toBeNull();
    expect(brandLogoUrl(undefined)).toBeNull();
    expect(brandLogoUrl("")).toBeNull();
  });

  it("covers all popular Indian-market brands", () => {
    const required = ["Maruti Suzuki", "Tata", "Mahindra", "Hyundai", "Honda", "Toyota", "Kia"];
    required.forEach((m) => expect(BRAND_LOGOS[m]).toBeDefined());
  });

  it("returns a URL for Honda", () => {
    expect(brandLogoUrl("Honda")).toMatch(/honda-logo/);
  });

  it("returns a URL for Toyota", () => {
    expect(brandLogoUrl("Toyota")).toMatch(/toyota-logo/);
  });

  it("returns a URL for Kia", () => {
    expect(brandLogoUrl("Kia")).toMatch(/kia-logo/);
  });

  it("returns a URL for MG", () => {
    expect(brandLogoUrl("MG")).toMatch(/mg-logo/);
  });

  it("returns a URL for Renault", () => {
    expect(brandLogoUrl("Renault")).toMatch(/renault-logo/);
  });

  it("returns a URL for Volkswagen", () => {
    expect(brandLogoUrl("Volkswagen")).toMatch(/volkswagen-logo/);
  });

  it("returns a URL for Skoda", () => {
    expect(brandLogoUrl("Skoda")).toMatch(/skoda-logo/);
  });

  it("returns a URL for BMW", () => {
    expect(brandLogoUrl("BMW")).toMatch(/bmw-logo/);
  });

  it("returns a URL for Mercedes-Benz", () => {
    expect(brandLogoUrl("Mercedes-Benz")).toMatch(/mercedes-benz-logo/);
  });

  it("returns a URL for Audi", () => {
    expect(brandLogoUrl("Audi")).toMatch(/audi-logo/);
  });

  it("returns a URL for Ford", () => {
    expect(brandLogoUrl("Ford")).toMatch(/ford-logo/);
  });

  it("returns a URL for Nissan", () => {
    expect(brandLogoUrl("Nissan")).toMatch(/nissan-logo/);
  });

  it("returns a URL for Suzuki (standalone brand key)", () => {
    expect(brandLogoUrl("Suzuki")).toMatch(/suzuki-logo/);
  });

  it("all BRAND_LOGOS values are valid HTTPS URLs", () => {
    Object.values(BRAND_LOGOS).forEach((url) => {
      expect(url).toMatch(/^https:\/\//);
    });
  });

  it("all BRAND_LOGOS values point to .png images", () => {
    Object.values(BRAND_LOGOS).forEach((url) => {
      expect(url.toLowerCase()).toMatch(/\.png$/);
    });
  });

  it("partial substring match works for compound makes", () => {
    // "Maruti" is a substring of "Maruti Suzuki 2022 Edition"
    expect(brandLogoUrl("Maruti Suzuki 2022 Edition")).toBeTruthy();
  });
});
