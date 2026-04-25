import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle, ArrowLeft, Save, AlertCircle, PlayCircle, Sparkles, Loader2, LogIn, PackageCheck, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { useProfilesByRole } from "@/hooks/useStaff";
import { formatINR, formatDateTime } from "@/lib/format";
import { toast } from "sonner";

interface Booking {
  id: string; status: string; priority: string; scheduled_at: string; notes: string | null;
  total_cost: number | null; service_id: string; vehicle_id: string; customer_id: string;
  assigned_to: string | null;
}
interface Vehicle { id: string; make: string; model: string; year: number; registration: string; mileage: number; fuel_type: string | null; color: string | null; }
interface Service { id: string; name: string; duration_minutes: number; price: number; category: string; }

const STATUSES = ["pending", "confirmed", "checked_in", "in_progress", "ready_for_pickup", "completed", "released", "cancelled"] as const;
const STATUS_COLOR: Record<string, string> = {
  pending: "text-amber-600 bg-amber-50",
  confirmed: "text-primary bg-primary/10",
  checked_in: "text-primary bg-primary/10",
  in_progress: "text-primary bg-primary/10",
  ready_for_pickup: "text-emerald-600 bg-emerald-50",
  completed: "text-emerald-600 bg-emerald-50",
  released: "text-emerald-700 bg-emerald-100",
  cancelled: "text-destructive bg-destructive/10",
};

const EmployeeJobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [notes, setNotes] = useState("");
  const [partsUsed, setPartsUsed] = useState("");
  const [mileageAtService, setMileageAtService] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiSummary, setAiSummary] = useState<{ loading: boolean; text: string | null; error: string | null }>({ loading: false, text: null, error: null });

  const { data: vehicles } = useLiveTable<Vehicle>("vehicles", (q) => q);
  const { data: services } = useLiveTable<Service>("services", (q) => q);
  const { byId: profilesById } = useProfilesByRole();

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
      if (data) {
        setBooking(data as Booking);
        setNotes(data.notes ?? "");
      }
    };
    load();
    const channel = supabase
      .channel(`booking-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  if (!booking) {
    return <div className="p-8 text-sm text-muted-foreground">Loading job…</div>;
  }

  const vehicle = vehicles.find((v) => v.id === booking.vehicle_id);
  const service = services.find((s) => s.id === booking.service_id);
  const customer = profilesById[booking.customer_id];

  const updateStatus = async (newStatus: string) => {
    if (!booking) return;
    const prevStatus = booking.status;
    // Optimistic update — reflect change immediately in local state
    setBooking((prev) => prev ? { ...prev, status: newStatus } : prev);
    setSaving(true);
    const patch: any = { status: newStatus, notes };
    if (newStatus === "checked_in") patch.checked_in_at = new Date().toISOString();
    if (newStatus === "released") patch.released_at = new Date().toISOString();
    const { error } = await supabase
      .from("bookings")
      .update(patch)
      .eq("id", booking.id);
    setSaving(false);
    if (error) {
      // Revert optimistic update
      setBooking((prev) => prev ? { ...prev, status: prevStatus } : prev);
      toast.error(error.message);
      return;
    }
    toast.success(`Status → ${newStatus.replace(/_/g, " ")}`);

    // Notify customer
    await supabase.from("notifications").insert({
      user_id: booking.customer_id,
      title: "Service Update",
      message: `Your ${service?.name || "service"} is now ${newStatus.replace(/_/g, " ")}.`,
      type: (newStatus === "completed" || newStatus === "released" || newStatus === "ready_for_pickup") ? "success" : "info",
    });

    // service_history is auto-created by DB trigger on completed/released.
    // If technician provided extra context (parts, mileage), patch the row.
    // The trigger may take a moment, so we retry up to 3 times with a short delay.
    if ((newStatus === "completed" || newStatus === "released") && (partsUsed || mileageAtService)) {
      const patchHistory = async (retries = 3): Promise<void> => {
        const { data: existing } = await supabase
          .from("service_history")
          .select("id")
          .eq("booking_id", booking.id)
          .maybeSingle();

        if (existing?.id) {
          // Row exists — update it
          await supabase.from("service_history").update({
            parts_used: partsUsed || null,
            mileage_at_service: mileageAtService ? parseInt(mileageAtService, 10) : null,
          }).eq("id", existing.id);
        } else if (retries > 0) {
          // Trigger hasn't fired yet — wait 800ms and retry
          await new Promise((r) => setTimeout(r, 800));
          return patchHistory(retries - 1);
        } else {
          // Trigger never fired — insert the row ourselves as fallback
          await supabase.from("service_history").insert({
            booking_id: booking.id,
            customer_id: booking.customer_id,
            vehicle_id: booking.vehicle_id,
            service_id: booking.service_id,
            technician_id: user?.id ?? null,
            service_date: new Date().toISOString(),
            cost: booking.total_cost ?? 0,
            parts_used: partsUsed || null,
            mileage_at_service: mileageAtService ? parseInt(mileageAtService, 10) : null,
            notes: notes || null,
          });
        }
      };
      await patchHistory();
    }
  };

  const fetchAiSummary = async () => {
    if (!vehicle) return;
    setAiSummary({ loading: true, text: null, error: null });
    try {
      const { data: hist } = await supabase
        .from("service_history")
        .select("service_date, cost, notes, parts_used, mileage_at_service, service_id")
        .eq("vehicle_id", vehicle.id)
        .order("service_date", { ascending: false })
        .limit(10);
      const enriched = (hist ?? []).map((h: any) => ({
        ...h,
        service: services.find((s) => s.id === h.service_id)?.name ?? "Service",
      }));
      const { data, error } = await supabase.functions.invoke("ai-vehicle-summary", {
        body: {
          vehicle: { make: vehicle.make, model: vehicle.model, year: vehicle.year, mileage: vehicle.mileage, fuel_type: vehicle.fuel_type },
          history: enriched,
          current_service: service?.name,
        },
      });
      if (error) throw error;
      setAiSummary({ loading: false, text: data?.summary ?? "No summary available.", error: null });
    } catch (e: any) {
      setAiSummary({ loading: false, text: null, error: e.message ?? "AI summary failed" });
    }
  };

  const saveNotes = async () => {
    setSaving(true);
    const { error } = await supabase.from("bookings").update({ notes }).eq("id", booking.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Notes saved");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/employee/queue" className="hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Service Queue</Link>
        <span>›</span>
        <span className="text-primary font-semibold font-mono">#{booking.id.slice(0, 8).toUpperCase()}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">
            {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Vehicle"}
          </h1>
          <div className="flex flex-wrap gap-6 text-sm mt-2">
            <div><span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">Registration</span><span className="font-mono font-bold">{vehicle?.registration || "—"}</span></div>
            <div><span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">Fuel</span><span className="font-bold">{vehicle?.fuel_type || "—"}</span></div>
            <div><span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">Odometer</span><span className="font-mono font-bold">{vehicle?.mileage?.toLocaleString("en-IN") || 0} km</span></div>
            <div><span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">Customer</span><span className="font-bold">{customer?.full_name || "—"}</span></div>
          </div>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full self-start ${STATUS_COLOR[booking.status] ?? "text-amber-600 bg-amber-50"}`}>
          {booking.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
            <h3 className="font-bold text-on-surface mb-4">Service Details</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-surface-container-low p-4 rounded-lg border border-border/10">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Service</p>
                <p className="text-sm font-bold text-on-surface mt-1">{service?.name || "—"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{service?.category}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-lg border border-border/10">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Estimated Cost</p>
                <p className="text-sm font-bold text-on-surface mt-1 font-mono">{formatINR(booking.total_cost ?? service?.price)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{service?.duration_minutes} min</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-lg border border-border/10">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Scheduled</p>
                <p className="text-sm font-bold text-on-surface mt-1">{formatDateTime(booking.scheduled_at)}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-lg border border-border/10">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Priority</p>
                <p className="text-sm font-bold text-on-surface mt-1 uppercase">{booking.priority}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/5 to-transparent p-5 rounded-xl border border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-on-surface">AI Vehicle History Summary</h3>
              </div>
              <button onClick={fetchAiSummary} disabled={aiSummary.loading} className="text-xs font-bold text-primary hover:underline disabled:opacity-50">
                {aiSummary.text ? "Refresh" : "Generate"}
              </button>
            </div>
            {!aiSummary.text && !aiSummary.loading && !aiSummary.error && (
              <p className="text-xs text-muted-foreground">Generate an AI-written summary of this vehicle's previous service history before starting work.</p>
            )}
            {aiSummary.loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing past services…</div>}
            {aiSummary.error && <p className="text-xs text-destructive">{aiSummary.error}</p>}
            {aiSummary.text && <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{aiSummary.text}</p>}
          </div>

          <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-on-surface">Technician Notes</h3>
              <button onClick={saveNotes} disabled={saving} className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:underline disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Diagnosis, observations, follow-up actions…"
              className="w-full p-3 text-sm bg-surface-container-low border border-border/20 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none resize-y"
            />
          </div>

          {(booking.status === "in_progress" || booking.status === "ready_for_pickup") && (
            <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
              <h3 className="font-bold text-on-surface mb-4">Completion Details</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1.5">Parts Used</label>
                  <input value={partsUsed} onChange={(e) => setPartsUsed(e.target.value)} placeholder="e.g. Brake pads × 4, Engine oil 4L" className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1.5">Mileage at Service (km)</label>
                  <input type="number" value={mileageAtService} onChange={(e) => setMileageAtService(e.target.value)} placeholder={String(vehicle?.mileage ?? 0)} className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
            <h4 className="font-bold text-on-surface mb-4">Update Status</h4>
            <div className="space-y-2">
              {booking.status === "pending" && (
                <button onClick={() => updateStatus("confirmed")} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary/10 text-primary rounded-lg text-sm font-bold hover:bg-primary/20 transition-colors disabled:opacity-50">
                  <CheckCircle className="w-4 h-4" /> Confirm Booking
                </button>
              )}
              {(booking.status === "pending" || booking.status === "confirmed") && (
                <button onClick={() => updateStatus("checked_in")} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary/10 text-primary rounded-lg text-sm font-bold hover:bg-primary/20 transition-colors disabled:opacity-50">
                  <LogIn className="w-4 h-4" /> Check In Vehicle
                </button>
              )}
              {(booking.status === "pending" || booking.status === "confirmed" || booking.status === "checked_in") && (
                <button onClick={() => updateStatus("in_progress")} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50">
                  <PlayCircle className="w-4 h-4" /> Start Job
                </button>
              )}
              {booking.status === "in_progress" && (
                <button onClick={() => updateStatus("ready_for_pickup")} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50">
                  <PackageCheck className="w-4 h-4" /> Ready for Pickup
                </button>
              )}
              {booking.status === "ready_for_pickup" && (
                <button onClick={() => updateStatus("completed")} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50">
                  <CheckCircle className="w-4 h-4" /> Mark Completed
                </button>
              )}
              {booking.status === "completed" && (
                <button onClick={() => updateStatus("released")} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50">
                  <Truck className="w-4 h-4" /> Release Vehicle
                </button>
              )}
              {booking.status !== "completed" && booking.status !== "released" && booking.status !== "cancelled" && (
                <button onClick={() => updateStatus("cancelled")} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 border border-destructive/30 text-destructive rounded-lg text-sm font-bold hover:bg-destructive/5 transition-colors disabled:opacity-50">
                  <AlertCircle className="w-4 h-4" /> Cancel Job
                </button>
              )}
              {(booking.status === "released" || booking.status === "cancelled") && (
                <button onClick={() => navigate("/employee/queue")} className="w-full flex items-center justify-center gap-2 py-2.5 border border-border/30 rounded-lg text-sm font-bold hover:bg-surface-container transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back to Queue
                </button>
              )}
            </div>
          </div>

          <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
            <h4 className="font-bold text-on-surface mb-3">Customer</h4>
            {customer ? (
              <div>
                <p className="text-sm font-bold text-on-surface">{customer.full_name}</p>
                {customer.phone && <p className="text-xs text-muted-foreground mt-1">{customer.phone}</p>}
              </div>
            ) : <p className="text-xs text-muted-foreground">—</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeJobDetail;
