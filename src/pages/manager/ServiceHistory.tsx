import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { useProfilesByRole } from "@/hooks/useStaff";
import { formatINR, formatDate } from "@/lib/format";

interface History {
  id: string; service_date: string; cost: number;
  service_id: string; vehicle_id: string; customer_id: string;
  technician_id: string | null; notes: string | null; parts_used: string | null;
  mileage_at_service: number | null;
}
interface Vehicle { id: string; make: string; model: string; year: number; registration: string; }
interface Service { id: string; name: string; }

const ManagerServiceHistory = () => {
  const { data: history } = useLiveTable<History>("service_history", (q) => q.order("service_date", { ascending: false }));
  const { data: vehicles } = useLiveTable<Vehicle>("vehicles", (q) => q);
  const { data: services } = useLiveTable<Service>("services", (q) => q);
  const { byId } = useProfilesByRole();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return history;
    return history.filter((h) => {
      const v = vehicles.find((x) => x.id === h.vehicle_id);
      const s = services.find((x) => x.id === h.service_id);
      const c = byId[h.customer_id];
      const hay = `${h.id} ${v?.registration ?? ""} ${v?.make ?? ""} ${v?.model ?? ""} ${c?.full_name ?? ""} ${s?.name ?? ""}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    });
  }, [history, search, vehicles, services, byId]);

  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
  const thisMonth = history.filter((h) => new Date(h.service_date).getTime() >= monthAgo);
  const totalRevenue = history.reduce((s, h) => s + Number(h.cost || 0), 0);
  const avgRevenue = history.length ? totalRevenue / history.length : 0;
  const customerSet = new Set(history.map((h) => h.customer_id));

  const exportCsv = () => {
    const rows = [
      ["ID", "Date", "Customer", "Vehicle", "Reg", "Service", "Technician", "Mileage", "Parts", "Notes", "Cost (₹)"],
      ...filtered.map((h) => {
        const v = vehicles.find((x) => x.id === h.vehicle_id);
        const s = services.find((x) => x.id === h.service_id);
        const c = byId[h.customer_id];
        const t = h.technician_id ? byId[h.technician_id] : null;
        return [
          h.id.slice(0, 8), formatDate(h.service_date), c?.full_name ?? "—",
          v ? `${v.year} ${v.make} ${v.model}` : "—", v?.registration ?? "—",
          s?.name ?? "—", t?.full_name ?? "—",
          h.mileage_at_service ? String(h.mileage_at_service) : "—",
          h.parts_used ?? "—", h.notes ?? "—", String(h.cost),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `service-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Service History</h1>
          <p className="text-sm text-muted-foreground mt-1">Complete archive of completed services.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 border border-border/30 rounded-lg text-xs font-medium hover:bg-surface-container">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total Records" value={String(history.length)} />
        <Kpi label="This Month" value={String(thisMonth.length)} />
        <Kpi label="Unique Customers" value={String(customerSet.size)} />
        <Kpi label="Avg. Revenue" value={formatINR(avgRevenue)} mono />
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ID, customer, vehicle, service…"
          className="w-full pl-11 pr-4 py-3 bg-card border border-border/20 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
      </div>

      <div className="bg-card rounded-xl border border-border/20 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
                <th className="text-left py-3 px-6 font-bold">ID</th>
                <th className="text-left py-3 px-4 font-bold">Customer</th>
                <th className="text-left py-3 px-4 font-bold">Vehicle</th>
                <th className="text-left py-3 px-4 font-bold">Service</th>
                <th className="text-left py-3 px-4 font-bold">Technician</th>
                <th className="text-left py-3 px-4 font-bold">Date</th>
                <th className="text-right py-3 px-4 font-bold">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No history records.</td></tr>
              )}
              {filtered.map((h) => {
                const v = vehicles.find((x) => x.id === h.vehicle_id);
                const s = services.find((x) => x.id === h.service_id);
                const c = byId[h.customer_id];
                const t = h.technician_id ? byId[h.technician_id] : null;
                return (
                  <tr key={h.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-4 px-6 text-sm font-mono font-bold text-on-surface">#{h.id.slice(0, 6).toUpperCase()}</td>
                    <td className="py-4 px-4 text-sm font-semibold text-on-surface">{c?.full_name || "—"}</td>
                    <td className="py-4 px-4 text-xs text-muted-foreground">{v ? `${v.year} ${v.make} ${v.model}` : "—"}</td>
                    <td className="py-4 px-4"><span className="text-xs font-medium bg-surface-container px-2 py-1 rounded">{s?.name || "—"}</span></td>
                    <td className="py-4 px-4 text-sm text-on-surface">{t?.full_name || "—"}</td>
                    <td className="py-4 px-4 text-xs text-muted-foreground">{formatDate(h.service_date)}</td>
                    <td className="py-4 px-4 text-sm font-bold text-on-surface text-right font-mono">{formatINR(h.cost)}</td>
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

const Kpi = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
    <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">{label}</p>
    <p className={`text-2xl font-black text-on-surface mt-1 ${mono ? "font-mono" : ""}`}>{value}</p>
  </div>
);

export default ManagerServiceHistory;
