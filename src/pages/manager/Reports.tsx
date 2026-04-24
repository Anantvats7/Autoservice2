import { useMemo, useState } from "react";
import { Calendar, Download, TrendingUp, Sparkles, Loader2 } from "lucide-react";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { useProfilesByRole } from "@/hooks/useStaff";
import { formatINR, formatDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const PIE_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

interface History { id: string; cost: number; service_date: string; service_id: string; customer_id: string; vehicle_id: string; }
interface Service { id: string; name: string; category: string; }
interface Vehicle { id: string; make: string; model: string; year: number; registration: string; }

const PERIODS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "All time", days: 0 },
] as const;

const ManagerReports = () => {
  const { data: history } = useLiveTable<History>("service_history", (q) => q.order("service_date", { ascending: false }));
  const { data: services } = useLiveTable<Service>("services", (q) => q);
  const { data: vehicles } = useLiveTable<Vehicle>("vehicles", (q) => q);
  const { byId } = useProfilesByRole();
  const [periodDays, setPeriodDays] = useState(30);
  const [aiInsights, setAiInsights] = useState<{ loading: boolean; text: string | null }>({ loading: false, text: null });

  const periodMs = periodDays > 0 ? periodDays * 24 * 3600 * 1000 : Infinity;
  const since = periodDays > 0 ? Date.now() - periodMs : 0;
  const periodHistory = history.filter((h) => new Date(h.service_date).getTime() >= since);

  const totalRevenue = periodHistory.reduce((s, h) => s + Number(h.cost || 0), 0);
  const avgTicket = periodHistory.length ? totalRevenue / periodHistory.length : 0;

  // Daily series for the selected period (or last 90d when "All time")
  const dailySeries = useMemo(() => {
    const days = periodDays > 0 ? periodDays : 90;
    const buckets: Record<string, number> = {};
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    history.forEach((h) => {
      const key = new Date(h.service_date).toISOString().slice(0, 10);
      if (key in buckets) buckets[key] += Number(h.cost || 0);
    });
    return Object.entries(buckets).map(([date, total]) => ({
      date,
      label: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      total,
    }));
  }, [history, periodDays]);

  // Monthly series for last 6 months (used as a quick KPI under the line chart)
  const months = useMemo(() => {
    const arr: { month: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setMonth(next.getMonth() + 1);
      arr.push({
        month: d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase(),
        total: history.filter((h) => {
          const t = new Date(h.service_date).getTime();
          return t >= d.getTime() && t < next.getTime();
        }).reduce((s, h) => s + Number(h.cost || 0), 0),
      });
    }
    return arr;
  }, [history]);
  

  // service distribution
  const distribution = useMemo(() => {
    const totals: Record<string, number> = {};
    periodHistory.forEach((h) => {
      const cat = services.find((s) => s.id === h.service_id)?.category || "Other";
      totals[cat] = (totals[cat] || 0) + Number(h.cost || 0);
    });
    const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(totals)
      .map(([name, amt]) => ({ name, pct: Math.round((amt / grand) * 100), amt }))
      .sort((a, b) => b.amt - a.amt)
      .slice(0, 5);
  }, [periodHistory, services]);

  const exportCsv = () => {
    const rows = [
      ["Date", "Customer", "Vehicle", "Service", "Cost"],
      ...history.map((h) => {
        const v = vehicles.find((x) => x.id === h.vehicle_id);
        const s = services.find((x) => x.id === h.service_id);
        const c = byId[h.customer_id];
        return [formatDate(h.service_date), c?.full_name ?? "—", v ? `${v.year} ${v.make} ${v.model} (${v.registration})` : "—", s?.name ?? "—", String(h.cost)];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `autoserve-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const generateInsights = async () => {
    if (aiInsights.loading) return;
    setAiInsights({ loading: true, text: null });
    try {
      const topServices = distribution.slice(0, 3).map((d) => `${d.name} (${d.pct}%)`).join(", ");
      const revenueThisPeriod = formatINR(totalRevenue);
      const avgTicketVal = formatINR(avgTicket);
      const monthlyTrend = months.map((m) => `${m.month}: ${m.total > 0 ? formatINR(m.total) : "₹0"}`).join(", ");
      const prompt = `You are a business analyst for AutoServe, an Indian automotive workshop in Gurugram.
Analyse this performance data and give 4-5 concise, actionable insights for the manager.

Period: Last ${periodDays > 0 ? `${periodDays} days` : "90 days"}
Total Revenue: ${revenueThisPeriod}
Services Completed: ${periodHistory.length}
Average Ticket: ${avgTicketVal}
Top Service Categories: ${topServices || "N/A"}
Monthly Revenue Trend (last 6 months): ${monthlyTrend}

Write plain paragraphs, no bullet points. Be specific with numbers. Highlight any anomalies, growth opportunities, or risks. Keep it under 120 words.`;

      const { data, error } = await supabase.functions.invoke("ai-diagnostics", {
        body: {
          mode: "chat",
          context: {},
          history: [{ role: "user", content: prompt }],
        },
      });
      if (error) throw error;
      setAiInsights({ loading: false, text: data?.reply ?? "Could not generate insights." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to generate insights";
      toast.error(msg);
      setAiInsights({ loading: false, text: null });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Performance Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Live financial overview and service distribution.</p>
        </div>
        <div className="flex gap-2 self-start flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setPeriodDays(p.days)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-all ${
                periodDays === p.days
                  ? "bg-on-surface text-card border-on-surface"
                  : "border-border/30 text-on-surface hover:bg-surface-container"
              }`}
            >
              <Calendar className="w-4 h-4" /> {p.label}
            </button>
          ))}
          <button onClick={exportCsv} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={generateInsights}
            disabled={aiInsights.loading || periodHistory.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-primary/80 to-primary px-5 py-2.5 rounded-lg text-sm font-bold text-primary-foreground hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {aiInsights.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI Insights
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
        <Kpi label={`Revenue (${periodDays > 0 ? `${periodDays}d` : "All time"})`} value={formatINR(totalRevenue)} sub={`${periodHistory.length} services`} subColor="text-emerald-600" />
        <Kpi label="Avg. Ticket" value={formatINR(avgTicket)} sub="per completed service" subColor="text-emerald-600" />
        <Kpi label="Lifetime Records" value={String(history.length)} sub="all-time history" subColor="text-muted-foreground" />
      </div>

      {/* AI Insights panel */}
      {(aiInsights.loading || aiInsights.text) && (
        <div className="bg-gradient-to-br from-primary/5 to-card p-6 rounded-xl border border-primary/20 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface">AI Business Insights</h3>
              <p className="text-xs text-muted-foreground">Generated from your {periodDays > 0 ? `last ${periodDays}-day` : "all-time"} data</p>
            </div>
          </div>
          {aiInsights.loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Analysing revenue trends and patterns...
            </div>
          )}
          {aiInsights.text && (
            <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{aiInsights.text}</p>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card p-6 rounded-xl border border-border/20 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Revenue Trend — {periodDays > 0 ? `Last ${periodDays} days` : "Last 90 days"}</h3>
              <p className="text-2xl font-black text-on-surface font-mono mt-1">{formatINR(dailySeries.reduce((s, d) => s + d.total, 0))}</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Live</span>
          </div>
          <div className="h-64 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor(dailySeries.length / 8) - 1)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
                  width={50}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [formatINR(value), "Revenue"]}
                  labelFormatter={(l) => l}
                />
                <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {months.some((m) => m.total > 0) && (
            <div className="mt-6 pt-4 border-t border-border/10 grid grid-cols-6 gap-2">
              {months.map((m) => (
                <div key={m.month} className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{m.month}</p>
                  <p className="text-xs font-bold font-mono text-on-surface mt-1">{m.total > 0 ? formatINR(m.total) : "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card p-6 rounded-xl border border-border/20 shadow-sm">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-4">Service Distribution</h3>
          {distribution.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          ) : (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="amt"
                      nameKey="name"
                      innerRadius={32}
                      outerRadius={64}
                      paddingAngle={2}
                    >
                      {distribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number, name: string) => [formatINR(Number(value)), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-2">
                {distribution.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-on-surface font-medium truncate">{d.name}</span>
                    </span>
                    <span className="font-bold text-on-surface font-mono shrink-0">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>


      <div className="bg-card rounded-xl border border-border/20 shadow-sm">
        <div className="flex items-center justify-between p-4 lg:p-6 border-b border-border/20">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
                <th className="text-left py-3 px-6 font-bold">Date</th>
                <th className="text-left py-3 px-4 font-bold">Customer</th>
                <th className="text-left py-3 px-4 font-bold">Vehicle</th>
                <th className="text-left py-3 px-4 font-bold">Service</th>
                <th className="text-right py-3 px-4 font-bold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {history.slice(0, 10).map((h) => {
                const v = vehicles.find((x) => x.id === h.vehicle_id);
                const s = services.find((x) => x.id === h.service_id);
                const c = byId[h.customer_id];
                return (
                  <tr key={h.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-4 px-6 text-sm text-on-surface">{formatDate(h.service_date)}</td>
                    <td className="py-4 px-4 text-sm text-on-surface">{c?.full_name || "—"}</td>
                    <td className="py-4 px-4 text-xs text-muted-foreground">{v ? `${v.make} ${v.model}` : "—"}</td>
                    <td className="py-4 px-4 text-sm text-muted-foreground">{s?.name || "—"}</td>
                    <td className="py-4 px-4 text-sm font-bold text-on-surface text-right font-mono">{formatINR(h.cost)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Kpi = ({ label, value, sub, subColor }: { label: string; value: string; sub: string; subColor: string }) => (
  <div className="bg-card p-5 lg:p-6 rounded-xl border border-border/20 shadow-sm">
    <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">{label}</p>
    <p className="text-3xl font-black text-on-surface tracking-tight mt-2 font-mono">{value}</p>
    <p className={`text-[10px] ${subColor} mt-2`}>{sub}</p>
  </div>
);

export default ManagerReports;
