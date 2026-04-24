// Production resale value predictor — uses AutoServe AI on real customer vehicles, returns INR estimates.
import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, AlertTriangle, Car, Shield, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import VehicleBrandLogo from "@/components/VehicleBrandLogo";

interface Vehicle { id: string; make: string; model: string; year: number; registration: string; mileage: number; fuel_type: string | null; }

interface Result {
  estimated_value: number;
  base_value: number;
  trend_pct: number;
  confidence: number;
  insights: string[];
  warnings: string[];
  depreciation: { months: number; value: number }[];
}

const conditions = ["Fair", "Good", "Excellent"] as const;

const Valuation = () => {
  const { user } = useAuth();
  const { data: vehicles } = useLiveTable<Vehicle>("vehicles", (q) => q.eq("owner_id", user?.id ?? ""), [user?.id], { enabled: !!user });

  const [vehicleId, setVehicleId] = useState<string>("");
  const [condition, setCondition] = useState<typeof conditions[number]>("Good");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (vehicles.length > 0 && !vehicleId) setVehicleId(vehicles[0].id);
  }, [vehicles, vehicleId]);

  const v = vehicles.find((x) => x.id === vehicleId);

  const calculate = async () => {
    if (!v) return;
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-resale-valuation", {
        body: {
          vehicle: { make: v.make, model: v.model, year: v.year, mileage: v.mileage, fuel_type: v.fuel_type },
          condition,
        },
      });
      if (error) throw error;
      setResult(data as Result);
    } catch (e: any) {
      toast.error(e.message ?? "Valuation failed");
    } finally {
      setBusy(false);
    }
  };

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-border/30 rounded-xl max-w-lg mx-auto">
        <Car className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-bold text-on-surface">No vehicles to value</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Add a vehicle to see its current Indian-market resale price.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Resale Value Predictor</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-powered estimate based on Indian market conditions.</p>
        </div>
        <button
          onClick={calculate}
          disabled={busy || !v}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50 self-start"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {busy ? "Calculating…" : result ? "Recalculate" : "Calculate Value"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Car className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Parameters</h3>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-2">Vehicle</label>
              <div className="space-y-2">
                {vehicles.map((veh) => (
                  <button
                    key={veh.id}
                    onClick={() => { setVehicleId(veh.id); setResult(null); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      vehicleId === veh.id ? "border-primary bg-primary/5" : "border-border/20 hover:border-border/40"
                    }`}
                  >
                    <VehicleBrandLogo make={veh.make} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-on-surface truncate">{veh.year} {veh.make} {veh.model}</p>
                      <p className="text-xs text-muted-foreground font-mono">{veh.mileage.toLocaleString("en-IN")} km · {veh.fuel_type}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-3">Condition</label>
              <div className="grid grid-cols-3 gap-2">
                {conditions.map(c => (
                  <button
                    key={c}
                    onClick={() => setCondition(c)}
                    className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition-all ${
                      condition === c ? "border-primary bg-primary/10 text-primary" : "border-border/30 text-on-surface hover:border-border/60"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {!result && !busy && (
            <div className="bg-card p-12 rounded-xl border border-dashed border-border/40 text-center">
              <Car className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-on-surface font-bold">Ready to value your {v?.make} {v?.model}</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Calculate Value" to get an instant Indian-market estimate.</p>
            </div>
          )}
          {busy && (
            <div className="bg-card p-12 rounded-xl border border-border/20 shadow-sm flex flex-col items-center text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-on-surface font-bold">Analysing market data…</p>
              <p className="text-xs text-muted-foreground mt-1">Comparing recent listings, depreciation curves, and demand.</p>
            </div>
          )}

          {result && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Estimated Resale Value</span>
                  </div>
                  <p className="text-4xl font-black tracking-tight font-mono">{formatINR(result.estimated_value)}</p>
                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                    <span className={`text-sm flex items-center gap-1 ${result.trend_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {result.trend_pct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {result.trend_pct >= 0 ? "+" : ""}{result.trend_pct}% recent trend
                    </span>
                    <span className="text-sm text-slate-400">Base: <span className="font-mono font-bold">{formatINR(result.base_value)}</span></span>
                  </div>
                </div>

                <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm flex flex-col items-center justify-center">
                  <div className="relative w-24 h-24">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--surface-container-high))" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeDasharray={`${result.confidence * 2.64} ${264 - result.confidence * 2.64}`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-black text-on-surface">{result.confidence}%</span>
                    </div>
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-3">Confidence Score</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
                  <h3 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-4">Projected Depreciation</h3>
                  <div className="flex items-end gap-3 h-36">
                    {result.depreciation.map((d, i) => {
                      const maxV = Math.max(...result.depreciation.map((x) => x.value));
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-mono font-bold text-on-surface">{formatINR(d.value)}</span>
                          <div className="flex-1 w-full flex items-end">
                            <div className="w-full bg-primary rounded-t transition-all duration-500" style={{ height: `${(d.value / maxV) * 100}%`, minHeight: "8px" }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium">{d.months === 0 ? "Now" : `+${d.months}m`}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><Shield className="w-4 h-4 text-primary" /></div>
                    <h3 className="text-sm font-bold text-on-surface">Market Insights</h3>
                  </div>
                  <div className="space-y-3">
                    {result.insights.map((s, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-on-surface">{s}</p>
                      </div>
                    ))}
                    {result.warnings.map((s, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-on-surface">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Valuation;
