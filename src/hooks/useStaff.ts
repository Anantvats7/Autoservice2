import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StaffProfile {
  user_id: string;
  full_name: string;
  role: "manager" | "employee" | "customer";
  phone: string | null;
}

/**
 * Fetches profiles + their roles, returns a map and array.
 * Subscribes to realtime changes on profiles and user_roles so the list
 * auto-updates whenever a new employee is added or a role changes.
 */
export function useProfilesByRole(role?: "manager" | "employee" | "customer") {
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [byId, setById] = useState<Record<string, StaffProfile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap: Record<string, StaffProfile["role"]> = {};
      (roles ?? []).forEach((r: any) => { roleMap[r.user_id] = r.role; });
      const merged: StaffProfile[] = (profs ?? []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name || "Unknown",
        phone: p.phone,
        role: roleMap[p.user_id] ?? "customer",
      }));
      const filtered = role ? merged.filter((m) => m.role === role) : merged;
      if (cancelled) return;
      setProfiles(filtered);
      const map: Record<string, StaffProfile> = {};
      merged.forEach((m) => { map[m.user_id] = m; });
      setById(map);
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel(`staff-${role ?? "all"}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { if (!cancelled) load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => { if (!cancelled) load(); })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [role]);

  return { profiles, byId, loading };
}
