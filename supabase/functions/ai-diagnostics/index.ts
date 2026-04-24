// AI diagnostic + chat assistant for AutoServe.
// Modes:
//   diagnose (default): { mode?: "diagnose", symptoms, vehicle, catalog? }
//   chat:               { mode: "chat", history, context? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Retry with exponential backoff ───────────────────────────────────────────
async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error = new Error("Unknown error");
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429 && res.status !== 503) return res;
    const retryAfter = res.headers.get("Retry-After");
    const waitMs = retryAfter
      ? parseInt(retryAfter) * 1000
      : Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 16000);
    console.warn(`Gemini rate limited. Attempt ${attempt + 1}/${maxRetries}. Waiting ${waitMs}ms...`);
    if (attempt < maxRetries) await new Promise((r) => setTimeout(r, waitMs));
    lastError = Object.assign(new Error("Rate limited after retries"), { status: 429 });
  }
  throw lastError;
}

async function callGemini(systemPrompt: string, userPrompt: string, jsonMode = true): Promise<string> {
  const body: any = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
  };
  if (jsonMode) body.generationConfig = { responseMimeType: "application/json" };
  const res = await fetchWithRetry(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  if (jsonMode) body.generationConfig = { responseMimeType: "application/json" };
  const res = await fetchWithRetry(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw Object.assign(new Error(`Gemini error ${res.status}`), { status: res.status });
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!GEMINI_API_KEY) return json(500, { error: "GEMINI_API_KEY is not configured in Supabase secrets" });

  try {
    const body = await req.json();

    // ============ CHAT MODE ============
    if (body.mode === "chat") {
      const history: Array<{ role: string; content: string }> = Array.isArray(body.history) ? body.history : [];
      if (history.length === 0) return json(400, { error: "history required" });

      const ctx = body.context ?? {};

      // Detect manager/analyst mode — empty context means no vehicles/services
      const isAnalystMode =
        (!Array.isArray(ctx.vehicles) || ctx.vehicles.length === 0) &&
        (!Array.isArray(ctx.services) || ctx.services.length === 0);

      let systemPrompt: string;

      if (isAnalystMode) {
        systemPrompt = [
          "You are a business analyst AI for AutoServe, an Indian automotive workshop in Gurugram.",
          "Answer the user's question directly and concisely based on the data they provide.",
          "Write plain paragraphs, no bullet points unless asked. Be specific with numbers.",
          "Do not mention vehicles, bookings, or ask about cars — focus purely on the business data provided.",
          'Always respond with valid JSON: { "reply": "your response here" }',
        ].join("\n");
      } else {
        const vehicleList =
          Array.isArray(ctx.vehicles) && ctx.vehicles.length > 0
            ? ctx.vehicles.map((v: any) => `  - id: "${v.id}" -> ${v.label} (${v.registration}, ${v.mileage} km)`).join("\n")
            : "  (none registered)";

        const serviceList =
          Array.isArray(ctx.services) && ctx.services.length > 0
            ? ctx.services.map((s: any) => `  - id: "${s.id}" -> ${s.name} [${s.category}] Rs.${s.price}`).join("\n")
            : "  (none available)";

        const activeVehicle = Array.isArray(ctx.vehicles)
          ? ctx.vehicles.find((v: any) => v.is_active_context) ?? ctx.vehicles[0]
          : null;

        const activeVehicleInfo = activeVehicle
          ? `ACTIVE VEHICLE (use this by default): id="${activeVehicle.id}" -> ${activeVehicle.label} (${activeVehicle.registration}, ${activeVehicle.mileage} km)`
          : "No active vehicle selected.";

        const recentBookings = JSON.stringify(ctx.recent_bookings ?? [], null, 2);

        systemPrompt = [
          "You are AutoServe AI, an expert assistant for an Indian car-service workshop.",
          "Be concise, friendly, and use Indian Rupees (Rs.).",
          "",
          `Customer: ${ctx.customer?.name ?? "Customer"}`,
          "",
          activeVehicleInfo,
          "",
          "All registered vehicles:",
          vehicleList,
          "",
          "Available services catalogue:",
          serviceList,
          "",
          "Recent bookings:",
          recentBookings,
          "",
          "BOOKING CAPABILITY:",
          "When the customer wants to book a service, you MUST:",
          "1. ALWAYS use the ACTIVE VEHICLE by default — NEVER ask which vehicle unless the customer explicitly mentions a different one.",
          "2. Identify the correct service_id from the catalogue above. If the customer says 'oil change', map it to the closest service (e.g. Basic Service).",
          "3. Pick a reasonable scheduled_at datetime (ISO 8601) — default to next business day at 10:00 AM IST if not specified.",
          "4. Choose priority: 'normal' (default), 'express' (+15%), or 'priority' (+30%) based on urgency cues.",
          "5. Return your reply AND a booking_intent block immediately — do NOT ask for confirmation questions.",
          "",
          "Your response MUST be valid JSON in this exact shape when booking intent is detected:",
          '{ "reply": "confirmation message", "booking_intent": { "vehicle_id": "<id>", "service_id": "<id>", "scheduled_at": "<ISO 8601>", "priority": "normal", "notes": "" } }',
          "",
          "When NO booking is needed, return: { \"reply\": \"your response\" }",
          "",
          "Rules:",
          "- ONLY use vehicle_ids and service_ids from the lists above. Never invent IDs.",
          "- NEVER ask 'which vehicle?' — always default to the ACTIVE VEHICLE.",
          "- NEVER ask 'which service?' — map the request to the closest catalogue match and proceed.",
          "- Keep replies under 5 sentences.",
          "- Always respond with valid JSON — no markdown, no preamble.",
        ].join("\n");
      }

      try {
        const raw = await callGeminiChat(systemPrompt, history, true);
        let parsed: any = {};
        try { parsed = JSON.parse(raw); } catch { parsed = { reply: raw }; }
        const reply = String(parsed.reply ?? parsed.message ?? "Sorry, I could not generate a response.");
        const booking_intent = parsed.booking_intent ?? null;
        return json(200, { reply, booking_intent });
      } catch (e: any) {
        if (e.status === 429) return json(429, { error: "Rate limited. Please try again in a moment." });
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

    const catalogText = catalog.map((s) => `- ${s.id} | ${s.name} [${s.category}] Rs.${s.price}`).join("\n");
    const vehInfo = vehicle
      ? `${vehicle.year ?? "?"} ${vehicle.make ?? ""} ${vehicle.model ?? ""} (${vehicle.fuel_type ?? "Petrol"}, ${vehicle.mileage ?? "?"} km)`
      : "Unknown vehicle";

    const userPrompt = [
      `Vehicle: ${vehInfo}`,
      `Customer symptoms: ${symptoms}`,
      "",
      "Available services (use the IDs verbatim):",
      catalogText,
      "",
      "Return STRICT JSON in exactly this shape:",
      '{ "faults": [{ "name": "fault name", "description": "1 sentence", "confidence": 80 }], "recommended_service_ids": ["<id>"], "proTip": "one actionable sentence" }',
      "",
      "Rules:",
      "- 2 to 4 faults, ranked by likelihood (highest confidence first).",
      "- confidence is an integer 0-100.",
      "- recommended_service_ids must use ONLY ids from the list above; pick 1-3 most relevant.",
      "- proTip should be plain English, friendly, and actionable.",
    ].join("\n");

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
      if (e.status === 429) return json(429, { error: "Rate limited. Please try again in a moment." });
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
