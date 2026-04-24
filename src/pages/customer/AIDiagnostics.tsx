// Production AI diagnostics page: real symptom analysis, ranked faults, recommended services from the catalog.
import { useState } from "react";
import { FileText, Clock, Zap, Lightbulb, Loader2, Wrench, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";

interface Vehicle { id: string; make: string; model: string; year: number; mileage: number; fuel_type: string | null; }
interface Service { id: string; name: string; description: string | null; category: string; price: number; }

interface Diagnosis {
  faults: { name: string; description: string; confidence: number }[];
  recommended_service_ids: string[];
  proTip: string;
}

const AIDiagnostics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: vehicles } = useLiveTable<Vehicle>("vehicles", (q) => q.eq("owner_id", user?.id ?? ""), [user?.id], { enabled: !!user });
  const { data: services } = useLiveTable<Service>("services", (q) => q.eq("active", true));

  const [vehicleId, setVehicleId] = useState<string>("");
  const [symptoms, setSymptoms] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Diagnosis | null>(null);

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? vehicles[0];

  const analyze = async () => {
    if (!symptoms.trim()) { toast.error("Please describe the symptoms first"); return; }
    if (!selectedVehicle) { toast.error("Add a vehicle first"); return; }
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-diagnostics", {
        body: {
          mode: "diagnose",
          symptoms,
          vehicle: { make: selectedVehicle.make, model: selectedVehicle.model, year: selectedVehicle.year, mileage: selectedVehicle.mileage, fuel_type: selectedVehicle.fuel_type },
          catalog: services.map((s) => ({ id: s.id, name: s.name, category: s.category, price: s.price, description: s.description })),
        },
      });
      if (error) throw error;
      setResult(data as Diagnosis);
    } catch (e: any) {
      toast.error(e.message ?? "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const recommendedServices = result
    ? services.filter((s) => result.recommended_service_ids.includes(s.id))
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">AI Diagnostics</h1>
        <p className="text-sm text-muted-foreground mt-1">Describe your symptoms — our AI ranks likely faults and suggests services from our catalog.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border/20">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-on-surface">Symptom Analysis</h3>
            </div>

            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-2">Vehicle</label>
            {vehicles.length === 0 ? (
              <Link to="/customer/vehicles" className="block p-3 mb-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
                Add a vehicle first to get accurate diagnostics →
              </Link>
            ) : (
              <select
                value={selectedVehicle?.id ?? ""}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full bg-surface-container-low border border-border/30 rounded-lg p-2.5 text-sm mb-4 outline-none focus:ring-2 focus:ring-primary/20"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} • {v.mileage.toLocaleString("en-IN")} km</option>
                ))}
              </select>
            )}

            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-2">Describe Symptoms</label>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Example: A high-pitched squealing noise when braking at low speeds, slight vibration through the brake pedal."
              className="w-full h-32 bg-surface-container-low border border-border/30 rounded-xl p-4 text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-muted-foreground transition-all"
            />
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Average analysis time: 5–8s
              </span>
              <button
                onClick={analyze}
                disabled={busy || vehicles.length === 0}
                className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {busy ? "Analyzing…" : "Analyze Symptoms"}
              </button>
            </div>
          </div>

          {result && recommendedServices.length > 0 && (
            <div className="bg-gradient-to-br from-primary/5 to-transparent p-6 rounded-xl border border-primary/20">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-on-surface">Recommended Services</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {recommendedServices.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigate("/customer/book")}
                    className="text-left p-4 bg-card border border-border/30 rounded-lg hover:border-primary/40 transition-all group"
                  >
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.category}</span>
                      <span className="text-sm font-mono font-bold text-primary">{formatINR(s.price)}</span>
                    </div>
                    <p className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                    <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-primary">
                      <Wrench className="w-3 h-3" /> Book this service →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-card p-5 rounded-xl border border-border/20 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Ranked Faults</h4>
              {result && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Live</span>}
            </div>

            {!result && !busy && (
              <p className="text-xs text-muted-foreground py-6 text-center">Run an analysis to see possible causes ranked by AI confidence.</p>
            )}
            {busy && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}

            {result && (
              <div className="space-y-3">
                {result.faults.length === 0 && <p className="text-xs text-muted-foreground">No specific faults identified. Consider booking a diagnostic scan.</p>}
                {result.faults.map((f) => (
                  <div key={f.name} className="p-3 bg-surface-container-low rounded-lg border border-border/10">
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.description}</p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-lg font-black text-primary">{f.confidence}%</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Conf.</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-surface-container-high rounded-full">
                      <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${f.confidence}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {result?.proTip && (
            <div className="bg-surface-container-low p-4 rounded-xl border border-border/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-tertiary/10 rounded-lg">
                  <Lightbulb className="w-3.5 h-3.5 text-tertiary" />
                </div>
                <p className="text-xs font-bold text-on-surface">AI Pro-Tip</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{result.proTip}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIDiagnostics;
