// Customer vehicles page with brand logos and an AI-powered maintenance tip section.
import { useState } from "react";
import { Plus, Pencil, Trash2, X, Loader2, Sparkles, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import VehicleBrandLogo from "@/components/VehicleBrandLogo";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  registration: string;
  mileage: number;
  color: string | null;
  fuel_type: string | null;
}

const FUEL_TYPES = ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"];
const POPULAR_MAKES = ["Maruti Suzuki", "Tata", "Mahindra", "Hyundai", "Honda", "Toyota", "Kia", "MG", "Renault", "Volkswagen", "Skoda", "BMW", "Mercedes-Benz", "Audi", "Ford", "Nissan"];

const empty = { make: "Maruti Suzuki", model: "", year: new Date().getFullYear(), registration: "", color: "", fuel_type: "Petrol", mileage: 0 };

const CustomerVehicles = () => {
  const { user } = useAuth();
  const { data: vehicles, loading } = useLiveTable<Vehicle>("vehicles", (q) => q.eq("owner_id", user?.id ?? "").order("created_at", { ascending: false }), [user?.id], { enabled: !!user });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  // AI maintenance tips per vehicle
  const [tipsByVehicle, setTipsByVehicle] = useState<Record<string, { loading: boolean; tips: string[] | null; error: string | null }>>({});

  const openAdd = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({ make: v.make, model: v.model, year: v.year, registration: v.registration, color: v.color ?? "", fuel_type: v.fuel_type ?? "Petrol", mileage: v.mileage });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const payload = { ...form, owner_id: user.id };
    const res = editing
      ? await supabase.from("vehicles").update(payload).eq("id", editing.id)
      : await supabase.from("vehicles").insert(payload);
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editing ? "Vehicle updated" : "Vehicle added");
    setOpen(false);
  };

  const remove = async (v: Vehicle) => {
    if (!confirm(`Remove ${v.make} ${v.model}? This will also remove related bookings and history.`)) return;
    const { error } = await supabase.from("vehicles").delete().eq("id", v.id);
    if (error) toast.error(error.message); else toast.success("Vehicle removed");
  };

  const fetchTips = async (v: Vehicle) => {
    setTipsByVehicle((p) => ({ ...p, [v.id]: { loading: true, tips: null, error: null } }));
    try {
      const { data, error } = await supabase.functions.invoke("ai-maintenance-tips", {
        body: { make: v.make, model: v.model, year: v.year, mileage: v.mileage, fuel_type: v.fuel_type },
      });
      if (error) throw error;
      setTipsByVehicle((p) => ({ ...p, [v.id]: { loading: false, tips: data?.tips ?? [], error: null } }));
    } catch (e: any) {
      setTipsByVehicle((p) => ({ ...p, [v.id]: { loading: false, tips: null, error: e.message ?? "Could not fetch tips" } }));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">My Vehicles</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your garage and get AI-powered maintenance recommendations.</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all self-start">
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border/30 rounded-xl">
          <VehicleBrandLogo make={null} size={48} className="mx-auto mb-3" />
          <h3 className="font-bold text-on-surface">No vehicles yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Add your first vehicle to start booking services.</p>
          <button onClick={openAdd} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-bold">
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicles.map((v) => {
            const tip = tipsByVehicle[v.id];
            return (
              <div key={v.id} className="bg-card rounded-xl border border-border/20 shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <VehicleBrandLogo make={v.make} size={44} />
                      <div className="min-w-0">
                        <h3 className="font-bold text-on-surface truncate">{v.year} {v.make} {v.model}</h3>
                        <p className="text-xs text-muted-foreground">{v.color || "—"} • {v.fuel_type}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider bg-emerald-50 text-emerald-600 shrink-0">Active</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-mono bg-surface-container px-2 py-1 rounded">{v.registration}</span>
                    <span className="text-xs font-mono text-muted-foreground">{v.mileage.toLocaleString("en-IN")} km</span>
                  </div>

                  <div className="mt-4 p-3 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-primary flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> AI Maintenance Tips
                      </p>
                      <button
                        onClick={() => fetchTips(v)}
                        disabled={tip?.loading}
                        className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline disabled:opacity-50"
                      >
                        {tip?.tips ? "Refresh" : "Get tips"}
                      </button>
                    </div>
                    {!tip && <p className="text-xs text-muted-foreground">Tap "Get tips" for personalised recommendations based on your vehicle's age, fuel type and odometer.</p>}
                    {tip?.loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Thinking…</div>}
                    {tip?.error && <p className="text-xs text-destructive">{tip.error}</p>}
                    {tip?.tips && (
                      <ul className="space-y-1.5">
                        {tip.tips.slice(0, 4).map((t, i) => (
                          <li key={i} className="text-xs text-on-surface flex gap-2"><span className="text-primary">•</span> {t}</li>
                        ))}
                      </ul>
                    )}
                    {tip?.tips && (
                      <Link to="/customer/book" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline">
                        <Calendar className="w-3 h-3" /> Book a service
                      </Link>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button onClick={() => openEdit(v)} className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border/30 rounded-lg text-xs font-bold hover:bg-surface-container active:scale-[0.98] transition-all">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => remove(v)} className="px-3 py-2 border border-destructive/30 rounded-lg text-destructive hover:bg-destructive/5 active:scale-[0.98] transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface">{editing ? "Edit Vehicle" : "Add New Vehicle"}</h3>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-surface-container rounded"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-1">Make</label>
                  <select value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} className="w-full bg-surface-container-low border border-border/30 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                    {POPULAR_MAKES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-1">Model</label>
                  <input required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Swift VXi" className="w-full bg-surface-container-low border border-border/30 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-1">Year</label>
                  <input required type="number" min={1990} max={2030} value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 0 })} className="w-full bg-surface-container-low border border-border/30 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-1">Mileage (km)</label>
                  <input required type="number" min={0} value={form.mileage} onChange={(e) => setForm({ ...form, mileage: parseInt(e.target.value) || 0 })} className="w-full bg-surface-container-low border border-border/30 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-1">Registration</label>
                <input required value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value.toUpperCase() })} placeholder="HR 26 BX 1234" className="w-full bg-surface-container-low border border-border/30 rounded-lg py-2 px-3 text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-1">Color</label>
                  <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Pearl White" className="w-full bg-surface-container-low border border-border/30 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-1">Fuel</label>
                  <select value={form.fuel_type} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })} className="w-full bg-surface-container-low border border-border/30 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                    {FUEL_TYPES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 border border-border/30 rounded-lg text-sm font-bold hover:bg-surface-container active:scale-[0.98] transition-all">Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? "Save changes" : "Add vehicle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerVehicles;
