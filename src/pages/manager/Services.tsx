import { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Trash2, X, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";

interface Service {
  id: string; name: string; description: string | null; category: string;
  price: number; duration_minutes: number; active: boolean;
}

const CATEGORIES = ["All", "Maintenance", "Engine", "Brakes", "Tyres", "Electrical", "AC", "Body", "Cleaning", "Diagnostics", "Repair", "Inspection", "Other"];
const empty = { name: "", description: "", category: "Maintenance", price: 0, duration_minutes: 60, active: true };

const ManagerServices = () => {
  const { data: services } = useLiveTable<Service>("services", (q) => q.order("name"));
  const [activeCategory, setActiveCategory] = useState("All");
  const [editing, setEditing] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  // Optimistic overrides for instant toggle feedback
  const [optimistic, setOptimistic] = useState<Record<string, Partial<Service>>>({});
  useEffect(() => { setOptimistic({}); }, [services]);

  const displayed = useMemo(
    () => services.map((s) => optimistic[s.id] ? { ...s, ...optimistic[s.id] } : s),
    [services, optimistic]
  );

  const filtered = useMemo(
    () => activeCategory === "All" ? displayed : displayed.filter((s) => s.category === activeCategory),
    [displayed, activeCategory]
  );

  const openCreate = () => { setEditing(null); setForm(empty); setShowForm(true); };
  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description ?? "", category: s.category, price: s.price, duration_minutes: s.duration_minutes, active: s.active });
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name, description: form.description || null, category: form.category,
      price: parseFloat(form.price) || 0, duration_minutes: parseInt(form.duration_minutes, 10) || 60, active: form.active,
    };
    const { error } = editing
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Service updated" : "Service added");
    setShowForm(false);
  };

  const toggleActive = async (s: Service) => {
    const newActive = !s.active;
    // Optimistic update — instant visual feedback
    setOptimistic((prev) => ({ ...prev, [s.id]: { ...prev[s.id], active: newActive } }));
    const { error } = await supabase.from("services").update({ active: newActive }).eq("id", s.id);
    if (error) {
      setOptimistic((prev) => { const { [s.id]: _, ...next } = prev; return next; });
      toast.error(error.message);
    } else {
      toast.success(`${s.name} ${newActive ? "activated" : "deactivated"}`);
    }
  };

  const remove = async (s: Service) => {
    if (!confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("services").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else toast.success("Deleted");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Service Catalogue</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage offerings, pricing (₹), and labor times.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all self-start">
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setActiveCategory(c)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              activeCategory === c ? "bg-on-surface text-card" : "bg-surface-container text-muted-foreground hover:bg-surface-container-high"
            }`}>{c}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {filtered.map((s) => (
          <div key={s.id} className={`bg-card p-5 lg:p-6 rounded-xl border border-border/20 shadow-sm transition-opacity ${!s.active ? "opacity-60" : ""}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Wrench className="w-5 h-5 text-primary" />
              </div>
              <button onClick={() => toggleActive(s)} className={`w-10 h-5 rounded-full flex items-center p-0.5 transition-colors ${s.active ? "bg-primary justify-end" : "bg-surface-container-high justify-start"}`}>
                <div className="w-4 h-4 bg-card rounded-full shadow-sm" />
              </button>
            </div>
            <h3 className="font-bold text-on-surface mb-1">{s.name}</h3>
            <p className="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-[2rem]">{s.description || "—"}</p>
            <div className="flex gap-4 mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Price</p>
                <p className="text-lg font-black text-on-surface font-mono">{formatINR(s.price)}</p>
              </div>
              <div className="border-l border-border/30 pl-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Duration</p>
                <p className="text-lg font-black text-on-surface">{s.duration_minutes}<span className="text-xs font-normal text-muted-foreground"> min</span></p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded ${s.active ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10"}`}>
                {s.active ? s.category : "Inactive"}
              </span>
              <div className="flex gap-1">
                <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-surface-container rounded text-muted-foreground hover:text-on-surface"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(s)} className="p-1.5 hover:bg-destructive/10 rounded text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        ))}

        <button onClick={openCreate} className="border-2 border-dashed border-border/40 rounded-xl flex flex-col items-center justify-center p-8 text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors min-h-[200px]">
          <Plus className="w-8 h-8 mb-2" />
          <span className="text-[10px] uppercase tracking-wider font-bold">Add Service</span>
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-on-surface">{editing ? "Edit Service" : "Add Service"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-surface-container rounded"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <Field label="Service Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" /></Field>
              <Field label="Description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 resize-y" /></Field>
              <Field label="Category"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none">{CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (₹)"><input type="number" step="0.01" min={0} required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" /></Field>
                <Field label="Duration (min)"><input type="number" min={1} required value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-on-surface">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 accent-primary" />
                Active (available for booking)
              </label>
              <button type="submit" disabled={saving} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-50">
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Service"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1.5">{label}</span>
    {children}
  </label>
);

export default ManagerServices;
