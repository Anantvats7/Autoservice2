// Returns AI maintenance tips + recommended services for a vehicle.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const MODELS_TO_TRY = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemma-3-27b-it"];

function geminiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429 && res.status !== 503) return res;
    const retryAfter = res.headers.get("Retry-After");
    const base = Math.min(1000 * Math.pow(2, attempt), 8000);
    const jitter = Math.random() * 500;
    const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : base + jitter;
    console.warn(`Rate limited on attempt ${attempt + 1}. Waiting ${Math.round(waitMs)}ms...`);
    if (attempt < maxRetries) await new Promise((r) => setTimeout(r, waitMs));
  }
  const err: any = new Error("Rate limited after retries");
  err.status = 429;
  throw err;
}

async function callWithFallback(buildBody: (jsonMode: boolean) => any, jsonMode = true): Promise<string> {
  let lastError: any = new Error("All models failed");
  for (const model of MODELS_TO_TRY) {
    const url = geminiUrl(model);
    const body = buildBody(jsonMode);
    if (model.startsWith("gemma")) {
      delete body.system_instruction;
      if (body.generationConfig) delete body.generationConfig.responseMimeType;
    }
    try {
      const res = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status === 503) { console.warn(`Model ${model} rate limited, trying next...`); continue; }
      if (!res.ok) { console.warn(`Model ${model} error ${res.status}`); lastError = Object.assign(new Error(`AI error ${res.status}`), { status: res.status }); continue; }
      const data = await res.json();
      console.log(`Responded using model: ${model}`);
      return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    } catch (e: any) {
      console.warn(`Model ${model} threw: ${e.message}`);
      lastError = e;
    }
  }
  throw lastError;
}

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
  if (!GEMINI_API_KEY) return json(500, { error: "GEMINI_API_KEY is not configured in Supabase secrets" });

  try {
    const body = (await req.json()) as Body;

    let vehicle: { make: string; model: string; year: number; mileage: number; fuel_type: string | null } | null = null;
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
      vehicle = { make: body.make, model: body.model, year: body.year, mileage: body.mileage ?? 0, fuel_type: body.fuel_type ?? "Petrol" };
    } else {
      return json(400, { error: "Provide either vehicle_id or {make, model, year}" });
    }

    const { data: services } = await admin.from("services").select("id, name, category, price").eq("active", true);
    const catalog = (services ?? []).map((s: any) => `${s.name} [${s.category}] Rs.${s.price}`).join("\n");

    const userPrompt = [
      "Vehicle profile:",
      `- ${vehicle!.year} ${vehicle!.make} ${vehicle!.model} (${vehicle!.fuel_type ?? "Petrol"})`,
      `- Current mileage: ${vehicle!.mileage} km`,
      `- Recent services: ${recentServiceNames.length ? recentServiceNames.join(", ") : "none recorded"}`,
      "",
      "Available services in our catalogue:",
      catalog,
      "",
      "Return JSON with these exact fields:",
      '{ "tips": ["3 short actionable maintenance tips"], "recommended_service_names": ["1-3 service names from catalogue"] }',
      "",
      "Rules: recommended_service_names MUST be exact names from catalogue. For EVs, never recommend oil/spark plug services.",
    ].join("\n");

    const sysPrompt = "You are an expert automotive maintenance advisor for Indian car owners. Reply with valid JSON only, no preamble.";

    try {
      const raw = await callWithFallback((jsonMode) => ({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        ...(jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
      }), true);

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
    } catch (e: any) {
      if (e.status === 429) return json(429, { error: "All AI models are rate limited. Please try again in a moment." });
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
