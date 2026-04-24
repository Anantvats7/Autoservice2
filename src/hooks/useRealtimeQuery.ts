import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type TableName =
  | "bookings"
  | "vehicles"
  | "services"
  | "inventory"
  | "service_history"
  | "service_reminders"
  | "notifications"
  | "user_roles"
  | "profiles";

interface Options {
  enabled?: boolean;
  realtime?: boolean;
}

/**
 * Generic live-query hook. Builds query via callback, subscribes to table changes for instant updates.
 */
export function useLiveTable<T = any>(
  table: TableName,
  build: (q: any) => any,
  deps: any[] = [],
  opts: Options = {}
) {
  const { enabled = true, realtime = true } = opts;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const buildRef = useRef(build);
  buildRef.current = build;

  const refetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      const q = buildRef.current(supabase.from(table).select("*"));
      const { data: rows, error } = await q;
      if (error) throw error;
      setData((rows ?? []) as T[]);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, table]);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    if (!realtime || !enabled) return;
    const channel = supabase
      .channel(`live-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, realtime, table, ...deps]);

  return { data, loading, error, refetch };
}
