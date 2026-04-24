// AI diagnostic + chat assistant for AutoServe.
// Modes:
//   diagnose (default): { mode?: "diagnose", symptoms, vehicle, catalog? }  → { faults, recommended_service_ids, proTip }
//   chat:               { mode: "chat", history, context? }                 → { reply }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set in Supabase");

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function callGemini(systemPrompt: string, userPrompt: string, jsonMode = true): Promise<string> {
  const body: any = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
  };
  if (jsonMode) {
    body.generationConfig = { responseMimeType: "application/json" };
  }
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw Object.assign(new Error("Rate limited"), { status: 429 });
  if (!res.ok) throw Object.assign(new Error(`Gemini error ${res.status}`), { status: res.status });
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

async function callGeminiChat(systemPrompt: string, history: Array<{ role: string; content: string }>, jsonMode = true): Promise<string> {
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: any = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
  };
  if (jsonMode) {
    body.generationConfig = { responseMimeType: "application/json" };
  }
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw Object.assign(new Error("Rate limited"), { status: 429 });
  if (!res.ok) throw Object.assign(new Error(`Gemini error ${res.status}`), { status: res.status });
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    // ============ CHAT MODE ============
    if (body.mode === "chat") {
      const history: Array<{ role: string; content: string }> = Array.isArray(body.history) ? body.history : [];
      if (history.length === 0) return json(400, { error: "history required" });

      const ctx = body.context ?? {};

      const vehicleList = Array.isArray(ctx.vehicles) && ctx.vehicles.length > 0
        ? ctx.vehicles.map((v: any) => `  - id: "${v.id}" → ${v.label} (${v.registration}, ${v.mileage} km)`).join("\n")
        : "  (none registered)";

      const serviceList = Array.isArray(ctx.services) && ctx.services.length > 0
        ? ctx.services.map((s: any) => `  - id: "${s.id}" → ${s.name} [${s.category}] ₹${s.price}`).join("\n")
        : "  (none available)";

      const systemPrompt = `You are AutoServe AI, an expert assistant for an Indian car-service workshop.
Be concise, friendly, and use Indian Rupees (₹).

Customer: ${ctx.customer?.name ?? "Customer"}

Their registered vehicles:
${vehicleList}

Available services catalogue:
${serviceList}

Recent bookings:
${JSON.stringify(ctx.recent_bookings ?? [], null, 2)}

BOOKING CAPABILITY:
When the customer clearly wants to book a service (e.g. "book an oil change for my Swift", "schedule brake service tomorrow"), you MUST:
1. Identify the correct vehicle_id from their vehicles list above.
2. Identify the correct service_id from the catalogue above.
3. Pick a reasonable scheduled_at datetime (ISO 8601) — default to next business day at 10:00 AM IST if not specified.
4. Choose priority: "normal" (default), "express" (+15%), or "priority" (+30%) based on urgency cues.
5. Return your reply AND a booking_intent block.

Your response MUST be valid JSON in this exact shape when booking intent is detected:
{
  "reply": "Your friendly confirmation message here, mentioning the service name, vehicle, date and price.",
  "booking_intent": {
    "vehicle_id": "<exact id from vehicles list>",
    "service_id": "<exact id from catalogue>",
    "scheduled_at": "<ISO 8601 datetime>",
    "priority": "normal" | "express" | "priority",
    "notes": "<optional notes from user>"
  }
}

When NO booking is needed, return plain JSON:
{
  "reply": "Your response here."
}

Rules:
- ONLY use vehicle_ids and service_ids from the lists above. Never invent IDs.
- If the customer mentions a vehicle but you cannot match it, ask them to clarify.
- If the customer mentions a service not in the catalogue, say it's not available and suggest the closest match.
- Keep replies under 6 sentences unless the user asks for detail.
- Always respond with valid JSON — no markdown, no preamble.`;

      try {
        const raw = await callGeminiChat(systemPrompt, history, true);
        let parsed: any = {};
        try { parsed = JSON.parse(raw); } catch { parsed = { reply: raw }; }
        const reply = String(parsed.reply ?? parsed.message ?? "Sorry, I couldn't generate a response.");
        const booking_intent = parsed.booking_intent ?? null;
        return json(200, { reply, booking_intent });
      } catch (e: any) {
        if (e.status === 429) return json(429, { error: "Rate limited" });
        return json(500, { error: String(e) });
      }
    }

    // ============ DIAGNOSTICS MODE (default) ============
    const { symptoms, vehicle } = body;
    if (!symptoms) return json(400, { error: "symptoms required" });

    let catalog: Array<{ id: string; name: string; category: string; price: number; description?: string | null }>;
    if (Array.isArray(body.catalog) && body.catalog.length > 0) {
      catalog = body.catalog;
    } else {
      const { data: services } = await admin.from("services").select("id, name, category, price, description").eq("active", true);
      catalog = (services ?? []) as any;
    }

    const catalogText = catalog.map((s) => `- ${s.id} | ${s.name} [${s.category}] – ₹${s.price}`).join("\n");
    const vehInfo = vehicle ? `${vehicle.year ?? "?"} ${vehicle.make ?? ""} ${vehicle.model ?? ""} (${vehicle.fuel_type ?? "Petrol"}, ${vehicle.mileage ?? "?"} km)` : "Unknown vehicle";

    const userPrompt = `Vehicle: ${vehInfo}
Customer's symptoms: ${symptoms}

Available services (use the IDs verbatim):
${catalogText}

Return STRICT JSON in exactly this shape:
{
  "faults": [
    { "name": "short fault name", "description": "1 sentence cause/explanation", "confidence": 80 }
  ],
  "recommended_service_ids": ["<service_id from list above>", "..."],
  "proTip": "One actionable sentence of advice for the customer."
}

Rules:
- 2 to 4 faults, ranked by likelihood (highest confidence first).
- confidence is an integer 0–100.
- recommended_service_ids must use ONLY ids from the list above; pick 1–3 most relevant.
- proTip should be plain English, friendly, and actionable.`;

    try {
      const raw = await callGemini(
        "You are an experienced automotive diagnostic technician for the Indian market. Output valid JSON only, exactly matching the requested schema.",
        userPrompt,
        true
      );

      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { return json(500, { error: "Invalid AI response" }); }

      const faults = Array.isArray(parsed.faults)
        ? parsed.faults.map((f: any) => ({
            name: String(f.name ?? "Possible issue"),
            description: String(f.description ?? ""),
            confidence: Math.max(0, Math.min(100, Math.round(Number(f.confidence ?? 50)))),
          }))
        : [];

      const validIds = new Set(catalog.map((s) => s.id));
      const recommended_service_ids = Array.isArray(parsed.recommended_service_ids)
        ? parsed.recommended_service_ids.filter((id: any) => validIds.has(String(id)))
        : [];

      const proTip = String(parsed.proTip ?? parsed.advice ?? "Get this checked at the workshop soon.");
      return json(200, { faults, recommended_service_ids, proTip });
    } catch (e: any) {
      if (e.status === 429) return json(429, { error: "Rate limited" });
      return json(500, { error: String(e) });
    }
  } catch (e) {
    console.error(e);
    return json(500, { error: String(e) });
  }
});

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
