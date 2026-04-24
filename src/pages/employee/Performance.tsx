import { TrendingUp, Clock, CheckCircle, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { useProfilesByRole } from "@/hooks/useStaff";
import { formatINR, formatDate } from "@/lib/format";

interface History {
  id: string; service_date: string; cost: number; service_id: string; vehicle_id: string;
  customer_id: string; technician_id: string | null; notes: string | null;
}
interface Vehicle { id: string; make: string; model: string; year: number; }
interface Service { id: string; name: string; duration_minutes: number; }
interface Booking { id: string; status: string; assigned_to: string | null; }

const EmployeePerformance = () => {
  const { user } = useAuth();
  const { data: history } = useLiveTable<History>(
    "service_history",
    (q) => q.eq("technician_id", user?.id).order("service_date", { ascending: false }),
    [user?.id],
    { enabled: !!user }
  );
  const { data: bookings } = useLiveTable<Booking>(
    "bookings",
    (q) => q.eq("assigned_to", user?.id),
    [user?.id],
    { enabled: !!user }
  );
  const { data: vehicles } = useLiveTable<Vehicle>("vehicles", (q) => q);
  const { data: services } = useLiveTable<Service>("services", (q) => q);
  const { byId } = useProfilesByRole();

  // Compute metrics
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const thisWeek = history.filter((h) => new Date(h.service_date).getTime() >= weekAgo);
  const totalRevenue = history.reduce((s, h) => s + Number(h.cost || 0), 0);
  const avgDuration = (() => {
    const durations = history.map((h) => services.find((s) => s.id === h.service_id)?.duration_minutes ?? 0).filter(Boolean);
    if (!durations.length) return "—";
    return `${(durations.reduce((a, b) => a + b, 0) / durations.length / 60).toFixed(1)}h`;
  })();
  const completedBookings = bookings.filter((b) => b.status === "completed").length;
  const totalBookings = bookings.length || 1;
  const efficiency = Math.round((completedBookings / totalBookings) * 100);

  // 7-day chart
  const days: { day: string; jobs: number; date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const dEnd = new Date(d); dEnd.setHours(23, 59, 59, 999);
    days.push({
      day: d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase(),
      date: d.toISOString(),
      jobs: history.filter((h) => {
        const t = new Date(h.service_date).getTime();
        return t >= d.getTime() && t <= dEnd.getTime();
      }).length,
    });
  }
  const maxJobs = Math.max(1, ...days.map((d) => d.jobs));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">My Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">Live metrics, completed jobs, and shift performance.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Jobs This Week", value: String(thisWeek.length), icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", sub: `${history.length} all-time` },
          { label: "Avg. Duration", value: avgDuration, icon: Clock, color: "text-primary", bg: "bg-primary/10", sub: "per service" },
          { label: "Completion Rate", value: `${efficiency}%`, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10", sub: `${completedBookings}/${bookings.length} jobs` },
          { label: "Revenue Generated", value: formatINR(totalRevenue), icon: Star, color: "text-amber-500", bg: "bg-amber-50", sub: "lifetime" },
        ].map((k) => (
          <div key={k.label} className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className={`p-2 rounded-lg ${k.bg}`}><k.icon className={`w-5 h-5 ${k.color}`} /></div>
            </div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">{k.label}</p>
            <p className="text-2xl lg:text-3xl font-black text-on-surface mt-1 font-mono">{k.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card p-6 rounded-xl border border-border/20 shadow-sm">
          <h3 className="font-bold text-on-surface mb-6">Last 7 Days</h3>
          <div className="flex items-end gap-3 h-48">
            {days.map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-on-surface">{bar.jobs}</span>
                <div className={`w-full rounded-t-md ${bar.jobs === maxJobs && bar.jobs > 0 ? "bg-primary" : "bg-primary/20"}`}
                  style={{ height: `${(bar.jobs / maxJobs) * 100}%`, minHeight: "4px" }} />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{bar.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-xl">
          <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-4">Shift Summary</h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1"><span className="text-slate-300">Completion Rate</span><span className="font-bold text-emerald-400">{efficiency}%</span></div>
              <div className="h-1.5 bg-white/10 rounded-full"><div className="h-full bg-emerald-400 rounded-full" style={{ width: `${efficiency}%` }} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                <p className="text-lg font-black">{history.length}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Total Jobs</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                <p className="text-lg font-black">{formatINR(totalRevenue)}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Revenue</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/20 shadow-sm">
        <div className="p-4 lg:p-6 border-b border-border/20">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Recently Completed</h3>
        </div>
        <div className="divide-y divide-border/10">
          {history.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No completed jobs yet.</div>}
          {history.slice(0, 8).map((h) => {
            const v = vehicles.find((x) => x.id === h.vehicle_id);
            const s = services.find((x) => x.id === h.service_id);
            const c = byId[h.customer_id];
            return (
              <div key={h.id} className="flex items-center justify-between p-4 lg:px-6 hover:bg-surface-container-low/50 transition-colors gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-sm font-mono font-bold text-on-surface shrink-0">#{h.id.slice(0, 6).toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{v ? `${v.year} ${v.make} ${v.model}` : "Vehicle"}</p>
                    <p className="text-xs text-muted-foreground truncate">{s?.name} • {c?.full_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:inline">{formatDate(h.service_date)}</span>
                  <span className="text-sm font-bold text-on-surface font-mono">{formatINR(h.cost)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EmployeePerformance;
