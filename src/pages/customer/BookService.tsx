// Multi-service booking flow with related-service suggestions, priority surcharge, and post-confirm QR pass.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Car, Clock, Loader2, AlertCircle, Wrench, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import { recommendRelated, PRIORITY_MULTIPLIER, priorityLabel } from "@/lib/recommendations";
import VehicleBrandLogo from "@/components/VehicleBrandLogo";
import BookingQRDialog from "@/components/BookingQRDialog";

interface Service { id: string; name: string; description: string | null; category: string; price: number; duration_minutes: number; }
interface Vehicle { id: string; make: string; model: string; year: number; registration: string; }

const steps = ["Services", "Vehicle", "Schedule", "Confirm"] as const;
const timeSlots = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"];

const todayPlus = (days: number) => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const BookService = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [date, setDate] = useState(todayPlus(2));
  const [time, setTime] = useState("10:00");
  const [priority, setPriority] = useState<"normal" | "express" | "priority">("normal");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);

  const { data: services, loading: servicesLoading } = useLiveTable<Service>("services", (q) => q.eq("active", true).order("category"));
  const { data: vehicles, loading: vehiclesLoading } = useLiveTable<Vehicle>("vehicles", (q) => q.eq("owner_id", user?.id ?? "").order("created_at", { ascending: false }), [user?.id], { enabled: !!user });
  const loading = servicesLoading || vehiclesLoading;

  // Auto-select the first vehicle once vehicles are loaded
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicle) {
      setSelectedVehicle(vehicles[0].id);
    }
  }, [vehicles, selectedVehicle]);

  const toggleService = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedServices = useMemo(
    () => services.filter((s) => selectedIds.has(s.id)),
    [services, selectedIds]
  );

  const primary = selectedServices[0];
  const recommended = useMemo(
    () => recommendRelated(primary, services, selectedIds, 3),
    [primary, services, selectedIds]
  );

  const subtotal = selectedServices.reduce((s, x) => s + Number(x.price || 0), 0);
  const totalDuration = selectedServices.reduce((s, x) => s + (x.duration_minutes || 0), 0);
  const surcharge = subtotal * (PRIORITY_MULTIPLIER[priority] - 1);
  const total = subtotal + surcharge;
  const veh = vehicles.find((v) => v.id === selectedVehicle);

  const submit = async () => {
    if (!user || selectedIds.size === 0 || !selectedVehicle) return;

    // Validate that the selected date + time is in the future
    const scheduled_at = new Date(`${date}T${time}:00`).toISOString();
    if (new Date(scheduled_at) < new Date()) {
      toast.error("Please select a future date and time.");
      return;
    }

    setBusy(true);
    const orderedIds = selectedServices.map((s) => s.id);
    const primaryId = orderedIds[0];
    const extras = orderedIds.slice(1);
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        customer_id: user.id,
        vehicle_id: selectedVehicle,
        service_id: primaryId,
        extra_service_ids: extras,
        scheduled_at,
        status: "pending",
        priority,
        notes: notes || null,
        total_cost: total,
      } as any)
      .select("id")
      .single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Booking confirmed!");
    setConfirmedBookingId(data.id);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-border/30 rounded-xl max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-bold text-on-surface">Add a vehicle first</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">You need to register a vehicle before booking a service.</p>
        <button onClick={() => navigate("/customer/vehicles")} className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-bold">Add Vehicle</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Book Service</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick one or more services, schedule, and confirm.</p>
      </div>

      <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i <= step ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-surface-container text-muted-foreground"}`}>
              {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider hidden sm:inline ${i <= step ? "text-primary" : "text-muted-foreground"}`}>{s}</span>
            {i < steps.length - 1 && <div className={`w-8 sm:w-12 h-px transition-colors ${i < step ? "bg-primary" : "bg-border/50"}`} />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s) => {
              const checked = selectedIds.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleService(s.id)}
                  className={`text-left bg-card p-5 rounded-xl border-2 transition-all hover:shadow-md relative ${checked ? "border-primary shadow-md ring-2 ring-primary/10" : "border-border/20 hover:border-border/40"}`}
                >
                  {checked && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg ${checked ? "bg-primary/10" : "bg-surface-container"}`}><Wrench className={`w-5 h-5 ${checked ? "text-primary" : "text-muted-foreground"}`} /></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.category}</span>
                  </div>
                  <h4 className="font-bold text-on-surface mb-1 pr-6">{s.name}</h4>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{s.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-black text-on-surface font-mono">{formatINR(s.price)}</span>
                    <span className="text-xs text-muted-foreground">{s.duration_minutes} min</span>
                  </div>
                </button>
              );
            })}
          </div>

          {recommended.length > 0 && (
            <div className="bg-gradient-to-br from-primary/5 to-primary/0 p-5 rounded-xl border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-on-surface">Recommended for your selection</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {recommended.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => toggleService(r.id)}
                    className="text-left bg-card p-3 rounded-lg border border-border/30 hover:border-primary/40 transition-all"
                  >
                    <p className="text-sm font-bold text-on-surface">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.category}</p>
                    <p className="text-sm font-mono text-primary mt-1 font-bold">+{formatINR(r.price)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="sticky bottom-2 sm:bottom-4 z-10">
            <div className="bg-card border border-border/30 shadow-xl rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{selectedIds.size} service{selectedIds.size === 1 ? "" : "s"} selected</p>
                <p className="text-base sm:text-lg font-black font-mono text-on-surface">{formatINR(subtotal)}</p>
              </div>
              <button
                disabled={selectedIds.size === 0}
                onClick={() => setStep(1)}
                className="w-full sm:w-auto bg-primary text-primary-foreground px-5 sm:px-6 py-3 rounded-lg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
              >
                Next: Choose Vehicle →
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="max-w-2xl mx-auto space-y-4">
          <h3 className="font-bold text-on-surface">Choose Vehicle</h3>
          {vehicles.map((v) => (
            <button key={v.id} onClick={() => { setSelectedVehicle(v.id); setStep(2); }} className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${selectedVehicle === v.id ? "border-primary bg-primary/5" : "border-border/20 bg-card hover:border-border/40"}`}>
              <VehicleBrandLogo make={v.make} size={44} />
              <div className="flex-1">
                <p className="font-bold text-on-surface">{v.year} {v.make} {v.model}</p>
                <p className="text-xs text-muted-foreground font-mono">{v.registration}</p>
              </div>
              {selectedVehicle === v.id && <CheckCircle className="w-5 h-5 text-primary" />}
            </button>
          ))}
          <div className="flex gap-3 pt-4">
            <button onClick={() => setStep(0)} className="px-6 py-3 border border-border/30 rounded-lg text-sm font-bold hover:bg-surface-container active:scale-[0.98] transition-all">← Back</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
              <h3 className="font-bold text-on-surface mb-4">Select Date</h3>
              <input type="date" min={todayPlus(0)} value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-surface-container-low border border-border/30 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
            </div>
            <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
              <h3 className="font-bold text-on-surface mb-1">Select Time Slot</h3>
              <p className="text-xs text-muted-foreground mb-4">Workshop hours: 9:00 AM – 6:00 PM IST</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {timeSlots.map((t) => {
                  const slotDateTime = new Date(`${date}T${t}:00`);
                  const isPast = slotDateTime < new Date();
                  return (
                    <button key={t} onClick={() => !isPast && setTime(t)} disabled={isPast}
                      className={`py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                        isPast
                          ? "bg-surface-container-low border border-border/20 text-muted-foreground/40 cursor-not-allowed line-through"
                          : time === t
                          ? "bg-primary text-primary-foreground shadow-lg"
                          : "bg-surface-container-low border border-border/30 text-on-surface hover:border-primary/30"
                      }`}>
                      <Clock className="w-3.5 h-3.5" /> {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
              <h3 className="font-bold text-on-surface mb-4">Priority</h3>
              <div className="grid grid-cols-3 gap-3">
                {(["normal", "express", "priority"] as const).map((p) => (
                  <button key={p} onClick={() => setPriority(p)} className={`py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${priority === p ? "bg-primary text-primary-foreground" : "bg-surface-container-low border border-border/30 text-on-surface"}`}>
                    {priorityLabel(p)}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Express adds 15% for same-day priority allocation. Priority adds 30% for next-bay-available service.</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
              <h3 className="font-bold text-on-surface mb-4">Notes (optional)</h3>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any specific concerns or requests…" className="w-full bg-surface-container-low border border-border/30 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-6 py-3 border border-border/30 rounded-lg text-sm font-bold hover:bg-surface-container active:scale-[0.98] transition-all">← Back</button>
              <button onClick={() => setStep(3)} className="ml-auto bg-primary text-primary-foreground px-6 py-3 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all">Next: Confirm →</button>
            </div>
          </div>
          <aside className="bg-card p-5 rounded-xl border border-border/20 shadow-sm h-fit space-y-4">
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Summary</h4>
            <div className="space-y-2 text-sm">
              {selectedServices.map((s) => (
                <div key={s.id} className="flex justify-between text-xs">
                  <span className="text-on-surface">{s.name}</span>
                  <span className="font-mono text-muted-foreground">{formatINR(s.price)}</span>
                </div>
              ))}
              <div className="border-t border-border/10 pt-2">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatINR(subtotal)}</span></div>
                {surcharge > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">{priorityLabel(priority)}</span><span className="font-mono">+{formatINR(surcharge)}</span></div>}
                <div className="flex justify-between mt-2"><span className="font-bold">Total</span><span className="text-lg font-black text-primary font-mono">{formatINR(total)}</span></div>
              </div>
              <div className="border-t border-border/10 pt-2 text-xs">
                <p className="text-muted-foreground">Vehicle</p>
                <p className="font-bold text-on-surface">{veh ? `${veh.year} ${veh.make} ${veh.model}` : "—"}</p>
              </div>
            </div>
          </aside>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
            <h3 className="font-bold text-on-surface mb-4">Confirm Booking</h3>
            <dl className="space-y-3">
              <div className="py-2 border-b border-border/10">
                <dt className="text-xs text-muted-foreground mb-1">Services ({selectedServices.length})</dt>
                {selectedServices.map((s) => (
                  <dd key={s.id} className="text-sm font-semibold text-on-surface flex justify-between">
                    <span>• {s.name}</span><span className="font-mono">{formatINR(s.price)}</span>
                  </dd>
                ))}
              </div>
              <div className="flex justify-between py-2 border-b border-border/10"><dt className="text-sm text-muted-foreground">Vehicle</dt><dd className="text-sm font-semibold text-on-surface">{veh?.year} {veh?.make} {veh?.model}</dd></div>
              <div className="flex justify-between py-2 border-b border-border/10"><dt className="text-sm text-muted-foreground">Registration</dt><dd className="text-sm font-mono font-semibold">{veh?.registration}</dd></div>
              <div className="flex justify-between py-2 border-b border-border/10"><dt className="text-sm text-muted-foreground">Date & Time</dt><dd className="text-sm font-semibold">{date} • {time}</dd></div>
              <div className="flex justify-between py-2 border-b border-border/10"><dt className="text-sm text-muted-foreground">Estimated Duration</dt><dd className="text-sm font-semibold">{Math.round(totalDuration / 60 * 10) / 10}h</dd></div>
              <div className="flex justify-between py-2 border-b border-border/10"><dt className="text-sm text-muted-foreground">Priority</dt><dd className="text-sm font-semibold">{priorityLabel(priority)}</dd></div>
              {surcharge > 0 && (
                <div className="flex justify-between py-2 border-b border-border/10"><dt className="text-sm text-muted-foreground">Priority surcharge</dt><dd className="text-sm font-semibold font-mono">+{formatINR(surcharge)}</dd></div>
              )}
              <div className="flex justify-between py-2"><dt className="text-sm font-bold">Total Amount</dt><dd className="text-xl font-black text-primary font-mono">{formatINR(total)}</dd></div>
            </dl>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} disabled={busy} className="px-6 py-3 border border-border/30 rounded-lg text-sm font-bold hover:bg-surface-container active:scale-[0.98] transition-all">← Back</button>
            <button onClick={submit} disabled={busy} className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Booking
            </button>
          </div>
        </div>
      )}

      {confirmedBookingId && (
        <BookingQRDialog
          bookingId={confirmedBookingId}
          type="dropoff"
          onClose={() => {
            setConfirmedBookingId(null);
            navigate("/customer/bookings");
          }}
        />
      )}
    </div>
  );
};

export default BookService;
