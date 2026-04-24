import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Users, CheckCircle, Zap, Filter, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { useProfilesByRole } from "@/hooks/useStaff";
import { formatDateTime, formatINR } from "@/lib/format";
import { toast } from "sonner";

interface Booking {
  id: string; status: string; priority: string; scheduled_at: string;
  service_id: string; vehicle_id: string; customer_id: string;
  assigned_to: string | null; total_cost: number | null;
}
interface Vehicle { id: string; make: string; model: string; year: number; registration: string; }
interface Service { id: string; name: string; }

const tabs = ["All", "pending", "confirmed", "checked_in", "in_progress", "ready_for_pickup", "completed", "released", "cancelled"] as const;
const ALL_STATUSES = ["pending", "confirmed", "checked_in", "in_progress", "ready_for_pickup", "completed", "released", "cancelled"] as const;

const statusColor: Record<string, string> = {
  pending: "text-amber-600 bg-amber-50",
  confirmed: "text-primary bg-primary/10",
  checked_in: "text-primary bg-primary/10",
  in_progress: "text-primary bg-primary/10",
  ready_for_pickup: "text-emerald-600 bg-emerald-50",
  completed: "text-emerald-600 bg-emerald-50",
  released: "text-emerald-700 bg-emerald-50",
  cancelled: "text-destructive bg-destructive/10",
};

