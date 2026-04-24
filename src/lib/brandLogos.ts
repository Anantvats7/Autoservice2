// Maps an Indian car make to a public CDN logo URL (carlogos.org). Falls back to a generic car icon name.
export const BRAND_LOGOS: Record<string, string> = {
  "Maruti Suzuki": "https://www.carlogos.org/car-logos/maruti-suzuki-logo.png",
  "Maruti": "https://www.carlogos.org/car-logos/maruti-suzuki-logo.png",
  "Suzuki": "https://www.carlogos.org/car-logos/suzuki-logo.png",
  "Tata": "https://www.carlogos.org/car-logos/tata-logo.png",
  "Mahindra": "https://www.carlogos.org/car-logos/mahindra-logo.png",
  "Hyundai": "https://www.carlogos.org/car-logos/hyundai-logo.png",
  "Honda": "https://www.carlogos.org/car-logos/honda-logo.png",
  "Toyota": "https://www.carlogos.org/car-logos/toyota-logo.png",
  "Kia": "https://www.carlogos.org/car-logos/kia-logo.png",
  "MG": "https://www.carlogos.org/car-logos/mg-logo.png",
  "Renault": "https://www.carlogos.org/car-logos/renault-logo.png",
  "Volkswagen": "https://www.carlogos.org/car-logos/volkswagen-logo.png",
  "Skoda": "https://www.carlogos.org/car-logos/skoda-logo.png",
  "BMW": "https://www.carlogos.org/car-logos/bmw-logo.png",
  "Mercedes-Benz": "https://www.carlogos.org/car-logos/mercedes-benz-logo.png",
  "Mercedes": "https://www.carlogos.org/car-logos/mercedes-benz-logo.png",
  "Audi": "https://www.carlogos.org/car-logos/audi-logo.png",
  "Ford": "https://www.carlogos.org/car-logos/ford-logo.png",
  "Nissan": "https://www.carlogos.org/car-logos/nissan-logo.png",
};

export function brandLogoUrl(make: string | null | undefined): string | null {
  if (!make) return null;
  const direct = BRAND_LOGOS[make];
  if (direct) return direct;
  const lower = make.toLowerCase();
  const match = Object.keys(BRAND_LOGOS).find((k) => k.toLowerCase() === lower || lower.includes(k.toLowerCase()));
  return match ? BRAND_LOGOS[match] : null;
}
