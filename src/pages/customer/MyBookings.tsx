// Customer bookings list with QR pass buttons (drop-off + pick-up).
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Calendar, MapPin, CheckCircle, Loader2, AlertCircle, QrCode, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatINR } from "@/lib/format";
import { toast } from "sonner";
import BookingQRDialog from "@/components/BookingQRDialog";

interface Booking {
  id: string;
  customer_id: string;
  vehicle_id: string;
  service_id: string;
  scheduled_at: string;
  status: string;
  priority: "normal" | "express" | "priority";
  total_cost: number | null;
  notes: string | null;
}

interface Vehicle { id: string; make: string; model: string; registration: string; }
interface Service { id: string; name: string; duration_minutes: number; }

const tabs = ["All", "Upcoming", "In Progress", "Past", "Cancelled"] as const;
type Tab = typeof tabs[number];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "text-amber-600 bg-amber-50" },
  confirmed: { label: "Confirmed", cls: "text-on-surface bg-surface-container" },
  checked_in: { label: "Checked In", cls: "text-primary bg-primary/10" },
  in_progress: { label: "In Progress", cls: "text-primary bg-primary/10" },
  ready_for_pickup: { label: "Ready for Pickup", cls: "text-emerald-600 bg-emerald-50" },
  completed: { label: "Completed", cls: "text-emerald-600 bg-emerald-50" },
  released: { label: "Released", cls: "text-emerald-700 bg-emerald-50" },
  cancelled: { label: "Cancelled", cls: "text-destructive bg-destructive/10" },
};

