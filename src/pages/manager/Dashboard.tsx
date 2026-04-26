import { Link } from "react-router-dom";
import { TrendingUp, IndianRupee, Calendar, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { useProfilesByRole } from "@/hooks/useStaff";
import { formatINR, formatDate } from "@/lib/format";

interface Booking {
  id: string; status: string; scheduled_at: string; total_cost: number | null;
  service_id: string; vehicle_id: string; customer_id: string; assigned_to: string | null;
}
interface Vehicle { id: string; make: string; model: string; year: number; }
interface Service { id: string; name: string; price: number; }
interface Item { id: string; name: string; sku: string; quantity: number; reorder_level: number; }
interface History { id: string; cost: number; service_date: string; }

const ManagerDashboard = () => {
  const { data: bookings } = useLiveTable<Booking>("bookings", (q) => q.order("scheduled_at", { ascending: false }));
  const { data: history } = useLiveTable<History>("service_history", (q) => q);
  const { data: vehicles } = useLiveTable<Vehicle>("vehicles", (q) => q);
  const { data: services } = useLiveTable<Service>("services", (q) => q);
  const { data: inventory } = useLiveTable<Item>("inventory", (q) => q);
  const { byId } = useProfilesByRole();

  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
  const thisMonthHistory = history.filter((h) => new Date(h.service_date).getTime() >= monthAgo);
  const totalRevenue = thisMonthHistory.reduce((s, h) => s + Number(h.cost || 0), 0);
  const totalBookings = bookings.length;
  const completedCount = bookings.filter((b) => b.status === "completed" || b.status === "released").length;
  const completionRate = totalBookings > 0 ? Math.round((completedCount / totalBookings) * 100) : 0;
  const lowStock = inventory.filter((i) => i.quantity <= i.reorder_level);

  // last 7 days revenue
  const days: { day: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const dEnd = new Date(d); dEnd.setHours(23, 59, 59, 999);
    days.push({
      day: d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase(),
      total: history.filter((h) => {
        const t = new Date(h.service_date).getTime();
        return t >= d.getTime() && t <= dEnd.getTime();
      }).reduce((s, h) => s + Number(h.cost || 0), 0),
    });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Manager Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time operational status — AutoServe Gurugram.</p>
        </div>
        <span className="px-3 py-1 bg-surface-container rounded-lg text-xs font-semibold text-muted-foreground flex items-center gap-1.5 self-start sm:self-auto">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" /> Live Updates
        </span>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <KpiCard icon={<IndianRupee className="w-5 h-5 text-primary" />} iconBg="bg-primary/10" label="Revenue (30d)" value={formatINR(totalRevenue)} />
        <KpiCard icon={<Calendar className="w-5 h-5 text-tertiary" />} iconBg="bg-tertiary/10" label="Total Bookings" value={String(totalBookings)} />
        <KpiCard icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-50" label="Completion Rate" value={`${completionRate}%`} />
        <KpiCard icon={<AlertTriangle className="w-5 h-5 text-destructive" />} iconBg="bg-destructive/10" label="Stock Alerts" value={`${lowStock.length} Items Low`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card p-6 rounded-xl shadow-sm border border-border/20">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-on-surface">Daily Revenue (Last 7 Days)</h3>
            <span className="text-xs text-muted-foreground">{formatINR(days.reduce((s, d) => s + d.total, 0))} total</span>
          </div>
          <div className="flex items-end gap-2 h-48">
            {days.map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                {bar.total > 0 && (
                  <div className="bg-on-surface text-card text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {formatINR(bar.total)}
                  </div>
                )}
                <div className={`w-full rounded-t-md transition-all ${bar.total === maxDay && bar.total > 0 ? "bg-primary" : "bg-primary/15"}`}
                  style={{ height: `${Math.max((bar.total / maxDay) * 100, 4)}%` }} />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{bar.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl shadow-sm border border-border/20">
          <h3 className="font-bold text-on-surface mb-4">Critical Inventory</h3>
          <div className="space-y-3">
            {lowStock.length === 0 && <p className="text-xs text-muted-foreground">All stock levels are healthy ✓</p>}
            {lowStock.slice(0, 4).map((item) => {
              const isCritical = item.quantity <= Math.floor(item.reorder_level / 2);
              return (
                <div key={item.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-border/10">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{item.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{item.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-lg font-black ${isCritical ? "text-destructive" : "text-amber-600"}`}>{item.quantity}</span>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">left</p>
                  </div>
                </div>
              );
            })}
            <Link to="/manager/inventory" className="w-full text-center text-sm text-primary font-semibold py-2 border border-border/30 rounded-lg hover:bg-surface-container transition-colors block">
              Manage Inventory
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="font-bold text-on-surface">Recent Service Bookings</h3>
          <Link to="/manager/bookings" className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
                <th className="text-left py-3 font-bold">Job</th>
                <th className="text-left py-3 font-bold">Customer / Vehicle</th>
                <th className="text-left py-3 font-bold">Service</th>
                <th className="text-left py-3 font-bold">Technician</th>
                <th className="text-right py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {bookings.slice(0, 5).map((b) => {
                const v = vehicles.find((x) => x.id === b.vehicle_id);
                const s = services.find((x) => x.id === b.service_id);
                const c = byId[b.customer_id];
                const t = b.assigned_to ? byId[b.assigned_to] : null;
                return (
                  <tr key={b.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-4 text-sm font-mono font-semibold text-on-surface">#{b.id.slice(0, 6).toUpperCase()}</td>
                    <td className="py-4">
                      <p className="text-sm font-semibold text-on-surface">{c?.full_name || "Customer"}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{v ? `${v.year} ${v.make} ${v.model}` : "—"}</p>
                    </td>
                    <td className="py-4"><span className="text-xs font-medium bg-surface-container px-2 py-1 rounded">{s?.name || "—"}</span></td>
                    <td className="py-4 text-sm text-on-surface">{t?.full_name || "Unassigned"}</td>
                    <td className="py-4 text-right">
                      <StatusBadge status={b.status} />
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

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending: "text-amber-600 bg-amber-50",
    confirmed: "text-primary bg-primary/10",
    in_progress: "text-primary bg-primary/10",
    completed: "text-emerald-600 bg-emerald-50",
    cancelled: "text-destructive bg-destructive/10",
  };
  return <span className={`text-xs font-bold px-2 py-1 rounded-full ${map[status] || "bg-surface-container"}`}>{status.replace("_", " ")}</span>;
};

const KpiCard = ({ icon, iconBg, label, value }: { icon: React.ReactNode; iconBg: string; label: string; value: string; }) => (
  <div className="bg-card p-5 lg:p-6 rounded-xl shadow-sm border border-border/20">
    <div className="flex justify-between items-start mb-3 lg:mb-4">
      <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
    </div>
    <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">{label}</p>
    <h3 className="text-2xl lg:text-3xl font-black text-on-surface tracking-tight mt-1 font-mono">{value}</h3>
  </div>
);

export default ManagerDashboard;
