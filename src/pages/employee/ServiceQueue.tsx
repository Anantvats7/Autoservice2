import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, CheckCircle, AlertTriangle, ArrowRight, Wrench, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { useProfilesByRole } from "@/hooks/useStaff";
import { formatTime, formatDate } from "@/lib/format";

interface Booking {
  id: string; status: string; priority: string; scheduled_at: string;
  service_id: string; vehicle_id: string; customer_id: string; assigned_to: string | null;
}
interface Vehicle { id: string; make: string; model: string; year: number; registration: string; }
interface Service { id: string; name: string; duration_minutes: number; }

const statusColor: Record<string, string> = {
  pending: "text-amber-600 bg-amber-50",
  confirmed: "text-primary bg-primary/10",
  checked_in: "text-primary bg-primary/10",
  in_progress: "text-primary bg-primary/10",
  ready_for_pickup: "text-emerald-600 bg-emerald-50",
  completed: "text-emerald-600 bg-emerald-50",
  released: "text-emerald-700 bg-emerald-100",
  cancelled: "text-destructive bg-destructive/10",
};

const priorityColor: Record<string, string> = {
  priority: "text-destructive bg-destructive/10",
  express: "text-amber-600 bg-amber-50",
  normal: "text-muted-foreground bg-surface-container",
};

const EmployeeServiceQueue = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const { data: bookings } = useLiveTable<Booking>(
    "bookings",
    (q) => q.eq("assigned_to", user?.id).order("scheduled_at"),
    [user?.id],
    { enabled: !!user }
  );
  const { data: vehicles } = useLiveTable<Vehicle>("vehicles", (q) => q);
  const { data: services } = useLiveTable<Service>("services", (q) => q);
  const { byId: profilesById } = useProfilesByRole();

  const veh = (id: string) => vehicles.find((v) => v.id === id);
  const svc = (id: string) => services.find((s) => s.id === id);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const todays = bookings.filter((b) => {
    const t = new Date(b.scheduled_at).getTime();
    return t >= todayStart.getTime() && t <= todayEnd.getTime();
  });
  const inQueue = todays.filter((b) => b.status === "pending" || b.status === "confirmed" || b.status === "checked_in").length;
  const inProg = todays.filter((b) => b.status === "in_progress" || b.status === "ready_for_pickup").length;
  const completed = todays.filter((b) => b.status === "completed" || b.status === "released").length;

  const filteredBookings = bookings.filter((j) => {
    if (!search) return true;
    const v = veh(j.vehicle_id);
    const s = svc(j.service_id);
    const cust = profilesById[j.customer_id]?.full_name ?? "";
    const hay = `${j.id} ${v?.make ?? ""} ${v?.model ?? ""} ${v?.registration ?? ""} ${s?.name ?? ""} ${cust}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Service Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">Your assigned work orders, prioritized by urgency.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "In Queue Today", value: String(inQueue).padStart(2, "0"), icon: Clock, color: "text-primary", bg: "bg-primary/10" },
          { label: "In Progress", value: String(inProg).padStart(2, "0"), icon: Wrench, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Completed Today", value: String(completed).padStart(2, "0"), icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total Assigned", value: String(bookings.length).padStart(2, "0"), icon: AlertTriangle, color: "text-primary", bg: "bg-primary/10" },
        ].map((k) => (
          <div key={k.label} className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className={`p-2 rounded-lg ${k.bg}`}><k.icon className={`w-5 h-5 ${k.color}`} /></div>
            </div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">{k.label}</p>
            <p className="text-2xl lg:text-3xl font-black text-on-surface mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border/20 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 lg:p-6 border-b border-border/20 gap-4">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">All Assigned Work Orders</h3>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              className="w-full pl-10 pr-3 py-2 bg-surface-container border border-border/20 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
                <th className="text-left py-3 px-6 font-bold">Job</th>
                <th className="text-left py-3 px-4 font-bold">Vehicle / Customer</th>
                <th className="text-left py-3 px-4 font-bold">Service</th>
                <th className="text-left py-3 px-4 font-bold">Priority</th>
                <th className="text-left py-3 px-4 font-bold">Scheduled</th>
                <th className="text-left py-3 px-4 font-bold">Status</th>
                <th className="text-center py-3 px-4 font-bold">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {filteredBookings.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">{bookings.length === 0 ? "No jobs assigned to you yet." : "No matching jobs."}</td></tr>
              )}
              {filteredBookings.map((j) => {
                const v = veh(j.vehicle_id); const s = svc(j.service_id);
                const cust = profilesById[j.customer_id]?.full_name || "Customer";
                return (
                  <tr key={j.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-4 px-6 text-sm font-mono font-bold text-on-surface">#{j.id.slice(0, 8).toUpperCase()}</td>
                    <td className="py-4 px-4">
                      <p className="text-sm font-semibold text-on-surface">{v ? `${v.year} ${v.make} ${v.model}` : "Vehicle"}</p>
                      <p className="text-xs text-muted-foreground">{cust}</p>
                    </td>
                    <td className="py-4 px-4 text-sm text-on-surface">{s?.name || "Service"}</td>
                    <td className="py-4 px-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${priorityColor[j.priority]}`}>{j.priority}</span>
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground">
                      {formatDate(j.scheduled_at)} • {formatTime(j.scheduled_at)}
                      {["pending", "confirmed", "checked_in"].includes(j.status) && new Date(j.scheduled_at) < new Date() && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Overdue</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusColor[j.status]}`}>
                        {j.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Link to={`/employee/job/${j.id}`} className="p-1.5 text-primary hover:bg-primary/10 rounded inline-flex">
                        <ArrowRight className="w-4 h-4" />
                      </Link>
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

export default EmployeeServiceQueue;