const CustomerBookings = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("All");
  const [qr, setQr] = useState<{ id: string; type: "dropoff" | "pickup" } | null>(null);

  const { data: bookings, loading, refetch } = useLiveTable<Booking>("bookings", (q) => q.eq("customer_id", user?.id ?? "").order("scheduled_at", { ascending: false }), [user?.id], { enabled: !!user });
  const { data: vehiclesArr } = useLiveTable<Vehicle>("vehicles", (q) => q.eq("owner_id", user?.id ?? ""), [user?.id], { enabled: !!user });
  const { data: servicesArr } = useLiveTable<Service>("services", (q) => q);

  // Refetch when the page becomes visible (e.g. navigating back from AI chat)
  useEffect(() => {
    const onFocus = () => refetch();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refetch();
    });
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

  const vehicles = useMemo(() => { const m: Record<string, Vehicle> = {}; vehiclesArr.forEach((v) => { m[v.id] = v; }); return m; }, [vehiclesArr]);
  const services = useMemo(() => { const m: Record<string, Service> = {}; servicesArr.forEach((s) => { m[s.id] = s; }); return m; }, [servicesArr]);

  // Optimistic overrides for instant cancel feedback
  const [optimistic, setOptimistic] = useState<Record<string, Partial<Booking>>>({});
  useEffect(() => { setOptimistic({}); }, [bookings]);

  // Refetch on mount to catch bookings created from other pages (e.g. AI chat)
  useEffect(() => {
    if (user) refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const displayed = useMemo(
    () => bookings.map((b) => optimistic[b.id] ? { ...b, ...optimistic[b.id] } : b),
    [bookings, optimistic]
  );

  const filtered = displayed.filter((b) => {
    if (tab === "All") return true;
    if (tab === "Upcoming") return ["pending", "confirmed"].includes(b.status);
    if (tab === "In Progress") return ["checked_in", "in_progress", "ready_for_pickup"].includes(b.status);
    if (tab === "Past") return ["completed", "released"].includes(b.status);
    if (tab === "Cancelled") return b.status === "cancelled";
    return true;
  });

  const cancel = async (id: string) => {
    if (!confirm("Cancel this booking?")) return;
    // Optimistic update
    setOptimistic((prev) => ({ ...prev, [id]: { ...prev[id], status: "cancelled" } }));
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) {
      setOptimistic((prev) => { const { [id]: _, ...next } = prev; return next; });
      toast.error(error.message);
    } else {
      toast.success("Booking cancelled");
    }
  };

  const counts = {
    upcoming: displayed.filter((b) => ["pending", "confirmed"].includes(b.status)).length,
    inprog: displayed.filter((b) => ["checked_in", "in_progress", "ready_for_pickup"].includes(b.status)).length,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">My Bookings</h1>
          <p className="text-sm text-muted-foreground mt-1">{counts.inprog} in progress, {counts.upcoming} upcoming.</p>
        </div>
        <Link to="/customer/book" className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all self-start">
          <Plus className="w-4 h-4" /> Book New
        </Link>
      </div>

      {/* AI Booking Shortcut Banner */}
      {filtered.length === 0 && (
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-xl border border-primary/20 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">Try booking with AI</p>
                <p className="text-xs text-muted-foreground">Just say "book an oil change" and let our AI handle the rest</p>
              </div>
            </div>
            <Link
              to="/customer/assistant"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 shrink-0"
            >
              Try AI Assistant
            </Link>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-all ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-on-surface"}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border/30 rounded-xl">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-bold text-on-surface">No bookings in this view</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Schedule a service to get started.</p>
          <Link to="/customer/book" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-bold">
            <Plus className="w-4 h-4" /> Book Service
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((b) => {
            const v = vehicles[b.vehicle_id];
            const s = services[b.service_id];
            const badge = STATUS_LABEL[b.status] ?? { label: b.status, cls: "bg-surface-container text-on-surface" };
            const showDropoffQR = ["pending", "confirmed"].includes(b.status);
            const showPickupQR = b.status === "ready_for_pickup";

            return (
              <div key={b.id} className={`bg-card p-5 rounded-xl border ${b.status === "in_progress" ? "border-2 border-primary/30" : "border-border/20"} shadow-sm hover:shadow-md transition-all`}>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${badge.cls}`}>
                    {b.status === "in_progress" && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                    {badge.label}
                  </span>
                  {b.priority !== "normal" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-amber-50 text-amber-600">{b.priority}</span>
                  )}
                </div>
                <h4 className="font-bold text-on-surface mb-1">{s?.name ?? "Service"}</h4>
                <p className="text-xs font-mono text-muted-foreground mb-3">{v ? `${v.make} ${v.model} • ${v.registration}` : "Vehicle"}</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2"><Calendar className="w-3 h-3" /> {formatDateTime(b.scheduled_at)}</div>
                  <div className="flex items-center gap-2"><MapPin className="w-3 h-3" /> AutoServe Gurugram</div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-sm font-black font-mono text-on-surface">{formatINR(b.total_cost)}</span>
                  <div className="flex gap-2">
                    {showDropoffQR && (
                      <button onClick={() => setQr({ id: b.id, type: "dropoff" })} className="px-3 py-1.5 text-xs font-bold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 flex items-center gap-1 active:scale-[0.98] transition-all">
                        <QrCode className="w-3.5 h-3.5" /> Drop-off QR
                      </button>
                    )}
                    {showPickupQR && (
                      <button onClick={() => setQr({ id: b.id, type: "pickup" })} className="px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-500/30 rounded-lg hover:bg-emerald-50 flex items-center gap-1 active:scale-[0.98] transition-all">
                        <ShieldCheck className="w-3.5 h-3.5" /> Pickup QR
                      </button>
                    )}
                    {["pending", "confirmed"].includes(b.status) && (
                      <button onClick={() => cancel(b.id)} className="px-3 py-1.5 text-xs font-bold text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/5 active:scale-[0.98] transition-all">Cancel</button>
                    )}
                  </div>
                </div>

                {b.status === "in_progress" && (
                  <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10 flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                    <span className="text-on-surface font-medium">Vehicle in workshop. We'll notify you when it's ready for pickup.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {qr && <BookingQRDialog bookingId={qr.id} type={qr.type} onClose={() => setQr(null)} />}
    </div>
  );
};

export default CustomerBookings;
