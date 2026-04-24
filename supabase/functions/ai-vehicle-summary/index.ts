// Generates an AI-written maintenance summary for a vehicle from its service history.
// Used on Employee JobDetail page so technicians get a fast brief on past work.
//
// Accepts EITHER:
//   { vehicle_id }                                          — server fetches everything
//   { vehicle: {...}, history: [...], current_service? }    — client supplies context
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set in Supabase");

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    let vehicle: any = body.vehicle ?? null;
    let history: any[] = Array.isArray(body.history) ? body.history : [];
    const currentService: string | undefined = body.current_service;

    if (!vehicle && body.vehicle_id) {
      const [{ data: veh }, { data: hist }, { data: services }] = await Promise.all([
        admin.from("vehicles").select("*").eq("id", body.vehicle_id).maybeSingle(),
        admin.from("service_history").select("*").eq("vehicle_id", body.vehicle_id).order("service_date", { ascending: false }).limit(20),
        admin.from("services").select("id, name, category"),
      ]);
      if (!veh) return json(404, { error: "Vehicle not found" });
      vehicle = veh;
      const svcMap = new Map((services ?? []).map((s: any) => [s.id, s.name]));
      history = (hist ?? []).map((h: any) => ({ ...h, service: svcMap.get(h.service_id) ?? "Service" }));
    }

    if (!vehicle) return json(400, { error: "vehicle or vehicle_id required" });

    const histLines = history.map((h: any) => {
      const date = h.service_date
        ? new Date(h.service_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : "Unknown date";
      return `- ${date} • ${h.service ?? "Service"} • ${h.mileage_at_service ?? "?"} km • ₹${h.cost ?? "?"} • Notes: ${h.notes ?? "—"} • Parts: ${h.parts_used ?? "—"}`;
    }).join("\n");

    const userPrompt = `You are an expert automotive service advisor briefing a technician about to work on this vehicle.

Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.fuel_type ?? "Petrol"})
Registration: ${vehicle.registration ?? "—"}
Current Odometer: ${vehicle.mileage ?? "?"} km
${currentService ? `Today's job: ${currentService}` : ""}

Service history (most recent first):
${histLines || "No prior service history."}

Write a concise 4-6 line briefing that:
1. Summarises the vehicle's overall maintenance state (well-maintained / needs attention / new vehicle).
2. Highlights any recurring issues or patterns.
3. Flags items likely due based on mileage and time gaps.
4. Suggests one specific check the technician should prioritise today.

Use plain, clear language. Flowing paragraphs only — no bullet points. Address the technician, not the customer.`;

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: "You are a senior automotive service advisor. Be concise, technical and actionable." }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      }),
    });

    if (res.status === 429) return json(429, { error: "Rate limited, please retry shortly" });
    if (!res.ok) {
      const text = await res.text();
      console.error("Gemini error", res.status, text);
      return json(500, { error: `AI error ${res.status}` });
    }

    const data = await res.json();
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Unable to generate summary.";
    return json(200, { summary });
  } catch (e) {
    console.error(e);
    return json(500, { error: String(e) });
  }
});

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
