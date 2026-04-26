import { useMemo, useState } from "react";
import { Filter, Download, CheckCircle, Wrench, Loader2, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { formatDate, formatINR } from "@/lib/format";

interface Record_ { id: string; service_date: string; cost: number; service_id: string; vehicle_id: string; mileage_at_service: number | null; parts_used: string | null; notes: string | null; }
interface Service { id: string; name: string; category: string; }
interface Vehicle { id: string; make: string; model: string; year: number; registration: string; }

const CustomerServiceHistory = () => {
  const { user } = useAuth();
  const { data: history, loading } = useLiveTable<Record_>("service_history", (q) => q.eq("customer_id", user?.id ?? "").order("service_date", { ascending: false }), [user?.id], { enabled: !!user });
  const { data: servicesArr } = useLiveTable<Service>("services", (q) => q);
  const { data: vehiclesArr } = useLiveTable<Vehicle>("vehicles", (q) => q.eq("owner_id", user?.id ?? ""), [user?.id], { enabled: !!user });
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const services = useMemo(() => { const m: Record<string, Service> = {}; servicesArr.forEach((s) => { m[s.id] = s; }); return m; }, [servicesArr]);
  const vehicles = useMemo(() => { const m: Record<string, Vehicle> = {}; vehiclesArr.forEach((v) => { m[v.id] = v; }); return m; }, [vehiclesArr]);

  const filtered = vehicleFilter === "all" && categoryFilter === "all" 
    ? history 
    : history.filter((h) => {
        const vehicleMatch = vehicleFilter === "all" || h.vehicle_id === vehicleFilter;
        const categoryMatch = categoryFilter === "all" || services[h.service_id]?.category === categoryFilter;
        return vehicleMatch && categoryMatch;
      });
  const totalSpent = filtered.reduce((sum, h) => sum + Number(h.cost), 0);

  const exportCsv = () => {
    const rows = [["Date", "Service", "Vehicle", "Mileage", "Parts", "Notes", "Cost"]];
    filtered.forEach((h) => {
      const v = vehicles[h.vehicle_id]; const s = services[h.service_id];
      rows.push([formatDate(h.service_date), s?.name ?? "", v ? `${v.year} ${v.make} ${v.model}` : "", String(h.mileage_at_service ?? ""), h.parts_used ?? "", h.notes ?? "", String(h.cost)]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "service-history.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Service Timeline</h1>
          <p className="text-sm text-muted-foreground mt-1">Complete maintenance history for your vehicles.</p>
        </div>
        <div className="flex gap-2 self-start">
          <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="px-3 py-2 border border-border/30 rounded-lg text-xs font-medium bg-card focus:ring-2 focus:ring-primary/20 outline-none">
            <option value="all">All Vehicles</option>
            {Object.values(vehicles).map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 border border-border/30 rounded-lg text-xs font-medium bg-card focus:ring-2 focus:ring-primary/20 outline-none">
            <option value="all">All Categories</option>
            {Array.from(new Set(Object.values(services).map((s) => s.category))).sort().map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button onClick={exportCsv} disabled={filtered.length === 0} className="flex items-center gap-1.5 px-3 py-2 border border-border/30 rounded-lg text-xs font-medium hover:bg-surface-container active:scale-[0.98] transition-all disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
          <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">Total Services</p>
          <p className="text-2xl font-black text-on-surface mt-1">{filtered.length}</p>
        </div>
        <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
          <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">Total Spent</p>
          <p className="text-2xl font-black text-on-surface mt-1 font-mono">{formatINR(totalSpent)}</p>
        </div>
        <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
          <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">Avg. Per Service</p>
          <p className="text-2xl font-black text-on-surface mt-1 font-mono">{filtered.length > 0 ? formatINR(Math.round(totalSpent / filtered.length)) : "—"}</p>
        </div>
        <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
          <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">Vehicles</p>
          <p className="text-2xl font-black text-on-surface mt-1">{Object.keys(vehicles).length}</p>
        </div>
        <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
          <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">Last Service</p>
          <p className="text-sm font-bold text-on-surface mt-2">{filtered[0] ? formatDate(filtered[0].service_date) : "—"}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border/30 rounded-xl">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-bold text-on-surface">No service records yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Records will appear here as services are completed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            const s = services[r.service_id]; const v = vehicles[r.vehicle_id];
            return (
              <div key={r.id} className="bg-card p-6 rounded-xl border border-border/20 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-lg"><Wrench className="w-5 h-5 text-primary" /></div>
                    <div>
                      <h3 className="font-bold text-on-surface">{s?.name ?? "Service"}</h3>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {formatDate(r.service_date)} {r.mileage_at_service ? `• ${r.mileage_at_service.toLocaleString("en-IN")} km` : ""} {v ? `• ${v.year} ${v.make} ${v.model}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-on-surface font-mono">{formatINR(r.cost)}</p>
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 justify-end"><CheckCircle className="w-3 h-3" /> Verified</span>
                  </div>
                </div>
                {(r.notes || r.parts_used) && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {r.notes && (
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Notes</h4>
                        <p className="text-sm text-muted-foreground italic leading-relaxed">"{r.notes}"</p>
                      </div>
                    )}
                    {r.parts_used && (
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Parts Used</h4>
                        <p className="text-sm text-muted-foreground">{r.parts_used}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerServiceHistory;
