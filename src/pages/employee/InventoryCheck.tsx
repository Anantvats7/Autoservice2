import { useEffect, useState } from "react";
import { Package, AlertTriangle, Search, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import QuantityPromptDialog from "@/components/QuantityPromptDialog";

interface Item {
  id: string; name: string; sku: string; category: string; quantity: number;
  reorder_level: number; unit_price: number; supplier: string | null;
}

const EmployeeInventoryCheck = () => {
  const { data: items } = useLiveTable<Item>("inventory", (q) => q.order("name"));
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [consumeTarget, setConsumeTarget] = useState<Item | null>(null);

  // Optimistic overrides for instant feedback
  const [optimistic, setOptimistic] = useState<Record<string, Partial<Item>>>({});
  useEffect(() => { setOptimistic({}); }, [items]);

  const displayed = items.map((i) => optimistic[i.id] ? { ...i, ...optimistic[i.id] } as Item : i);

  const filtered = displayed.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku.toLowerCase().includes(search.toLowerCase())
  );

  const lowCount = displayed.filter((i) => i.quantity <= i.reorder_level).length;
  const totalSkus = displayed.length;
  const totalValue = displayed.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  const openConsume = (item: Item) => {
    if (item.quantity <= 0) return;
    setConsumeTarget(item);
  };

  const confirmConsume = async (qty: number) => {
    if (!consumeTarget) return;
    const item = consumeTarget;
    const safeQty = Math.max(1, Math.min(qty, item.quantity));
    const newQty = item.quantity - safeQty;
    setOptimistic((prev) => ({ ...prev, [item.id]: { ...prev[item.id], quantity: newQty } }));
    setBusy(true);
    const { error } = await supabase
      .from("inventory")
      .update({ quantity: newQty })
      .eq("id", item.id);
    setBusy(false);
    if (error) {
      setOptimistic((prev) => { const { [item.id]: _, ...next } = prev; return next; });
      toast.error(error.message);
    } else {
      toast.success(`Logged ${safeQty} × ${item.name} used`);
      setConsumeTarget(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Parts & Inventory</h1>
        <p className="text-sm text-muted-foreground mt-1">Check stock and log parts consumption. Manager handles restocking.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
          <div className="p-2 bg-primary/10 rounded-lg w-fit mb-3"><Package className="w-5 h-5 text-primary" /></div>
          <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">Total SKUs</p>
          <p className="text-2xl lg:text-3xl font-black text-on-surface mt-1">{totalSkus}</p>
        </div>
        <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
          <div className="p-2 bg-destructive/10 rounded-lg w-fit mb-3"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
          <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">Low Stock</p>
          <p className="text-2xl lg:text-3xl font-black text-destructive mt-1">{lowCount}</p>
        </div>
        <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm col-span-2 lg:col-span-1">
          <div className="p-2 bg-emerald-50 rounded-lg w-fit mb-3"><Package className="w-5 h-5 text-emerald-600" /></div>
          <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">Inventory Value</p>
          <p className="text-2xl lg:text-3xl font-black text-on-surface mt-1 font-mono">{formatINR(totalValue)}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU…"
          className="w-full pl-11 pr-4 py-3 bg-card border border-border/20 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
      </div>

      <div className="bg-card rounded-xl border border-border/20 shadow-sm">
        <div className="divide-y divide-border/10">
          {filtered.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No parts found.</div>}
          {filtered.map((p) => {
            const isLow = p.quantity <= p.reorder_level;
            const isCritical = p.quantity <= Math.floor(p.reorder_level / 2);
            const pct = Math.min(100, (p.quantity / Math.max(p.reorder_level * 2, 1)) * 100);
            return (
              <div key={p.id} className="flex items-center justify-between p-4 lg:px-6 hover:bg-surface-container-low/50 transition-colors gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-surface-container rounded-lg flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{p.sku} • {p.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="w-20 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${isCritical ? "bg-destructive" : isLow ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{p.quantity} left</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${isCritical ? "text-destructive bg-destructive/10" : isLow ? "text-amber-700 bg-amber-100" : "text-emerald-700 bg-emerald-100"}`}>
                    {isCritical ? "Critical" : isLow ? "Low" : "OK"}
                  </span>
                  <button onClick={() => openConsume(p)} disabled={busy || p.quantity <= 0}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-40">
                    <Minus className="w-3 h-3" /> Log Use
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <QuantityPromptDialog
        open={!!consumeTarget}
        title={consumeTarget ? `Log usage — ${consumeTarget.name}` : ""}
        description={consumeTarget ? `Available: ${consumeTarget.quantity} ${consumeTarget.quantity === 1 ? "unit" : "units"}` : undefined}
        label="Quantity used"
        confirmLabel="Log Usage"
        defaultValue={1}
        min={1}
        max={consumeTarget?.quantity}
        busy={busy}
        onConfirm={confirmConsume}
        onCancel={() => setConsumeTarget(null)}
      />
    </div>
  );
};

export default EmployeeInventoryCheck;
