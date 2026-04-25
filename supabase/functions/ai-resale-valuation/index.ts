// Estimates resale value of a vehicle using Gemini AI, calibrated to Indian used-car market.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!GEMINI_API_KEY) return json(500, { error: "GEMINI_API_KEY is not configured in Supabase secrets" });

  try {
    const body = await req.json();
    const v = body.vehicle ?? body;
    const make = v.make;
    const model = v.model;
    const year = v.year;
    const mileage = v.mileage;
    const fuel_type = v.fuel_type;
    const condition = body.condition ?? v.condition ?? "Good";

    if (!make || !model || !year) return json(400, { error: "make, model, year required" });

    const userPrompt = [
      "Estimate the current 2025 resale value (in INR) of this car in the Indian used-car market (Gurugram/NCR):",
      `Make: ${make}, Model: ${model}, Year: ${year}, Mileage: ${mileage ?? "unknown"} km, Fuel: ${fuel_type ?? "Petrol"}, Condition: ${condition}`,
      "",
      "Return STRICT JSON:",
      '{ "estimated_value": <int>, "base_value": <int>, "trend_pct": <number>, "confidence": <int 0-100>, "insights": ["3 insights"], "warnings": ["1-2 warnings"], "depreciation": [{ "months": 0, "value": <int> }, { "months": 6, "value": <int> }, { "months": 12, "value": <int> }, { "months": 24, "value": <int> }, { "months": 36, "value": <int> }] }',
      "",
      "Use realistic Indian used-car dealer prices (CarDekho/OLX/Cars24 averages). Be conservative.",
    ].join("\n");

    const sysPrompt = "You are an automotive valuation expert specialising in the Indian used-car market. Output valid JSON only, matching the requested schema exactly.";

    try {
      const raw = await callWithFallback((jsonMode) => ({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        ...(jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
      }), true);

      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { return json(500, { error: "Invalid AI response" }); }

      const estimated_value = Math.round(Number(parsed.estimated_value ?? 0));
      const base_value = Math.round(Number(parsed.base_value ?? estimated_value * 1.05));
      const trend_pct = Number(parsed.trend_pct ?? 0);
      const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence ?? 75))));
      const insights = Array.isArray(parsed.insights) ? parsed.insights.map(String) : [];
      const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [];

      let depreciation: Array<{ months: number; value: number }> = [];
      if (Array.isArray(parsed.depreciation) && parsed.depreciation.length > 0) {
        depreciation = parsed.depreciation.map((d: any) => ({
          months: Math.max(0, Math.round(Number(d.months ?? 0))),
          value: Math.max(0, Math.round(Number(d.value ?? 0))),
        }));
      } else {
        depreciation = [0, 6, 12, 24, 36].map((m) => ({
          months: m,
          value: Math.round(estimated_value * Math.pow(1 - 0.12, m / 12)),
        }));
      }

      return json(200, { estimated_value, base_value, trend_pct, confidence, insights, warnings, depreciation });
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
