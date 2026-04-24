import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Edit2, Trash2, X, Package, AlertTriangle, IndianRupee, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import QuantityPromptDialog from "@/components/QuantityPromptDialog";

interface Item {
  id: string; name: string; sku: string; category: string; quantity: number;
  reorder_level: number; unit_price: number; supplier: string | null;
}

const CATEGORIES = ["Engine", "Brakes", "Tires", "Electrical", "Filters", "Lubricants", "AC", "Body", "Other"];

const empty = { name: "", sku: "", category: "Engine", quantity: 0, reorder_level: 5, unit_price: 0, supplier: "" };

const ManagerInventory = () => {
  const { data: items } = useLiveTable<Item>("inventory", (q) => q.order("name"));
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "low">("all");
  const [editing, setEditing] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Item | null>(null);
  const [restockBusy, setRestockBusy] = useState(false);

  // Optimistic overrides for instant restock feedback
  const [optimistic, setOptimistic] = useState<Record<string, Partial<Item>>>({});
  useEffect(() => { setOptimistic({}); }, [items]);

  const displayed = useMemo(
    () => items.map((i) => optimistic[i.id] ? { ...i, ...optimistic[i.id] } : i),
    [items, optimistic]
  );

  const filtered = useMemo(() => {
    return displayed.filter((i) => {
      if (tab === "low" && i.quantity > i.reorder_level) return false;
      if (search) {
        const hay = `${i.name} ${i.sku} ${i.category} ${i.supplier ?? ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [displayed, tab, search]);

  const totalValue = displayed.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const lowCount = displayed.filter((i) => i.quantity <= i.reorder_level).length;

  const openCreate = () => { setEditing(null); setForm(empty); setShowForm(true); };
  const openEdit = (i: Item) => {
    setEditing(i);
    setForm({ name: i.name, sku: i.sku, category: i.category, quantity: i.quantity, reorder_level: i.reorder_level, unit_price: i.unit_price, supplier: i.supplier ?? "" });
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name, sku: form.sku, category: form.category,
      quantity: parseInt(form.quantity, 10) || 0,
      reorder_level: parseInt(form.reorder_level, 10) || 0,
      unit_price: parseFloat(form.unit_price) || 0,
      supplier: form.supplier || null,
    };
    const { error } = editing
      ? await supabase.from("inventory").update(payload).eq("id", editing.id)
      : await supabase.from("inventory").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Updated" : "Added to inventory");
    setShowForm(false);
  };

  const restock = (i: Item) => setRestockTarget(i);

  const confirmRestock = async (qty: number) => {
    if (!restockTarget) return;
    const target = restockTarget.quantity + qty;
    setRestockBusy(true);
    setOptimistic((prev) => ({ ...prev, [restockTarget.id]: { ...prev[restockTarget.id], quantity: target } }));
    const { error } = await supabase.from("inventory").update({ quantity: target }).eq("id", restockTarget.id);
    setRestockBusy(false);
    if (error) {
      setOptimistic((prev) => { const { [restockTarget.id]: _, ...next } = prev; return next; });
      toast.error(error.message);
      return;
    }
    toast.success(`Added ${qty} × ${restockTarget.name} (now ${target})`);
    setRestockTarget(null);
  };

  const remove = async (i: Item) => {
    if (!confirm(`Delete ${i.name}?`)) return;
    const { error } = await supabase.from("inventory").delete().eq("id", i.id);
    if (error) toast.error(error.message);
    else toast.success("Deleted");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Inventory Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time parts stock, pricing, and procurement.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all self-start">
          <Plus className="w-4 h-4" /> Add Part
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total SKUs" value={String(displayed.length)} icon={Package} bg="bg-primary/10" color="text-primary" />
        <Kpi label="Low Stock" value={String(lowCount)} icon={AlertTriangle} bg="bg-destructive/10" color="text-destructive" valueColor="text-destructive" />
        <Kpi label="Suppliers" value={String(new Set(displayed.map((i) => i.supplier).filter(Boolean)).size)} icon={Truck} bg="bg-primary/10" color="text-primary" />
        <Kpi label="Inventory Value" value={formatINR(totalValue)} icon={IndianRupee} bg="bg-emerald-50" color="text-emerald-600" mono />
      </div>

      <div className="bg-card rounded-xl border border-border/20 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 lg:p-6 border-b border-border/20 gap-4">
          <div className="flex gap-2">
            <button onClick={() => setTab("all")} className={`px-3 py-1.5 rounded-full text-xs font-bold ${tab === "all" ? "bg-on-surface text-card" : "bg-surface-container text-muted-foreground"}`}>All</button>
            <button onClick={() => setTab("low")} className={`px-3 py-1.5 rounded-full text-xs font-bold ${tab === "low" ? "bg-destructive/10 text-destructive" : "bg-surface-container text-muted-foreground"}`}>● Low Stock</button>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              className="w-full pl-10 pr-3 py-2 bg-surface-container border border-border/20 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
                <th className="text-left py-3 px-6 font-bold">Item</th>
                <th className="text-left py-3 px-4 font-bold">Category</th>
                <th className="text-left py-3 px-4 font-bold">Stock</th>
                <th className="text-left py-3 px-4 font-bold">Unit Price</th>
                <th className="text-left py-3 px-4 font-bold">Supplier</th>
                <th className="text-center py-3 px-4 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No inventory items.</td></tr>
              )}
              {filtered.map((i) => {
                const isLow = i.quantity <= i.reorder_level;
                const isCritical = i.quantity <= Math.floor(i.reorder_level / 2);
                return (
                  <tr key={i.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-4 px-6">
                      <p className="text-sm font-semibold text-on-surface">{i.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{i.sku}</p>
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground">{i.category}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${isCritical ? "text-destructive" : isLow ? "text-amber-600" : "text-on-surface"}`}>{i.quantity}</span>
                        {isLow && (
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isCritical ? "text-destructive bg-destructive/10" : "text-amber-700 bg-amber-100"}`}>
                            {isCritical ? "Critical" : "Low"}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">reorder at {i.reorder_level}</p>
                    </td>
                    <td className="py-4 px-4 text-sm font-mono text-on-surface">{formatINR(i.unit_price)}</td>
                    <td className="py-4 px-4 text-xs text-muted-foreground">{i.supplier || "—"}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-1">
                        {isLow && (
                          <button onClick={() => restock(i)} className="px-2 py-1 text-[10px] font-bold bg-primary text-primary-foreground rounded hover:bg-primary/90">Restock</button>
                        )}
                        <button onClick={() => openEdit(i)} className="p-1.5 hover:bg-surface-container rounded text-muted-foreground hover:text-on-surface"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(i)} className="p-1.5 hover:bg-destructive/10 rounded text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-on-surface">{editing ? "Edit Part" : "Add Part"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-surface-container rounded"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <Field label="Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SKU"><input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" /></Field>
                <Field label="Category"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity"><input type="number" min={0} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" /></Field>
                <Field label="Reorder Level"><input type="number" min={0} required value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" /></Field>
              </div>
              <Field label="Unit Price (₹)"><input type="number" step="0.01" min={0} required value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" /></Field>
              <Field label="Supplier"><input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="optional" className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" /></Field>
              <button type="submit" disabled={saving} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-50">
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Part"}
              </button>
            </form>
          </div>
        </div>
      )}

      <QuantityPromptDialog
        open={!!restockTarget}
        title={restockTarget ? `Restock ${restockTarget.name}` : ""}
        description={restockTarget ? `Current stock: ${restockTarget.quantity} • Reorder at ${restockTarget.reorder_level}` : undefined}
        label="Quantity to add"
        confirmLabel="Add to Stock"
        defaultValue={restockTarget ? Math.max(restockTarget.reorder_level * 2 - restockTarget.quantity, 1) : 1}
        min={1}
        busy={restockBusy}
        onConfirm={confirmRestock}
        onCancel={() => setRestockTarget(null)}
      />
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1.5">{label}</span>
    {children}
  </label>
);

const Kpi = ({ label, value, icon: Icon, bg, color, valueColor, mono }: { label: string; value: string; icon: any; bg: string; color: string; valueColor?: string; mono?: boolean }) => (
  <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
    <div className="flex justify-between items-start mb-3">
      <div className={`p-2 rounded-lg ${bg}`}><Icon className={`w-5 h-5 ${color}`} /></div>
    </div>
    <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">{label}</p>
    <p className={`text-2xl lg:text-3xl font-black mt-1 ${valueColor || "text-on-surface"} ${mono ? "font-mono" : ""}`}>{value}</p>
  </div>
);

export default ManagerInventory;
