// Suggests related services based on the service the customer just picked.
// Pure client-side heuristics — no API call needed.
export const RELATED_BY_CATEGORY: Record<string, string[]> = {
  Maintenance: ["Diagnostics", "Cleaning", "Tyres", "AC"],
  Engine: ["Diagnostics", "Maintenance", "Electrical"],
  Brakes: ["Tyres", "Maintenance"],
  Tyres: ["Brakes", "Maintenance"],
  Electrical: ["Diagnostics", "AC"],
  AC: ["Electrical", "Maintenance"],
  Repair: ["Diagnostics", "Maintenance"],
  Diagnostics: ["Engine", "Electrical", "Maintenance"],
  Cleaning: ["Maintenance"],
  Body: ["Cleaning"],
  Inspection: ["Maintenance", "Diagnostics"],
};

export interface ServiceLite {
  id: string;
  name: string;
  category: string;
  price: number;
}

export function recommendRelated(
  picked: ServiceLite | undefined,
  all: ServiceLite[],
  alreadySelected: Set<string>,
  limit = 3
): ServiceLite[] {
  if (!picked) return [];
  const wantedCats = new Set(RELATED_BY_CATEGORY[picked.category] ?? []);
  return all
    .filter(
      (s) =>
        s.id !== picked.id &&
        !alreadySelected.has(s.id) &&
        (wantedCats.has(s.category) || s.category === picked.category)
    )
    .sort((a, b) => a.price - b.price)
    .slice(0, limit);
}

// Priority surcharge: 0% normal, 15% express, 30% priority (industry standard).
export const PRIORITY_MULTIPLIER: Record<string, number> = {
  normal: 1,
  express: 1.15,
  priority: 1.3,
};

export function priorityLabel(p: string) {
  if (p === "express") return "Express (+15%)";
  if (p === "priority") return "Priority (+30%)";
  return "Normal";
}
