// Staff-facing QR scanner / code-entry page used to check vehicles in and release them at pickup.
import { useState } from "react";
import { ScanLine, Car, ShieldCheck, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";

interface BookingMatch {
  id: string;
  status: string;
  scheduled_at: string;
  customer_id: string;
  vehicle_id: string;
  service_id: string;
  assigned_to: string | null;
  dropoff_code: string | null;
  pickup_code: string | null;
}

const ScanHandoff = () => {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ booking: BookingMatch; vehicle: any; service: any; mode: "dropoff" | "pickup" } | null>(null);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setResult(null);
    const trimmed = code.trim().toUpperCase();
    const isDropoff = trimmed.startsWith("DROP-");
    const isPickup = trimmed.startsWith("PICK-");
    if (!isDropoff && !isPickup) {
      setBusy(false);
      toast.error("Code must start with DROP- or PICK-");
      return;
    }
    const column = isDropoff ? "dropoff_code" : "pickup_code";
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq(column, trimmed)
      .maybeSingle();
    if (error || !data) {
      setBusy(false);
      toast.error("No booking found for this code");
      return;
    }
    const [{ data: vehicle }, { data: service }] = await Promise.all([
      supabase.from("vehicles").select("*").eq("id", data.vehicle_id).maybeSingle(),
      supabase.from("services").select("*").eq("id", data.service_id).maybeSingle(),
    ]);
    setBusy(false);
    setResult({ booking: data as BookingMatch, vehicle, service, mode: isDropoff ? "dropoff" : "pickup" });
  };

  const confirmCheckIn = async () => {
    if (!result) return;
    setBusy(true);
    const { error } = await supabase.from("bookings").update({
      status: "checked_in",
      checked_in_at: new Date().toISOString(),
      assigned_to: result.booking.assigned_to ?? user?.id,
    } as any).eq("id", result.booking.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await supabase.from("notifications").insert({
      user_id: result.booking.customer_id,
      title: "Vehicle Checked In",
      message: `Your ${result.vehicle?.make} ${result.vehicle?.model} has been received. Work will start shortly.`,
      type: "info",
    });
    toast.success("Vehicle checked in");
    setResult(null);
    setCode("");
  };

  const confirmRelease = async () => {
    if (!result) return;
    setBusy(true);
    const { error } = await supabase.from("bookings").update({
      status: "released",
      released_at: new Date().toISOString(),
    } as any).eq("id", result.booking.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await supabase.from("notifications").insert({
      user_id: result.booking.customer_id,
      title: "Vehicle Released",
      message: `Your ${result.vehicle?.make} ${result.vehicle?.model} has been released. Drive safe!`,
      type: "success",
    });
    toast.success("Vehicle released to customer");
    setResult(null);
    setCode("");
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Vehicle Hand-off Scanner</h1>
        <p className="text-sm text-muted-foreground mt-1">Scan or enter the customer's QR code to check vehicles in or release them.</p>
      </div>

      <form onSubmit={lookup} className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
        <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-2">Booking code</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().trim())}
              onPaste={(e) => {
                const txt = e.clipboardData.getData("text").trim().toUpperCase();
                const match = txt.match(/(DROP|PICK)-[A-Z0-9]+/);
                if (match) {
                  e.preventDefault();
                  setCode(match[0]);
                }
              }}
              placeholder="DROP-XXXXXXXX or PICK-XXXXXXXX"
              className="w-full pl-10 pr-3 py-3 bg-surface-container-low border border-border/30 rounded-lg font-mono text-sm uppercase tracking-wider focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="px-5 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-50 active:scale-[0.98] transition-all flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
            Lookup
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => setCode("DROP-")}
            className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors"
          >
            <Car className="w-3 h-3 inline mr-1" /> Drop-off
          </button>
          <button
            type="button"
            onClick={() => setCode("PICK-")}
            className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full hover:bg-emerald-100 transition-colors"
          >
            <ShieldCheck className="w-3 h-3 inline mr-1" /> Pick-up
          </button>
          {code && (
            <button
              type="button"
              onClick={() => setCode("")}
              className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-surface-container text-muted-foreground rounded-full hover:bg-surface-container-high transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Tip: USB barcode scanners type the code and submit automatically. You can also paste a full QR payload — the code is auto-extracted.
        </p>
      </form>

      {result && (
        <div className={`bg-card p-6 rounded-xl border-2 shadow-md ${result.mode === "dropoff" ? "border-primary/30" : "border-emerald-500/30"}`}>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 ${result.mode === "dropoff" ? "bg-primary/10 text-primary" : "bg-emerald-50 text-emerald-600"}`}>
            {result.mode === "dropoff" ? <Car className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
            {result.mode === "dropoff" ? "Drop-off — verify and check in" : "Pick-up — verify and release"}
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <Cell label="Vehicle" value={result.vehicle ? `${result.vehicle.year} ${result.vehicle.make} ${result.vehicle.model}` : "—"} />
            <Cell label="Registration" value={result.vehicle?.registration ?? "—"} mono />
            <Cell label="Service" value={result.service?.name ?? "—"} />
            <Cell label="Scheduled" value={formatDateTime(result.booking.scheduled_at)} />
            <Cell label="Current Status" value={result.booking.status.replace("_", " ").toUpperCase()} mono />
          </div>

          {result.mode === "dropoff" && result.booking.status === "checked_in" && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg text-xs mb-4">
              <AlertCircle className="w-4 h-4" /> This vehicle is already checked in.
            </div>
          )}
          {result.mode === "pickup" && result.booking.status === "released" && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-xs mb-4">
              <CheckCircle2 className="w-4 h-4" /> This vehicle has already been released.
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setResult(null); setCode(""); }} className="px-5 py-3 border border-border/30 rounded-lg text-sm font-bold hover:bg-surface-container">Cancel</button>
            {result.mode === "dropoff" ? (
              <button onClick={confirmCheckIn} disabled={busy || result.booking.status === "checked_in"} className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-bold active:scale-[0.98] disabled:opacity-50">
                Confirm Check-in
              </button>
            ) : (
              <button onClick={confirmRelease} disabled={busy || result.booking.status === "released"} className="flex-1 py-3 bg-emerald-600 text-white rounded-lg text-sm font-bold active:scale-[0.98] disabled:opacity-50">
                Confirm Release
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Cell = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
    <p className={`text-sm font-bold text-on-surface mt-1 ${mono ? "font-mono" : ""}`}>{value}</p>
  </div>
);

export default ScanHandoff;
