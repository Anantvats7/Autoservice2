// AI assistant with full vehicle context, chat persistence, and in-chat booking capability.
import React, { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles, Trash2, CheckCircle, XCircle, Car, Wrench, CalendarClock, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLiveTable } from "@/hooks/useRealtimeQuery";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: number;
  booking_intent?: BookingIntent | null;
  booking_status?: "pending" | "confirmed" | "declined";
}

interface BookingIntent {
  vehicle_id: string;
  service_id: string;
  scheduled_at: string;
  priority: "normal" | "express" | "priority";
  notes?: string;
}

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  registration: string;
  mileage: number;
  fuel_type: string | null;
}

interface Booking {
  id: string;
  status: string;
  scheduled_at: string;
  service_id: string;
  vehicle_id: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  category: string;
  duration_minutes: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "autoserve_assistant_history_v2";

const PRIORITY_SURCHARGE: Record<string, number> = {
  normal: 1,
  express: 1.15,
  priority: 1.3,
};

const PRIORITY_LABEL: Record<string, string> = {
  normal: "Normal",
  express: "Express (+15%)",
  priority: "Priority (+30%)",
};

// ─── Booking Confirmation Card ────────────────────────────────────────────────

const BookingCard = ({
  intent,
  vehicles,
  services,
  status,
  onConfirm,
  onDecline,
}: {
  intent: BookingIntent;
  vehicles: Vehicle[];
  services: Service[];
  status: "pending" | "confirmed" | "declined";
  onConfirm: () => void;
  onDecline: () => void;
}) => {
  const vehicle = vehicles.find((v) => v.id === intent.vehicle_id);
  const service = services.find((s) => s.id === intent.service_id);
  const price = service ? Math.round(service.price * (PRIORITY_SURCHARGE[intent.priority] ?? 1)) : 0;
  const scheduledDate = new Date(intent.scheduled_at).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (status === "confirmed") {
    return (
      <div className="mt-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-800">Booking confirmed!</p>
          <p className="text-xs text-emerald-700 mt-0.5">
            {service?.name} for {vehicle?.make} {vehicle?.model} on {scheduledDate}
          </p>
        </div>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="mt-3 p-3 bg-surface-container-low border border-border/20 rounded-xl flex items-center gap-2 text-xs text-muted-foreground">
        <XCircle className="w-4 h-4 shrink-0" />
        Booking cancelled. Let me know if you would like to try a different time or service.
      </div>
    );
  }

  return (
    <div className="mt-3 bg-card border border-primary/20 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-primary/5 px-4 py-2.5 border-b border-primary/10 flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-primary uppercase tracking-wider">Confirm Booking</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-surface-container-low rounded-lg">
            <Car className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Vehicle</p>
            <p className="text-sm font-bold text-on-surface">
              {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Unknown vehicle"}
            </p>
            <p className="text-xs text-muted-foreground font-mono">{vehicle?.registration}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-surface-container-low rounded-lg">
            <Wrench className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Service</p>
            <p className="text-sm font-bold text-on-surface">{service?.name ?? "Unknown service"}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{PRIORITY_LABEL[intent.priority]}</span>
              <span className="text-sm font-mono font-bold text-primary">{formatINR(price)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-surface-container-low rounded-lg">
            <CalendarClock className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Scheduled</p>
            <p className="text-sm font-bold text-on-surface">{scheduledDate}</p>
          </div>
        </div>

        {intent.notes && (
          <p className="text-xs text-muted-foreground bg-surface-container-low rounded-lg px-3 py-2">
            Notes: {intent.notes}
          </p>
        )}
      </div>

      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:scale-[0.98] transition-all"
        >
          <CheckCircle className="w-4 h-4" /> Confirm Booking
        </button>
        <button
          onClick={onDecline}
          className="px-4 py-2.5 border border-border/30 rounded-lg text-sm font-medium text-muted-foreground hover:bg-surface-container transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AIAssistant = () => {
  const { user, profile } = useAuth();
  const { data: vehicles } = useLiveTable<Vehicle>(
    "vehicles",
    (q) => q.eq("owner_id", user?.id ?? ""),
    [user?.id],
    { enabled: !!user }
  );
  const { data: bookings } = useLiveTable<Booking>(
    "bookings",
    (q) => q.eq("customer_id", user?.id ?? "").order("scheduled_at", { ascending: false }).limit(8),
    [user?.id],
    { enabled: !!user }
  );
  const { data: services } = useLiveTable<Service>("services", (q) => q.eq("active", true));

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Active vehicle — pinned so the AI always knows which vehicle the user is talking about
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);

  // Auto-select first vehicle once loaded
  useEffect(() => {
    if (vehicles.length > 0 && !activeVehicleId) {
      setActiveVehicleId(vehicles[0].id);
    }
  }, [vehicles, activeVehicleId]);

  // Restore conversation from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Persist messages and auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
      } catch { /* ignore */ }
    }
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const activeVehicle = vehicles.find((v) => v.id === activeVehicleId) ?? null;

  // ── Context builder ──────────────────────────────────────────────────────────
  const buildContext = () => ({
    customer: { name: profile?.full_name ?? "Customer" },
    // Active vehicle is listed first so the AI defaults to it when the user says "my car"
    vehicles: [
      ...(activeVehicle ? [activeVehicle] : []),
      ...vehicles.filter((v) => v.id !== activeVehicleId),
    ].map((v) => ({
      id: v.id,
      label: `${v.year} ${v.make} ${v.model}`,
      registration: v.registration,
      mileage: v.mileage,
      fuel_type: v.fuel_type,
      is_active_context: v.id === activeVehicleId,
    })),
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      price: s.price,
      duration_minutes: s.duration_minutes,
    })),
    recent_bookings: bookings.map((b) => {
      const v = vehicles.find((x) => x.id === b.vehicle_id);
      const s = services.find((x) => x.id === b.service_id);
      return {
        id: b.id,
        status: b.status,
        when: b.scheduled_at,
        vehicle: v ? `${v.make} ${v.model}` : "?",
        service: s?.name ?? "?",
      };
    }),
  });

  // ── Send message ─────────────────────────────────────────────────────────────
  const send = async () => {
    if (!input.trim() || busy) return;
    const userMsg: Message = { role: "user", content: input.trim(), ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-diagnostics", {
        body: {
          mode: "chat",
          context: buildContext(),
          history: next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;

      const reply: Message = {
        role: "assistant",
        content: data?.reply ?? "Sorry, I could not generate a response.",
        ts: Date.now(),
        booking_intent: data?.booking_intent ?? null,
        booking_status: data?.booking_intent ? "pending" : undefined,
      };
      setMessages((prev) => [...prev, reply]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "AI request failed";
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I had trouble connecting. Please try again.", ts: Date.now() },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // ── Confirm booking ──────────────────────────────────────────────────────────
  const confirmBooking = async (msgIndex: number, intent: BookingIntent) => {
    if (!user) return;

    // Validate that vehicle and service actually exist in the customer's data
    const vehicle = vehicles.find((v) => v.id === intent.vehicle_id);
    const service = services.find((s) => s.id === intent.service_id);
    if (!vehicle || !service) {
      toast.error("Could not match vehicle or service. Please try again.");
      return;
    }

    // Validate scheduled_at is a valid future date
    const scheduledDate = new Date(intent.scheduled_at);
    if (isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
      toast.error("Invalid booking date. Please try again.");
      return;
    }

    const price = Math.round(service.price * (PRIORITY_SURCHARGE[intent.priority] ?? 1));

    try {
      const { error } = await supabase.from("bookings").insert({
        customer_id: user.id,
        vehicle_id: intent.vehicle_id,
        service_id: intent.service_id,
        scheduled_at: intent.scheduled_at,
        priority: intent.priority,
        notes: intent.notes ?? null,
        total_cost: price,
        status: "pending",
        extra_service_ids: [],
      });
      if (error) throw error;

      setMessages((prev) =>
        prev.map((m, i) => (i === msgIndex ? { ...m, booking_status: "confirmed" as const } : m))
      );
      toast.success("Booking created successfully!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create booking";
      toast.error(msg);
    }
  };

  // ── Decline booking ──────────────────────────────────────────────────────────
  const declineBooking = (msgIndex: number) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, booking_status: "declined" as const } : m))
    );
  };

  const clear = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const suggestions = [
    "Book an oil change for my car",
    "When is my next service due?",
    "Schedule a brake inspection for tomorrow",
    "What services does my vehicle need?",
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto w-full">

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/20 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-on-surface">AutoServe AI Assistant</h1>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono truncate">
            Powered by AutoServe AI &middot; {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} &middot; Can book services
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Vehicle context picker */}
          {vehicles.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setVehiclePickerOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-border/30 rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <Car className="w-3.5 h-3.5 text-primary" />
                {activeVehicle ? `${activeVehicle.make} ${activeVehicle.model}` : "Select vehicle"}
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
              {vehiclePickerOpen && (
                <div className="absolute right-0 top-full mt-1 bg-card border border-border/30 rounded-xl shadow-xl z-20 min-w-[200px] overflow-hidden">
                  {vehicles.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => { setActiveVehicleId(v.id); setVehiclePickerOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface-container transition-colors flex items-center justify-between gap-3 ${
                        v.id === activeVehicleId ? "text-primary font-bold bg-primary/5" : "text-on-surface"
                      }`}
                    >
                      <span>{v.year} {v.make} {v.model}</span>
                      {v.id === activeVehicleId && <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.length > 0 && (
            <button
              onClick={clear}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1.5 p-2 rounded-lg hover:bg-surface-container transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scroller} className="flex-1 overflow-y-auto py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 items-center justify-center mb-4 shadow-lg shadow-primary/20">
              <Sparkles className="w-7 h-7 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-bold text-on-surface mb-1">
              How can I help, {profile?.full_name?.split(" ")[0] ?? "there"}?
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Ask about your vehicles, upcoming services, pricing — or just say "book an oil change" and I will handle it.
            </p>
            {activeVehicle && (
              <p className="text-xs text-primary font-semibold mb-4">
                Active vehicle: {activeVehicle.year} {activeVehicle.make} {activeVehicle.model} &middot; {activeVehicle.registration}
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-2 max-w-lg mx-auto">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="p-3 text-left text-sm bg-card border border-border/30 rounded-lg hover:border-primary/30 transition-colors text-on-surface"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] sm:max-w-[75%] ${m.role === "user" ? "" : "flex gap-2"}`}>
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <div
                  className={`p-3.5 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card border border-border/20 text-on-surface rounded-tl-md shadow-sm"
                  }`}
                >
                  {m.content}
                </div>

                {/* Inline booking confirmation card */}
                {m.role === "assistant" && m.booking_intent && m.booking_status && (
                  <BookingCard
                    intent={m.booking_intent}
                    vehicles={vehicles}
                    services={services}
                    status={m.booking_status}
                    onConfirm={() => confirmBooking(i, m.booking_intent!)}
                    onDecline={() => declineBooking(i)}
                  />
                )}
              </div>
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground animate-pulse" />
            </div>
            <div className="bg-card border border-border/20 p-3.5 rounded-2xl rounded-tl-md text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/20 pt-3">
        <form
          onSubmit={(e: React.FormEvent) => { e.preventDefault(); send(); }}
          className="bg-card border border-border/30 rounded-2xl shadow-sm p-2 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
            placeholder="Ask anything or say: book an oil change for my Swift..."
            className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-on-surface placeholder:text-muted-foreground"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="p-2.5 bg-primary text-primary-foreground rounded-xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-2 px-1 text-center">
          AI-generated responses. Verify critical maintenance with a certified technician.
        </p>
      </div>
    </div>
  );
};

export default AIAssistant;
