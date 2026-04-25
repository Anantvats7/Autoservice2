// Generates an AI-written maintenance summary for a vehicle from its service history.
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
      return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } catch (e: any) {
      console.warn(`Model ${model} threw: ${e.message}`);
      lastError = e;
    }
  }
  throw lastError;
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!GEMINI_API_KEY) return json(500, { error: "GEMINI_API_KEY is not configured in Supabase secrets" });

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
      return `- ${date} | ${h.service ?? "Service"} | ${h.mileage_at_service ?? "?"} km | Rs.${h.cost ?? "?"} | Notes: ${h.notes ?? "-"} | Parts: ${h.parts_used ?? "-"}`;
    }).join("\n");

    const userPrompt = [
      `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.fuel_type ?? "Petrol"})`,
      `Registration: ${vehicle.registration ?? "-"}, Odometer: ${vehicle.mileage ?? "?"} km`,
      currentService ? `Today's job: ${currentService}` : "",
      "",
      "Service history (most recent first):",
      histLines || "No prior service history.",
      "",
      "Write a concise 4-6 line technician briefing covering:",
      "1. Overall maintenance state",
      "2. Recurring issues or patterns",
      "3. Items likely due based on mileage/time",
      "4. One specific check to prioritise today",
      "Use plain paragraphs only. Address the technician, not the customer.",
    ].join("\n");

    const sysPrompt = "You are a senior automotive service advisor. Be concise, technical and actionable.";

    try {
      const summary = await callWithFallback((_jsonMode) => ({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      }), false);

      return json(200, { summary: summary || "Unable to generate summary." });
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
