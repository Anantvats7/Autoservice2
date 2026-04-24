import { Link } from "react-router-dom";
import { CheckCircle, Clock, Wrench, ArrowRight, Cpu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { formatTime, formatDate, formatINR } from "@/lib/format";

interface Booking {
  id: string; status: string; priority: string; scheduled_at: string; notes: string | null;
  total_cost: number | null; service_id: string; vehicle_id: string; customer_id: string;
}
interface Vehicle { id: string; make: string; model: string; year: number; registration: string; }
interface Service { id: string; name: string; duration_minutes: number; }

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const { data: bookings } = useLiveTable<Booking>(
    "bookings",
    (q) => q.eq("assigned_to", user?.id).order("scheduled_at"),
    [user?.id],
    { enabled: !!user }
  );
  const { data: vehicles } = useLiveTable<Vehicle>("vehicles", (q) => q);
  const { data: services } = useLiveTable<Service>("services", (q) => q);

  const veh = (id: string) => vehicles.find((v) => v.id === id);
  const svc = (id: string) => services.find((s) => s.id === id);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todays = bookings.filter((b) => new Date(b.scheduled_at) >= todayStart);
  const pending = todays.filter((b) => b.status === "pending" || b.status === "confirmed" || b.status === "checked_in");
  const inProgress = todays.filter((b) => b.status === "in_progress" || b.status === "ready_for_pickup");
  const completed = todays.filter((b) => b.status === "completed" || b.status === "released");
  const active = inProgress[0];
  const queue = pending.slice(0, 4);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Today's Assignments</h1>
        <p className="text-muted-foreground text-sm">{formatDate(new Date())} • {bookings.length} total assigned to you</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Today", value: todays.length },
          { label: "Pending", value: pending.length, dot: "bg-amber-400" },
          { label: "In Progress", value: inProgress.length, dot: "bg-primary" },
          { label: "Completed", value: completed.length, dot: "bg-emerald-500" },
        ].map((k) => (
          <div key={k.label} className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
            <div className="flex justify-between items-start mb-1">
              <span className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">{k.label}</span>
              {k.dot && <div className={`h-2 w-2 rounded-full ${k.dot}`} />}
            </div>
            <span className="text-3xl font-black text-on-surface tracking-tight">{String(k.value).padStart(2, "0")}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {active ? (
            <div className="bg-card rounded-xl border-2 border-primary/30 shadow-sm overflow-hidden">
              <div className="bg-primary/5 px-6 py-3 flex items-center justify-between border-b border-primary/10">
                <div className="flex items-center gap-3">
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider">Active Job</span>
                  <span className="text-xs font-mono text-muted-foreground">#{active.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase">{active.priority}</span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-on-surface mb-1">{svc(active.service_id)?.name || "Service"}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {veh(active.vehicle_id) ? `${veh(active.vehicle_id)!.year} ${veh(active.vehicle_id)!.make} ${veh(active.vehicle_id)!.model} • ${veh(active.vehicle_id)!.registration}` : "Vehicle"}
                </p>
                {active.notes && (
                  <div className="bg-surface-container-low border border-border/20 rounded-lg p-4 text-sm text-muted-foreground mb-4">{active.notes}</div>
                )}
                <div className="flex flex-wrap gap-3 mb-6">
                  <div className="bg-surface-container px-4 py-2 rounded-lg">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Scheduled</p>
                    <p className="text-sm font-mono font-bold text-on-surface">{formatTime(active.scheduled_at)}</p>
                  </div>
                  <div className="bg-surface-container px-4 py-2 rounded-lg">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Estimated</p>
                    <p className="text-sm font-mono font-bold text-on-surface">{formatINR(active.total_cost)}</p>
                  </div>
                </div>
                <Link to={`/employee/job/${active.id}`} className="block w-full bg-primary text-primary-foreground py-3 rounded-lg font-bold text-center active:scale-[0.98] transition-all">
                  Open Job Details →
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-card p-8 rounded-xl border border-dashed border-border/40 text-center">
              <Cpu className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-semibold text-on-surface">No active job in progress</p>
              <p className="text-xs text-muted-foreground mt-1">Pick the next job from your queue to start.</p>
            </div>
          )}
        </div>

        <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Up Next</h4>
            <span className="text-xs font-bold text-on-surface bg-surface-container px-2 py-1 rounded">{queue.length}</span>
          </div>
          <div className="space-y-3">
            {queue.length === 0 && <p className="text-xs text-muted-foreground">No upcoming jobs.</p>}
            {queue.map((q) => (
              <Link to={`/employee/job/${q.id}`} key={q.id} className="block p-3 rounded-lg border border-border/10 hover:bg-surface-container-low transition-colors group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatTime(q.scheduled_at)}
                  </span>
                  <span className={`text-[10px] font-bold uppercase ${q.priority === "priority" ? "text-destructive" : q.priority === "express" ? "text-amber-600" : "text-muted-foreground"}`}>
                    {q.priority}
                  </span>
                </div>
                <h5 className="text-sm font-bold text-on-surface">{svc(q.service_id)?.name || "Service"}</h5>
                <p className="text-xs text-muted-foreground">{veh(q.vehicle_id)?.make} {veh(q.vehicle_id)?.model}</p>
                <div className="flex items-center justify-end mt-1">
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
          <Link to="/employee/queue" className="block text-center mt-4 text-[10px] uppercase tracking-wider font-bold text-on-surface hover:text-primary transition-colors">
            View Full Queue
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