const ManagerBookings = () => {
  const [activeTab, setActiveTab] = useState<string>("All");
  const [search, setSearch] = useState("");
  const { data: bookings, refetch: refetchBookings } = useLiveTable<Booking>("bookings", (q) => q.order("scheduled_at", { ascending: false }));
  const { data: vehicles } = useLiveTable<Vehicle>("vehicles", (q) => q);
  const { data: services } = useLiveTable<Service>("services", (q) => q);
  const { profiles: technicians, byId } = useProfilesByRole("employee");

  // Optimistic overrides: applied instantly on mutation, cleared when fresh data arrives
  const [optimistic, setOptimistic] = useState<Record<string, Partial<Booking>>>({});
  useEffect(() => { setOptimistic({}); }, [bookings]);

  const displayedBookings = useMemo(
    () => bookings.map((b) => optimistic[b.id] ? { ...b, ...optimistic[b.id] } : b),
    [bookings, optimistic]
  );

  const filtered = useMemo(() => {
    return displayedBookings.filter((b) => {
      if (activeTab !== "All" && b.status !== activeTab) return false;
      if (search) {
        const v = vehicles.find((x) => x.id === b.vehicle_id);
        const c = byId[b.customer_id];
        const s = services.find((x) => x.id === b.service_id);
        const hay = `${v?.registration ?? ""} ${v?.make ?? ""} ${v?.model ?? ""} ${c?.full_name ?? ""} ${s?.name ?? ""} ${b.id}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [displayedBookings, activeTab, search, vehicles, services, byId]);

  const assign = async (b: Booking, techId: string) => {
    const newStatus = techId && b.status === "pending" ? "confirmed" : (b.status as any);
    // Optimistic update
    setOptimistic((prev) => ({ ...prev, [b.id]: { ...prev[b.id], assigned_to: techId || null, status: newStatus } }));
    const { error } = await supabase.from("bookings").update({
      assigned_to: techId || null,
      status: newStatus,
    }).eq("id", b.id);
    if (error) {
      setOptimistic((prev) => { const next = { ...prev }; delete next[b.id]; return next; });
      toast.error(error.message);
      return;
    }
    toast.success(techId ? "Technician assigned" : "Unassigned");
    refetchBookings();
    if (techId) {
      await supabase.from("notifications").insert({
        user_id: techId,
        title: "New Job Assigned",
        message: `You have been assigned booking #${b.id.slice(0, 6).toUpperCase()}.`,
        type: "info",
      });
    }
  };

  const updateStatus = async (b: Booking, status: string) => {
    // Optimistic update
    setOptimistic((prev) => ({ ...prev, [b.id]: { ...prev[b.id], status } }));
    const { error } = await supabase.from("bookings").update({ status: status as any }).eq("id", b.id);
    if (error) {
      setOptimistic((prev) => { const next = { ...prev }; delete next[b.id]; return next; });
      toast.error(error.message);
    } else {
      toast.success(`Status → ${status.replace(/_/g, " ")}`);
      refetchBookings();
    }
  };

  const counts = {
    pending: displayedBookings.filter((b) => b.status === "pending" || b.status === "confirmed").length,
    in_progress: displayedBookings.filter((b) => b.status === "in_progress" || b.status === "checked_in" || b.status === "ready_for_pickup").length,
    completed: displayedBookings.filter((b) => b.status === "completed" || b.status === "released").length,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Service Bookings</h1>
        <p className="text-sm text-muted-foreground mt-1">Assign technicians, monitor progress, and manage every job in real-time.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total Bookings" value={String(bookings.length)} icon={ClipboardList} bg="bg-primary/10" color="text-primary" />
        <Kpi label="Pending" value={String(counts.pending)} icon={Users} bg="bg-amber-50" color="text-amber-600" />
        <Kpi label="In Progress" value={String(counts.in_progress)} icon={Zap} bg="bg-primary/10" color="text-primary" />
        <Kpi label="Completed" value={String(counts.completed)} icon={CheckCircle} bg="bg-emerald-50" color="text-emerald-600" />
      </div>

      <div className="bg-card rounded-xl border border-border/20 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 lg:p-6 border-b border-border/20 gap-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((s) => (
              <button key={s} onClick={() => setActiveTab(s)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap capitalize transition-colors ${
                  activeTab === s ? "bg-on-surface text-card" : "text-muted-foreground bg-surface-container hover:bg-surface-container-high"
                }`}>
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              className="w-full pl-10 pr-3 py-2 bg-surface-container border border-border/20 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
                <th className="text-left py-3 px-6 font-bold">Job</th>
                <th className="text-left py-3 px-4 font-bold">Customer / Vehicle</th>
                <th className="text-left py-3 px-4 font-bold">Service</th>
                <th className="text-left py-3 px-4 font-bold">Schedule</th>
                <th className="text-left py-3 px-4 font-bold">Cost</th>
                <th className="text-left py-3 px-4 font-bold">Status</th>
                <th className="text-left py-3 px-4 font-bold">Technician</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No bookings match.</td></tr>
              )}
              {filtered.map((b) => {
                const v = vehicles.find((x) => x.id === b.vehicle_id);
                const s = services.find((x) => x.id === b.service_id);
                const c = byId[b.customer_id];
                return (
                  <tr key={b.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3 px-6">
                      <p className="text-sm font-bold font-mono text-on-surface">#{b.id.slice(0, 6).toUpperCase()}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{b.priority}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm font-semibold text-on-surface">{c?.full_name || "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{v ? `${v.year} ${v.make} ${v.model} • ${v.registration}` : "—"}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-on-surface">{s?.name || "—"}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{formatDateTime(b.scheduled_at)}</td>
                    <td className="py-3 px-4 text-sm font-mono text-on-surface">{formatINR(b.total_cost)}</td>
                    <td className="py-3 px-4">
                      <select value={b.status} onChange={(e) => updateStatus(b, e.target.value)}
                        className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border-0 cursor-pointer ${statusColor[b.status] ?? "bg-surface-container text-on-surface"}`}>
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <select value={b.assigned_to ?? ""} onChange={(e) => assign(b, e.target.value)}
                        className="text-xs bg-surface-container border border-border/30 rounded-lg px-2 py-1.5 outline-none">
                        <option value="">Unassigned</option>
                        {technicians.map((t) => (
                          <option key={t.user_id} value={t.user_id}>{t.full_name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Kpi = ({ label, value, icon: Icon, bg, color }: { label: string; value: string; icon: any; bg: string; color: string; }) => (
  <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
    <div className="flex justify-between items-start mb-3">
      <div className={`p-2 rounded-lg ${bg}`}><Icon className={`w-5 h-5 ${color}`} /></div>
    </div>
    <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">{label}</p>
    <p className="text-2xl lg:text-3xl font-black text-on-surface mt-1">{value}</p>
  </div>
);

export default ManagerBookings;
