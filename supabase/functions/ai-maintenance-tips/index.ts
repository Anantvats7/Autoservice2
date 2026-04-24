// Returns AI maintenance tips + recommended services for a vehicle.
// Accepts EITHER { vehicle_id } (server lookup) OR { make, model, year, mileage, fuel_type } (client-supplied).
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

interface Body {
  vehicle_id?: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  fuel_type?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;

    let vehicle: { make: string; model: string; year: number; mileage: number; fuel_type: string | null; id?: string } | null = null;
    let recentServiceNames: string[] = [];

    if (body.vehicle_id) {
      const [{ data: v }, { data: history }] = await Promise.all([
        admin.from("vehicles").select("*").eq("id", body.vehicle_id).maybeSingle(),
        admin.from("service_history").select("service_id, service_date").eq("vehicle_id", body.vehicle_id).order("service_date", { ascending: false }).limit(10),
      ]);
      if (!v) return json(404, { error: "Vehicle not found" });
      vehicle = v as any;
      if (history?.length) {
        const ids = history.map((h: any) => h.service_id);
        const { data: svcs } = await admin.from("services").select("id, name").in("id", ids);
        recentServiceNames = (history as any[]).map((h) => svcs?.find((s: any) => s.id === h.service_id)?.name).filter(Boolean) as string[];
      }
    } else if (body.make && body.model && body.year != null) {
      vehicle = {
        make: body.make,
        model: body.model,
        year: body.year,
        mileage: body.mileage ?? 0,
        fuel_type: body.fuel_type ?? "Petrol",
      };
    } else {
      return json(400, { error: "Provide either vehicle_id or {make, model, year}" });
    }

    const { data: services } = await admin.from("services").select("id, name, category, price").eq("active", true);
    const catalog = (services ?? []).map((s: any) => `${s.name} [${s.category}] – ₹${s.price}`).join("\n");

    const userPrompt = `Vehicle profile:
- ${vehicle!.year} ${vehicle!.make} ${vehicle!.model} (${vehicle!.fuel_type ?? "Petrol"})
- Current mileage: ${vehicle!.mileage} km
- Recent services: ${recentServiceNames.length ? recentServiceNames.join(", ") : "none recorded"}

Available services in our catalogue:
${catalog}

Return a JSON object with these exact fields:
{
  "tips": ["3 short, actionable maintenance tips specific to this vehicle's age, mileage, fuel type"],
  "recommended_service_names": ["1-3 service names from the catalogue above that this customer should book next"]
}

Important:
- recommended_service_names MUST be exact names from the catalogue.
- Skip services already done in the last 30 days unless mileage warrants.
- For EVs, never recommend oil/spark plug services.`;

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: "You are an expert automotive maintenance advisor for Indian car owners. Reply with valid JSON only, no preamble." }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (res.status === 429) return json(429, { error: "Rate limited" });
    if (!res.ok) return json(500, { error: `AI error ${res.status}` });

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { tips: [raw], recommended_service_names: [] }; }

    const recIds = (parsed.recommended_service_names ?? [])
      .map((n: string) => services?.find((s: any) => s.name.toLowerCase() === String(n).toLowerCase())?.id)
      .filter(Boolean);

    return json(200, {
      tips: parsed.tips ?? [],
      recommended_service_ids: recIds,
      recommended_service_names: parsed.recommended_service_names ?? [],
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: String(e) });
  }
});

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
