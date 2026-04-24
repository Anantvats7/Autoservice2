// Estimates resale value of a vehicle using Gemini AI, calibrated to Indian used-car market.
// Body: { vehicle: { make, model, year, mileage, fuel_type }, condition }
//    or flat { make, model, year, mileage, fuel_type, condition }
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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

    const userPrompt = `Estimate the current 2025 resale value (in INR) of this car in the Indian used-car market (Gurugram/NCR):

- Make: ${make}
- Model: ${model}
- Year: ${year}
- Mileage: ${mileage ?? "unknown"} km
- Fuel: ${fuel_type ?? "Petrol"}
- Condition: ${condition}

Return STRICT JSON in this exact shape:
{
  "estimated_value": <integer rupees>,
  "base_value": <integer rupees, ex-showroom equivalent today>,
  "trend_pct": <number, recent 6-month price trend %, can be negative>,
  "confidence": <integer 0-100>,
  "insights": ["3 short positive market insights"],
  "warnings": ["1-2 short risks or caveats"],
  "depreciation": [
    { "months": 0, "value": <integer = estimated_value> },
    { "months": 6, "value": <integer> },
    { "months": 12, "value": <integer> },
    { "months": 24, "value": <integer> },
    { "months": 36, "value": <integer> }
  ]
}

Use realistic Indian used-car dealer prices (CarDekho / OLX / Cars24 averages). Be conservative.`;

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: "You are an automotive valuation expert specialising in the Indian used-car market. Output valid JSON only, matching the requested schema exactly." }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (res.status === 429) return json(429, { error: "Rate limited" });
    if (!res.ok) {
      const text = await res.text();
      console.error("Gemini error", res.status, text);
      return json(500, { error: `AI error ${res.status}` });
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
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
      const annualDep = 0.12;
      depreciation = [0, 6, 12, 24, 36].map((m) => ({
        months: m,
        value: Math.round(estimated_value * Math.pow(1 - annualDep, m / 12)),
      }));
    }

    return json(200, { estimated_value, base_value, trend_pct, confidence, insights, warnings, depreciation });
  } catch (e) {
    console.error(e);
    return json(500, { error: String(e) });
  }
});

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
